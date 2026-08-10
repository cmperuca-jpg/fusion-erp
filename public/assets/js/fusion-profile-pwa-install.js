(() => {
  "use strict";

  const standalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  let deferredPrompt = null;

  const $ = (id) => document.getElementById(id);
  const btn = $("btnInstalar");
  const info = $("instalacaoInfo");

  function mensagem(texto, tipo = "") {
    if (!info) return;
    info.textContent = texto;
    info.className = `install-info ${tipo}`.trim();
  }

  async function registrarSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      // Recepção/Administração compartilham o cache do PWA de gestão.
      await navigator.serviceWorker.register("/fusion-sw-sistema.js", { scope: "/" });
    } catch (erro) {
      console.warn("[Fusion PWA] SW não registrado:", erro);
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (btn) {
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = "Instalar aplicativo";
    }
    mensagem("Aplicativo pronto para instalação neste aparelho.", "ok");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (btn) {
      btn.hidden = false;
      btn.disabled = true;
      btn.textContent = "Aplicativo instalado";
    }
    mensagem("Aplicativo instalado com sucesso.", "ok");
  });

  btn?.addEventListener("click", async () => {
    if (standalone()) {
      mensagem("Você já está usando a versão instalada.", "ok");
      return;
    }

    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      await prompt.userChoice.catch(() => null);
      return;
    }

    if (ios) {
      mensagem("No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”.", "ios");
      return;
    }

    mensagem("No navegador, abra o menu e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.");
  });

  if (standalone()) {
    if (btn) {
      btn.hidden = false;
      btn.disabled = true;
      btn.textContent = "Aplicativo instalado";
    }
    mensagem("Executando como aplicativo instalado.", "ok");
  } else if (ios) {
    if (btn) btn.hidden = false;
    mensagem("No iPhone, use Compartilhar → Adicionar à Tela de Início.", "ios");
  } else if (btn) {
    // Deixamos visível; se beforeinstallprompt chegar, a instalação será nativa.
    btn.hidden = false;
  }

  registrarSW();
})();