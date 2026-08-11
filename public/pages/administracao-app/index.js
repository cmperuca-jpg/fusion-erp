(() => {
  "use strict";

  const APP = "Fusion Administração";
  const PERFIS = new Set(["gerente", "admin", "administrador", "dono", "master"]);
  const BINDING_KEY = "fusionTenantDeviceBinding";
  const $ = id => document.getElementById(id);

  function normalizar(v) {
    return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function contexto() {
    const c = window.__FUSION_TENANT_CONTEXT__ || {};
    const partes = location.pathname.split("/").filter(Boolean);
    return {
      tenantId:String(c.tenantId || localStorage.getItem("fusionTenantId") || "").trim(),
      nome:String(c.nome || sessionStorage.getItem("fusionAcademiaSelecionadaNome") || "").trim(),
      slug:String(c.slug || (partes[1] === "apps" ? partes[0] : "") || "").trim()
    };
  }

  function usuarioAtual() {
    try { return window.FusionAuth?.usuarioAtual?.() || null; } catch { return null; }
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

  function selectionToken() {
    return String(sessionStorage.getItem("fusionTenantSelectionToken") || "").trim();
  }

  async function garantirSelecao(ctx) {
    if (selectionToken()) return true;
    const binding = String(localStorage.getItem(BINDING_KEY) || "").trim();
    if (!binding || !ctx.tenantId) return false;

    try {
      const resp = await fetch("/api/auth/vinculo-dispositivo/selecionar", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({tenant:ctx.tenantId,deviceBindingToken:binding})
      });
      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json.ok || !json.selectionToken) throw new Error(json.mensagem || "Vínculo inválido.");

      sessionStorage.setItem("fusionTenantSelectionToken",json.selectionToken);
      sessionStorage.setItem("fusionAcademiaSelecionadaNome",json.academia?.nome || ctx.nome);
      localStorage.setItem("fusionTenantId",json.tenantId || ctx.tenantId);
      if (json.deviceBindingToken) localStorage.setItem(BINDING_KEY,json.deviceBindingToken);
      return true;
    } catch {
      localStorage.removeItem(BINDING_KEY);
      return false;
    }
  }

  function irSelecionarAcademia(ctx) {
    const params = new URLSearchParams({
      academia:ctx.slug || ctx.tenantId,
      next:location.pathname
    });
    location.href = `/pages/comecar/?${params.toString()}`;
  }

  function irLogin(ctx) {
    location.href = `/${encodeURIComponent(ctx.slug || ctx.tenantId)}/app/login?next=${encodeURIComponent(location.pathname)}`;
  }

  async function render() {
    const ctx = contexto();
    const temSelecao = await garantirSelecao(ctx);
    const u = usuarioAtual();
    const perfil = perfilDoUsuario(u || {});

    $("academiaNome").textContent = ctx.nome || ctx.slug || ctx.tenantId || "Não selecionada";
    $("usuarioNome").textContent = u ? nomeDoUsuario(u) : "Não conectado";
    $("quick").classList.add("hidden");
    mostrarErro("");

    if (!ctx.tenantId) {
      $("btnAbrir").textContent = "Selecionar academia";
      $("btnAbrir").onclick = () => irSelecionarAcademia(ctx);
      return;
    }

    if (!u) {
      $("btnAbrir").textContent = temSelecao ? "Entrar" : "Vincular este aparelho";
      $("btnAbrir").onclick = temSelecao ? () => irLogin(ctx) : () => irSelecionarAcademia(ctx);
      return;
    }

    if (!PERFIS.has(perfil)) {
      $("btnAbrir").textContent = "Entrar com outro usuário";
      $("btnAbrir").onclick = () => {
        try { window.FusionAuth?.sair?.(); } catch {}
      };
      mostrarErro(`O perfil “${u.perfil || perfil || "não identificado"}” não possui acesso ao ${APP}.`);
      return;
    }

    $("btnAbrir").textContent = "Abrir meu sistema";
    $("btnAbrir").onclick = () => {
      location.href = `/${encodeURIComponent(ctx.slug || ctx.tenantId)}/app/dashboard`;
    };
    $("quick").classList.remove("hidden");
  }

  window.addEventListener("pageshow",render);
  render();
})();