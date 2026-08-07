(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let dadosAtuais = null;

  function usuarioPodeRegenerar() {
    const user = FusionAuth.usuarioAtual() || {};
    const perfil = String(user.perfilOriginal || user.perfil || "").toLowerCase();
    const permissoes = Array.isArray(user.permissoes) ? user.permissoes : [];
    return perfil === "administrador" || perfil === "admin" || permissoes.includes("*");
  }

  function mostrar(dados) {
    dadosAtuais = dados;
    $("academia").textContent = dados.academia?.nome || dados.tenantId || "—";
    $("codigo").textContent = dados.codigoAcesso || "—";
    const podeRegenerar = usuarioPodeRegenerar();
    $("btnRegenerar").hidden = !podeRegenerar;
    $("avisoRegenerar").hidden = !podeRegenerar;
    $("estado").hidden = true;
    $("dados").hidden = false;
  }

  async function carregar() {
    if (!window.FusionAuth?.estaLogado()) {
      location.replace("/pages/comecar/");
      return;
    }
    try {
      const resp = await FusionAuth.fetchAuth("/api/auth/codigo-acesso", { cache: "no-store" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível carregar o código da academia.");
      mostrar(json);
    } catch (error) {
      $("estado").textContent = error.message || "Não foi possível carregar o código da academia.";
    }
  }

  $("btnCopiar").addEventListener("click", async () => {
    if (!dadosAtuais?.codigoAcesso) return;
    try {
      await navigator.clipboard.writeText(dadosAtuais.codigoAcesso);
      $("mensagem").textContent = "Código da academia copiado.";
    } catch {
      $("mensagem").textContent = `Código da academia: ${dadosAtuais.codigoAcesso}`;
    }
  });

  $("btnRegenerar").addEventListener("click", async () => {
    if (!usuarioPodeRegenerar()) return;
    if (!confirm("Gerar um novo código da academia? O código atual deixará de funcionar imediatamente.")) return;
    const btn = $("btnRegenerar");
    btn.disabled = true;
    btn.textContent = "Gerando...";
    $("mensagem").textContent = "";
    try {
      const resp = await FusionAuth.fetchAuth("/api/auth/codigo-acesso/regenerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível gerar novo código da academia.");
      mostrar(json);
      $("mensagem").textContent = "Novo código gerado. O anterior foi invalidado.";
    } catch (error) {
      $("mensagem").textContent = error.message || "Falha ao gerar novo código.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Gerar novo código";
    }
  });

  carregar();
})();
