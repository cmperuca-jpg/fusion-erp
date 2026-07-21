(function(){
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || params.get("matriculaId") || params.get("numero");

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));
  }
  function texto(v, padrao = "-") {
    return v === undefined || v === null || String(v).trim() === "" ? padrao : String(v);
  }
  function numero(v) {
    const n = Number(String(v ?? 0).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function moeda(v) {
    const n = numero(v);
    return n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";
  }
  function data(v) {
    if (!v) return "-";
    const s = String(v).slice(0, 10);
    const p = s.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : texto(v);
  }
  function set(idCampo, valor) {
    const el = $(idCampo);
    if (el) el.textContent = valor;
  }
  function html(idCampo, valor) {
    const el = $(idCampo);
    if (el) el.innerHTML = valor;
  }
  function servicos(m) {
    return Array.isArray(m.servicos) ? m.servicos : (Array.isArray(m.turmas) ? m.turmas : []);
  }
  function renderServicos(m) {
    const lista = servicos(m);
    if (!lista.length) return esc(texto(m.turma || m.turmaNome));
    return lista.map((s) => `
      <div style="padding:10px 0;border-bottom:1px solid #cbd5e1">
        <strong>${esc(s.nome || "-")}</strong><br>
        Modalidade: ${esc(s.modalidade || "-")} | Professor: ${esc(s.professor || "-")}<br>
        Dias: ${esc(s.diasSemana || "-")} | Horario: ${esc(s.horario || "-")} | Local: ${esc(s.sala || "-")}
      </div>
    `).join("");
  }
  function proximaMensalidade(m) {
    return m.mensalidadeProxima || m.proximaMensalidade || null;
  }
  function resumoProximaMensalidade(m) {
    const prox = proximaMensalidade(m);
    const fin = m.financeiroProximo || null;
    const vencimento = prox?.vencimento || fin?.vencimento || m.proximoVencimento || "";
    const valor = prox?.valor ?? prox?.total ?? prox?.valorRestante ?? fin?.valor ?? fin?.valorRestante ?? m.valorMensalTotal ?? m.valorMensal;
    const competencia = prox?.competencia || fin?.competencia || String(vencimento || "").slice(0, 7);
    const status = prox?.status || fin?.status || (vencimento ? "Prevista" : "");

    if (!prox && !fin && !vencimento) {
      return `
        <div class="ficha-financeiro-bloco">
          <p class="warn"><b>Proxima mensalidade</b><br>Nenhum lancamento futuro foi localizado para esta matricula.</p>
        </div>
      `;
    }

    return `
      <div class="ficha-financeiro-bloco">
        <p class="${prox || fin ? "ok" : "warn"}">
          <b>${prox || fin ? "Proxima mensalidade gerada" : "Proximo vencimento previsto"}</b><br>
          Competencia: ${esc(competencia || "-")}<br>
          Vencimento: ${esc(data(vencimento))}<br>
          Valor: ${esc(moeda(valor))}<br>
          Status: ${esc(status || "-")}
        </p>
      </div>
    `;
  }
  function preencher(m) {
    $("tituloMatricula").textContent = m.numero ? `Matricula ${m.numero}` : "Matricula";
    set("aluno", texto(m.aluno || m.nomeAluno));
    html("turma", renderServicos(m));
    set("modalidade", texto(m.modalidade));
    set("professor", texto(m.professor));
    set("horario", texto(m.horario));
    set("sala", texto(m.sala));
    set("data_matricula", data(m.dataMatricula));
    set("data_inicio", data(m.dataInicio));
    set("data_fim", data(m.dataFim));
    set("plano", `${texto(m.plano)} | ${texto(m.tipoPlano || m.tipoCobranca)}`);
    set("valor", moeda(m.valorMensalTotal ?? m.valorMensal ?? m.valorTotalInicial));
    set("forma_pagamento", texto(m.formaPagamento));
    set("status", texto(m.status));

    const obs = $("observacoes");
    if (obs) {
      obs.innerHTML = `
        ${esc(texto(m.observacao || m.observacoes, "Sem observacoes."))}
        <br><br>
        <b>Resumo financeiro</b><br>
        Taxa de matricula: ${esc(moeda(m.valorMatricula))}<br>
        Mensalidade do plano: ${esc(moeda(m.valorMensalTotal ?? m.valorMensal))}<br>
        Desconto inicial: ${esc(moeda(m.descontoMatricula))}<br>
        <b>Total inicial: ${esc(moeda(m.valorTotalInicial))}</b><br>
        <small>Turmas nao alteram o financeiro.</small>
        ${resumoProximaMensalidade(m)}
      `;
    }

    const btn = $("btnEditar");
    if (btn) btn.onclick = () => location.href = `/pages/matriculas/cadastro.html?id=${encodeURIComponent(m.id || id)}`;
  }
  async function carregar() {
    if (!id || id === "undefined" || id === "null") {
      $("tituloMatricula").textContent = "Matricula nao informada";
      return;
    }
    try {
      const res = await fetch(`/api/matriculas/${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.erro || "Erro ao carregar matricula.");
      preencher(j.dados || j.matricula || j);
    } catch (e) {
      $("tituloMatricula").textContent = "Erro ao carregar matricula";
      set("observacoes", e.message);
    }
  }
  carregar();
})();
