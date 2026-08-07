document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const erro = document.getElementById("erro");
  const btn = document.getElementById("btnEntrar");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");
  const academiaNome = document.getElementById("academiaNome");
  const trocarAcademia = document.getElementById("trocarAcademia");
  const recuperarSenha = document.getElementById("recuperarSenha");

  if (!form || !window.FusionAuth) return;

  const params = new URLSearchParams(location.search);
  const tenant = String(params.get("tenant") || localStorage.getItem("fusionTenantId") || "").trim();
  const nome = String(params.get("academia") || sessionStorage.getItem("fusionAcademiaSelecionadaNome") || tenant || "").trim();
  const selectionToken = String(sessionStorage.getItem("fusionTenantSelectionToken") || "").trim();
  const next = params.get("next") || "";

  if (!tenant || !selectionToken) {
    const voltar = new URLSearchParams();
    if (tenant) voltar.set("academia", tenant);
    if (next) voltar.set("next", next);
    location.replace(`/pages/comecar/${voltar.toString() ? `?${voltar.toString()}` : ""}`);
    return;
  }

  localStorage.setItem("fusionTenantId", tenant);
  if (nome) sessionStorage.setItem("fusionAcademiaSelecionadaNome", nome);
  academiaNome.textContent = nome || tenant;

  const trocaParams = new URLSearchParams({ academia: tenant });
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.textContent = "";
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
      const usuario = await FusionAuth.login(email.value, senha.value, tenant);
      const destino = next || FusionAuth.destinoPorPerfil(usuario);
      const url = new URL(destino, location.origin);
      if (url.origin === location.origin && !url.searchParams.has("tenant")) {
        url.searchParams.set("tenant", tenant);
      }
      window.location.href = url.pathname + url.search + url.hash;
    } catch (err) {
      erro.textContent = err.message || "Erro ao entrar.";
      if (/seleção|academia.*expir/i.test(erro.textContent)) {
        setTimeout(() => location.replace(`/pages/comecar/?academia=${encodeURIComponent(tenant)}`), 1200);
      } else {
        senha.focus();
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
});
