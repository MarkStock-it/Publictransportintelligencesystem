const VERSION = 'largo-static-v2';

function getBasePath() {
  const path = new URL(self.location.href).pathname;
  return path.endsWith('/sw.js') ? path.slice(0, -'/sw.js'.length) || '/' : '/';
}

const BASE_PATH = getBasePath();
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH.replace(/\/$/, '')}/index.html`,
  `${BASE_PATH.replace(/\/$/, '')}/manifest.webmanifest`,
];

function isAppNavigationRequest(request) {
  return request.mode === 'navigate';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          if (response.ok) {
            void caches.open(VERSION).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => {
          if (isAppNavigationRequest(event.request)) {
            return caches.match(`${BASE_PATH.replace(/\/$/, '')}/index.html`);
          }

          return Response.error();
        }),
    }),
  );
});