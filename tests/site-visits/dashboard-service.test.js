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

  it('derives accurate daily totals from complete hits when the total endpoint returns 404', async () => {
    const hits = {
      hits: [
        { count: 3, stats: [{ day: '2026-10-01', daily: 2 }, { day: '2026-10-02', daily: 1 }] },
        { count: 2, stats: [{ day: '2026-10-01', daily: 1 }, { day: '2026-10-02', daily: 1 }] }
      ],
      total: 5,
      more: false
    };
    const fetchImplementation = vi.fn(async (url) => {
      const name = new URL(url).pathname.split('/').at(-1);
      if (name === 'total') {
        return new Response('', { status: 404 });
      }
      if (name === 'hits') {
        return new Response(JSON.stringify(hits));
      }
      return successfulResponse(url);
    });
    const result = await createService(fetchImplementation).getDashboard();
    expect(fetchImplementation).toHaveBeenCalledTimes(9);
    expect(result.data.total.total).toBe(5);
    expect(result.data.total.stats).toHaveLength(30);
    expect(result.data.total.stats).toContainEqual({ day: '2026-10-01', daily: 3 });
    expect(result.data.total.stats).toContainEqual({ day: '2026-10-02', daily: 2 });
    expect(result.data.total.stats[0]).toEqual({ day: '2026-09-06', daily: 0 });
    expect(result.reportMetadata.total).toEqual({ ...result.reportMetadata.hits, source: 'hits' });
    expect(result.errors.total).toBeUndefined();
    expect(result.stale).toBe(false);
  });

  it.each([
    { hits: [], total: 20, more: true },
    { hits: [{ count: 2 }], total: 2, more: false },
    { hits: [null], total: 2, more: false },
    { hits: [{ stats: [null] }], total: 2, more: false },
    { hits: [{ stats: [{ day: '2026-08-01', daily: 2 }] }], total: 2, more: false },
    { hits: [{ stats: [{ day: '2026-10-01', daily: -1 }] }], total: -1, more: false },
    { hits: [{ stats: [{ day: '2026-10-01', daily: 1 }] }], total: 2, more: false }
  ])('does not invent totals from incomplete or inconsistent hits: %j', async (hits) => {
    const result = await createService(async (url) => {
      const name = new URL(url).pathname.split('/').at(-1);
      if (name === 'total') {
        return new Response('', { status: 404 });
      }
      return name === 'hits' ? new Response(JSON.stringify(hits)) : successfulResponse(url);
    }).getDashboard();
    expect(result.data.total).toBeNull();
    expect(result.reportMetadata.total).toBeUndefined();
    expect(result.errors.total).toContain('404');
    expect(result.stale).toBe(true);
  });

  it('derives an honest zero total from a complete empty hits report', async () => {
    const result = await createService(async (url) => new URL(url).pathname.endsWith('/total')
      ? new Response('', { status: 404 })
      : new Response(JSON.stringify({ hits: [], total: 0, more: false }))
    ).getDashboard();
    expect(result.data.total.total).toBe(0);
    expect(result.data.total.stats).toHaveLength(30);
    expect(result.data.total.stats.every((stat) => stat.daily === 0)).toBe(true);
    expect(result.errors.total).toBeUndefined();
  });

  it.each([401, 429, 503])('does not hide total-report HTTP %s failures behind the fallback', async (status) => {
    const result = await createService(async (url) => new URL(url).pathname.endsWith('/total')
      ? new Response('', { status })
      : new Response(JSON.stringify({ hits: [], total: 0, more: false }))
    ).getDashboard();
    expect(result.data.total).toBeNull();
    expect(result.errors.total).toContain(String(status));
    expect(result.stale).toBe(true);
  });

  it('retains the previous total and timestamp when current hits are paginated', async () => {
    const initialDashboard = await createService(successfulResponse).getDashboard();
    const result = await createService(async (url) => {
      const name = new URL(url).pathname.split('/').at(-1);
      if (name === 'total') {
        return new Response('', { status: 404 });
      }
      return name === 'hits'
        ? new Response(JSON.stringify({ hits: [], total: 20, more: true }))
        : successfulResponse(url);
    }, {
      initialDashboard,
      cacheTtlMilliseconds: 0,
      now: () => new Date('2026-10-06T12:00:00.000Z')
    }).getDashboard();
    expect(result.data.total).toEqual(initialDashboard.data.total);
    expect(result.reportMetadata.total).toEqual(initialDashboard.reportMetadata.total);
    expect(result.errors.total).toContain('404');
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