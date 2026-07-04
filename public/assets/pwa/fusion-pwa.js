
(() => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isAndroid = /android/i.test(navigator.userAgent || '');
  document.documentElement.classList.add(isIOS ? 'fusion-ios' : isAndroid ? 'fusion-android' : 'fusion-desktop');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/fusion-sw.js').catch(() => {}));
  }
  let promptEvent = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent = event;
    if (!isStandalone) showAndroidInstall();
  });
  function showAndroidInstall(){
    if (document.querySelector('.fusion-pwa-banner')) return;
    const el = document.createElement('div');
    el.className = 'fusion-pwa-banner show';
    el.innerHTML = '<div><strong>Instalar Fusion ERP</strong><span>Adicionar à tela inicial deste celular.</span></div><button type="button">Instalar</button>';
    el.querySelector('button').addEventListener('click', async () => {
      el.remove();
      if (promptEvent) { promptEvent.prompt(); await promptEvent.userChoice.catch(() => {}); promptEvent = null; }
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 12000);
  }
  function showIOSHint(){
    if (!isIOS || isStandalone || document.querySelector('.fusion-ios-hint')) return;
    const key = 'fusion_ios_hint_seen_v274';
    if (localStorage.getItem(key)) return;
    const el = document.createElement('div');
    el.className = 'fusion-ios-hint show';
    el.innerHTML = '<button type="button">OK</button><strong>iPhone/iPad:</strong> toque em Compartilhar e depois em “Adicionar à Tela de Início”.';
    el.querySelector('button').addEventListener('click', () => { localStorage.setItem(key, '1'); el.remove(); });
    document.body.appendChild(el);
    setTimeout(() => { localStorage.setItem(key, '1'); el.remove(); }, 14000);
  }
  window.addEventListener('load', showIOSHint);
})();
