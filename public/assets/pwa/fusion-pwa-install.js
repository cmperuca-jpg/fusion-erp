(() => {
  "use strict";

  const path = location.pathname.replace(/\/index\.html$/, "/");
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches === true ||
    window.navigator.standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const manifestPath = (() => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
    try { return new URL(href, location.href).pathname; }
    catch { return href; }
  })();

  const APPS = {
    aluno: {
      key: "aluno",
      enabled:
        /manifest-aluno\.webmanifest$/i.test(manifestPath) ||
        path.startsWith("/pages/aluno-"),
      name: "Fusion Aluno",
      color: "#16a34a",
      sw: "/fusion-sw-aluno.js",
      scope: "/pages/aluno-",
      dismissKey: "fusion_pwa_aluno_recusado_v282"
    },
    professor: {
      key: "professor",
      enabled:
        /manifest-professor\.webmanifest$/i.test(manifestPath) ||
        path.startsWith("/pages/professor-"),
      name: "Fusion Professor",
      color: "#2563eb",
      sw: "/fusion-sw-professor.js",
      scope: "/pages/professor-",
      dismissKey: "fusion_pwa_professor_recusado_v282"
    },
    sistema: {
      key: "sistema",
      enabled:
        /manifest-sistema\.webmanifest$/i.test(manifestPath) ||
        (path.startsWith("/pages/") &&
          !path.startsWith("/pages/aluno-") &&
          !path.startsWith("/pages/professor-")),
      name: "Fusion Sistema",
      color: "#22b8d2",
      sw: "/fusion-sw-sistema.js",
      scope: "/",
      dismissKey: "fusion_pwa_sistema_recusado_v282"
    }
  };

  const app =
    APPS.aluno.enabled ? APPS.aluno :
    APPS.professor.enabled ? APPS.professor :
    APPS.sistema.enabled ? APPS.sistema :
    null;

  if (!app) return;

  document.documentElement.dataset.fusionPwaApp = app.key;
  document.documentElement.style.setProperty("--fusion-pwa-color", app.color);

  function scriptDaRegistration(reg) {
    return (
      reg?.active?.scriptURL ||
      reg?.waiting?.scriptURL ||
      reg?.installing?.scriptURL ||
      ""
    );
  }

  async function removerRegistrosLegados() {
    if (!("serviceWorker" in navigator)) return;

    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async reg => {
        const scopePath = (() => {
          try { return new URL(reg.scope).pathname; }
          catch { return ""; }
        })();

        const scriptPath = (() => {
          try { return new URL(scriptDaRegistration(reg), location.href).pathname; }
          catch { return scriptDaRegistration(reg); }
        })();

        const swAlunoProfessorLegado =
          scopePath === "/pages/" &&
          /\/fusion-sw-(aluno|professor)\.js$/i.test(scriptPath);

        const swGenericoLegado =
          scopePath === "/" &&
          /\/fusion-sw\.js$/i.test(scriptPath);

        if (swAlunoProfessorLegado || swGenericoLegado) {
          await reg.unregister().catch(() => false);
        }
      }));
    } catch (_) {}
  }

  async function registrarAtualizarSW() {
    if (!("serviceWorker" in navigator)) return;

    await removerRegistrosLegados();

    try {
      const reg = await navigator.serviceWorker.register(app.sw, { scope: app.scope });
      await reg.update().catch(() => {});
    } catch (_) {}
  }

  /*
   * No Sistema, o menu superior novo não usa fusion-menu-open.
   * Se essa classe antiga sobreviver ao bfcache/retorno do PWA, o CSS legado
   * pode aplicar touch-action:none e bloquear o gesto de um dedo.
   */
  function liberarRolagemSistema() {
    if (app.key !== "sistema") return;

    const html = document.documentElement;
    const body = document.body;
    [html, body].filter(Boolean).forEach(el => {
      el.classList.remove("fusion-menu-open", "fusion-ui-menu-open");
      el.style.removeProperty("overflow");
      el.style.removeProperty("overflow-y");
      el.style.removeProperty("touch-action");
      el.style.removeProperty("height");
      el.style.removeProperty("max-height");
    });
  }

  function aoRetornarAoApp() {
    liberarRolagemSistema();
    registrarAtualizarSW();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", liberarRolagemSistema, { once: true });
  } else {
    liberarRolagemSistema();
  }

  window.addEventListener("load", registrarAtualizarSW, { once: true });
  window.addEventListener("pageshow", aoRetornarAoApp);
  window.addEventListener("orientationchange", liberarRolagemSistema);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) aoRetornarAoApp();
  });

  /*
   * A atualização do SW precisa acontecer também no PWA já instalado.
   * Apenas a interface de instalação é ignorada em standalone.
   */
  if (standalone) return;

  const style = document.createElement("style");
  style.textContent = `
    .fusion-pwa-banner,.fusion-ios-hint{position:fixed;left:14px;right:14px;bottom:14px;z-index:99999;background:#111827;color:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:12px;display:flex;align-items:center;gap:10px;max-width:620px;margin:auto;font-family:Arial,Helvetica,sans-serif}
    .fusion-pwa-banner div{display:grid;gap:3px;flex:1}
    .fusion-pwa-banner span,.fusion-ios-hint span{font-size:13px;color:#d1d5db}
    .fusion-pwa-banner button,.fusion-ios-hint button{border:0;border-radius:10px;padding:9px 11px;font-weight:800;cursor:pointer}
    .fusion-pwa-banner [data-pwa-install]{background:var(--fusion-pwa-color,#22b8d2);color:#fff}
    .fusion-pwa-banner [data-pwa-close],.fusion-ios-hint button{background:#e5e7eb;color:#111827}
    @media(max-width:560px){.fusion-pwa-banner{align-items:stretch;display:grid}.fusion-pwa-banner button{width:100%}}
  `;
  document.head.appendChild(style);

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
