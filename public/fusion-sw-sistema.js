const CACHE = 'fusion-sistema-v281-scroll';
const CACHE_PREFIX = 'fusion-sistema-';
const ALLOWED = [
  '/pages/login/',
  '/pages/dashboard/',
  '/pages/admin/',
  '/manifest-sistema.webmanifest',
  '/assets/pwa/fusion-pwa-mobile.css',
  '/assets/pwa/fusion-pwa-install.js',
  '/assets/css/fusion-mobile-final.css',
  '/assets/js/fusion-mobile-final.js'
];

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!ALLOWED.some(p => url.pathname.startsWith(p) || url.pathname === p)) return;

  event.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
