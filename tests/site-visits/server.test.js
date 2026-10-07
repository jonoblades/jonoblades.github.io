import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { Dashboard } from '../../site-visits/server.js';

const pollIntervalMilliseconds = 15 * 60 * 1000;

const upstream = { GOATCOUNTER_API_BASE_URL: 'https://example.test/api/', GOATCOUNTER_API_TOKEN: 'test' };

function createContext(storage, sockets = []) {
  return {
    storage,
    getWebSockets: () => sockets,
    setWebSocketAutoResponse: vi.fn(),
    blockConcurrencyWhile(callback) { this.ready = callback(); }
  };
}

function createStorage() {
  const records = new Map();
  return {
    get: vi.fn(async (key) => structuredClone(records.get(key))),
    put: vi.fn(async (key, value) => { records.set(key, structuredClone(value)); }),
    setAlarm: vi.fn(async () => {}),
    deleteAlarm: vi.fn(async () => {})
  };
}

function createSocket() {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(function close() { this.readyState = 3; })
  };
}

describe('dashboard Durable Object', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    vi.stubGlobal('WebSocketRequestResponsePair', class {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ count: 1 }] }))));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shares one batch across concurrent clients and persists the throttle before fetching', async () => {
    const storage = createStorage();
    const socket = createSocket();
    const ctx = createContext(storage, [socket, createSocket()]);
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    const first = object.refreshIfDue();
    const second = object.refreshIfDue();
    expect(first).toBe(second);
    await vi.runAllTimersAsync();
    await first;
    expect(fetch).toHaveBeenCalledTimes(9);
    expect(storage.put.mock.calls[0][1].lastAttemptAt).toBe(Date.parse('2026-10-07T12:00:00Z'));
    expect(storage.put.mock.calls[0][1].payload).toBeNull();
    expect(socket.send).toHaveBeenCalledTimes(1);

    const restartedContext = createContext(storage, [createSocket()]);
    const restarted = new Dashboard(restartedContext, upstream);
    await restartedContext.ready;
    await restarted.alarm();
    expect(fetch).toHaveBeenCalledTimes(9);
    expect(storage.setAlarm).toHaveBeenLastCalledWith(Date.parse('2026-10-07T12:00:00Z') + pollIntervalMilliseconds);
    expect(restarted.state.payload.reportMetadata.hits).toBeDefined();
  });

  it('makes no requests without clients and cancels the alarm after the last disconnect', async () => {
    const storage = createStorage();
    const socket = createSocket();
    const ctx = createContext(storage, [socket]);
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    await object.webSocketClose(socket, 1000);
    await object.alarm();
    expect(storage.deleteAlarm).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes reserved close codes after an abrupt network disconnect', async () => {
    const storage = createStorage();
    const socket = createSocket();
    const ctx = createContext(storage, [socket]);
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    await object.webSocketClose(socket, 1006);
    expect(socket.close).toHaveBeenCalledWith(1000);
    expect(storage.deleteAlarm).toHaveBeenCalled();
  });

  it('finishes a running refresh after the last client leaves without scheduling more work', async () => {
    const storage = createStorage();
    const socket = createSocket();
    const ctx = createContext(storage, [socket]);
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    const refresh = object.refreshIfDue();
    await vi.advanceTimersByTimeAsync(1);
    await object.webSocketClose(socket, 1000);
    await vi.runAllTimersAsync();
    await refresh;
    expect(fetch).toHaveBeenCalledTimes(9);
    expect(object.state.payload.data.hits).toBeDefined();
    expect(storage.deleteAlarm).toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('throttles failed initial attempts across recreation and refreshes once due', async () => {
    fetch.mockResolvedValue(new Response('', { status: 503 }));
    const storage = createStorage();
    const ctx = createContext(storage, [createSocket()]);
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    const failed = object.alarm();
    await vi.runAllTimersAsync();
    await failed;
    expect(object.state.payload.error).toContain('GoatCounter');
    const nextContext = createContext(storage, [createSocket()]);
    const next = new Dashboard(nextContext, upstream);
    await nextContext.ready;
    await next.alarm();
    expect(fetch).toHaveBeenCalledTimes(9);
    await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
    fetch.mockImplementation(async () => new Response('{"items":[]}'));
    const retry = next.alarm();
    await vi.runAllTimersAsync();
    await retry;
    expect(fetch).toHaveBeenCalledTimes(18);
    expect(next.state.payload.error).toBeUndefined();
  });

  it('propagates storage quota errors without calling GoatCounter', async () => {
    const storage = createStorage();
    storage.put.mockRejectedValue(new Error('quota exceeded'));
    const ctx = createContext(storage, [createSocket()]);
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    await expect(object.alarm()).rejects.toThrow('quota exceeded');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bounds active connections without starting an upstream refresh', async () => {
    const ctx = createContext(createStorage(), Array.from({ length: 64 }, createSocket));
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    const response = await object.fetch(new Request('https://worker.test/api/dashboard/events', {
      headers: { Upgrade: 'websocket' }
    }));
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serves snapshot requests without creating demand for an upstream refresh', async () => {
    const ctx = createContext(createStorage());
    const object = new Dashboard(ctx, upstream);
    await ctx.ready;
    const response = await object.fetch(new Request('https://worker.test/api/dashboard'));
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('dashboard Worker routing', () => {
  it('uses one fixed object name and applies CORS to snapshot responses', async () => {
    const fetchObject = vi.fn(async () => new Response('{}'));
    const env = { DASHBOARD: { getByName: vi.fn(() => ({ fetch: fetchObject })) } };
    const response = await worker.fetch(new Request('https://worker.test/api/dashboard', {
      headers: { Origin: 'https://jonoblades.github.io' }
    }), env);
    expect(env.DASHBOARD.getByName).toHaveBeenCalledWith('public-dashboard');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://jonoblades.github.io');
  });

  it('rejects foreign browser origins without invoking the object', async () => {
    const response = await worker.fetch(new Request('https://worker.test/api/dashboard', {
      headers: { Origin: 'https://foreign.test' }
    }), {});
    expect(response.status).toBe(403);
  });

  it('rejects unknown paths and handles preflight without invoking the object', async () => {
    expect((await worker.fetch(new Request('https://worker.test/missing'), {})).status).toBe(404);
    expect((await worker.fetch(new Request('https://worker.test/api/dashboard', { method: 'OPTIONS' }), {})).status).toBe(204);
  });
});