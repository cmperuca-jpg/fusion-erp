(() => {
  "use strict";

  const APP = "Fusion Recepção";
  const PERFIS = new Set(["recepcao","recepcionista","atendimento","gerente","admin","administrador","dono","master"]);
  const $ = id => document.getElementById(id);

  function normalizar(v) {
    return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  }

  function usuarioAtual() {
    try { return window.FusionAuth?.usuarioAtual?.() || null; } catch { return null; }
  }

  function academiaAtual() {
    return {
      tenantId: String(localStorage.getItem("fusionTenantId") || "").trim(),
      nome: String(sessionStorage.getItem("fusionAcademiaSelecionadaNome") || "").trim(),
      selectionToken: String(sessionStorage.getItem("fusionTenantSelectionToken") || "").trim()
    };
  }

  function academiaEsperada() {
    const params = new URLSearchParams(location.search);
    return {
      tenantId: String(params.get("tenant") || "").trim(),
      nome: String(params.get("nome") || "").trim(),
      slug: String(params.get("academia") || "").trim()
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

  function irSelecionarAcademia(esperada = academiaEsperada()) {
    const params = new URLSearchParams();
    if (esperada.tenantId || esperada.slug) params.set("academia", esperada.tenantId || esperada.slug);
    params.set("next", urlRetorno());
    location.href = `/pages/comecar/?${params.toString()}`;
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
    const atual = academiaAtual();
    const esperada = academiaEsperada();
    const u = usuarioAtual();
    const perfil = perfilDoUsuario(u || {});

    const academiaDiferente = Boolean(
      esperada.tenantId &&
      atual.tenantId &&
      normalizar(esperada.tenantId) !== normalizar(atual.tenantId)
    );
    const precisaConfirmar = Boolean(
      esperada.tenantId &&
      (!atual.tenantId || !atual.selectionToken || academiaDiferente)
    );

    $("academiaNome").textContent =
      esperada.nome || atual.nome || esperada.tenantId || atual.tenantId || "Não selecionada";
    $("usuarioNome").textContent = u ? nomeDoUsuario(u) : "Não conectado";
    $("quick").classList.add("hidden");
    mostrarErro("");

    if (precisaConfirmar) {
      $("btnAbrir").textContent = "Confirmar esta academia e entrar";
      $("btnAbrir").onclick = () => irSelecionarAcademia(esperada);
      if (academiaDiferente) {
        mostrarErro("Há outra academia selecionada neste navegador. Confirme a academia deste link antes de entrar.");
      }
      return;
    }

    if (!atual.tenantId || !atual.selectionToken) {
      $("btnAbrir").textContent = "Selecionar academia e entrar";
      $("btnAbrir").onclick = () => irSelecionarAcademia(esperada);
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
