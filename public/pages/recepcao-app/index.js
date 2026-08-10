(() => {
  "use strict";

  const APP = "Fusion Recepção";
  const PERFIS = new Set(["recepcao","recepcionista","atendimento","gerente","admin","administrador","dono","master"]);
  const $ = id => document.getElementById(id);

  function normalizar(v) {
    return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function usuarioAtual() {
    try { return window.FusionAuth?.usuarioAtual?.() || null; } catch { return null; }
  }

  function academiaAtual() {
    return {
      tenantId: String(localStorage.getItem("fusionTenantId") || "").trim(),
      nome: String(sessionStorage.getItem("fusionAcademiaSelecionadaNome") || "").trim()
    };
  }

  function perfilDoUsuario(u = {}) {
    return normalizar(u.perfil || u.role || u.tipo || u.profile || "");
  }

  function nomeDoUsuario(u = {}) {
    return String(u.nome || u.name || u.usuarioNome || u.login || u.email || "Usuário").trim();
  }

  function mostrarErro(texto = "") {
    const el = $("mensagem");
    el.textContent = texto;
    el.classList.toggle("hidden", !texto);
  }

  function urlRetorno() {
    return location.pathname + location.search;
  }

  function irSelecionarAcademia() {
    location.href = `/pages/comecar/?next=${encodeURIComponent(urlRetorno())}`;
  }

  function irLogin() {
    location.href = `/pages/login/index.html?next=${encodeURIComponent(urlRetorno())}`;
  }

  function destino(u) {
    try {
      return window.FusionAuth?.destinoPorPerfil?.(u?.perfil) || "/pages/dashboard/index.html";
    } catch {
      return "/pages/dashboard/index.html";
    }
  }

  function render() {
    const academia = academiaAtual();
    const u = usuarioAtual();
    const perfil = perfilDoUsuario(u || {});

    $("academiaNome").textContent = academia.nome || academia.tenantId || "Não selecionada";
    $("usuarioNome").textContent = u ? nomeDoUsuario(u) : "Não conectado";
    $("quick").classList.add("hidden");
    mostrarErro("");

    if (!academia.tenantId) {
      $("btnAbrir").textContent = "Selecionar academia e entrar";
      $("btnAbrir").onclick = irSelecionarAcademia;
      return;
    }

    if (!u) {
      $("btnAbrir").textContent = "Entrar";
      $("btnAbrir").onclick = irLogin;
      return;
    }

    if (!PERFIS.has(perfil)) {
      $("btnAbrir").textContent = "Entrar com outro usuário";
      $("btnAbrir").onclick = () => {
        try { window.FusionAuth?.sair?.(); } catch {}
        irLogin();
      };
      mostrarErro(`O perfil “${u.perfil || perfil || "não identificado"}” não possui acesso ao ${APP}.`);
      return;
    }

    $("btnAbrir").textContent = "Abrir painel";
    $("btnAbrir").onclick = () => { location.href = destino(u); };
    $("quick").classList.remove("hidden");
  }

  window.addEventListener("pageshow", render);
  render();
})();