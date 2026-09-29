const CACHE_VERSION = 'v2';
const CACHE_NAME = `jonoblades-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

const APP_SHELL = [
  '/',
  OFFLINE_PAGE,
  '/site.webmanifest',
  '/styles/styles.css',
  '/styles/vars.css',
  '/scripts/index.js',
  '/scripts/Main.js',
  '/scripts/BaseClass.js',
  '/scripts/Enhancements.js',
  '/scripts/Settings.js',
  '/scripts/DefinitionsService.js',
  '/assets/icons/favicon-256x256.png',
  '/assets/icons/favicon-512x512.png'
];

const IS_LOCAL =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(
              cacheName =>
                cacheName.startsWith('jonoblades-') &&
                cacheName !== CACHE_NAME
            )
            .map(cacheName => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  /*
   * During local development, always try the network first.
   *
   * This keeps the service worker active and allows offline testing,
   * but prevents stale JavaScript and CSS being served while online.
   */
  if (IS_LOCAL) {
    event.respondWith(
      networkFirst(request, {
        bypassHttpCache: true,
        offlineFallback: request.mode === 'navigate'
      })
    );

    return;
  }

  /*
   * Page navigation:
   *
   * Use the latest page when online, falling back to the cached page
   * or offline page when the network is unavailable.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, {
        offlineFallback: true
      })
    );

    return;
  }

  /*
   * CSS, JavaScript and web workers:
   *
   * Prefer the network so that deployments are picked up immediately.
   * Fall back to the cached version while offline.
   */
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker'
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  /*
   * Images and fonts:
   *
   * These generally change less frequently, so serve them from the
   * cache first for faster loading.
   */
  if (
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /*
   * Everything else:
   *
   * Use network first so that JSON, manifests and other resources
   * remain current.
   */
  event.respondWith(networkFirst(request));
});

async function networkFirst(
  request,
  {
    bypassHttpCache = false,
    offlineFallback = false
  } = {}
) {
  try {
    const response = await fetch(request, {
      cache: bypassHttpCache ? 'no-store' : 'no-cache'
    });

    await cacheResponse(request, response);

    return response;
  } catch {
    const cachedResponse = await getCachedResponse(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (offlineFallback) {
      const offlineResponse = await getCachedResponse(OFFLINE_PAGE);

      if (offlineResponse) {
        return offlineResponse;
      }
    }

    return new Response('You appear to be offline.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

async function cacheFirst(request) {
  const cachedResponse = await getCachedResponse(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    await cacheResponse(request, response);

    return response;
  } catch {
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function getCachedResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}

async function cacheResponse(request, response) {
  if (!response || !response.ok) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}