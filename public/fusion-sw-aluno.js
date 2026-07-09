const CACHE = 'fusion-aluno-v280';
const ALLOWED = ['/pages/portal-aluno/', '/pages/aluno-login/', '/pages/treinos-v3-aluno/', '/manifest-aluno.webmanifest'];
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!ALLOWED.some(p => url.pathname.startsWith(p) || url.pathname === p)) return;
  event.respondWith(fetch(req).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
    return resp;
  }).catch(() => caches.match(req)));
});
