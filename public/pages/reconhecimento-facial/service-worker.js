const CACHE="fusion-facial-terminal-v1";
const ARQUIVOS=["/pages/reconhecimento-facial/index.html","/pages/reconhecimento-facial/terminal-pwa.css","/pages/reconhecimento-facial/style.css","/pages/reconhecimento-facial/terminal.js","/pages/reconhecimento-facial/icon.svg"];
self.addEventListener("install",evento=>evento.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ARQUIVOS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",evento=>evento.waitUntil(caches.keys().then(chaves=>Promise.all(chaves.filter(chave=>chave!==CACHE).map(chave=>caches.delete(chave)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",evento=>{const url=new URL(evento.request.url);if(evento.request.method!=="GET"||url.pathname.startsWith("/api/"))return;evento.respondWith(fetch(evento.request).then(resposta=>{const copia=resposta.clone();caches.open(CACHE).then(cache=>cache.put(evento.request,copia));return resposta;}).catch(()=>caches.match(evento.request)));});
