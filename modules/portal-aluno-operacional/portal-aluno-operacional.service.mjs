import { carregarBasePortalAluno } from "./portal-aluno-operacional.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","bloqueado","bloqueada","removido","removida"].includes(normalizar(item?.status || "Ativo")); }
function alunoNome(a = {}) { return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno"); }
function dinheiro(v) { const n = Number(String(v ?? 0).replace(",", ".")); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; }
function dataISO(v) { return texto(v).slice(0, 10); }
function pago(item = {}) { return ["pago","recebido","quitado","baixado"].includes(normalizar(item.status || item.statusPagamento)); }
function cancelado(item = {}) { return ["cancelado","cancelada","estornado","estornada","excluido","excluida"].includes(normalizar(item.status || item.situacao)) || item.cancelado === true || item.excluido === true; }
function programado(item = {}) {
  const s = normalizar(item.status || item.situacao);
  return ["programado","programada","agendado","agendada","previsto","prevista","futura","futuro"].includes(s) ||
    item.programada === true || item.programado === true || item.previsto === true;
}
function valorCobranca(item = {}) { return dinheiro(item.total ?? item.valorOriginal ?? item.valorBruto ?? item.valor); }
function valorRecebido(item = {}) { return dinheiro(item.valorPago ?? item.valorRecebido ?? item.recebido ?? item.valorLiquido); }
function saldoCobranca(item = {}) {
  if (pago(item) || cancelado(item) || programado(item)) return 0;
  const campos = [item.valorRestante, item.saldoRestante, item.saldo, item.valorAberto];
  const direto = campos.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
  if (direto !== undefined) return Math.max(0, dinheiro(direto));
  return Math.max(0, valorCobranca(item) - valorRecebido(item));
}
function chaveCobranca(item = {}, origem = "") {
  const mensalidadeId = item.mensalidadeId || (origem === "mensalidade" ? item.id : "");
  if (mensalidadeId) return `men:${mensalidadeId}`;
  if (item.lancamentoFinanceiroId || item.financeiroId) return `fin:${item.lancamentoFinanceiroId || item.financeiroId}`;
  return `${origem}:${item.id || item.descricao || Math.random()}`;
}
function normalizarCobranca(item = {}, origem = "") {
  const vencimento = dataISO(item.vencimento || item.dataVencimento || item.data_vencimento || item.competencia);
  const valor = valorCobranca(item);
  const saldo = saldoCobranca(item);
  const hoje = hojeISO();
  let estadoFinanceiro = "a_vencer";
  let statusExibicao = "A vencer";
  if (cancelado(item)) {
    estadoFinanceiro = "cancelado";
    statusExibicao = "Cancelado";
  } else if (pago(item) || saldo <= 0 && !programado(item)) {
    estadoFinanceiro = "pago";
    statusExibicao = "Pago";
  } else if (programado(item)) {
    estadoFinanceiro = "programada";
    statusExibicao = "Programada";
  } else if (vencimento && vencimento < hoje) {
    estadoFinanceiro = "divida_ativa";
    statusExibicao = "Em atraso";
  } else if (vencimento && vencimento === hoje) {
    estadoFinanceiro = "vence_hoje";
    statusExibicao = "Vence hoje";
  }
  return { ...item, origemPortal: origem, estadoFinanceiro, statusExibicao, statusPortal: estadoFinanceiro, valorPortal: valor, saldoPortal: saldo, vencimento };
}
function ordenarAsc(lista = []) {
  return [...lista].sort((a,b) => String(a.vencimento || a.competencia || "").localeCompare(String(b.vencimento || b.competencia || "")));
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find(ativo) || lista[0] || null;
}

function servicosAtivosDoContrato(servicos, contratoId) {
  return servicos.filter((s) => String(s.contratoId) === String(contratoId) && ativo(s));
}

function dataDiaSemana(dataISO = hojeISO()) {
  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);
  const nomes = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
  return nomes[data.getDay()];
}

function ocorreNoDia(diasSemana = "", dataISO = hojeISO()) {
  const dias = normalizar(diasSemana);
  if (!dias || dias.includes("livre")) return true;
  if (dias.includes("segunda a sexta")) return !["sabado","domingo"].includes(dataDiaSemana(dataISO));
  if (dias.includes("segunda a sabado")) return dataDiaSemana(dataISO) !== "domingo";
  return dias.includes(dataDiaSemana(dataISO));
}

