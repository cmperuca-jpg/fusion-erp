;(() => {
  "use strict";

  const MARCA = "FUSION_PWA_SCROLL_FIX_20260807";
  if (window.__fusionPwaScrollFix20260807) return;

  const emModoStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches === true ||
    window.navigator.standalone === true;

  if (!emModoStandalone()) return;
  window.__fusionPwaScrollFix20260807 = true;

  const CLASSE_LIVRE = "fusion-pwa-scroll-unlocked";
  const html = document.documentElement;

  function visivel(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList?.contains("hidden")) return false;
    if (el.hasAttribute?.("hidden")) return false;

    const estilo = window.getComputedStyle(el);
    if (estilo.display === "none" || estilo.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  }

  function existeModalAberto() {
    const seletores = [
      "dialog[open]",
      ".modal-backdrop:not(.hidden)",
      ".modal-overlay:not(.hidden)",
      ".modal:not(.hidden)",
      ".popup:not(.hidden)",
      ".dialog:not(.hidden)",
      ".popup-operacional:not(.hidden)",
      '[role="dialog"]:not(.hidden)'
    ].join(",");

    return Array.from(document.querySelectorAll(seletores)).some(visivel);
  }

  function botoesMenu() {
    return Array.from(document.querySelectorAll(
      ".fusion-mobile-final-menu-btn,.fusion-mobile-toggle,.fusion-mobile-menu-button,.fusion-v3-menu-toggle"
    ));
  }

  function fecharMenuResidual() {
    const body = document.body;
    if (!body) return;

    body.classList.remove("fusion-menu-open", "fusion-ui-menu-open");
    html.classList.remove("fusion-menu-open", "fusion-ui-menu-open");

    botoesMenu().forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
      if (btn.classList.contains("fusion-mobile-final-menu-btn")) {
        btn.setAttribute("aria-label", "Abrir menu");
        btn.innerHTML = "☰";
      }
    });
  }

  function removerTravasInline(el) {
    if (!el) return;

    const overflow = String(el.style.getPropertyValue("overflow") || "").trim().toLowerCase();
    const overflowY = String(el.style.getPropertyValue("overflow-y") || "").trim().toLowerCase();
    const touchAction = String(el.style.getPropertyValue("touch-action") || "").trim().toLowerCase();

    if (overflow === "hidden" || overflow === "clip") {
      el.style.removeProperty("overflow");
    }
    if (overflowY === "hidden" || overflowY === "clip") {
      el.style.removeProperty("overflow-y");
    }
    if (touchAction === "none") {
      el.style.removeProperty("touch-action");
    }
  }

  function atualizarEstadoScroll({ fecharMenu = false } = {}) {
    const body = document.body;
    if (!body || !emModoStandalone()) return;

    if (fecharMenu) fecharMenuResidual();

    const menuAberto =
      body.classList.contains("fusion-menu-open") ||
      body.classList.contains("fusion-ui-menu-open") ||
      html.classList.contains("fusion-menu-open") ||
      html.classList.contains("fusion-ui-menu-open");

    const bloqueado = menuAberto || existeModalAberto();

    html.classList.toggle(CLASSE_LIVRE, !bloqueado);
    body.classList.toggle(CLASSE_LIVRE, !bloqueado);

    if (!bloqueado) {
      removerTravasInline(html);
      removerTravasInline(body);
    }
  }

  function agendar(opcoes = {}) {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => atualizarEstadoScroll(opcoes), 0);
    });
  }

  function instalarObservador() {
    const body = document.body;
    if (!body || body.dataset.fusionPwaScrollObserver === "1") return;

    body.dataset.fusionPwaScrollObserver = "1";

    const observer = new MutationObserver(() => agendar());
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true
    });
  }

  function iniciar() {
    instalarObservador();
    agendar({ fecharMenu: true });

    /* Uma segunda conferência cobre menus/layouts criados depois do DOMContentLoaded. */
    window.setTimeout(() => agendar({ fecharMenu: true }), 250);
    window.setTimeout(() => agendar(), 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }

  /*
   * O PWA pode voltar de bfcache ou do segundo plano com a classe
   * fusion-menu-open preservada. Nesses retornos o menu é fechado e o
   * scroll raiz é restaurado.
   */
  window.addEventListener("pageshow", () => agendar({ fecharMenu: true }));
  window.addEventListener("pagehide", fecharMenuResidual);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) agendar({ fecharMenu: true });
  });

  window.addEventListener("orientationchange", () => agendar());
  window.addEventListener("resize", () => agendar());

  /*
   * No código anterior, fusion-pwa-install.js retorna cedo quando já está
   * em standalone. Revalidamos o Service Worker do sistema também dentro
   * do PWA instalado para que correções futuras cheguem mais rápido.
   */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
      if (!/manifest-sistema\.webmanifest/i.test(manifest)) return;

      try {
        const registro = await navigator.serviceWorker.register("/fusion-sw-sistema.js", { scope: "/" });
        await registro.update();
      } catch (_) {
        /* Sem bloquear o uso offline se a atualização falhar. */
      }
    }, { once: true });
  }

  window.FusionPwaScrollFix = {
    marker: MARCA,
    atualizar: () => atualizarEstadoScroll(),
    liberar: () => atualizarEstadoScroll({ fecharMenu: true })
  };
})();
