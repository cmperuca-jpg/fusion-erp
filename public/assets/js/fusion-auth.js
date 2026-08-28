(function () {
  const LOGIN_URL = "/pages/login/index.html";
  const STORAGE_KEYS = ["fusionToken", "fusionUsuario", "fusionTenantId", "usuarioLogado", "usuarioNome", "usuarioEmail", "usuarioPerfil"];
  const estiloPendente = document.createElement("style");
  estiloPendente.textContent = "html.fusion-auth-pendente{visibility:hidden!important}";
  document.head.appendChild(estiloPendente);

  function texto(valor) { return String(valor || "").trim(); }
  function normalizar(valor) { return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function lista(valor) { return Array.isArray(valor) ? valor : (valor === undefined || valor === null || valor === "" ? [] : [valor]); }

  function tenantSalvo() {
    try { return texto(localStorage.getItem("fusionTenantId")); }
    catch { return ""; }
  }

  function tenantDaPagina() {
    try { return texto(new URLSearchParams(location.search).get("tenant")); }
    catch { return ""; }
  }

  function tenantAtual() {
    return tenantDaPagina() || tenantSalvo();
  }

  function urlLoginTenant(tenant = "") {
    const id = texto(tenant);
    return id ? `${LOGIN_URL}?tenant=${encodeURIComponent(id)}` : LOGIN_URL;
  }

  function tokenSelecaoTenant() {
    try { return texto(sessionStorage.getItem("fusionTenantSelectionToken")); }
    catch { return ""; }
  }

  function limparSelecaoTenant() {
    try {
      sessionStorage.removeItem("fusionTenantSelectionToken");
      sessionStorage.removeItem("fusionAcademiaSelecionadaNome");
    } catch {}
  }

  function urlSelecionarAcademia(tenant = "", next = "") {
    const params = new URLSearchParams();
    if (texto(tenant)) params.set("academia", texto(tenant));
    if (texto(next)) params.set("next", texto(next));
    const query = params.toString();
    return `/pages/comecar/${query ? `?${query}` : ""}`;
  }

  function sessaoPertencePagina(usuario = {}) {
    const esperado = tenantDaPagina();
    const atual = texto(usuario?.tenantId || tenantSalvo());
    return !esperado || !atual || esperado === atual;
  }

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
      tenantId: texto(usuario.tenantId || tenantSalvo()),
      perfil,
      perfilOriginal,
      permissoes,
      professorId: usuario.professorId || usuario.id || "",
      acessoTodosAlunos: usuario.acessoTodosAlunos === true,
      academiaNome: texto(usuario.academiaNome),
      supportAccess: usuario.supportAccess === true,
      supportSessionId: texto(usuario.supportSessionId),
      supportHomeTenantId: texto(usuario.supportHomeTenantId),
      supportReason: texto(usuario.supportReason),
      supportRole: texto(usuario.supportRole)
    };
  }

  function salvarSessao(token, usuario, tenantId = "") {
    if (!token) throw new Error("Token de autenticação ausente.");
    const tenant = texto(tenantId || usuario?.tenantId || tenantSalvo());
    if (!tenant) throw new Error("Empresa da sessão não identificada.");
    const user = normalizarUsuario({ ...(usuario || {}), tenantId: tenant });
    localStorage.setItem("fusionToken", token);
    localStorage.setItem("fusionUsuario", JSON.stringify(user));
    localStorage.setItem("fusionTenantId", tenant);
    localStorage.setItem("usuarioLogado", "true");
    localStorage.setItem("usuarioNome", user.nome);
    localStorage.setItem("usuarioEmail", user.email);
    localStorage.setItem("usuarioPerfil", user.perfil);
    document.documentElement.dataset.fusionTenant = tenant;
    queueMicrotask(() => garantirBannerSuporte());
    return user;
  }

  function tokenAtual() { return localStorage.getItem("fusionToken") || ""; }

  function usuarioAtual() {
    try {
      const bruto = localStorage.getItem("fusionUsuario");
      if (bruto) return normalizarUsuario(JSON.parse(bruto));
    } catch {}
    return null;
  }

  function estaLogado() { return Boolean(tokenAtual() && usuarioAtual()); }

  function limparSessao(redirecionar = true) {
    const tenant = tenantAtual();
    STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    limparSelecaoTenant();
    delete document.documentElement.dataset.fusionTenant;
    if (redirecionar) location.href = urlSelecionarAcademia(tenant);
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
    try {
      const resp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) throw new Error(json.mensagem || "Sessão inválida.");
      const usuario = salvarSessao(token, json.usuario, json.usuario?.tenantId || json.tenantId || tenantSalvo());
      document.documentElement.classList.remove("fusion-auth-pendente");
      return usuario;
    } catch {
      limparSessao(true);
      return null;
    }
  }

  function proteger(perfisPermitidos) {
    document.documentElement.classList.add("fusion-auth-pendente");
    if (!estaLogado()) {
      const destino = location.pathname + location.search;
      location.href = urlSelecionarAcademia(tenantDaPagina() || tenantSalvo(), destino);
      return false;
    }
    const user = usuarioAtual();
    if (!sessaoPertencePagina(user)) {
      const tenant = tenantDaPagina();
      const destino = location.pathname + location.search;
      limparSessao(false);
      location.href = urlSelecionarAcademia(tenant, destino);
      return false;
    }
    if (!podeAcessar(user, perfisPermitidos)) {
      alert("Acesso não permitido para este usuário.");
      location.href = destinoPorPerfil(user);
      return false;
    }
    setTimeout(() => validarSessao().then((sessao) => {
      if (!sessao) return;
      if (!sessaoPertencePagina(sessao)) {
        const tenant = tenantDaPagina();
        limparSessao(false);
        location.href = `${urlLoginTenant(tenant)}&next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      if (!podeAcessar(sessao, perfisPermitidos)) {
        alert("Acesso não permitido para este usuário.");
        location.href = destinoPorPerfil(sessao);
        return;
      }
      filtrarElementosPorPermissao();
    }).catch(() => limparSessao(true)), 0);
    return true;
  }

  function cabecalhoAuth(headers = {}) {
    const token = tokenAtual();
    const tenant = tenantAtual();
    const saida = { ...headers };
    if (token) saida.Authorization = `Bearer ${token}`;
    if (tenant) saida["X-Fusion-Tenant"] = tenant;
    return saida;
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

  function estaEmSuporte() {
    return usuarioAtual()?.supportAccess === true;
  }

  async function encerrarSuporte() {
    const user = usuarioAtual();
    if (!user?.supportAccess) return false;

    const tokenSuporte = tokenAtual();
    try {
      await fetchOriginal("/api/suporte/acesso/encerrar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenSuporte}`,
          "Content-Type": "application/json",
          "X-Fusion-Tenant": user.tenantId || ""
        }
      });
    } catch {}

    const tokenOriginal = sessionStorage.getItem("fusionSupportOriginalToken") || "";
    const usuarioOriginalBruto = sessionStorage.getItem("fusionSupportOriginalUsuario") || "";
    const tenantOriginal = sessionStorage.getItem("fusionSupportOriginalTenantId") || "";

    sessionStorage.removeItem("fusionSupportOriginalToken");
    sessionStorage.removeItem("fusionSupportOriginalUsuario");
    sessionStorage.removeItem("fusionSupportOriginalTenantId");

    if (!tokenOriginal || !usuarioOriginalBruto) {
      limparSessao(true);
      return true;
    }

    let usuarioOriginal = null;
    try { usuarioOriginal = JSON.parse(usuarioOriginalBruto); } catch {}
    salvarSessao(tokenOriginal, usuarioOriginal || {}, tenantOriginal);
    location.replace("/pages/suporte/index.html");
    return true;
  }

  function garantirBannerSuporte() {
    const user = usuarioAtual();
    document.getElementById("fusionSupportBanner")?.remove();
    if (!user?.supportAccess || !document.body) return;

    let style = document.getElementById("fusionSupportBannerStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "fusionSupportBannerStyle";
      style.textContent = `
        #fusionSupportBanner{position:fixed;left:10px;right:10px;bottom:10px;z-index:2147483000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #fb923c;border-radius:12px;background:#7c2d12;color:#fff;box-shadow:0 18px 45px rgba(0,0,0,.25);font:700 13px/1.35 Arial,sans-serif}
        #fusionSupportBanner strong{display:block;font-size:14px}
        #fusionSupportBanner small{display:block;color:#ffedd5;font-weight:600}
        #fusionSupportBanner button{flex:0 0 auto;border:1px solid #fed7aa;border-radius:9px;background:#fff;color:#7c2d12;padding:8px 11px;font:800 12px Arial,sans-serif;cursor:pointer}
        @media(max-width:640px){#fusionSupportBanner{align-items:stretch;display:grid}#fusionSupportBanner button{width:100%}}
      `;
      document.head.appendChild(style);
    }

    const banner = document.createElement("div");
    banner.id = "fusionSupportBanner";
    banner.innerHTML = `
      <div>
        <strong>MODO SUPORTE — ${user.academiaNome || user.tenantId || "Academia"}</strong>
        <small>${user.supportReason ? `Motivo: ${user.supportReason}` : "Sessão temporária e auditada"}</small>
      </div>
      <button type="button">Encerrar suporte</button>
    `;
    banner.querySelector("button").addEventListener("click", () => encerrarSuporte());
    document.body.appendChild(banner);
  }

  function sair() {
    if (estaEmSuporte()) {
      encerrarSuporte();
      return;
    }
    limparSessao(true);
  }

  function destinoPorPerfil(usuario) {
    const perfil = String(usuario?.perfil || "").toLowerCase();
    if (perfil === "professor" || perfil === "responsavel_tecnico") return "/pages/professor-area/index.html";
    if (perfil === "aluno") return "/pages/aluno-login/index.html";
    if (perfil === "comercial") return "/pages/comercial-painel/index.html";
    return "/pages/dashboard/index.html";
  }

  async function login(email, senha, tenantEsperado = "") {
    const tenant = texto(tenantEsperado || tenantDaPagina() || tenantSalvo());
    if (!tenant) throw new Error("Selecione a academia antes de fazer login.");

    const selectionToken = tokenSelecaoTenant();
    if (!selectionToken) {
      throw new Error("A seleção da academia expirou. Volte e informe o código da academia novamente.");
    }

    const body = { email: texto(email), senha, tenant, selectionToken };
    const resp = await fetchOriginal("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fusion-Tenant": tenant,
        "X-Fusion-Tenant-Selection": selectionToken
      },
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || "Falha no login.");

    const tenantSessao = texto(json.tenantId || json.usuario?.tenantId || tenant);
    if (tenantSessao !== tenant) {
      throw new Error("A conta informada pertence a outra empresa.");
    }
    limparSelecaoTenant();
    return salvarSessao(json.token, json.usuario, tenantSessao);
  }

  const fetchOriginal = window.fetch.bind(window);
  const idempotenciaFinanceiraPendente = new Map();
  const IDEMPOTENCIA_FINANCEIRA_TTL_MS = 2 * 60 * 1000;

  function detalhesApiInterna(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      const url = new URL(raw, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return null;
      return url;
    } catch {
      return null;
    }
  }

  function urlApiInterna(input) {
    return Boolean(detalhesApiInterna(input));
  }

  function metodoRequisicao(input, opcoes = {}) {
    return String(
      opcoes.method ||
      (input instanceof Request ? input.method : "GET") ||
      "GET"
    ).toUpperCase();
  }

  function rotaFinanceiraMutavel(input, opcoes = {}) {
    const url = detalhesApiInterna(input);
    if (!url) return null;

    const metodo = metodoRequisicao(input, opcoes);
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(metodo)) return null;

    const prefixos = [
      "/api/financeiro",
      "/api/caixa",
      "/api/recebimentos",
      "/api/pagamentos"
    ];

    if (!prefixos.some((prefixo) =>
      url.pathname === prefixo || url.pathname.startsWith(`${prefixo}/`)
    )) {
      return null;
    }

    return { url, metodo };
  }

  function chaveIdempotenciaDoPayload(opcoes = {}) {
    if (typeof opcoes.body !== "string" || !opcoes.body.trim()) return "";
    try {
      const payload = JSON.parse(opcoes.body);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
      return texto(payload.operacaoId || payload.idempotencyKey);
    } catch {
      return "";
    }
  }

  function novaChaveIdempotenciaFinanceira() {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `fin-${uuid}`;
    return `fin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function prepararIdempotenciaFinanceira(input, opcoes, headers) {
    const rota = rotaFinanceiraMutavel(input, opcoes);
    if (!rota) return null;

    if (headers.has("Idempotency-Key") || headers.has("X-Idempotency-Key")) {
      return null;
    }

    const chavePayload = chaveIdempotenciaDoPayload(opcoes);
    if (chavePayload) {
      headers.set("Idempotency-Key", chavePayload);
      return null;
    }

    const agora = Date.now();
    for (const [assinatura, pendente] of idempotenciaFinanceiraPendente.entries()) {
      if (agora - pendente.criadoEm > IDEMPOTENCIA_FINANCEIRA_TTL_MS) {
        idempotenciaFinanceiraPendente.delete(assinatura);
      }
    }

    const corpo = typeof opcoes.body === "string" ? opcoes.body : "";
    const assinatura = [
      tenantAtual(),
      rota.metodo,
      rota.url.pathname,
      rota.url.search,
      corpo
    ].join("|");

    let pendente = idempotenciaFinanceiraPendente.get(assinatura);
    if (!pendente) {
      pendente = {
        chave: novaChaveIdempotenciaFinanceira(),
        criadoEm: agora
      };
      idempotenciaFinanceiraPendente.set(assinatura, pendente);
    }

    headers.set("Idempotency-Key", pendente.chave);
    return { assinatura };
  }

  window.fetch = function fusionFetch(input, opcoes = {}) {
    if (!urlApiInterna(input)) return fetchOriginal(input, opcoes);

    const token = tokenAtual();
    const tenant = tenantAtual();
    const headers = new Headers(opcoes.headers || (input instanceof Request ? input.headers : undefined));

    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    if (tenant && !headers.has("X-Fusion-Tenant")) headers.set("X-Fusion-Tenant", tenant);

    const idempotencia = prepararIdempotenciaFinanceira(input, opcoes, headers);
    const requisicao = fetchOriginal(input, { ...opcoes, headers });

    if (!idempotencia) return requisicao;

    return requisicao.then((resp) => {
      if (resp.status < 500) {
        idempotenciaFinanceiraPendente.delete(idempotencia.assinatura);
      }
      return resp;
    });
  };

  window.FusionAuth = { login, salvarSessao, usuarioAtual, tokenAtual, tenantAtual, estaLogado, validarSessao, temPermissao, permissoesAtual, cabecalhoAuth, fetchAuth, filtrarElementosPorPermissao, proteger, sair, limparSessao, destinoPorPerfil, estaEmSuporte, encerrarSuporte, tokenSelecaoTenant, limparSelecaoTenant, urlSelecionarAcademia };
  window.protegerPagina = function protegerPagina(perfisPermitidos) { return proteger(perfisPermitidos); };
  window.sair = sair;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", garantirBannerSuporte, { once: true });
  else garantirBannerSuporte();
})();
