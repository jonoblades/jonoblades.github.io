import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cacheName = 'jonoblades-v2';

function createCache() {
  const entries = new Map();
  return {
    addAll: vi.fn(async (requests) => {
      requests.forEach((request) => entries.set(String(request), new Response('shell')));
    }),
    match: vi.fn(async (request) => entries.get(typeof request === 'string' ? request : request.url)),
    put: vi.fn(async (request, response) => { entries.set(request.url, response); }),
    entries
  };
}

async function loadWorker(hostname = 'example.test') {
  const listeners = new Map();
  const cache = createCache();
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => [cacheName, 'jonoblades-v1', 'unrelated-cache']),
    delete: vi.fn(async () => true)
  };
  const serviceWorker = {
    location: { hostname, origin: `https://${hostname}` },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener))
  };
  vi.stubGlobal('self', serviceWorker);
  vi.stubGlobal('caches', caches);
  const module = await import('../../src/site/service-worker.js');
  return { cache, caches, listeners, serviceWorker, module };
}

async function dispatchFetch(listener, request) {
  const event = { request, respondWith: vi.fn() };
  listener(event);
  return event.respondWith.mock.calls[0]?.[0];
}

function createRequest(url, { method = 'GET', mode = '', destination = '' } = {}) {
  return { url, method, mode, destination };
}

describe('service worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pre-caches the app shell on install and removes old caches on activation', async () => {
    const { cache, caches, listeners, serviceWorker } = await loadWorker();
    const installEvent = { waitUntil: vi.fn() };
    listeners.get('install')(installEvent);
    await installEvent.waitUntil.mock.calls[0][0];
    expect(cache.addAll).toHaveBeenCalledWith(expect.arrayContaining(['/offline.html', '/scripts/index.js']));
    expect(serviceWorker.skipWaiting).toHaveBeenCalled();

    const activateEvent = { waitUntil: vi.fn() };
    listeners.get('activate')(activateEvent);
    await activateEvent.waitUntil.mock.calls[0][0];
    expect(caches.delete).toHaveBeenCalledWith('jonoblades-v1');
    expect(caches.delete).not.toHaveBeenCalledWith(cacheName);
    expect(serviceWorker.clients.claim).toHaveBeenCalled();
  });

  it('uses network-first for navigation and falls back to the offline page', async () => {
    const { cache, listeners } = await loadWorker();
    cache.entries.set('https://example.test/page', new Response('cached page'));
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const responsePromise = await dispatchFetch(listeners.get('fetch'), createRequest('https://example.test/page', { mode: 'navigate' }));
    expect((await responsePromise).status).toBe(200);
    expect(await (await responsePromise).text()).toBe('cached page');

    cache.entries.delete('/page');
    cache.entries.set('/offline.html', new Response('offline page'));
    const fallback = await dispatchFetch(listeners.get('fetch'), createRequest('https://example.test/missing', { mode: 'navigate' }));
    expect(await (await fallback).text()).toBe('offline page');
  });

  it('returns a service-unavailable response when network and offline fallback fail', async () => {
    const { listeners } = await loadWorker();
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const response = await dispatchFetch(listeners.get('fetch'), createRequest('https://example.test/data'));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('You appear to be offline.');
  });

  it('caches successful network-first responses and leaves failed responses uncached', async () => {
    const { cache, listeners } = await loadWorker();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('fresh'));
    const request = createRequest('https://example.test/data');
    const response = await dispatchFetch(listeners.get('fetch'), request);
    expect(await response.text()).toBe('fresh');
    expect(fetch).toHaveBeenCalledWith(request, { cache: 'no-cache' });
    expect(cache.entries.get(request.url)).toBeDefined();

    vi.mocked(fetch).mockResolvedValueOnce(new Response('missing', { status: 404 }));
    await dispatchFetch(listeners.get('fetch'), createRequest('https://example.test/missing'));
    expect(cache.entries.has('https://example.test/missing')).toBe(false);
  });

  it('serves cached images first and fetches and caches image misses', async () => {
    const { cache, listeners } = await loadWorker();
    const cachedImage = new Response('cached image');
    cache.entries.set('https://example.test/image.png', cachedImage);
    const request = createRequest('https://example.test/image.png', { destination: 'image' });
    const cachedResponse = await dispatchFetch(listeners.get('fetch'), request);
    expect(await cachedResponse.text()).toBe('cached image');
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockResolvedValue(new Response('new image'));
    const missingRequest = createRequest('https://example.test/new.png', { destination: 'image' });
    const response = await dispatchFetch(listeners.get('fetch'), missingRequest);
    expect(await response.text()).toBe('new image');
    expect(cache.entries.has(missingRequest.url)).toBe(true);
  });

  it('returns 503 when a cache-first request cannot reach the network', async () => {
    const { listeners } = await loadWorker();
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const response = await dispatchFetch(listeners.get('fetch'), createRequest('https://example.test/font.woff2', { destination: 'font' }));
    expect(response.status).toBe(503);
  });

  it('bypasses HTTP cache on localhost and ignores non-GET and cross-origin requests', async () => {
    const { listeners } = await loadWorker('localhost');
    const ignoredMethod = await dispatchFetch(listeners.get('fetch'), createRequest('https://localhost/write', { method: 'POST' }));
    const ignoredOrigin = await dispatchFetch(listeners.get('fetch'), createRequest('https://other.test/data'));
    expect(ignoredMethod).toBeUndefined();
    expect(ignoredOrigin).toBeUndefined();

    vi.mocked(fetch).mockResolvedValue(new Response('local'));
    const request = createRequest('https://localhost/app.js', { destination: 'script' });
    await dispatchFetch(listeners.get('fetch'), request);
    expect(fetch).toHaveBeenCalledWith(request, { cache: 'no-store' });
  });
});