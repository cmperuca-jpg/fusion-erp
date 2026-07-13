(function () {
  const LOGIN_URL = "/pages/login/index.html";
  const STORAGE_KEYS = ["fusionToken", "fusionUsuario", "usuarioLogado", "usuarioNome", "usuarioEmail", "usuarioPerfil"];

  function texto(valor) { return String(valor || "").trim(); }
  function normalizar(valor) { return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function lista(valor) { return Array.isArray(valor) ? valor : (valor === undefined || valor === null || valor === "" ? [] : [valor]); }

  function perfilSlug(perfilOriginal) {
    const perfil = normalizar(perfilOriginal || "Administrador");
    if (perfil.includes("responsavel tecnico") || perfil.includes("responsavel-tecnico") || perfil.includes("responsavel_tecnico")) return "responsavel_tecnico";
    if (perfil.includes("prof")) return "professor";
    if (perfil.includes("aluno")) return "aluno";
    if (perfil.includes("comercial")) return "comercial";
    if (perfil.includes("recepc")) return "recepcao";
    if (perfil.includes("gerente")) return "gerente";
    return "admin";
  }

  function normalizarUsuario(usuario = {}) {
    const perfilOriginal = usuario.perfilOriginal || usuario.perfil || usuario.tipo || usuario.role || "Administrador";
    const perfil = perfilSlug(perfilOriginal);
    let permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes.filter(Boolean) : [];
    if ((perfil === "admin" || normalizar(perfilOriginal) === "administrador") && !permissoes.length) permissoes = ["*"];

    return {
      id: usuario.id || usuario.usuarioId || "local-admin",
      nome: usuario.nome || usuario.name || "Administrador",
      email: usuario.email || "admin@fusionerp.local",
      perfil,
      perfilOriginal,
      permissoes,
      professorId: usuario.professorId || usuario.id || "",
      acessoTodosAlunos: usuario.acessoTodosAlunos === true
    };
  }

  function salvarSessao(token, usuario) {
    const user = normalizarUsuario(usuario);
    localStorage.setItem("fusionToken", token || `fusion-local-${Date.now()}`);
    localStorage.setItem("fusionUsuario", JSON.stringify(user));
    localStorage.setItem("usuarioLogado", "true");
    localStorage.setItem("usuarioNome", user.nome);
    localStorage.setItem("usuarioEmail", user.email);
    localStorage.setItem("usuarioPerfil", user.perfil);
    return user;
  }

  function tokenAtual() { return localStorage.getItem("fusionToken") || ""; }

  function usuarioAtual() {
    try {
      const bruto = localStorage.getItem("fusionUsuario");
      if (bruto) return normalizarUsuario(JSON.parse(bruto));
    } catch {}
    if (localStorage.getItem("usuarioLogado") === "true") {
      return normalizarUsuario({
        nome: localStorage.getItem("usuarioNome") || "Administrador",
        email: localStorage.getItem("usuarioEmail") || "admin@fusionerp.local",
        perfil: localStorage.getItem("usuarioPerfil") || "Administrador"
      });
    }
    return null;
  }

  function estaLogado() { return Boolean(tokenAtual() && usuarioAtual()); }

  function limparSessao(redirecionar = true) {
    STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    if (redirecionar) location.href = LOGIN_URL;
  }

  function permissoesAtual() {
    const user = usuarioAtual();
    return Array.isArray(user?.permissoes) ? user.permissoes : [];
  }

  function temPermissao(moduloOuPermissoes) {
    const user = usuarioAtual();
    if (!user) return false;
    if (user.perfil === "admin" || normalizar(user.perfilOriginal) === "administrador") return true;

    const permissoes = permissoesAtual().map(normalizar);
    if (permissoes.includes("*")) return true;

    const solicitadas = lista(moduloOuPermissoes).map(normalizar).filter(Boolean);
    if (!solicitadas.length) return true;

    return solicitadas.some(item => permissoes.includes(item) || normalizar(user.perfil) === item || normalizar(user.perfilOriginal) === item);
  }

  function podeAcessar(user, perfisPermitidos) {
    const permitidos = lista(perfisPermitidos).map(normalizar).filter(Boolean);
    if (!permitidos.length) return true;
    if (temPermissao(permitidos)) return true;
    return permitidos.includes(normalizar(user?.perfil)) || permitidos.includes(normalizar(user?.perfilOriginal));
  }

  async function validarSessao() {
    const token = tokenAtual();
    if (!token) return null;
    if (token.startsWith("fusion-local-")) return usuarioAtual();

    try {
      const resp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Sessão inválida.");
      return salvarSessao(token, json.usuario);
    } catch {
      limparSessao(true);
      return null;
    }
  }

  function proteger(perfisPermitidos) {
    if (!estaLogado()) {
      const destino = encodeURIComponent(location.pathname + location.search);
      location.href = `${LOGIN_URL}?next=${destino}`;
      return false;
    }
    const user = usuarioAtual();
    if (!podeAcessar(user, perfisPermitidos)) {
      alert("Acesso não permitido para este usuário.");
      location.href = destinoPorPerfil(user);
      return false;
    }
    setTimeout(() => validarSessao().then(() => filtrarElementosPorPermissao()).catch(() => {}), 0);
    setTimeout(() => filtrarElementosPorPermissao(), 0);
    return true;
  }

  function cabecalhoAuth(headers = {}) {
    const token = tokenAtual();
    return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
  }

  async function fetchAuth(url, opcoes = {}) {
    const resp = await fetch(url, { ...opcoes, headers: cabecalhoAuth(opcoes.headers || {}) });
    if (resp.status === 401) limparSessao(true);
    return resp;
  }

  function filtrarElementosPorPermissao(root = document) {
    root.querySelectorAll("[data-permissao]").forEach(el => {
      const regras = String(el.getAttribute("data-permissao") || "").split(",").map(v => v.trim()).filter(Boolean);
      if (regras.length && !temPermissao(regras)) el.remove();
    });
  }

  function sair() { limparSessao(true); }

  function destinoPorPerfil(usuario) {
    const perfil = String(usuario?.perfil || "").toLowerCase();
    if (perfil === "professor" || perfil === "responsavel_tecnico") return "/pages/professor-area/index.html";
    if (perfil === "aluno") return "/pages/aluno-login/index.html";
    if (perfil === "comercial") return "/pages/comercial-painel/index.html";
    return "/pages/dashboard/index.html";
  }

  async function login(email, senha) {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: texto(email), senha })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || "Falha no login.");
    return salvarSessao(json.token, json.usuario);
  }

  window.FusionAuth = { login, salvarSessao, usuarioAtual, tokenAtual, estaLogado, validarSessao, temPermissao, permissoesAtual, cabecalhoAuth, fetchAuth, filtrarElementosPorPermissao, proteger, sair, limparSessao, destinoPorPerfil };
  window.protegerPagina = function protegerPagina(perfisPermitidos) { return proteger(perfisPermitidos); };
  window.salvarSessaoUsuario = function salvarSessaoUsuario(nome = "Administrador") { return salvarSessao(`fusion-local-${Date.now()}`, { nome, perfil: "Administrador", permissoes: ["*"] }); };
  window.sair = sair;
})();
