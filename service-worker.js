const CACHE_VERSION = 'v1';
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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('jonoblades-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return cacheResponse(request, response);
  } catch {
    return (await caches.match(request)) || caches.match(OFFLINE_PAGE);
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  return cacheResponse(request, response);
}

async function cacheResponse(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}