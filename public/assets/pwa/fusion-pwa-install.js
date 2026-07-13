(() => {
  const path = location.pathname.replace(/\/index\.html$/, "/");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");

  const APPS = {
    aluno: {
      enabled: path.includes("/pages/aluno-login/") || path.includes("/pages/aluno-treinos/"),
      name: "Fusion Aluno",
      color: "#16a34a",
      sw: "/fusion-sw-aluno.js",
      scope: "/pages/",
      dismissKey: "fusion_pwa_aluno_recusado_v280"
    },
    professor: {
      enabled: path.includes("/pages/professor-area/"),
      name: "Fusion Professor",
      color: "#2563eb",
      sw: "/fusion-sw-professor.js",
      scope: "/pages/",
      dismissKey: "fusion_pwa_professor_recusado_v280"
    },
    sistema: {
      enabled: path.includes("/pages/login/") || path.includes("/pages/dashboard/") || path.includes("/pages/admin/"),
      name: "Fusion ERP",
      color: "#ff6600",
      sw: "/fusion-sw-sistema.js",
      scope: "/",
      dismissKey: "fusion_pwa_sistema_recusado_v280"
    }
  };

  const app = Object.values(APPS).find(item => item.enabled);
  if (!app || standalone) return;

  const style = document.createElement("style");
  style.textContent = `
    .fusion-pwa-banner,.fusion-ios-hint{position:fixed;left:14px;right:14px;bottom:14px;z-index:99999;background:#111827;color:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:12px;display:flex;align-items:center;gap:10px;max-width:620px;margin:auto;font-family:Arial,Helvetica,sans-serif}
    .fusion-pwa-banner div{display:grid;gap:3px;flex:1}.fusion-pwa-banner span,.fusion-ios-hint span{font-size:13px;color:#d1d5db}.fusion-pwa-banner button,.fusion-ios-hint button{border:0;border-radius:10px;padding:9px 11px;font-weight:800;cursor:pointer}.fusion-pwa-banner [data-pwa-install]{background:var(--fusion-pwa-color,#ff6600);color:#fff}.fusion-pwa-banner [data-pwa-close],.fusion-ios-hint button{background:#e5e7eb;color:#111827}@media(max-width:560px){.fusion-pwa-banner{align-items:stretch;display:grid}.fusion-pwa-banner button{width:100%}}
  `;
  document.head.appendChild(style);

  document.documentElement.style.setProperty("--fusion-pwa-color", app.color);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(app.sw, { scope: app.scope }).catch(() => {});
    });
  }

  function foiRecusado() {
    return localStorage.getItem(app.dismissKey) === "1";
  }

  function marcarRecusado() {
    localStorage.setItem(app.dismissKey, "1");
  }

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    if (!foiRecusado()) mostrarBanner();
  });

  function mostrarBanner() {
    if (foiRecusado() || document.querySelector(".fusion-pwa-banner")) return;

    const el = document.createElement("div");
    el.className = "fusion-pwa-banner";
    el.innerHTML = `
      <div>
        <strong>Instalar ${app.name}</strong>
        <span>Opcional. Você pode continuar usando pelo navegador.</span>
      </div>
      <button type="button" data-pwa-install>Instalar</button>
      <button type="button" data-pwa-close aria-label="Fechar">Agora não</button>
    `;

    el.querySelector("[data-pwa-close]").addEventListener("click", () => {
      marcarRecusado();
      el.remove();
    });

    el.querySelector("[data-pwa-install]").addEventListener("click", async () => {
      el.remove();
      if (!deferredPrompt) {
        marcarRecusado();
        return;
      }

      deferredPrompt.prompt();
      const escolha = await deferredPrompt.userChoice.catch(() => null);
      if (!escolha || escolha.outcome !== "accepted") marcarRecusado();
      deferredPrompt = null;
    });

    document.body.appendChild(el);
  }

  function mostrarDicaIOS() {
    if (!isIOS || foiRecusado() || document.querySelector(".fusion-ios-hint")) return;

    const el = document.createElement("div");
    el.className = "fusion-ios-hint";
    el.innerHTML = `
      <button type="button">OK</button>
      <span><strong>Instalação opcional:</strong> no iPhone/iPad, use Compartilhar e Adicionar à Tela de Início.</span>
    `;
    el.querySelector("button").addEventListener("click", () => {
      marcarRecusado();
      el.remove();
    });
    document.body.appendChild(el);
  }

  window.addEventListener("load", () => setTimeout(mostrarDicaIOS, 800));
})();
