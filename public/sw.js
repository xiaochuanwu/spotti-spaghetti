const CACHE_VERSION = 'spotti-spaghetti-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

const CACHEABLE_DESTINATIONS = new Set([
  'font',
  'image',
  'manifest',
  'script',
  'style',
  'worker',
]);

const isSameOrigin = (requestUrl) => requestUrl.origin === self.location.origin;

const isCacheableRequest = (request) => {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return false;
  if (url.pathname.startsWith('/api/')) return false;

  return request.mode === 'navigate' || CACHEABLE_DESTINATIONS.has(request.destination);
};

const trimRuntimeCache = async (maxEntries = 80) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  const extraKeys = keys.slice(0, Math.max(0, keys.length - maxEntries));
  await Promise.all(extraKeys.map((key) => cache.delete(key)));
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => {
            cache.put('/index.html', responseCopy);
          });
          return response;
        })
        .catch(async () => (
          caches.match('/index.html') || caches.match('/')
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseCopy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseCopy).then(() => trimRuntimeCache());
        });
        return response;
      });
    })
  );
});
