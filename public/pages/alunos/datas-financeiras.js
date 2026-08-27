// AJUSTE DE DATAS FINANCEIRAS - FICHA DO ALUNO 20260826
(() => {
  const params = new URLSearchParams(location.search);
  const alunoId = params.get("id") || params.get("alunoId") || params.get("aluno_id") || "";
  const $ = (id) => document.getElementById(id);

  function esc(v = "") {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function moeda(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  }
  function dataBR(v) {
    const s = String(v || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`
      : "-";
  }
  function fetchAuth(url, opcoes = {}) {
    if (window.FusionAuth?.fetchAuth) return window.FusionAuth.fetchAuth(url, opcoes);
    return fetch(url, opcoes);
  }
  async function api(url, opcoes = {}) {
    const resp = await fetchAuth(url, { cache:"no-store", ...opcoes });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.ok === false) {
      throw new Error(json?.mensagem || json?.erro || `HTTP ${resp.status}`);
    }
    return json;
  }

  let estado = { registros: [] };

  function garantirCard() {
    if (!alunoId) return false;
    if ($("alunoDatasFinanceirasCard")) return true;
    const painel = document.querySelector("#tab-financeiro");
    if (!painel) return false;

    const card = document.createElement("div");
    card.id = "alunoDatasFinanceirasCard";
    card.className = "fusion-card aluno-datas-financeiras-card";
    card.innerHTML = `
      <div class="adf-head">
        <div>
          <small>CORREÇÃO ADMINISTRATIVA</small>
          <h3>Datas financeiras do aluno</h3>
          <p>Vencimentos podem ser corrigidos após a matrícula. Pagamentos já lançados também podem ter a data corrigida, mantendo valor e status.</p>
        </div>
        <button type="button" id="adfAtualizar">Atualizar</button>
      </div>

      <div class="adf-regra-mensal" id="adfRegraMensal">
        <div class="adf-regra-texto">
          <strong>Dia do vencimento todo mês</strong>
          <small id="adfRegraResumo">Carregando regra mensal...</small>
        </div>
        <label>
          <span>Dia</span>
          <select id="adfDiaVencimentoMensal"></select>
        </label>
        <button type="button" id="adfSalvarDiaMensal">Salvar dia mensal</button>
      </div>
      <div id="adfMensagem" class="adf-msg"></div>
      <div class="adf-table-wrap">
        <table class="adf-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Data do pagamento</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="adfLinhas">
            <tr><td colspan="6">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
      <p class="adf-foot">
        Alterar a data do pagamento exige motivo e atualiza os vínculos do mesmo recebimento/caixa para evitar divergência no BI e nos relatórios.
      </p>
    `;
    painel.prepend(card);
    $("adfAtualizar")?.addEventListener("click", carregar);
    $("adfSalvarDiaMensal")?.addEventListener("click", salvarRegraMensal);
    $("adfLinhas")?.addEventListener("click", (ev) => {
      const botao = ev.target.closest?.("[data-adf-salvar]");
      if (botao) salvar(botao.dataset.adfSalvar);
    });
    return true;
  }

  function render() {
    const tbody = $("adfLinhas");
    if (!tbody) return;

    const lista = Array.isArray(estado.registros) ? estado.registros : [];
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6">Nenhum lançamento financeiro localizado para este aluno.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map((r, i) => {
      const pago = r.pago === true;
      return `
        <tr data-adf-row="${i}">
          <td>
            <strong>${esc(r.descricao || r.competencia || "Lançamento")}</strong>
            <small>${esc(r.competencia || "")}</small>
          </td>
          <td><span class="adf-status">${esc(r.status || "-")}</span></td>
          <td>${esc(moeda(r.valor))}</td>
          <td>
            <input type="date" data-adf-venc value="${esc(r.vencimento || "")}">
            <small>Atual: ${esc(dataBR(r.vencimento))}</small>
          </td>
          <td>
            <input type="date" data-adf-pag value="${esc(r.dataPagamento || "")}" ${pago ? "" : "disabled"}>
            <input type="text" data-adf-motivo placeholder="${pago ? "Motivo se alterar pagamento" : "Ainda não pago"}" ${pago ? "" : "disabled"}>
            <small>${pago ? `Atual: ${esc(dataBR(r.dataPagamento))}` : "Sem baixa registrada"}</small>
          </td>
          <td><button type="button" data-adf-salvar="${i}">Salvar datas</button></td>
        </tr>
      `;
    }).join("");
  }


// DIA VENCIMENTO MENSAL ALUNO UI 20260826
async function carregarRegraMensal() {
  const select = $("adfDiaVencimentoMensal");
  const resumo = $("adfRegraResumo");
  if (!select || !resumo) return;

  if (!select.options.length) {
    select.innerHTML = Array.from({length:28}, (_, i) =>
      `<option value="${i + 1}">${String(i + 1).padStart(2, "0")}</option>`
    ).join("");
  }

  try {
    const regra = await api(`/api/alunos/${encodeURIComponent(alunoId)}/dia-vencimento-mensal`);
    const dia = Number(regra?.diaVencimento || 0);
    if (dia >= 1 && dia <= 28) select.value = String(dia);
    resumo.textContent = dia
      ? `Regra atual: todo dia ${String(dia).padStart(2, "0")}. Próximo vencimento: ${dataBR(regra?.proximoVencimento)}.`
      : "Nenhum dia mensal definido. Escolha de 1 a 28.";
    select.dataset.original = dia ? String(dia) : "";
  } catch (e) {
    resumo.textContent = e.message || "Não foi possível carregar a regra mensal.";
  }
}

async function salvarRegraMensal() {
  const select = $("adfDiaVencimentoMensal");
  const botao = $("adfSalvarDiaMensal");
  const resumo = $("adfRegraResumo");
  if (!select || !botao || !resumo) return;

  const dia = Number(select.value || 0);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    alert("Escolha um dia entre 1 e 28.");
    return;
  }

  const original = Number(select.dataset.original || 0);
  if (original === dia) {
    alert(`O vencimento mensal já está definido para o dia ${String(dia).padStart(2, "0")}.`);
    return;
  }

  if (!confirm(
    `Alterar o vencimento mensal para todo dia ${String(dia).padStart(2, "0")}?\n\n` +
    "Pagamentos históricos não serão alterados. Faturas futuras ainda não pagas acompanharão o novo dia."
  )) return;

  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    const regra = await api(`/api/alunos/${encodeURIComponent(alunoId)}/dia-vencimento-mensal`, {
      method:"PUT",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ diaVencimento: dia })
    });
    select.dataset.original = String(dia);
    resumo.textContent =
      `Regra salva: todo dia ${String(dia).padStart(2, "0")}. Próximo vencimento: ${dataBR(regra?.proximoVencimento)}.`;
    const msg = $("adfMensagem");
    if (msg) {
      msg.textContent = "Dia de vencimento mensal atualizado. Faturas futuras em aberto foram sincronizadas.";
      msg.dataset.tipo = "ok";
    }
    await carregar();
  } catch (e) {
    const msg = $("adfMensagem");
    if (msg) {
      msg.textContent = e.message || "Não foi possível alterar o dia de vencimento mensal.";
      msg.dataset.tipo = "erro";
    }
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar dia mensal";
  }
}

  async function carregar() {
    if (!garantirCard()) return;
    const msg = $("adfMensagem");
    try {
      if (msg) { msg.textContent = "Carregando..."; msg.dataset.tipo = ""; }
      estado = await api(`/api/alunos/${encodeURIComponent(alunoId)}/datas-financeiras`);
      render();
      if (msg) msg.textContent = "";
    } catch (e) {
      if (msg) { msg.textContent = e.message || "Falha ao carregar datas financeiras."; msg.dataset.tipo = "erro"; }
    }
  }

  async function salvar(indice) {
    const r = estado.registros?.[Number(indice)];
    const linha = document.querySelector(`[data-adf-row="${Number(indice)}"]`);
    if (!r || !linha) return;

    const novoVencimento = linha.querySelector("[data-adf-venc]")?.value || "";
    const novaDataPagamento = linha.querySelector("[data-adf-pag]")?.value || "";
    const motivo = linha.querySelector("[data-adf-motivo]")?.value?.trim() || "";
    const mudouVenc = novoVencimento !== String(r.vencimento || "");
    const mudouPag = r.pago === true && novaDataPagamento !== String(r.dataPagamento || "");

    if (!mudouVenc && !mudouPag) {
      alert("Nenhuma data foi alterada.");
      return;
    }
    if (mudouPag && motivo.length < 5) {
      alert("Informe o motivo da correção da data de pagamento.");
      linha.querySelector("[data-adf-motivo]")?.focus();
      return;
    }

    const payload = { registroId: r.id };
    if (mudouVenc) payload.novoVencimento = novoVencimento;
    if (mudouPag) {
      payload.novaDataPagamento = novaDataPagamento;
      payload.motivo = motivo;
    }

    const botao = linha.querySelector("[data-adf-salvar]");
    const msg = $("adfMensagem");
    if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }

    try {
      estado = await api(`/api/alunos/${encodeURIComponent(alunoId)}/datas-financeiras`, {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(payload)
      });
      render();
      if (msg) {
        msg.textContent = "Datas atualizadas e auditadas. Recarregando a ficha...";
        msg.dataset.tipo = "ok";
      }
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      if (msg) { msg.textContent = e.message || "Não foi possível alterar as datas."; msg.dataset.tipo = "erro"; }
      if (botao) { botao.disabled = false; botao.textContent = "Salvar datas"; }
    }
  }

  function iniciar() {
    garantirCard();
    carregar();
    carregarRegraMensal();
    document.addEventListener("click", (ev) => {
      if (ev.target.closest?.('[data-tab="financeiro"]')) setTimeout(() => { carregar(); carregarRegraMensal(); }, 80);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once:true });
  else iniciar();
})();
