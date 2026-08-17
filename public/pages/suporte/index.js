(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let clientes = [];
  let planos = [];
  let selecionado = null;

  function esc(v = "") {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
  }

  function texto(v = "") {
    return String(v ?? "").trim();
  }

  function dinheiro(valor = 0) {
    const n = Number(valor || 0);
    if (!Number.isFinite(n) || n <= 0) return "A definir";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(n);
  }

  function dataBR(valor = "") {
    const raw = texto(valor).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
    const [ano, mes, dia] = raw.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function planoPorCodigo(codigo = "") {
    return planos.find(p => p.codigo === codigo) || null;
  }

  function labelPlano(plano = {}) {
    if (!plano?.codigo) return "";
    if (plano.codigo === "free") return "Sem cobrança";
    if (plano.ciclo === "anual") return `${dinheiro(plano.valorCiclo)} / ano`;
    return `${dinheiro(plano.valorMensal)} / mês`;
  }

  function statusClasse(status = "") {
    const s = texto(status).toLowerCase();
    if (["active", "ativa", "trial"].includes(s)) return "ok";
    if (["suspended", "suspensa", "cancelled", "cancelada"].includes(s)) return "bloqueado";
    if (["inadimplente"].includes(s)) return "alerta";
    return "";
  }

  function renderPlanos() {
    const area = $("planos");
    if (!area) return;
    if (!planos.length) {
      area.innerHTML = "";
      return;
    }

    area.innerHTML = planos.map(plano => `
      <article class="plano">
        <strong>${esc(plano.nome || plano.codigo)}</strong>
        <span>${esc(labelPlano(plano))}</span>
        <small>${esc(plano.descricao || "")}</small>
      </article>
    `).join("");
  }

  function opcoesPlanos(atual = "") {
    return planos.map(plano => `
      <option value="${esc(plano.codigo)}" ${plano.codigo === atual ? "selected" : ""}>
        ${esc(plano.nome || plano.codigo)}
      </option>
    `).join("");
  }

  function resumoCobranca(c = {}) {
    const assinatura = c.billing || null;
    if (!assinatura) {
      return `<span class="subinfo">Billing ainda não formalizado.</span>`;
    }

    const proxima = dataBR(assinatura.proximaCobrancaEm);
    const suspenso = dataBR(assinatura.suspensoEm);
    const partes = [
      assinatura.ciclo ? `Ciclo ${assinatura.ciclo}` : "",
      proxima ? `Próxima cobrança ${proxima}` : "",
      suspenso ? `Suspensa em ${suspenso}` : ""
    ].filter(Boolean);

    return `
      <span class="subinfo">${esc(partes.join(" · ") || "Sem próxima cobrança registrada.")}</span>
      ${assinatura.motivoStatus ? `<span class="motivo">${esc(assinatura.motivoStatus)}</span>` : ""}
    `;
  }

  function render(lista) {
    if (!lista.length) {
      $("lista").innerHTML = `<section class="estado">Nenhuma academia encontrada.</section>`;
      return;
    }

    $("lista").innerHTML = lista.map(c => {
      const assinatura = c.billing || {};
      const planoAtual = assinatura.planoCodigo || c.plan_code || "free";
      const statusBilling = assinatura.status || "sem billing";
      return `
        <article class="cliente" data-tenant="${esc(c.tenant_id)}">
          <header class="cliente-head">
            <div>
              <h2>${esc(c.name || c.tenant_id)}</h2>
              <small>${esc(c.tenant_id)}</small>
            </div>
            <div class="meta">
              <span class="pill ${statusClasse(c.status)}">${esc(c.status || "")}</span>
              <span class="pill ${statusClasse(statusBilling)}">${esc(statusBilling)}</span>
            </div>
          </header>

          <div class="billing-row">
            <div>
              <span class="label">Plano atual</span>
              <strong>${esc(assinatura.planoNome || planoPorCodigo(planoAtual)?.nome || planoAtual)}</strong>
              ${resumoCobranca(c)}
              ${c.billingErro ? `<span class="motivo erro">${esc(c.billingErro)}</span>` : ""}
            </div>
            <label>
              Alterar plano
              <select data-plano-select="${esc(c.tenant_id)}">
                ${opcoesPlanos(planoAtual)}
              </select>
            </label>
          </div>

          <div class="acoes">
            <button type="button" class="secundario" data-plano="${esc(c.tenant_id)}">Aplicar plano</button>
            <button type="button" class="perigo" data-bloquear="${esc(c.tenant_id)}">Bloquear</button>
            <button type="button" class="sucesso" data-desbloquear="${esc(c.tenant_id)}">Desbloquear</button>
            <button type="button" class="primario" data-acessar="${esc(c.tenant_id)}">Acessar suporte</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function listaFiltrada() {
    const q = $("busca").value.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(c => [
      c.name,
      c.tenant_id,
      c.status,
      c.plan_code,
      c.billing?.planoCodigo,
      c.billing?.planoNome,
      c.billing?.status
    ].some(valor => String(valor || "").toLowerCase().includes(q)));
  }

  function atualizarLista() {
    render(listaFiltrada());
  }

  async function carregarPlanos() {
    const resp = await FusionAuth.fetchAuth("/api/suporte/manutencao/planos", { cache: "no-store" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível carregar os planos Fusion.");
    planos = Array.isArray(json.planos) ? json.planos : [];
    renderPlanos();
  }

  async function carregarClientes() {
    const resp = await FusionAuth.fetchAuth("/api/suporte/clientes", { cache: "no-store" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível carregar as academias.");
    clientes = Array.isArray(json.clientes) ? json.clientes : [];
    $("estado").hidden = true;
    $("lista").hidden = false;
    atualizarLista();
  }

  async function postarManutencao(rota, body = {}) {
    const resp = await FusionAuth.fetchAuth(`/api/suporte/manutencao/${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Operação não concluída.");
    return json;
  }

  async function aplicarPlano(tenantId = "") {
    const select = Array
      .from(document.querySelectorAll("[data-plano-select]"))
      .find(el => el.dataset.planoSelect === tenantId);
    const planoCodigo = select?.value || "";
    const plano = planoPorCodigo(planoCodigo);
    if (!tenantId || !planoCodigo) return;

    if (!confirm(`Aplicar o plano "${plano?.nome || planoCodigo}" nesta academia?`)) return;

    $("estado").hidden = false;
    $("estado").textContent = "Aplicando plano...";
    await postarManutencao("plano", { tenantId, planoCodigo });
    await carregarClientes();
  }

  async function bloquear(tenantId = "") {
    const cliente = clientes.find(c => c.tenant_id === tenantId);
    const motivo = prompt(`Motivo do bloqueio de ${cliente?.name || tenantId}:`, "Bloqueio administrativo do Fusion.");
    if (motivo === null) return;

    $("estado").hidden = false;
    $("estado").textContent = "Bloqueando academia...";
    await postarManutencao("bloquear", { tenantId, motivo: motivo.trim() || "Bloqueio administrativo do Fusion." });
    await carregarClientes();
  }

  async function desbloquear(tenantId = "") {
    const cliente = clientes.find(c => c.tenant_id === tenantId);
    const motivo = prompt(`Motivo do desbloqueio de ${cliente?.name || tenantId}:`, "Regularização administrativa do Fusion.");
    if (motivo === null) return;

    $("estado").hidden = false;
    $("estado").textContent = "Desbloqueando academia...";
    await postarManutencao("desbloquear", { tenantId, motivo: motivo.trim() || "Regularização administrativa do Fusion." });
    await carregarClientes();
  }

  function abrirModalSuporte(tenantId = "") {
    selecionado = clientes.find(c => c.tenant_id === tenantId);
    if (!selecionado) return;
    $("nomeAcademia").textContent = selecionado.name || selecionado.tenant_id;
    $("motivo").value = "";
    $("mensagem").textContent = "";
    $("modalAcesso").showModal();
    setTimeout(() => $("motivo").focus(), 0);
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

      await carregarPlanos();
      await carregarClientes();
    } catch (error) {
      $("estado").hidden = false;
      $("estado").textContent = error.message || "Falha ao carregar a manutenção Fusion.";
    }
  }

  $("busca").addEventListener("input", atualizarLista);

  $("lista").addEventListener("click", event => {
    const target = event.target;
    const tenantAcessar = target?.dataset?.acessar;
    const tenantPlano = target?.dataset?.plano;
    const tenantBloquear = target?.dataset?.bloquear;
    const tenantDesbloquear = target?.dataset?.desbloquear;

    const executar = async acao => {
      try {
        await acao();
      } catch (error) {
        $("estado").hidden = false;
        $("estado").textContent = error.message || "Operação não concluída.";
      }
    };

    if (tenantAcessar) abrirModalSuporte(tenantAcessar);
    if (tenantPlano) executar(() => aplicarPlano(tenantPlano));
    if (tenantBloquear) executar(() => bloquear(tenantBloquear));
    if (tenantDesbloquear) executar(() => desbloquear(tenantDesbloquear));
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
