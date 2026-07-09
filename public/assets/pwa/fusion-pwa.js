(() => {
  const path = location.pathname;
  const isAluno = path.includes('/portal-aluno') || path.includes('/treinos-v3-aluno');
  const isBiblioteca = path.includes('/biblioteca-inteligente') || path.includes('/exercicios');
  const app = isAluno ? 'aluno' : isBiblioteca ? 'biblioteca' : 'sistema';
  const colors = { aluno:'#16a34a', sistema:'#ff6600', biblioteca:'#dc2626' };
  const names = { aluno:'Fusion Aluno', sistema:'Fusion ERP', biblioteca:'Fusion Biblioteca' };
  document.documentElement.style.setProperty('--fusion-pwa-color', colors[app] || colors.sistema);
  document.documentElement.classList.add('fusion-pwa-ready', `fusion-pwa-${app}`);

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/fusion-sw.js', { scope:'/' }).catch(() => {}));
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    deferredPrompt = ev;
    if (!standalone) showInstallBanner();
  });

  function showInstallBanner(){
    if (standalone || document.querySelector('.fusion-pwa-banner')) return;
    const el = document.createElement('div');
    el.className = 'fusion-pwa-banner';
    el.innerHTML = `<div><strong>Instalar ${names[app]}</strong><span>Cria um ícone na tela inicial e abre em tela cheia.</span></div><button type="button">Instalar</button>`;
    el.querySelector('button').addEventListener('click', async () => {
      el.remove();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;
    });
    document.body.appendChild(el);
  }

  function showIOSHint(){
    if (!isIOS || standalone || document.querySelector('.fusion-ios-hint')) return;
    const key = `fusion_ios_hint_${app}_274`;
    if (localStorage.getItem(key)) return;
    const el = document.createElement('div');
    el.className = 'fusion-ios-hint';
    el.innerHTML = '<button type="button">OK</button><span><strong>iPhone/iPad:</strong> toque em Compartilhar e depois em “Adicionar à Tela de Início”.</span>';
    el.querySelector('button').addEventListener('click', () => { localStorage.setItem(key, '1'); el.remove(); });
    document.body.appendChild(el);
  }

  window.addEventListener('load', () => setTimeout(showIOSHint, 700));
})();