function frequenciasAluno(frequencia, alunoId) {
  return frequencia
    .filter((f) => String(f.alunoId) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function treinosAluno(treinos, alunoId) {
  return treinos
    .filter((t) => String(t.alunoId || t.aluno_id) === String(alunoId) && !["cancelado","inativo","arquivado"].includes(normalizar(t.status || "ativo")))
    .sort((a,b) => String(b.criadoEm || b.dataInicio || "").localeCompare(String(a.criadoEm || a.dataInicio || "")));
}

function avaliacoesAluno(avaliacoes, alunoId) {
  return avaliacoes
    .filter((a) => String(a.alunoId || a.aluno_id) === String(alunoId))
    .sort((a,b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function financeiroAluno(mensalidades, financeiro, alunoId) {
  const mensalidadesAluno = mensalidades.filter((m) => String(m.alunoId) === String(alunoId));
  const lancamentos = financeiro.filter((f) => String(f.alunoId) === String(alunoId));
  const mapa = new Map();
  const adicionar = (item, origem) => {
    const registro = normalizarCobranca(item, origem);
    const chave = chaveCobranca(item, origem);
    const atual = mapa.get(chave);
    if (!atual) mapa.set(chave, registro);
    else if (atual.estadoFinanceiro === "programada" && registro.estadoFinanceiro !== "programada") mapa.set(chave, registro);
  };
  mensalidadesAluno.forEach((item) => adicionar(item, "mensalidade"));
  lancamentos.forEach((item) => adicionar(item, "financeiro"));
  const todos = [...mapa.values()];
  const dividaAtiva = ordenarAsc(todos.filter((x) => x.estadoFinanceiro === "divida_ativa"));
  const venceHoje = ordenarAsc(todos.filter((x) => x.estadoFinanceiro === "vence_hoje"));
  const aVencer = ordenarAsc(todos.filter((x) => x.estadoFinanceiro === "a_vencer"));
  const programadas = ordenarAsc(todos.filter((x) => x.estadoFinanceiro === "programada"));
  const abertos = [...dividaAtiva, ...venceHoje, ...aVencer];
  const totalAberto = abertos.reduce((t, x) => t + dinheiro(x.saldoPortal), 0);
  const totalDividaAtiva = dividaAtiva.reduce((t, x) => t + dinheiro(x.saldoPortal), 0);
  const totalProgramado = programadas.reduce((t, x) => t + dinheiro(x.valorPortal), 0);
  return {
    mensalidades: mensalidadesAluno.slice(-12).reverse(),
    lancamentos: lancamentos.slice(-12).reverse(),
    abertos,
    dividaAtiva,
    venceHoje,
    aVencer,
    programadas,
    proximaMensalidade: [...programadas, ...aVencer, ...venceHoje][0] || null,
    totalAberto: dinheiro(totalAberto),
    totalDividaAtiva: dinheiro(totalDividaAtiva),
    totalProgramado: dinheiro(totalProgramado)
  };
}

function montarAgendaAluno(servicos = [], data = hojeISO()) {
  const todos = servicos.map((s) => ({
    servicoContratadoId: s.id || s.servicoContratadoId || "",
    turmaId: String(s.turmaId || ""),
    turma: s.turma || s.nome || "",
    modalidade: s.modalidade || "",
    professor: s.professor || "",
    diasSemana: s.diasSemana || "",
    horario: s.horario || "",
    sala: s.sala || "",
    ocorreHoje: ocorreNoDia(s.diasSemana, data),
    valor: dinheiro(s.valor),
    tipoCobranca: s.tipoCobranca || "Mensal"
  }));
  return { hoje: todos.filter((x) => x.ocorreHoje), todos };
}

export async function statusPortalAlunoOperacional() {
  return {
    ok: true,
    modulo: "portal-aluno-operacional",
    versao: "Fusion ERP 2.4",
    status: "Online",
    conceito: "Portal do aluno baseado em contrato comercial, serviços, agenda, frequência, treinos e financeiro"
  };
}

export async function obterPortalAluno(alunoId, filtros = {}) {
  const data = filtros.data || hojeISO();
  const base = await carregarBasePortalAluno();
  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  const servicosAtivos = contrato ? servicosAtivosDoContrato(base.servicosContratados, contrato.id) : [];
  const agenda = montarAgendaAluno(servicosAtivos, data);
  const frequencias = frequenciasAluno(base.frequencia, alunoId);
  const treinos = treinosAluno(base.treinos, alunoId);
  const avaliacoes = avaliacoesAluno(base.avaliacoes, alunoId);
  const financeiro = financeiroAluno(base.mensalidades, base.financeiro, alunoId);

  return {
    ok: true,
    data,
    aluno: aluno || { id: alunoId, nome: "Aluno" },
    contrato,
    servicosAtivos,
    agendaHoje: agenda.hoje,
    agendaCompleta: agenda.todos,
    frequencias: frequencias.slice(0, 20),
    treinosAtivos: treinos,
    ultimaAvaliacao: avaliacoes[0] || null,
    avaliacoes: avaliacoes.slice(0, 10),
    financeiro,
    resumo: {
      contratoAtivo: Boolean(contrato && ativo(contrato)),
      totalServicos: servicosAtivos.length,
      aulasHoje: agenda.hoje.length,
      frequenciasRegistradas: frequencias.length,
      treinosAtivos: treinos.length,
      avaliacoes: avaliacoes.length,
      financeiroAberto: financeiro.totalDividaAtiva,
      financeiroAReceber: financeiro.totalAberto,
      financeiroProgramado: financeiro.totalProgramado
    }
  };
}

export async function obterAgendaAluno(alunoId, filtros = {}) {
  const portal = await obterPortalAluno(alunoId, filtros);
  return {
    ok: true,
    data: portal.data,
    aluno: portal.aluno,
    hoje: portal.agendaHoje,
    completa: portal.agendaCompleta
  };
}

export async function obterFinanceiroAluno(alunoId) {
  const base = await carregarBasePortalAluno();
  const aluno = localizarAluno(base.alunos, alunoId);
  return {
    ok: true,
    aluno: aluno || { id: alunoId },
    financeiro: financeiroAluno(base.mensalidades, base.financeiro, alunoId)
  };
}
