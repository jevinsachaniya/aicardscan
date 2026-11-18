/**
 * CardScan Pro - High Reliability Network-First Service Worker
 * Ensures users always see the latest updated UI immediately while supporting offline fallback
 */

const CACHE_NAME = 'cardscan-pro-v3.4';
const ASSETS_TO_CACHE = [
  '/',
  '/static/style.css?v=3.4',
  '/static/app.js?v=3.4',
  '/static/manifest.json',
  '/static/favicon.svg',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for old worker to exit
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Purge all old versions of cache
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let API requests pass directly without caching
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Network-First Strategy: Fetch newest updates live from server
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Only if mobile device is offline, load from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
