import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

const ARQUIVOS = {
  alunos: "alunos.json",
  matriculas: "matriculas.json",
  mensalidades: "mensalidades.json",
  financeiro: "financeiro.json",
  recebimentos: "recebimentos.json",
  checkins: "checkins.json"
};

const STATUS_PAGOS = new Set([
  "pago",
  "paga",
  "recebido",
  "recebida",
  "quitado",
  "quitada",
  "baixado",
  "baixada",
  "liquidado",
  "liquidada"
]);

const STATUS_CANCELADOS = new Set([
  "cancelado",
  "cancelada",
  "estornado",
  "estornada",
  "isento",
  "isenta"
]);

const STATUS_ABERTOS = new Set([
  "aberto",
  "aberta",
  "pendente",
  "parcial",
  "vencido",
  "vencida",
  "atrasado",
  "atrasada",
  "em atraso",
  "inadimplente"
]);

async function lerJson(nome, padrao = []) {
  try {
    const texto = await fs.readFile(path.join(DATA_DIR, nome), "utf8");
    if (!texto.trim()) return padrao;
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
}

async function salvarJson(nome, dados) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, nome), JSON.stringify(dados, null, 2), "utf8");
}

async function carregarBases() {
  return {
    alunos: await lerJson(ARQUIVOS.alunos, []),
    matriculas: await lerJson(ARQUIVOS.matriculas, []),
    mensalidades: await lerJson(ARQUIVOS.mensalidades, []),
    financeiro: await lerJson(ARQUIVOS.financeiro, []),
    recebimentos: await lerJson(ARQUIVOS.recebimentos, []),
    checkins: await lerJson(ARQUIVOS.checkins, [])
  };
}

async function salvarBases(bases) {
  await salvarJson(ARQUIVOS.alunos, bases.alunos);
  await salvarJson(ARQUIVOS.matriculas, bases.matriculas);
  await salvarJson(ARQUIVOS.mensalidades, bases.mensalidades);
  await salvarJson(ARQUIVOS.financeiro, bases.financeiro);
  await salvarJson(ARQUIVOS.recebimentos, bases.recebimentos);
  await salvarJson(ARQUIVOS.checkins, bases.checkins);
}

