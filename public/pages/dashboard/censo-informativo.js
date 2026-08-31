(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
  const norm = (v) => String(v ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function fetchAuth(url) {
    if (window.FusionAuth?.fetchAuth) return window.FusionAuth.fetchAuth(url);
    return fetch(url, { cache: "no-store" });
  }

  async function json(url) {
    const r = await fetchAuth(url);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.mensagem || data?.erro || `Erro HTTP ${r.status}`);
    return data;
  }

  function lista(data, chaves = []) {
    if (Array.isArray(data)) return data;
    for (const k of chaves) if (Array.isArray(data?.[k])) return data[k];
    if (Array.isArray(data?.dados)) return data.dados;
    return [];
  }

  function numero(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = String(v ?? "").replace("R$", "").replace(/\s/g, "").trim();
    if (!s) return 0;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : 0;
  }

  function moeda(v) {
    return numero(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function dataISO(v) {
    const s = String(v ?? "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
  }

  function dataBR(v) {
    const s = dataISO(v);
    if (!s) return "-";
    const [a,m,d] = s.split("-");
    return `${d}/${m}/${a}`;
  }

  function idAluno(a = {}) {
    return String(a.alunoId || a.aluno_id || a.idAluno || "");
  }

  function sexo(a = {}) {
    const s = norm(a.sexo || a.genero || a.gênero);
    if (["masculino","masc","m"].includes(s)) return "masculino";
    if (["feminino","fem","f"].includes(s)) return "feminino";
    return "";
  }

  function valorPeso(av = {}) {
    return numero(av.peso ?? av.assistente_contexto?.composicao?.peso);
  }

  function valorAltura(av = {}) {
    let n = numero(av.altura ?? av.assistente_contexto?.composicao?.altura);
    if (n > 3 && n <= 250) n /= 100;
    return n >= 0.5 && n <= 2.5 ? n : 0;
  }

  function dataAvaliacao(av = {}) {
    return dataISO(av.data || av.atualizadoEm || av.atualizado_em || av.criadoEm || av.criado_em);
  }

  function maisRecentesPorAluno(avaliacoes = []) {
    const map = new Map();
    for (const av of avaliacoes) {
      const id = idAluno(av);
      if (!id) continue;
      const atual = map.get(id);
      if (!atual || dataAvaliacao(av) >= dataAvaliacao(atual)) map.set(id, av);
    }
    return [...map.values()];
  }

  function ehFumante(av = {}) {
    const v = av.risco_tabagismo
      ?? av.selecoes_estruturadas?.risco_tabagismo?.valor
      ?? av.triagem_selecoes?.risco_tabagismo?.valor;
    if (v === true) return true;
    if (typeof v === "number") return v > 0;
    const s = norm(v);
    if (!s) return false;
    if (["sim","s","true","fumante","tabagista","positivo","presente"].includes(s)) return true;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n > 0;
  }

  function renderFaixas(censo = {}) {
    const el = $("censoFaixas");
    if (!el) return;
    const itens = Array.isArray(censo.faixasEtarias) ? censo.faixasEtarias : [];
    el.innerHTML = itens.length ? itens.map(x =>
      `<div class="censo-linha"><span>${esc(x.faixa)} anos</span><b>${Number(x.total || 0)} <small>M ${Number(x.masculino || 0)} · F ${Number(x.feminino || 0)}</small></b></div>`
    ).join("") : '<span class="censo-sem-dado">Sem datas de nascimento.</span>';
  }

  function linhaExtremo(rotulo, dado, sufixo = "") {
    if (!dado?.nome) return `<div class="censo-linha"><span>${esc(rotulo)}</span><b class="censo-sem-dado">Sem dado</b></div>`;
    return `<div class="censo-linha"><span>${esc(rotulo)}</span><b>${esc(dado.nome)}${sufixo ? ` <small>${esc(sufixo)}</small>` : ""}</b></div>`;
  }

  function renderExtremos(censo, alunos, avaliacoes) {
    const alunosMap = new Map(alunos.map(a => [String(a.id || a.alunoId || a.aluno_id || ""), a]));
    const ultimas = maisRecentesPorAluno(avaliacoes);

    for (const sx of ["masculino", "feminino"]) {
      const dados = ultimas.map(av => {
        const aluno = alunosMap.get(idAluno(av));
        if (!aluno || sexo(aluno) !== sx) return null;
        return { nome: aluno.nome || av.alunoNome || "Aluno", peso: valorPeso(av), altura: valorAltura(av) };
      }).filter(Boolean);

      const pesos = dados.filter(x => x.peso >= 20 && x.peso <= 300);
      const alturas = dados.filter(x => x.altura >= 0.5 && x.altura <= 2.5);

      const maiorPeso = [...pesos].sort((a,b) => b.peso - a.peso)[0] || null;
      const menorPeso = [...pesos].sort((a,b) => a.peso - b.peso)[0] || null;
      const maiorAltura = [...alturas].sort((a,b) => b.altura - a.altura)[0] || null;
      const menorAltura = [...alturas].sort((a,b) => a.altura - b.altura)[0] || null;
      const velho = censo?.maisVelho?.[sx] || null;

      const el = $(sx === "masculino" ? "censoExtremosMasculino" : "censoExtremosFeminino");
      if (!el) continue;
      el.innerHTML = [
        linhaExtremo("Mais velho", velho, velho?.idade != null ? `${velho.idade} anos` : ""),
        linhaExtremo("Maior peso", maiorPeso, maiorPeso ? `${maiorPeso.peso.toFixed(1)} kg` : ""),
        linhaExtremo("Menor peso", menorPeso, menorPeso ? `${menorPeso.peso.toFixed(1)} kg` : ""),
        linhaExtremo("Mais alto", maiorAltura, maiorAltura ? `${maiorAltura.altura.toFixed(2)} m` : ""),
        linhaExtremo("Mais baixo", menorAltura, menorAltura ? `${menorAltura.altura.toFixed(2)} m` : "")
      ].join("");
    }

    const avaliadosTabagismo = ultimas.filter(av =>
      av.risco_tabagismo !== undefined
      || av.selecoes_estruturadas?.risco_tabagismo?.valor !== undefined
      || av.triagem_selecoes?.risco_tabagismo?.valor !== undefined
    );
    const fumantes = avaliadosTabagismo.filter(ehFumante).length;
    if ($("censoFumantes")) $("censoFumantes").textContent = String(fumantes);
    if ($("censoFumantesBase")) $("censoFumantesBase").textContent =
      avaliadosTabagismo.length ? `base: ${avaliadosTabagismo.length} aluno(s) avaliado(s)` : "sem dados de tabagismo";
  }

  function segundaFeira(data) {
    const d = new Date(`${dataISO(data)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    const dia = d.getDay();
    const delta = dia === 0 ? -6 : 1 - dia;
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  function addDias(iso, dias) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  function saldoMensalidade(m = {}) {
    const st = norm(m.status);
    if (["pago","paga","recebido","recebida","quitado","quitada","baixado","baixada","cancelado","cancelada","estornado","estornada"].includes(st)) return 0;
    const resto = numero(m.valorRestante ?? m.saldoRestante ?? m.saldo);
    if (resto > 0) return resto;
    return Math.max(0, numero(m.valorDevido ?? m.valorOriginal ?? m.total ?? m.valor));
  }

  function renderSemanaReceber(mensalidades = []) {
    const agora = new Date();
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,"0")}-${String(agora.getDate()).padStart(2,"0")}`;
    const mapa = new Map();

    for (const m of mensalidades) {
      const venc = dataISO(m.vencimento || m.dataVencimento || m.data_vencimento);
      if (!venc || venc < hoje) continue;
      const saldo = saldoMensalidade(m);
      if (saldo <= 0) continue;
      const inicio = segundaFeira(venc);
      if (!inicio) continue;
      const atual = mapa.get(inicio) || { valor: 0, titulos: 0 };
      atual.valor += saldo;
      atual.titulos += 1;
      mapa.set(inicio, atual);
    }

    const melhor = [...mapa.entries()].sort((a,b) => b[1].valor - a[1].valor || a[0].localeCompare(b[0]))[0];
    if (!melhor) {
      $("censoSemanaReceber").textContent = "-";
      $("censoSemanaReceberPeriodo").textContent = "sem valores futuros programados";
      return;
    }

    const [inicio, dados] = melhor;
    const fim = addDias(inicio, 6);
    $("censoSemanaReceber").textContent = moeda(dados.valor);
    $("censoSemanaReceberPeriodo").textContent = `${dataBR(inicio)} a ${dataBR(fim)} · ${dados.titulos} título(s)`;
  }

  function renderHoras(censo = {}) {
    const el = $("censoHorasPico");
    if (!el) return;
    const itens = Array.isArray(censo.horasPico) ? censo.horasPico : [];
    el.innerHTML = itens.length ? itens.map((x, i) =>
      `<div class="censo-linha"><span>${i + 1}º · ${esc(x.faixa)}</span><b>${Number(x.entradas || 0)} <small>entradas</small></b></div>`
    ).join("") : '<span class="censo-sem-dado">Sem entradas com horário.</span>';
  }

  function renderMovimento(censo = {}) {
    const el = $("censoMovimentoGrafico");
    if (!el) return;
    const dados = Array.isArray(censo.movimentoMes) ? censo.movimentoMes : [];
    const total = dados.reduce((s,x) => s + Number(x.entradas || 0), 0);
    if ($("censoMovimentoTotal")) $("censoMovimentoTotal").textContent = `${total} entrada${total === 1 ? "" : "s"}`;

    if (!dados.length) {
      el.innerHTML = '<span class="censo-sem-dado">Sem movimento registrado no mês.</span>';
      return;
    }

    const w = 900, h = 100, px = 16, py = 12;
    const max = Math.max(1, ...dados.map(x => Number(x.entradas || 0)));
    const step = dados.length > 1 ? (w - px * 2) / (dados.length - 1) : 0;
    const pts = dados.map((x,i) => {
      const xx = px + i * step;
      const yy = h - py - (Number(x.entradas || 0) / max) * (h - py * 2);
      return { ...x, x: xx, y: yy };
    });

    const path = pts.map((p,i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const rotulos = pts.filter((_,i) => i === 0 || i === pts.length - 1 || i % Math.max(1, Math.ceil(pts.length / 6)) === 0);

    el.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Movimento diário de alunos no mês">
        <line class="grid" x1="${px}" y1="${h-py}" x2="${w-px}" y2="${h-py}"></line>
        <line class="grid" x1="${px}" y1="${py}" x2="${w-px}" y2="${py}"></line>
        <path class="linha" d="${path}"></path>
        ${pts.map(p => `<circle class="ponto" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2"><title>${dataBR(p.data)}: ${p.entradas} entradas</title></circle>`).join("")}
        ${rotulos.map(p => `<text class="rotulo" x="${p.x.toFixed(1)}" y="${h-1}" text-anchor="middle">${esc(dataBR(p.data).slice(0,5))}</text>`).join("")}
      </svg>`;
  }

  async function carregarCenso() {
    const status = $("censoAtualizado");
    try {
      const [bi, alunosRaw, avaliacoesRaw, mensalidadesRaw] = await Promise.all([
        json("/api/bi/executivo"),
        json("/api/alunos"),
        json("/api/avaliacoes"),
        json("/api/mensalidades")
      ]);

      const censo = bi?.censo || {};
      const alunos = lista(alunosRaw, ["alunos"]);
      const avaliacoes = lista(avaliacoesRaw, ["avaliacoes"]);
      const mensalidades = lista(mensalidadesRaw, ["mensalidades"]);

      $("censoMasculino").textContent = String(censo?.sexo?.masculino || 0);
      $("censoFeminino").textContent = String(censo?.sexo?.feminino || 0);

      renderFaixas(censo);
      renderExtremos(censo, alunos, avaliacoes);
      renderSemanaReceber(mensalidades);
      renderHoras(censo);
      renderMovimento(censo);

      if (status) status.textContent = `Atualizado ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
    } catch (e) {
      console.error("Falha ao carregar censo informativo:", e);
      if (status) status.textContent = e.message || "Falha ao atualizar";
    }
  }

  document.addEventListener("DOMContentLoaded", carregarCenso);
})();
