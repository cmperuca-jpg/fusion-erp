import fs from "fs/promises";
import path from "path";
import { alunoSchema, alunoUpdateSchema } from "./alunos.schema.mjs";
import {
  listarAlunos,
  buscarAlunoPorId,
  criarAluno,
  atualizarAluno,
  excluirAluno
} from "./alunos.repository.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");

function mensagemValidacao(resultado) {
  return resultado.error.issues.map(item => item.message).join(", ");
}

function agoraISO() { return new Date().toISOString(); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v || "").trim(); }
function normalizar(v) { return texto(v).toLowerCase(); }
function mesmoId(a, b) { return String(a || "") === String(b || ""); }

async function lerJson(nomeArquivo, padrao) {
  const arquivo = path.join(DATA_DIR, nomeArquivo);
  try {
    const texto = await fs.readFile(arquivo, "utf-8");
    if (!texto.trim()) return padrao;
    const dados = JSON.parse(texto);
    return dados ?? padrao;
  } catch (erro) {
    if (erro?.code === "ENOENT") {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), "utf-8");
      return padrao;
    }
    return padrao;
  }
}

async function salvarJson(nomeArquivo, dados) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, nomeArquivo), JSON.stringify(dados, null, 2), "utf-8");
}

function estaPago(status) {
  return ["pago", "recebido", "quitado", "baixado"].includes(normalizar(status));
}

function estaCancelado(status) {
  return ["cancelado", "cancelada", "estornado", "estornada", "encerrado", "encerrada"].includes(normalizar(status));
}

function podeCancelarCobranca(item = {}) {
  if (estaPago(item.status)) return false;
  if (estaCancelado(item.status)) return false;
  return true;
}

function nomeAluno(aluno = {}) {
  return aluno.nome || aluno.name || aluno.aluno || aluno.alunoNome || "";
}

async function registrarAuditoria(evento = {}) {
  const auditoria = await lerJson("auditoria_integridade.json", []);
  auditoria.unshift({
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    ...evento,
    criadoEm: agoraISO()
  });
  await salvarJson("auditoria_integridade.json", auditoria.slice(0, 3000));
}

