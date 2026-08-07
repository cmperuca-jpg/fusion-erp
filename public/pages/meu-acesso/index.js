(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let dadosAtuais = null;

  function mostrar(dados) {
    dadosAtuais = dados;
    const user = FusionAuth.usuarioAtual() || {};
    $("academia").textContent = dados.academia?.nome || dados.tenantId || "—";
    $("usuario").textContent = `${user.nome || user.email || "Usuário"}${dados.perfil ? ` — ${dados.perfil}` : ""}`;
    $("codigo").textContent = dados.codigoAcesso || "—";
    $("estado").hidden = true;
    $("dados").hidden = false;
  }

  async function carregar() {
    if (!window.FusionAuth?.estaLogado()) {
      location.replace("/pages/login/index.html?next=/pages/meu-acesso/index.html");
      return;
    }
    try {
      const resp = await FusionAuth.fetchAuth("/api/auth/codigo-acesso", { cache: "no-store" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível carregar o código.");
      mostrar(json);
    } catch (error) {
      $("estado").textContent = error.message || "Não foi possível carregar seu acesso.";
    }
  }

  $("btnCopiar").addEventListener("click", async () => {
    if (!dadosAtuais?.codigoAcesso) return;
    try {
      await navigator.clipboard.writeText(dadosAtuais.codigoAcesso);
      $("mensagem").textContent = "Código copiado.";
    } catch {
      $("mensagem").textContent = `Código: ${dadosAtuais.codigoAcesso}`;
    }
  });

  $("btnRegenerar").addEventListener("click", async () => {
    if (!confirm("Gerar um novo código? O código atual deixará de funcionar imediatamente.")) return;
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
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível gerar novo código.");
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
