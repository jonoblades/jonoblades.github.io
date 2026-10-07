import { describe, expect, it, vi } from 'vitest';
import {
  createDashboardService,
  dashboardReports
} from '../../src/server/dashboard-service.js';

function successfulResponse(url) {
  return new Response(JSON.stringify({
    items: [{ name: new URL(url).pathname, count: 1 }]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createService(fetchImplementation, options = {}) {
  return createDashboardService({
    apiBaseUrl: 'https://example.test/api/v0/stats/',
    apiToken: 'test-token',
    requestIntervalMilliseconds: 0,
    now: () => new Date('2026-10-05T12:00:00.000Z'),
    fetchImplementation,
    ...options
  });
}

describe('dashboard service', () => {
  it('collects each fixed dashboard report for one shared date range', async () => {
    const fetchImplementation = vi.fn(async (url) => successfulResponse(url));
    const service = createService(fetchImplementation);

    const dashboard = await service.getDashboard();

    expect(fetchImplementation).toHaveBeenCalledTimes(dashboardReports.length);
    expect(Object.keys(dashboard.data)).toEqual(dashboardReports);
    expect(dashboard.range).toEqual({
      start: '2026-09-06',
      end: '2026-10-05',
      label: 'Last 30 days'
    });

    const requestedReports = fetchImplementation.mock.calls.map(([url]) => {
      const requestedUrl = new URL(url);
      expect(requestedUrl.searchParams.get('start')).toBe('2026-09-06');
      expect(requestedUrl.searchParams.get('end')).toBe('2026-10-05');
      return requestedUrl.pathname.split('/').at(-1);
    });
    expect(requestedReports).toEqual(dashboardReports);
  });

  it('shares an in-flight refresh and serves the cached snapshot', async () => {
    const fetchImplementation = vi.fn(async (url) => successfulResponse(url));
    const service = createService(fetchImplementation);

    const [first, second] = await Promise.all([
      service.getDashboard(),
      service.getDashboard()
    ]);
    const third = await service.getDashboard();

    expect(fetchImplementation).toHaveBeenCalledTimes(dashboardReports.length);
    expect(first).toBe(second);
    expect(third).toBe(first);
  });

  it('returns the last complete snapshot as stale when a refresh fails', async () => {
    let succeeds = true;
    const fetchImplementation = vi.fn(async (url) => succeeds
      ? successfulResponse(url)
      : new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 })
    );
    const service = createService(fetchImplementation, { cacheTtlMilliseconds: 0 });

    const fresh = await service.getDashboard();
    succeeds = false;
    const stale = await service.getDashboard();

    expect(fresh.stale).toBe(false);
    expect(stale.stale).toBe(true);
    expect(stale.data).toEqual(fresh.data);
    expect(stale.reportMetadata).toEqual(fresh.reportMetadata);
  });

  it('restores per-report data and preserves its timestamp and range on partial failure', async () => {
    const initialDashboard = await createService(successfulResponse).getDashboard();
    const service = createService(async (url) => new URL(url).pathname.endsWith('/hits')
      ? new Response('', { status: 503 })
      : successfulResponse(url), {
      initialDashboard,
      cacheTtlMilliseconds: 0,
      now: () => new Date('2026-10-06T12:00:00.000Z')
    });

    const result = await service.getDashboard();

    expect(result.data.hits).toEqual(initialDashboard.data.hits);
    expect(result.reportMetadata.hits).toEqual(initialDashboard.reportMetadata.hits);
    expect(result.reportMetadata.total.updatedAt).toBe('2026-10-06T12:00:00.000Z');
    expect(result.reportMetadata.total.range.end).toBe('2026-10-06');
    expect(result.lastAttemptAt).toBe('2026-10-06T12:00:00.000Z');
    expect(result.errors.hits).toContain('503');
    expect(result.stale).toBe(true);
  });

  it('reports an initial total failure without inventing a successful snapshot', async () => {
    const service = createService(async () => new Response('', { status: 503 }));
    await expect(service.getDashboard()).rejects.toThrow('Unable to load');
  });

  it('supplies an abort deadline for upstream requests', async () => {
    const fetchImplementation = vi.fn(successfulResponse);
    await createService(fetchImplementation).getDashboard();
    expect(fetchImplementation.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('retains a report when its upstream request exceeds the deadline', async () => {
    const initialDashboard = await createService(successfulResponse).getDashboard();
    const service = createService((url, { signal }) => {
      if (!new URL(url).pathname.endsWith('/hits')) {
        return Promise.resolve(successfulResponse(url));
      }
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }, { initialDashboard, cacheTtlMilliseconds: 0, requestTimeoutMilliseconds: 5 });
    const result = await service.getDashboard();
    expect(result.errors.hits).toBeTruthy();
    expect(result.data.hits).toEqual(initialDashboard.data.hits);
    expect(result.reportMetadata.hits).toEqual(initialDashboard.reportMetadata.hits);
  });
});