async function cancelarVinculosFinanceirosDoAluno(aluno, opcoes = {}) {
  const alunoId = aluno?.id;
  const alunoNome = nomeAluno(aluno);
  const usuario = opcoes.usuario || "sistema";
  const motivo = opcoes.motivo || "Aluno desligado/excluído do sistema.";
  const agora = agoraISO();
  const hoje = hojeISO();

  const resumo = {
    matriculasCanceladas: 0,
    mensalidadesCanceladas: 0,
    financeiroCancelado: 0,
    recebimentosCancelados: 0,
    checkinsBloqueados: 0
  };

  const matriculas = await lerJson("matriculas.json", []);
  const matriculaIds = new Set();
  if (Array.isArray(matriculas)) {
    for (const m of matriculas) {
      if (!mesmoId(m.alunoId, alunoId)) continue;
      if (m.id) matriculaIds.add(String(m.id));
      if (estaCancelado(m.status)) continue;
      m.status = "Cancelada";
      m.canceladaEm = agora;
      m.encerradaEm = m.encerradaEm || agora;
      m.motivoCancelamento = motivo;
      m.renovacaoAutomatica = false;
      m.gerarMensalidadeAutomatica = false;
      m.atualizadoEm = agora;
      m.historico = Array.isArray(m.historico) ? m.historico : [];
      m.historico.push({
        id: `hist_mat_cancel_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
        acao: "cancelamento_por_desligamento_aluno",
        descricao: "Matrícula cancelada automaticamente pelo desligamento/exclusão do aluno.",
        motivo,
        usuario,
        criadoEm: agora
      });
      resumo.matriculasCanceladas += 1;
    }
    await salvarJson("matriculas.json", matriculas);
  }

  const pertenceAoAluno = (item = {}) => {
    if (mesmoId(item.alunoId, alunoId)) return true;
    if (item.matriculaId && matriculaIds.has(String(item.matriculaId))) return true;
    return false;
  };

  const mensalidades = await lerJson("mensalidades.json", []);
  if (Array.isArray(mensalidades)) {
    for (const m of mensalidades) {
      if (!pertenceAoAluno(m)) continue;
      if (!podeCancelarCobranca(m)) continue;
      m.status = "cancelado";
      m.canceladoEm = agora;
      m.canceladaEm = agora;
      m.canceladoPor = usuario;
      m.motivoCancelamento = motivo;
      m.valorRestante = 0;
      m.saldoRestante = 0;
      m.renovacaoAutomatica = false;
      m.atualizadoEm = agora;
      m.alunoNome = m.alunoNome || alunoNome;
      m.aluno = m.aluno || alunoNome;
      m.historico = Array.isArray(m.historico) ? m.historico : [];
      m.historico.push({
        id: `hist_men_cancel_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
        acao: "cancelamento_por_desligamento_aluno",
        descricao: "Mensalidade aberta cancelada automaticamente pelo desligamento/exclusão do aluno.",
        motivo,
        usuario,
        criadoEm: agora
      });
      resumo.mensalidadesCanceladas += 1;
    }
    await salvarJson("mensalidades.json", mensalidades);
  }

  const financeiro = await lerJson("financeiro.json", []);
  if (Array.isArray(financeiro)) {
    for (const f of financeiro) {
      if (!pertenceAoAluno(f)) continue;
      if (!podeCancelarCobranca(f)) continue;
      f.status = "Cancelado";
      f.canceladoEm = agora;
      f.canceladoPor = usuario;
      f.motivoCancelamento = motivo;
      f.valorRestante = 0;
      f.saldoRestante = 0;
      f.renovacaoAutomatica = false;
      f.atualizadoEm = agora;
      f.alunoFornecedor = f.alunoFornecedor || alunoNome;
      f.pessoa = f.pessoa || alunoNome;
      f.pessoaFornecedor = f.pessoaFornecedor || alunoNome;
      f.observacao = [f.observacao, `Cancelado automaticamente: ${motivo}`].filter(Boolean).join(" | ");
      f.observacoes = f.observacao;
      resumo.financeiroCancelado += 1;
    }
    await salvarJson("financeiro.json", financeiro);
  }

  const recebimentos = await lerJson("recebimentos.json", []);
  if (Array.isArray(recebimentos)) {
    for (const r of recebimentos) {
      if (!pertenceAoAluno(r)) continue;
      if (!podeCancelarCobranca(r)) continue;
      r.status = "cancelado";
      r.canceladoEm = agora;
      r.canceladoPor = usuario;
      r.motivoCancelamento = motivo;
      r.valorRestante = 0;
      r.atualizadoEm = agora;
      resumo.recebimentosCancelados += 1;
    }
    await salvarJson("recebimentos.json", recebimentos);
  }

  const checkins = await lerJson("checkins.json", []);
  if (Array.isArray(checkins)) {
    for (const c of checkins) {
      if (!mesmoId(c.alunoId, alunoId)) continue;
      c.status = "Bloqueado";
      c.motivoBloqueio = motivo;
      c.atualizadoEm = agora;
      resumo.checkinsBloqueados += 1;
    }
    await salvarJson("checkins.json", checkins);
  }

  const historico = await lerJson("alunos_historico_planos.json", []);
  if (Array.isArray(historico)) {
    historico.push({
      id: `hist_aluno_deslig_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
      alunoId,
      aluno: alunoNome,
      acao: "desligamento_cancelamento_financeiro",
      data: hoje,
      motivo,
      resumo,
      usuario,
      criadoEm: agora
    });
    await salvarJson("alunos_historico_planos.json", historico);
  }

  await registrarAuditoria({
    tipo: "aluno_desligado",
    alunoId,
    aluno: alunoNome,
    motivo,
    usuario,
    resumo
  });

  return resumo;
}

async function alunoPossuiHistoricoFinanceiro(alunoId) {
  const [mensalidades, financeiro, recebimentos, caixa] = await Promise.all([
    lerJson("mensalidades.json", []),
    lerJson("financeiro.json", []),
    lerJson("recebimentos.json", []),
    lerJson("caixa.json", { caixas: [], movimentos: [] })
  ]);

  const emMensalidades = Array.isArray(mensalidades) && mensalidades.some(m => mesmoId(m.alunoId, alunoId));
  const emFinanceiro = Array.isArray(financeiro) && financeiro.some(f => mesmoId(f.alunoId, alunoId));
  const emRecebimentos = Array.isArray(recebimentos) && recebimentos.some(r => mesmoId(r.alunoId, alunoId));
  const movimentos = Array.isArray(caixa?.movimentos) ? caixa.movimentos : [];
  const emCaixa = movimentos.some(m => mesmoId(m.alunoId, alunoId));

  return emMensalidades || emFinanceiro || emRecebimentos || emCaixa;
}

export async function listar() {
  return await listarAlunos();
}

export async function buscar(id) {
  return await buscarAlunoPorId(id);
}

export async function criar(dados) {
  const resultado = alunoSchema.safeParse(dados);
  if (!resultado.success) throw new Error(mensagemValidacao(resultado));
  return await criarAluno(resultado.data);
}

export async function atualizar(id, dados) {
  const resultado = alunoUpdateSchema.safeParse(dados);
  if (!resultado.success) throw new Error(mensagemValidacao(resultado));
  return await atualizarAluno(id, resultado.data);
}

export async function desligar(id, opcoes = {}) {
  const aluno = await buscarAlunoPorId(id);
  if (!aluno) return null;

  const resumoCancelamento = await cancelarVinculosFinanceirosDoAluno(aluno, opcoes);
  const atualizado = await atualizarAluno(id, {
    status: "inativo",
    statusMatricula: "Cancelada",
    desligadoEm: agoraISO(),
    motivoDesligamento: opcoes.motivo || "Aluno desligado do sistema.",
    renovacaoAutomatica: false
  });

  return {
    ok: true,
    desligado: true,
    removido: false,
    alunoId: id,
    aluno: nomeAluno(atualizado || aluno),
    resumoCancelamento
  };
}

export async function excluir(id, opcoes = {}) {
  const aluno = await buscarAlunoPorId(id);
  if (!aluno) return null;

  const forcar = opcoes.forcar === true || opcoes.forcar === "true";
  const temHistorico = await alunoPossuiHistoricoFinanceiro(id);

  if (temHistorico && !forcar) {
    // Regra segura para o botão atual de exclusão: com histórico, desliga em vez de apagar.
    return await desligar(id, opcoes);
  }

  const resumoCancelamento = await cancelarVinculosFinanceirosDoAluno(aluno, opcoes);
  const removido = await excluirAluno(id);

  await registrarAuditoria({
    tipo: "aluno_excluido_definitivamente",
    alunoId: id,
    aluno: nomeAluno(aluno),
    usuario: opcoes.usuario || "sistema",
    motivo: opcoes.motivo || "Exclusão definitiva de aluno sem histórico financeiro relevante.",
    resumoCancelamento
  });

  return {
    ok: Boolean(removido),
    desligado: false,
    removido: Boolean(removido),
    alunoId: id,
    aluno: nomeAluno(aluno),
    resumoCancelamento
  };
}


function somenteDataAluno(valor = "") {
  return String(valor || "").slice(0, 10);
}

function numeroAluno(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao;
}

function statusAbertoAluno(status = "") {
  const s = normalizar(status);
  return ["aberto", "aberta", "pendente", "parcial", "atrasado"].includes(s);
}

function statusPagoAluno(status = "") {
  const s = normalizar(status);
  return ["pago", "paga", "recebido", "quitado", "baixado"].includes(s);
}

function pertenceAoAlunoProntuario(item = {}, alunoId = "", matriculaIds = new Set()) {
  if (mesmoId(item.alunoId, alunoId) || mesmoId(item.aluno_id, alunoId)) return true;
  if (item.matriculaId && matriculaIds.has(String(item.matriculaId))) return true;
  if (item.matricula_id && matriculaIds.has(String(item.matricula_id))) return true;
  return false;
}

function ordenarPorDataDesc(lista = [], campos = ["criadoEm", "criado_em", "data", "vencimento"]) {
  return [...lista].sort((a, b) => {
    const da = campos.map(c => a?.[c]).find(Boolean) || "";
    const db = campos.map(c => b?.[c]).find(Boolean) || "";
    return String(db).localeCompare(String(da));
  });
}

function calcularResumoFinanceiroAluno(mensalidades = [], financeiro = []) {
  const resumo = {
    mensalidadesTotal: mensalidades.length,
    mensalidadesAbertas: 0,
    mensalidadesPagas: 0,
    mensalidadesCanceladas: 0,
    valorAberto: 0,
    valorPago: 0,
    valorCancelado: 0,
    financeiroTotal: financeiro.length,
    proximoVencimento: "",
    ultimaBaixa: ""
  };

  for (const m of mensalidades) {
    const valorBase = numeroAluno(m.total ?? m.valorOriginal ?? m.valor ?? m.valorBruto, 0);
    const valorPago = numeroAluno(m.valorPago ?? m.valorRecebido ?? 0, 0);
    if (statusPagoAluno(m.status)) {
      resumo.mensalidadesPagas += 1;
      resumo.valorPago += valorPago || valorBase;
      const baixa = somenteDataAluno(m.dataPagamento || m.pagamento || m.baixadoEm || "");
      if (baixa && baixa > resumo.ultimaBaixa) resumo.ultimaBaixa = baixa;
    } else if (estaCancelado(m.status)) {
      resumo.mensalidadesCanceladas += 1;
      resumo.valorCancelado += valorBase;
    } else if (statusAbertoAluno(m.status)) {
      resumo.mensalidadesAbertas += 1;
      resumo.valorAberto += numeroAluno(m.valorRestante ?? m.saldoRestante ?? valorBase, valorBase);
      const venc = somenteDataAluno(m.vencimento || m.dataVencimento || "");
      if (venc && (!resumo.proximoVencimento || venc < resumo.proximoVencimento)) resumo.proximoVencimento = venc;
    }
  }

  for (const k of ["valorAberto", "valorPago", "valorCancelado"]) resumo[k] = numeroAluno(resumo[k], 0);
  return resumo;
}

export async function prontuario(id) {
  const aluno = await buscarAlunoPorId(id);
  if (!aluno) return null;

  const [matriculasRaw, mensalidadesRaw, financeiroRaw, recebimentosRaw, caixaRaw, checkinsRaw, avaliacoesRaw, treinosRaw, historicoPlanosRaw] = await Promise.all([
    lerJson("matriculas.json", []),
    lerJson("mensalidades.json", []),
    lerJson("financeiro.json", []),
    lerJson("recebimentos.json", []),
    lerJson("caixa.json", { caixas: [], movimentos: [] }),
    lerJson("checkins.json", []),
    lerJson("avaliacoes.json", []),
    lerJson("treinos.json", []),
    lerJson("alunos_historico_planos.json", [])
  ]);

  const matriculas = Array.isArray(matriculasRaw) ? matriculasRaw.filter(m => mesmoId(m.alunoId, id) || mesmoId(m.aluno_id, id)) : [];
  const matriculaIds = new Set(matriculas.map(m => String(m.id || m.matriculaId || "")).filter(Boolean));
  const mensalidades = Array.isArray(mensalidadesRaw) ? mensalidadesRaw.filter(m => pertenceAoAlunoProntuario(m, id, matriculaIds)) : [];
  const financeiro = Array.isArray(financeiroRaw) ? financeiroRaw.filter(f => pertenceAoAlunoProntuario(f, id, matriculaIds)) : [];
  const recebimentos = Array.isArray(recebimentosRaw) ? recebimentosRaw.filter(r => pertenceAoAlunoProntuario(r, id, matriculaIds)) : [];
  const movimentosCaixa = Array.isArray(caixaRaw?.movimentos) ? caixaRaw.movimentos.filter(m => pertenceAoAlunoProntuario(m, id, matriculaIds) || financeiro.some(f => String(f.movimentoCaixaId || "") === String(m.id || ""))) : [];
  const checkins = Array.isArray(checkinsRaw) ? checkinsRaw.filter(c => pertenceAoAlunoProntuario(c, id, matriculaIds)) : [];
  const avaliacoes = Array.isArray(avaliacoesRaw) ? avaliacoesRaw.filter(a => mesmoId(a.alunoId, id) || mesmoId(a.aluno_id, id)) : [];
  const treinos = Array.isArray(treinosRaw) ? treinosRaw.filter(t => mesmoId(t.alunoId, id) || mesmoId(t.aluno_id, id)) : [];
  const historicoPlanos = Array.isArray(historicoPlanosRaw) ? historicoPlanosRaw.filter(h => mesmoId(h.alunoId, id) || mesmoId(h.aluno_id, id)) : [];

  const resumoFinanceiro = calcularResumoFinanceiroAluno(mensalidades, financeiro);
  const ultimaAvaliacao = ordenarPorDataDesc(avaliacoes, ["data", "criadoEm", "criado_em"])[0] || null;
  const ultimoTreino = ordenarPorDataDesc(treinos, ["atualizado_em", "atualizadoEm", "criado_em", "criadoEm"])[0] || null;
  const ultimoCheckin = ordenarPorDataDesc(checkins, ["data", "criadoEm", "criado_em"])[0] || null;

  const linhaDoTempo = [
    ...matriculas.map(m => ({ tipo: "matricula", data: m.criadoEm || m.criado_em || m.dataMatricula || m.data_matricula || "", titulo: `Matrícula ${m.numero || ""}`.trim(), descricao: `${m.plano || "Plano não informado"} · ${m.status || ""}` })),
    ...mensalidades.map(m => ({ tipo: "mensalidade", data: m.vencimento || m.criadoEm || m.criado_em || "", titulo: `Mensalidade ${m.competencia || ""}`.trim(), descricao: `${m.status || ""} · R$ ${numeroAluno(m.total ?? m.valor, 0).toFixed(2)}` })),
    ...financeiro.filter(f => statusPagoAluno(f.status)).map(f => ({ tipo: "financeiro", data: f.dataPagamento || f.pagamento || f.atualizadoEm || "", titulo: "Baixa financeira", descricao: `${f.descricao || "Lançamento"} · R$ ${numeroAluno(f.valorBrutoRecebido ?? f.valorPago ?? f.valor, 0).toFixed(2)}` })),
    ...avaliacoes.map(a => ({ tipo: "avaliacao", data: a.data || a.criadoEm || a.criado_em || "", titulo: "Avaliação física", descricao: `Peso ${a.peso || "-"} · IMC ${a.imc || "-"}` })),
    ...treinos.map(t => ({ tipo: "treino", data: t.atualizado_em || t.atualizadoEm || t.criado_em || t.criadoEm || "", titulo: t.nome || "Treino", descricao: `${t.objetivo || ""} · ${t.status || ""}` })),
    ...checkins.map(c => ({ tipo: "checkin", data: c.data || c.criadoEm || c.criado_em || "", titulo: "Check-in", descricao: `${c.status || ""} · ${c.modalidade || c.plano || ""}` }))
  ].filter(i => i.data || i.titulo).sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).slice(0, 80);

  return {
    ok: true,
    aluno,
    indicadores: {
      status: aluno.status || "",
      statusMatricula: aluno.statusMatricula || "",
      plano: aluno.plano || "",
      proximoVencimento: resumoFinanceiro.proximoVencimento,
      ultimaBaixa: resumoFinanceiro.ultimaBaixa,
      ultimaAvaliacao: ultimaAvaliacao?.data || ultimaAvaliacao?.criadoEm || ultimaAvaliacao?.criado_em || "",
      ultimoTreino: ultimoTreino?.nome || "",
      ultimoCheckin: ultimoCheckin?.data || ""
    },
    resumoFinanceiro,
    matriculas: ordenarPorDataDesc(matriculas, ["criadoEm", "dataMatricula", "data_matricula"]),
    mensalidades: ordenarPorDataDesc(mensalidades, ["vencimento", "competencia", "criadoEm"]),
    financeiro: ordenarPorDataDesc(financeiro, ["vencimento", "dataPagamento", "criadoEm"]),
    recebimentos: ordenarPorDataDesc(recebimentos, ["dataRecebimento", "vencimento", "criadoEm"]),
    movimentosCaixa: ordenarPorDataDesc(movimentosCaixa, ["data", "criadoEm"]),
    checkins: ordenarPorDataDesc(checkins, ["data", "criadoEm"]),
    avaliacoes: ordenarPorDataDesc(avaliacoes, ["data", "criadoEm", "criado_em"]),
    treinos: ordenarPorDataDesc(treinos, ["atualizado_em", "atualizadoEm", "criado_em", "criadoEm"]),
    historicoPlanos: ordenarPorDataDesc(historicoPlanos, ["criadoEm", "data"]),
    linhaDoTempo
  };
}
