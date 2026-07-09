// Fusion ERP 2.8.0 — Service Worker legado neutralizado.
// Mantido para limpar cache antigo do Portal do Aluno que foi registrado com escopo global.
const LEGACY_CACHE_ALLOWLIST = [];
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !LEGACY_CACHE_ALLOWLIST.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', () => {});
