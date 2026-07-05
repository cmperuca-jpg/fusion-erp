/* Fusion ERP 2.7.5 — PWA cache Portal do Aluno */
const FUSION_CACHE = 'fusion-erp-aluno-v275-a1g';
const CORE_ASSETS = [
  '/',
  '/pages/portal-aluno/',
  '/pages/portal-aluno/index.html',
  '/pages/portal-aluno/style.css',
  '/pages/portal-aluno/index.js',
  '/pages/treinos-v3-aluno/',
  '/pages/treinos-v3-aluno/index.html',
  '/pages/treinos-v3-aluno/style.css',
  '/pages/treinos-v3-aluno/index.js',
  '/assets/pwa/fusion-pwa-mobile.css',
  '/assets/pwa/fusion-pwa-install.js',
  '/manifest-aluno.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(FUSION_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS.map(url => new Request(url, { cache: 'reload' }))).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== FUSION_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isTreinoAlunoRequest(url){
  return url.pathname.includes('/pages/portal-aluno') ||
    url.pathname.includes('/pages/treinos-v3-aluno') ||
    url.pathname.includes('/assets/exercises') ||
    url.pathname.includes('/assets/pwa') ||
    url.pathname === '/manifest-aluno.webmanifest';
}

function isTreinoApi(url){
  return url.pathname.includes('/api/treinos-operacional/portal/alunos/') ||
    url.pathname.includes('/api/exercicios-biblioteca') ||
    url.pathname.includes('/api/treinos-integrado');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(isTreinoApi(url)){
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(FUSION_CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if(isTreinoAlunoRequest(url)){
    event.respondWith(
      caches.match(req).then(cached => {
        const rede = fetch(req).then(resp => {
          const copy = resp.clone();
          caches.open(FUSION_CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          return resp;
        }).catch(() => cached);
        return cached || rede;
      })
    );
  }
});
