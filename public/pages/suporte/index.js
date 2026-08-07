(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let clientes = [];
  let selecionado = null;

  function esc(v = "") {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
  }

  function render(lista) {
    $("lista").innerHTML = lista.map(c => `
      <article class="cliente">
        <div>
          <h2>${esc(c.name || c.tenant_id)}</h2>
          <small>${esc(c.tenant_id)}</small>
        </div>
        <div class="meta">
          <span class="pill">${esc(c.status || "")}</span>
          <span class="pill">${esc(c.plan_code || "")}</span>
        </div>
        <button type="button" data-acessar="${esc(c.tenant_id)}">Acessar em modo suporte</button>
      </article>
    `).join("");

    $("lista").querySelectorAll("[data-acessar]").forEach(btn => {
      btn.addEventListener("click", () => {
        selecionado = clientes.find(c => c.tenant_id === btn.dataset.acessar);
        if (!selecionado) return;
        $("nomeAcademia").textContent = selecionado.name || selecionado.tenant_id;
        $("motivo").value = "";
        $("mensagem").textContent = "";
        $("modalAcesso").showModal();
        setTimeout(() => $("motivo").focus(), 0);
      });
    });
  }

  async function iniciar() {
    if (!window.FusionAuth?.estaLogado()) {
      location.replace("/pages/login/index.html?next=/pages/suporte/index.html");
      return;
    }

    try {
      const status = await FusionAuth.fetchAuth("/api/suporte/status", { cache: "no-store" });
      const statusJson = await status.json().catch(() => ({}));
      if (!status.ok || !statusJson.autorizado) {
        $("estado").textContent = "Sua conta não está autorizada como operador de suporte do Fusion.";
        return;
      }

      const resp = await FusionAuth.fetchAuth("/api/suporte/clientes", { cache: "no-store" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível carregar as academias.");

      clientes = Array.isArray(json.clientes) ? json.clientes : [];
      $("estado").hidden = true;
      $("lista").hidden = false;
      render(clientes);
    } catch (error) {
      $("estado").textContent = error.message || "Falha ao carregar a Central de Suporte.";
    }
  }

  $("busca").addEventListener("input", () => {
    const q = $("busca").value.trim().toLowerCase();
    render(!q ? clientes : clientes.filter(c =>
      String(c.name || "").toLowerCase().includes(q) ||
      String(c.tenant_id || "").toLowerCase().includes(q)
    ));
  });

  $("btnFechar").addEventListener("click", () => $("modalAcesso").close());
  $("btnCancelar").addEventListener("click", () => $("modalAcesso").close());

  $("formAcesso").addEventListener("submit", async event => {
    event.preventDefault();
    if (!selecionado) return;
    if (!$("formAcesso").reportValidity()) return;

    const botao = $("btnAcessar");
    botao.disabled = true;
    botao.textContent = "Criando sessão...";
    $("mensagem").textContent = "";

    try {
      const tokenOriginal = FusionAuth.tokenAtual();
      const usuarioOriginal = FusionAuth.usuarioAtual();
      const tenantOriginal = localStorage.getItem("fusionTenantId") || usuarioOriginal?.tenantId || "";

      const resp = await FusionAuth.fetchAuth("/api/suporte/acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selecionado.tenant_id,
          motivo: $("motivo").value.trim()
        })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível iniciar o suporte.");

      sessionStorage.setItem("fusionSupportOriginalToken", tokenOriginal);
      sessionStorage.setItem("fusionSupportOriginalUsuario", JSON.stringify(usuarioOriginal || {}));
      sessionStorage.setItem("fusionSupportOriginalTenantId", tenantOriginal);

      FusionAuth.salvarSessao(json.token, json.usuario, json.tenantId);
      location.replace(`/pages/dashboard/index.html?tenant=${encodeURIComponent(json.tenantId)}&suporte=1`);
    } catch (error) {
      $("mensagem").textContent = error.message || "Não foi possível iniciar o acesso.";
      botao.disabled = false;
      botao.textContent = "Acessar por 30 minutos";
    }
  });

  iniciar();
})();
