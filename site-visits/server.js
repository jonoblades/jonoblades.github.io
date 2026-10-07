import { createDashboardService } from './dashboard-service.js';

const pollIntervalMilliseconds = 15 * 60 * 1000;
const maximumClients = 64;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export class Dashboard {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.pendingRefresh = undefined;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.state = await ctx.storage.get('dashboardState')
        ?? { lastAttemptAt: null, payload: null };
    });
  }

  clients() {
    return this.ctx.getWebSockets().filter((socket) => socket.readyState === 1);
  }

  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/dashboard') {
      return jsonResponse(this.state.payload ?? { error: 'No dashboard snapshot is available yet.' },
        this.state.payload && !this.state.payload.error ? 200 : 503);
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse({ error: 'A WebSocket connection is required.' }, 426);
    }
    if (!this.env.GOATCOUNTER_API_BASE_URL || !this.env.GOATCOUNTER_API_TOKEN) {
      return jsonResponse({ error: 'Dashboard upstream credentials are not configured.' }, 503);
    }
    if (this.clients().length >= maximumClients) {
      return jsonResponse({ error: 'Dashboard connection limit reached.' }, 503);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(this.state.payload ?? { status: 'Loading dashboard...' }));
    this.ctx.waitUntil(this.refreshIfDue());
    return new Response(null, { status: 101, webSocket: client });
  }

  refreshIfDue() {
    this.pendingRefresh ??= this.refresh()
      .finally(() => { this.pendingRefresh = undefined; });
    return this.pendingRefresh;
  }

  async refresh() {
    if (this.clients().length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const now = Date.now();
    const nextAttemptAt = this.state.lastAttemptAt == null
      ? now : this.state.lastAttemptAt + pollIntervalMilliseconds;
    if (now < nextAttemptAt) {
      await this.ctx.storage.setAlarm(nextAttemptAt);
      return;
    }

    this.state.lastAttemptAt = now;
    await this.ctx.storage.put('dashboardState', { ...this.state });
    await this.ctx.storage.setAlarm(now + pollIntervalMilliseconds);
    const service = createDashboardService({
      apiBaseUrl: this.env.GOATCOUNTER_API_BASE_URL,
      apiToken: this.env.GOATCOUNTER_API_TOKEN,
      cacheTtlMilliseconds: 0,
      initialDashboard: this.state.payload,
      requestIntervalMilliseconds: 350,
      requestTimeoutMilliseconds: 10000,
      rowLimit: 10
    });
    try {
      this.state.payload = await service.getDashboard();
    } catch {
      this.state.payload = {
        error: 'Unable to reach the GoatCounter API.',
        lastAttemptAt: new Date(now).toISOString()
      };
    }
    await this.ctx.storage.put('dashboardState', { ...this.state });

    const message = JSON.stringify(this.state.payload);
    for (const socket of this.clients()) {
      try {
        socket.send(message);
      } catch {
        socket.close(1011, 'Unable to send dashboard update.');
      }
    }
    if (this.clients().length === 0) {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async alarm() {
    await this.refreshIfDue();
  }

  async webSocketClose(socket, code) {
    socket.close([1005, 1006, 1015].includes(code) ? 1000 : code);
    if (this.clients().length === 0) {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async webSocketError(socket) {
    await this.webSocketClose(socket, 1011);
  }

  async webSocketMessage(socket) {
    await this.webSocketClose(socket, 1008);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.DASHBOARD_ORIGIN || 'https://jonoblades.github.io';
    if (origin && origin !== allowedOrigin) {
      return jsonResponse({ error: 'Dashboard origin is not allowed.' }, 403);
    }
    const pathname = new URL(request.url).pathname;
    if (!['/api/dashboard', '/api/dashboard/events'].includes(pathname)) {
      return jsonResponse({ error: 'Not found.' }, 404);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          Vary: 'Origin'
        }
      });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }
    const response = await env.DASHBOARD.getByName('public-dashboard').fetch(request);
    if (response.status === 101) {
      return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');
    return new Response(response.body, { status: response.status, headers });
  }
};