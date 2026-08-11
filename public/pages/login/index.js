document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const erro = document.getElementById("erro");
  const btn = document.getElementById("btnEntrar");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");
  const academiaNome = document.getElementById("academiaNome");
  const trocarAcademia = document.getElementById("trocarAcademia");
  const recuperarSenha = document.getElementById("recuperarSenha");

  if (!form || !window.FusionAuth) return;

  const BINDING_KEY = "fusionTenantDeviceBinding";
  const params = new URLSearchParams(location.search);
  const contexto = window.__FUSION_TENANT_CONTEXT__ || {};
  const segmentos = location.pathname.split("/").filter(Boolean);
  const slugPath = segmentos[1] === "app" || segmentos[1] === "apps" ? segmentos[0] : "";

  const tenant = String(
    params.get("tenant") ||
    contexto.tenantId ||
    localStorage.getItem("fusionTenantId") ||
    slugPath ||
    ""
  ).trim();

  const nome = String(
    params.get("academia") ||
    contexto.nome ||
    sessionStorage.getItem("fusionAcademiaSelecionadaNome") ||
    localStorage.getItem("fusionAcademiaNome") ||
    tenant ||
    ""
  ).trim();

  const slug = String(contexto.slug || localStorage.getItem("fusionAcademiaSlug") || slugPath || tenant).trim();
  const next = params.get("next") || "";
  let selectionToken = String(sessionStorage.getItem("fusionTenantSelectionToken") || "").trim();

  async function restaurarSelecaoPeloAparelho() {
    if (selectionToken) return true;

    const binding = String(localStorage.getItem(BINDING_KEY) || "").trim();
    if (!binding || !tenant) return false;

    try {
      const resp = await fetch("/api/auth/vinculo-dispositivo/selecionar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          tenant,
          deviceBindingToken: binding
        })
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok || !json.selectionToken) throw new Error(json.mensagem || "Vínculo inválido.");

      selectionToken = String(json.selectionToken);
      sessionStorage.setItem("fusionTenantSelectionToken", selectionToken);
      sessionStorage.setItem("fusionAcademiaSelecionadaNome", json.academia?.nome || nome);
      localStorage.setItem("fusionTenantId", json.tenantId || tenant);
      localStorage.setItem("fusionAcademiaSlug", json.academia?.slug || slug);
      if (json.deviceBindingToken) localStorage.setItem(BINDING_KEY, json.deviceBindingToken);
      return true;
    } catch {
      localStorage.removeItem(BINDING_KEY);
      return false;
    }
  }

  if (!tenant) {
    location.replace("/pages/comecar/");
    return;
  }

  localStorage.setItem("fusionTenantId", tenant);
  if (slug) localStorage.setItem("fusionAcademiaSlug", slug);
  if (nome) {
    sessionStorage.setItem("fusionAcademiaSelecionadaNome", nome);
    localStorage.setItem("fusionAcademiaNome", nome);
  }

  const temSelecao = await restaurarSelecaoPeloAparelho();
  if (!temSelecao) {
    const voltar = new URLSearchParams();
    voltar.set("academia", slug || tenant);
    voltar.set("next", location.pathname + location.search);
    location.replace(`/pages/comecar/?${voltar.toString()}`);
    return;
  }

  academiaNome.textContent = nome || tenant;

  const trocaParams = new URLSearchParams({ academia: slug || tenant, trocar: "1" });
  if (next) trocaParams.set("next", next);
  trocarAcademia.href = `/pages/comecar/?${trocaParams.toString()}`;

  const recuperaParams = new URLSearchParams({ academia: tenant, tipo: "senha" });
  if (email.value.trim()) recuperaParams.set("email", email.value.trim());
  recuperarSenha.href = `/pages/recuperar-acesso/?${recuperaParams.toString()}`;

  email.addEventListener("input", () => {
    const rp = new URLSearchParams({ academia: tenant, tipo: "senha" });
    if (email.value.trim()) rp.set("email", email.value.trim());
    recuperarSenha.href = `/pages/recuperar-acesso/?${rp.toString()}`;
  });

  function destinoLimpo(usuario) {
    if (next) return next;
    const perfil = String(usuario?.perfil || "").toLowerCase();
    if (perfil === "professor" || perfil === "responsavel_tecnico") return `/${slug || tenant}/app/professor`;
    if (perfil === "comercial") return `/${slug || tenant}/app/crm`;
    return `/${slug || tenant}/app/dashboard`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.textContent = "";
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
      const usuario = await FusionAuth.login(email.value, senha.value, tenant);
      window.location.href = destinoLimpo(usuario);
    } catch (err) {
      erro.textContent = err.message || "Erro ao entrar.";
      if (/seleção|academia.*expir/i.test(erro.textContent)) {
        setTimeout(() => location.replace(`/pages/comecar/?academia=${encodeURIComponent(slug || tenant)}&next=${encodeURIComponent(location.pathname)}`), 1200);
      } else {
        senha.focus();
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
});