function normalizar(valor = "") {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataISO(valor) {
  if (!valor) return "";
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

function statusDoItem(item = {}) {
  return normalizar(item.status || item.statusPagamento || item.situacao || item.estado || item.pagamento || "");
}

function statusPago(item = {}) {
  return STATUS_PAGOS.has(statusDoItem(item));
}

function statusCancelado(item = {}) {
  return STATUS_CANCELADOS.has(statusDoItem(item));
}

function saldoAberto(item = {}) {
  if (item.valorRestante !== undefined) return Math.max(0, numero(item.valorRestante, 0));
  if (item.saldoRestante !== undefined) return Math.max(0, numero(item.saldoRestante, 0));
  if (item.saldo !== undefined) return Math.max(0, numero(item.saldo, 0));

  const total = numero(item.valorDevido ?? item.valorBruto ?? item.total ?? item.valor ?? 0, 0);
  const pago = numero(item.valorRecebido ?? item.valorPago ?? 0, 0);
  return Math.max(0, Number((total - pago).toFixed(2)));
}

function itemQuitado(item = {}) {
  if (!item || typeof item !== "object") return false;
  if (statusCancelado(item)) return false;

  const pago = numero(item.valorRecebido ?? item.valorPago ?? item.valorBaixa ?? 0, 0);
  const saldo = saldoAberto(item);

  if (statusPago(item)) return saldo <= 0 || pago > 0 || item.valorRestante === undefined;
  return saldo <= 0 && pago > 0;
}

function textoBusca(item = {}) {
  return normalizar([
    item.origem,
    item.categoria,
    item.descricao,
    item.recorrencia,
    item.tipoCobranca,
    item.tipoPlano
  ].join(" "));
}

function pagamentoDeMatriculaOuReativacao(item = {}, matricula = null, aluno = null) {
  const alvo = `${textoBusca(item)} ${textoBusca(matricula || {})} ${textoBusca(aluno || {})}`;
  return Boolean(item.ativarMatriculaAoReceber) ||
    Boolean(matricula?.reativacaoNovaMatricula) ||
    alvo.includes("reativacao") ||
    alvo.includes("matricula_inicial_unificada") ||
    alvo.includes("matricula inicial") ||
    alvo.includes("entrada matricula") ||
    alvo.includes("matricula + mensalidade") ||
    alvo.includes("matricula e mensalidade");
}

function mesmoId(a, b) {
  return Boolean(a) && Boolean(b) && String(a) === String(b);
}

function idsDoItem(item = {}) {
  return {
    id: item.id || "",
    alunoId: item.alunoId || item.aluno_id || item.pessoaId || "",
    matriculaId: item.matriculaId || item.matricula_id || "",
    mensalidadeId: item.mensalidadeId || item.mensalidade_id || item.mensalidadeInicialId || "",
    financeiroId: item.lancamentoFinanceiroId || item.financeiroId || item.financeiroInicialId || "",
    recebimentoId: item.recebimentoId || item.recebimentoInicialId || item.pagamentoInicialId || ""
  };
}

function encontrarContexto(bases, item = {}) {
  const ids = idsDoItem(item);

  let mensalidade = bases.mensalidades.find((m) =>
    mesmoId(m.id, ids.mensalidadeId) ||
    mesmoId(m.id, ids.id) ||
    mesmoId(m.lancamentoFinanceiroId, ids.id) ||
    mesmoId(m.lancamentoFinanceiroId, ids.financeiroId) ||
    mesmoId(m.recebimentoId, ids.id) ||
    mesmoId(m.recebimentoId, ids.recebimentoId)
  ) || null;

  let financeiro = bases.financeiro.find((f) =>
    mesmoId(f.id, ids.financeiroId) ||
    mesmoId(f.id, ids.id) ||
    mesmoId(f.mensalidadeId, ids.id) ||
    mesmoId(f.mensalidadeId, ids.mensalidadeId) ||
    mesmoId(f.recebimentoId, ids.id) ||
    mesmoId(f.recebimentoId, ids.recebimentoId)
  ) || null;

  let recebimento = bases.recebimentos.find((r) =>
    mesmoId(r.id, ids.recebimentoId) ||
    mesmoId(r.id, ids.id) ||
    mesmoId(r.lancamentoFinanceiroId, ids.id) ||
    mesmoId(r.lancamentoFinanceiroId, ids.financeiroId) ||
    mesmoId(r.mensalidadeId, ids.id) ||
    mesmoId(r.mensalidadeId, ids.mensalidadeId)
  ) || null;

  if (!mensalidade && financeiro?.mensalidadeId) {
    mensalidade = bases.mensalidades.find((m) => mesmoId(m.id, financeiro.mensalidadeId)) || null;
  }
  if (!mensalidade && recebimento?.mensalidadeId) {
    mensalidade = bases.mensalidades.find((m) => mesmoId(m.id, recebimento.mensalidadeId)) || null;
  }
  if (!financeiro && mensalidade?.lancamentoFinanceiroId) {
    financeiro = bases.financeiro.find((f) => mesmoId(f.id, mensalidade.lancamentoFinanceiroId)) || null;
  }
  if (!financeiro && recebimento?.lancamentoFinanceiroId) {
    financeiro = bases.financeiro.find((f) => mesmoId(f.id, recebimento.lancamentoFinanceiroId)) || null;
  }
  if (!recebimento && financeiro?.recebimentoId) {
    recebimento = bases.recebimentos.find((r) => mesmoId(r.id, financeiro.recebimentoId)) || null;
  }
  if (!recebimento && mensalidade?.recebimentoId) {
    recebimento = bases.recebimentos.find((r) => mesmoId(r.id, mensalidade.recebimentoId)) || null;
  }

  const alunoId =
    ids.alunoId ||
    recebimento?.alunoId ||
    financeiro?.alunoId ||
    mensalidade?.alunoId ||
    "";

  let matriculaId =
    ids.matriculaId ||
    recebimento?.matriculaId ||
    financeiro?.matriculaId ||
    mensalidade?.matriculaId ||
    "";

  let matricula = bases.matriculas.find((m) =>
    mesmoId(m.id, matriculaId) ||
    mesmoId(m.financeiroInicialId, ids.id) ||
    mesmoId(m.financeiroInicialId, financeiro?.id) ||
    mesmoId(m.mensalidadeInicialId, ids.id) ||
    mesmoId(m.mensalidadeInicialId, mensalidade?.id) ||
    mesmoId(m.recebimentoInicialId, ids.id) ||
    mesmoId(m.recebimentoInicialId, recebimento?.id)
  ) || null;

  let aluno = bases.alunos.find((a) =>
    mesmoId(a.id, alunoId) ||
    mesmoId(a.id, matricula?.alunoId) ||
    mesmoId(a.matriculaId, matricula?.id) ||
    mesmoId(a.recebimentoReativacaoId, recebimento?.id) ||
    mesmoId(a.recebimentoReativacaoId, ids.id)
  ) || null;

  if (!matricula && aluno?.matriculaId) {
    matricula = bases.matriculas.find((m) => mesmoId(m.id, aluno.matriculaId)) || null;
  }
  if (!matricula && aluno?.id) {
    matricula = bases.matriculas.find((m) =>
      mesmoId(m.alunoId, aluno.id) &&
      !["cancelada", "cancelado", "encerrada", "encerrado"].includes(normalizar(m.status))
    ) || null;
  }

  if (matricula && !matriculaId) matriculaId = matricula.id || "";

  const ignorarIds = new Set([
    ids.id,
    ids.mensalidadeId,
    ids.financeiroId,
    ids.recebimentoId,
    mensalidade?.id,
    financeiro?.id,
    recebimento?.id
  ].filter(Boolean).map(String));

  return { aluno, matricula, mensalidade, financeiro, recebimento, ignorarIds };
}

function pertenceAoAlunoOuMatricula(item = {}, alunoId = "", matriculaId = "") {
  return mesmoId(item.alunoId, alunoId) ||
    mesmoId(item.aluno_id, alunoId) ||
    mesmoId(item.pessoaId, alunoId) ||
    mesmoId(item.matriculaId, matriculaId) ||
    mesmoId(item.matricula_id, matriculaId);
}

function registroIgnorado(item = {}, ignorarIds = new Set()) {
  return [
    item.id,
    item.mensalidadeId,
    item.lancamentoFinanceiroId,
    item.financeiroId,
    item.recebimentoId
  ].filter(Boolean).some((id) => ignorarIds.has(String(id)));
}

function pendenciasBloqueantes(bases, alunoId, matriculaId, ignorarIds) {
  const hoje = hojeISO();
  const pendencias = [];
  const fontes = [
    ["mensalidade", bases.mensalidades],
    ["financeiro", bases.financeiro],
    ["recebimento", bases.recebimentos]
  ];

  for (const [fonte, lista] of fontes) {
    for (const item of Array.isArray(lista) ? lista : []) {
      if (!pertenceAoAlunoOuMatricula(item, alunoId, matriculaId)) continue;
      if (registroIgnorado(item, ignorarIds)) continue;
      if (statusCancelado(item) || itemQuitado(item)) continue;

      const vencimento = dataISO(item.vencimento || item.dataVencimento || item.data_vencimento || item.competencia || item.data);
      const status = statusDoItem(item);
      const saldo = saldoAberto(item);
      const estaAberto = saldo > 0 || STATUS_ABERTOS.has(status);

      if (estaAberto && vencimento && vencimento < hoje) {
        pendencias.push({
          fonte,
          id: item.id || "",
          descricao: item.descricao || item.referencia || item.categoria || "Pendencia financeira",
          vencimento,
          valorRestante: saldo
        });
      }
    }
  }

  return pendencias;
}

function podeReativarAluno(aluno = {}, item = {}, matricula = null) {
  const statusAluno = normalizar(aluno.status);
  const statusSituacao = normalizar(aluno.situacao);
  const ehReativacao = pagamentoDeMatriculaOuReativacao(item, matricula, aluno);

  if (["cancelado", "cancelada", "desligado", "desligada", "excluido", "excluida"].includes(statusAluno) && !ehReativacao) {
    return false;
  }

  return ehReativacao ||
    ["ativo", "ativa", "bloqueado", "bloqueada", "suspenso", "suspensa", "inadimplente"].includes(statusAluno) ||
    ["reativacao_pendente", "bloqueado", "bloqueada", "suspenso", "suspensa", "inadimplente"].includes(statusSituacao) ||
    aluno.ativo === false;
}

function limparRegistroPago(registro = {}, tipo = "financeiro") {
  if (!registro) return;
  registro.valorRestante = 0;
  if ("saldoRestante" in registro) registro.saldoRestante = 0;
  if ("saldo" in registro) registro.saldo = 0;

  if (tipo === "recebimento") {
    registro.status = "recebido";
    registro.situacao = "recebido";
  } else if (tipo === "financeiro") {
    registro.status = "Pago";
    registro.statusPagamento = "Pago";
  } else if (tipo === "mensalidade") {
    registro.status = "pago";
    registro.statusPagamento = "Pago";
    registro.situacao = "pago";
  }

  registro.atualizadoEm = new Date().toISOString();
}

function adicionarHistoricoMatricula(matricula, pagamentoId, origem, agora) {
  if (!matricula) return;
  matricula.historico = Array.isArray(matricula.historico) ? matricula.historico : [];
  const jaExiste = matricula.historico.some((h) =>
    h?.acao === "desbloqueio_por_pagamento" &&
    mesmoId(h?.dados?.pagamentoId, pagamentoId)
  );
  if (jaExiste) return;

  matricula.historico.push({
    id: `hist_mat_desb_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    acao: "desbloqueio_por_pagamento",
    descricao: "Bloqueio financeiro limpo automaticamente apos quitacao.",
    dados: {
      pagamentoId: pagamentoId || "",
      origem: origem || "financeiro"
    },
    criadoEm: agora
  });
}

function aplicarDesbloqueio({ aluno, matricula, checkins, item, contexto, origem }) {
  const agora = new Date().toISOString();
  const hoje = hojeISO();
  const pagamentoId =
    contexto.recebimento?.id ||
    contexto.financeiro?.id ||
    contexto.mensalidade?.id ||
    item.id ||
    "";

  if (matricula) {
    matricula.status = "Ativa";
    matricula.statusPagamento = "Pago";
    matricula.statusFinanceiroInicial = "Pago";
    matricula.bloqueada = false;
    matricula.bloqueioCheckin = false;
    matricula.motivoBloqueio = "";
    matricula.motivoBloqueioCheckin = "";
    matricula.dataAtivacao = matricula.dataAtivacao || hoje;
    matricula.ativadaEm = matricula.ativadaEm || agora;
    matricula.liberadaAcessoEm = agora;
    matricula.liberadaPorPagamentoEm = agora;
    matricula.cacheAcessoLimpoEm = agora;
    matricula.encerradaEm = "";
    matricula.canceladaEm = "";
    matricula.motivoEncerramento = "";
    matricula.motivoCancelamento = "";
    matricula.atualizadoEm = agora;
    adicionarHistoricoMatricula(matricula, pagamentoId, origem, agora);
  }

  if (aluno) {
    aluno.status = "ativo";
    aluno.ativo = true;
    aluno.situacao = "ativo";
    aluno.status_legado_access = "ativo";
    aluno.statusMatricula = "Ativa";
    aluno.matriculaStatus = "Ativa";
    aluno.bloqueado = false;
    aluno.bloqueioCheckin = false;
    aluno.inadimplente = false;
    aluno.emAtraso = false;
    aluno.motivoBloqueio = "";
    aluno.motivoBloqueioCheckin = "";
    aluno.reativacaoPendenteEm = "";
    aluno.recebimentoReativacaoId = "";
    aluno.liberadoAcessoEm = agora;
    aluno.liberadoPorPagamentoEm = agora;
    aluno.cacheAcessoLimpoEm = agora;

    if (matricula?.id) {
      aluno.matriculaId = matricula.id;
      aluno.numeroMatricula = matricula.numero || matricula.numeroMatricula || aluno.numeroMatricula || "";
      aluno.planoId = matricula.planoId || aluno.planoId || "";
      aluno.plano = matricula.plano || matricula.planoNome || aluno.plano || "";
      aluno.valorMensal = numero(matricula.valorMensal ?? aluno.valorMensal, aluno.valorMensal || 0);
      aluno.valorPlano = numero(matricula.valorPlano ?? aluno.valorPlano, aluno.valorPlano || 0);
      aluno.valorMensalTotal = numero(matricula.valorMensalTotal ?? aluno.valorMensalTotal, aluno.valorMensalTotal || 0);
    }

    aluno.atualizadoEm = agora;
  }

  for (const checkin of Array.isArray(checkins) ? checkins : []) {
    const mesmoAluno = aluno?.id && mesmoId(checkin.alunoId, aluno.id);
    const mesmaMatricula = matricula?.id && mesmoId(checkin.matriculaId, matricula.id);
    if (!mesmoAluno && !mesmaMatricula) continue;

    checkin.status = "Ativo";
    checkin.bloqueado = false;
    checkin.bloqueioCheckin = false;
    checkin.motivoBloqueio = "";
    checkin.motivoBloqueioCheckin = "";
    checkin.cacheAcessoLimpoEm = agora;
    checkin.atualizadoEm = agora;
  }
}

function sincronizarRegistrosPagos(bases, contexto, item) {
  const ids = contexto.ignorarIds || new Set();

  const mensalidades = bases.mensalidades.filter((m) => registroIgnorado(m, ids) || mesmoId(m.id, item.mensalidadeId));
  const financeiro = bases.financeiro.filter((f) => registroIgnorado(f, ids) || mesmoId(f.id, item.lancamentoFinanceiroId));
  const recebimentos = bases.recebimentos.filter((r) => registroIgnorado(r, ids) || mesmoId(r.id, item.recebimentoId));

  for (const m of mensalidades) limparRegistroPago(m, "mensalidade");
  for (const f of financeiro) limparRegistroPago(f, "financeiro");
  for (const r of recebimentos) limparRegistroPago(r, "recebimento");
}

export async function desbloquearAlunoAposPagamento(item = {}, opcoes = {}) {
  const bases = await carregarBases();
  const contexto = encontrarContexto(bases, item);
  const aluno = contexto.aluno;
  const matricula = contexto.matricula;

  const pagamentoQuitado = [
    item,
    contexto.recebimento,
    contexto.financeiro,
    contexto.mensalidade
  ].some((registro) => itemQuitado(registro || {}));

  if (!pagamentoQuitado) {
    return { ok: true, desbloqueado: false, motivo: "Pagamento ainda nao esta quitado." };
  }

  if (!aluno) {
    return { ok: false, desbloqueado: false, motivo: "Aluno nao encontrado para limpar bloqueio." };
  }

  if (!podeReativarAluno(aluno, item, matricula)) {
    return {
      ok: true,
      desbloqueado: false,
      alunoId: aluno.id || "",
      matriculaId: matricula?.id || "",
      motivo: "Aluno possui cancelamento/desligamento que nao deve ser revertido por este pagamento."
    };
  }

  const pendencias = pendenciasBloqueantes(bases, aluno.id, matricula?.id || aluno.matriculaId || "", contexto.ignorarIds);
  if (pendencias.length) {
    sincronizarRegistrosPagos(bases, contexto, item);
    await salvarBases(bases);
    return {
      ok: true,
      desbloqueado: false,
      alunoId: aluno.id || "",
      matriculaId: matricula?.id || "",
      pendenciasRestantes: pendencias,
      motivo: "Pagamento registrado, mas ainda existe pendencia vencida."
    };
  }

  sincronizarRegistrosPagos(bases, contexto, item);
  aplicarDesbloqueio({
    aluno,
    matricula,
    checkins: bases.checkins,
    item,
    contexto,
    origem: opcoes.origem || "financeiro"
  });

  await salvarBases(bases);

  return {
    ok: true,
    desbloqueado: true,
    alunoId: aluno.id || "",
    matriculaId: matricula?.id || aluno.matriculaId || "",
    mensagem: "Aluno liberado automaticamente apos quitacao financeira."
  };
}

export async function regularizarAlunosComFinanceiroPago(opcoes = {}) {
  const bases = await carregarBases();
  const alunoFiltro = opcoes.alunoId ? String(opcoes.alunoId) : "";
  const vistos = new Set();
  const resultados = [];
  const candidatos = [
    ...bases.recebimentos,
    ...bases.financeiro,
    ...bases.mensalidades
  ].filter((item) => {
    if (!itemQuitado(item)) return false;
    if (alunoFiltro && String(item.alunoId || "") !== alunoFiltro) return false;
    const chave = [
      item.alunoId || "",
      item.matriculaId || "",
      item.mensalidadeId || item.id || "",
      item.lancamentoFinanceiroId || "",
      item.recebimentoId || ""
    ].join("|");
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  for (const item of candidatos) {
    resultados.push(await desbloquearAlunoAposPagamento(item, {
      origem: opcoes.origem || "regularizacao_financeiro_pago"
    }));
  }

  return {
    ok: true,
    processados: candidatos.length,
    desbloqueados: resultados.filter((r) => r?.desbloqueado).length,
    pendentes: resultados.filter((r) => r?.pendenciasRestantes?.length).length,
    resultados
  };
}
