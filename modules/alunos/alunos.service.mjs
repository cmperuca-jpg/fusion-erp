import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { alunoSchema, alunoUpdateSchema } from "./alunos.schema.mjs";
import { obterTreinos } from "../treinos/treinos.service.mjs";
import {
  listarAlunos,
  buscarAlunoPorId,
  criarAluno,
  atualizarAluno,
  excluirAluno
} from "./alunos.repository.mjs";

function mensagemValidacao(resultado) {
  return resultado.error.issues.map(item => item.message).join(", ");
}

function agoraISO() { return new Date().toISOString(); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v || "").trim(); }
function normalizar(v) { return texto(v).toLowerCase(); }
function mesmoId(a, b) { return String(a || "") === String(b || ""); }

async function lerJson(nomeArquivo, padrao) {
  try {
    return await lerJsonDuravel(nomeArquivo, padrao);
  } catch {
    return padrao;
  }
}

async function salvarJson(nomeArquivo, dados) {
  await salvarJsonDuravel(nomeArquivo, dados);
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

function somenteNumerosAluno(valor = "") {
  return String(valor || "").replace(/\D/g, "");
}

function statusSolicitaDesligamento(dados = {}) {
  const alvo = normalizar([
    dados.status,
    dados.situacao,
    dados.statusMatricula,
    dados.matriculaStatus
  ].filter(Boolean).join(" "));

  return [
    "cancelado", "cancelada",
    "inativo", "inativa",
    "desligado", "desligada",
    "encerrado", "encerrada"
  ].some(s => alvo.includes(s));
}


function statusSolicitaReativacao(dados = {}) {
  // Regra de correção: quando a tela envia status=ativo, isso deve prevalecer
  // mesmo que campos antigos ainda venham como statusMatricula=Cancelada.
  // Esse era o caso dos alunos importados/inativos: o PUT trazia status ativo,
  // mas mantinha statusMatricula cancelada e caía novamente na rotina de desligamento.
  const statusDireto = normalizar([
    dados.status,
    dados.situacao,
    dados.ativo === true ? "ativo" : "",
    dados.acao
  ].filter(Boolean).join(" "));

  return ["ativo", "ativa", "reativar", "reativacao", "reativação"].some(s => statusDireto.includes(s));
}

function gerarIdLocal(prefixo = "id") {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function competenciaAtualAluno(data = hojeISO()) {
  return String(data || hojeISO()).slice(0, 7);
}

function numeroMatriculaAluno(matriculas = [], data = hojeISO()) {
  const ym = String(data || hojeISO()).slice(0, 7).replace("-", "");
  const prefixo = `MAT-${ym}-`;
  const nums = matriculas
    .map(m => String(m.numero || m.numeroMatricula || ""))
    .filter(n => n.startsWith(prefixo))
    .map(n => Number(n.split("-").pop()))
    .filter(Number.isFinite);
  return `${prefixo}${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(6, "0")}`;
}

function statusAbertoCobrancaAluno(status = "") {
  const s = normalizar(status || "aberto");
  return !["pago", "paga", "recebido", "recebida", "quitado", "baixado", "cancelado", "cancelada", "estornado", "estornada"].includes(s);
}

function valorMensalAluno(aluno = {}, matricula = {}, plano = null, opcoes = {}) {
  // Pega o primeiro valor positivo. Em alunos importados o campo
  // valorMensalTotal pode vir como 0, enquanto valorMensal já está correto.
  const candidatos = [
    opcoes.valor,
    opcoes.valorMensal,
    aluno.valorMensalTotal,
    aluno.valorMensal,
    aluno.valorPlano,
    matricula.valorMensalTotal,
    matricula.valorMensal,
    matricula.valorPlano,
    plano?.valorMensal,
    plano?.valor,
    plano?.preco
  ];

  for (const candidato of candidatos) {
    const n = numeroAluno(candidato, 0);
    if (n > 0) return n;
  }

  return 0;
}

async function reativarFluxoCompletoAluno(id, opcoes = {}) {
  const aluno = await buscarAlunoPorId(id);
  if (!aluno) return null;

  const agora = agoraISO();
  const hoje = somenteDataAluno(opcoes.vencimento || opcoes.dataReativacao || hojeISO()) || hojeISO();
  const competencia = competenciaAtualAluno(hoje);
  const usuario = opcoes.usuario || opcoes.atualizadoPor || "sistema";
  const motivo = opcoes.motivo || opcoes.motivoReativacao || "Reativação manual do aluno.";

  const [matriculas, mensalidades, financeiro, recebimentos, checkins, planos] = await Promise.all([
    lerJson("matriculas.json", []),
    lerJson("mensalidades.json", []),
    lerJson("financeiro.json", []),
    lerJson("recebimentos.json", []),
    lerJson("checkins.json", []),
    lerJson("planos.json", [])
  ]);

  let matricula = Array.isArray(matriculas)
    ? [...matriculas]
        .filter(m => mesmoId(m.alunoId, id))
        .sort((a, b) => String(b.criadoEm || b.criado_em || b.dataMatricula || b.data_matricula || "").localeCompare(String(a.criadoEm || a.criado_em || a.dataMatricula || a.data_matricula || "")))[0]
    : null;

  const planoId = opcoes.planoId || aluno.planoId || matricula?.planoId || "";
  const plano = Array.isArray(planos) ? planos.find(p => mesmoId(p.id, planoId) || mesmoId(p.codigo, planoId)) : null;
  const planoNome = opcoes.planoNome || aluno.plano || aluno.nomePlano || matricula?.plano || matricula?.planoNome || plano?.nome || plano?.descricao || "";
  const valor = valorMensalAluno(aluno, matricula || {}, plano, opcoes);

  if (!matricula) {
    matricula = {
      id: gerarIdLocal("mat"),
      numero: numeroMatriculaAluno(matriculas, hoje),
      numeroMatricula: "",
      alunoId: id,
      alunoNome: nomeAluno(aluno),
      aluno: nomeAluno(aluno),
      planoId,
      plano: planoNome,
      planoNome,
      valorMensal: valor,
      valorMensalTotal: valor,
      valorPlano: valor,
      valorServicos: 0,
      dataMatricula: hoje,
      dataInicio: hoje,
      status: "Ativa",
      statusPagamento: "Aberto",
      statusFinanceiroInicial: "Aberto",
      renovacaoAutomatica: true,
      gerarMensalidadeAutomatica: true,
      origem: "reativacao_aluno",
      criadoEm: agora,
      atualizadoEm: agora,
      historico: []
    };
    matricula.numeroMatricula = matricula.numero;
    matriculas.push(matricula);
  }

  matricula.status = "Ativa";
  matricula.statusPagamento = "Aberto";
  matricula.statusFinanceiroInicial = "Aberto";
  matricula.bloqueada = false;
  matricula.bloqueioCheckin = false;
  matricula.renovacaoAutomatica = true;
  matricula.gerarMensalidadeAutomatica = true;
  matricula.dataInicio = matricula.dataInicio || hoje;
  matricula.dataFim = "";
  matricula.encerradaEm = "";
  matricula.canceladaEm = "";
  matricula.motivoCancelamento = "";
  matricula.motivoEncerramento = "";
  matricula.planoId = planoId || matricula.planoId || "";
  matricula.plano = planoNome || matricula.plano || "";
  matricula.planoNome = planoNome || matricula.planoNome || matricula.plano || "";
  matricula.valorMensal = valor || numeroAluno(matricula.valorMensal, 0);
  matricula.valorMensalTotal = valor || numeroAluno(matricula.valorMensalTotal, 0);
  matricula.valorPlano = valor || numeroAluno(matricula.valorPlano, 0);
  matricula.atualizadoEm = agora;
  matricula.historico = Array.isArray(matricula.historico) ? matricula.historico : [];
  matricula.historico.push({
    id: gerarIdLocal("hist_mat_reat"),
    acao: "reativacao_aluno",
    descricao: "Matrícula reativada automaticamente pela reativação do aluno.",
    motivo,
    usuario,
    criadoEm: agora
  });

  const mensalidadeAberta = mensalidades.find(m =>
    mesmoId(m.alunoId, id) &&
    String(m.competencia || "").slice(0, 7) === competencia &&
    statusAbertoCobrancaAluno(m.status)
  );

  let mensalidade = mensalidadeAberta || null;
  let financeiroItem = null;
  let recebimento = null;

  if (!mensalidade) {
    const mensalidadeId = gerarIdLocal("men");
    const financeiroId = `fin_${mensalidadeId}`;
    const recebimentoId = `rec_${mensalidadeId}`;

    mensalidade = {
      id: mensalidadeId,
      alunoId: id,
      alunoNome: nomeAluno(aluno),
      aluno: nomeAluno(aluno),
      matriculaId: matricula.id,
      planoId,
      planoNome,
      plano: planoNome,
      competencia,
      vencimento: hoje,
      valor,
      valorOriginal: valor,
      total: valor,
      valorRestante: valor,
      saldoRestante: valor,
      status: "aberto",
      descricao: `Mensalidade ${nomeAluno(aluno)} - ${competencia}`,
      origem: "reativacao_aluno",
      lancamentoFinanceiroId: financeiroId,
      recebimentoId,
      renovacaoAutomatica: true,
      criadoEm: agora,
      atualizadoEm: agora,
      historico: [{
        id: gerarIdLocal("hist_men_reat"),
        acao: "gerada_por_reativacao_aluno",
        descricao: "Mensalidade aberta gerada automaticamente pela reativação do aluno.",
        motivo,
        usuario,
        criadoEm: agora
      }]
    };

    financeiroItem = {
      id: financeiroId,
      tipo: "receber",
      descricao: mensalidade.descricao,
      categoria: "Mensalidades",
      centroCusto: "Academia",
      alunoFornecedor: nomeAluno(aluno),
      pessoa: nomeAluno(aluno),
      pessoaFornecedor: nomeAluno(aluno),
      alunoId: id,
      matriculaId: matricula.id,
      mensalidadeId,
      recebimentoId,
      planoId,
      plano: planoNome,
      valor,
      valorBruto: valor,
      valorLiquido: 0,
      valorPago: 0,
      valorRecebido: 0,
      valorRestante: valor,
      vencimento: hoje,
      pagamento: "",
      dataPagamento: "",
      formaPagamento: "",
      status: "Aberto",
      origem: "reativacao_aluno",
      criadoEm: agora,
      atualizadoEm: agora
    };

    recebimento = {
      id: recebimentoId,
      descricao: mensalidade.descricao,
      categoria: "Mensalidades",
      pessoa: nomeAluno(aluno),
      alunoId: id,
      matriculaId: matricula.id,
      mensalidadeId,
      lancamentoFinanceiroId: financeiroId,
      planoId,
      plano: planoNome,
      vencimento: hoje,
      valor: valor,
      valorBruto: valor,
      valorDevido: valor,
      valorRecebido: 0,
      valorRestante: valor,
      status: "aberto",
      origem: "reativacao_aluno",
      criadoEm: agora,
      atualizadoEm: agora
    };

    mensalidades.push(mensalidade);
    financeiro.push(financeiroItem);
    recebimentos.push(recebimento);
  } else {
    mensalidade.status = normalizar(mensalidade.status) === "atrasado" ? mensalidade.status : "aberto";
    mensalidade.matriculaId = mensalidade.matriculaId || matricula.id;
    mensalidade.valorRestante = numeroAluno(mensalidade.valorRestante ?? mensalidade.valor ?? valor, valor);
    mensalidade.saldoRestante = numeroAluno(mensalidade.saldoRestante ?? mensalidade.valorRestante, mensalidade.valorRestante);
    mensalidade.renovacaoAutomatica = true;
    mensalidade.atualizadoEm = agora;
    financeiroItem = financeiro.find(f => mesmoId(f.id, mensalidade.lancamentoFinanceiroId) || mesmoId(f.mensalidadeId, mensalidade.id)) || null;
    recebimento = recebimentos.find(r => mesmoId(r.id, mensalidade.recebimentoId) || mesmoId(r.mensalidadeId, mensalidade.id)) || null;
  }

  matricula.mensalidadeProximaId = mensalidade.id;
  matricula.financeiroProximoId = financeiroItem?.id || mensalidade.lancamentoFinanceiroId || "";
  matricula.recebimentoProximoId = recebimento?.id || mensalidade.recebimentoId || "";
  matricula.proximoVencimento = mensalidade.vencimento || hoje;

  for (const c of checkins) {
    if (!mesmoId(c.alunoId, id) && !mesmoId(c.matriculaId, matricula.id)) continue;
    c.status = "Ativo";
    c.motivoBloqueio = "";
    c.atualizadoEm = agora;
  }

  await salvarJson("matriculas.json", matriculas);
  await salvarJson("mensalidades.json", mensalidades);
  await salvarJson("financeiro.json", financeiro);
  await salvarJson("recebimentos.json", recebimentos);
  await salvarJson("checkins.json", checkins);

  const atualizado = await atualizarAluno(id, {
    status: "ativo",
    situacao: "ativo",
    ativo: true,
    status_legado_access: "ativo",
    statusMatricula: "Ativa",
    matriculaStatus: "Ativa",
    matriculaId: matricula.id,
    numeroMatricula: matricula.numero || matricula.numeroMatricula || aluno.numeroMatricula || "",
    planoId: planoId || aluno.planoId || "",
    plano: planoNome || aluno.plano || "",
    valorMensal: valor || aluno.valorMensal || 0,
    valorPlano: valor || aluno.valorPlano || 0,
    valorMensalTotal: valor || aluno.valorMensalTotal || 0,
    proximoVencimento: mensalidade.vencimento || hoje,
    mensalidadeProximaId: mensalidade.id,
    financeiroProximoId: financeiroItem?.id || mensalidade.lancamentoFinanceiroId || "",
    recebimentoProximoId: recebimento?.id || mensalidade.recebimentoId || "",
    renovacaoAutomatica: true,
    reativadoEm: agora,
    desligadoEm: "",
    motivoDesligamento: "",
    atualizadoEm: agora
  });

  await registrarAuditoria({
    tipo: "aluno_reativado",
    alunoId: id,
    aluno: nomeAluno(atualizado || aluno),
    motivo,
    usuario,
    resumo: {
      matriculaId: matricula.id,
      mensalidadeId: mensalidade.id,
      financeiroId: financeiroItem?.id || mensalidade.lancamentoFinanceiroId || "",
      recebimentoId: recebimento?.id || mensalidade.recebimentoId || "",
      competencia,
      valor
    }
  });

  return {
    ok: true,
    reativado: true,
    alunoId: id,
    aluno: nomeAluno(atualizado || aluno),
    matricula,
    mensalidade,
    financeiro: financeiroItem || financeiro.find(f => mesmoId(f.id, mensalidade.lancamentoFinanceiroId)) || null,
    recebimento: recebimento || recebimentos.find(r => mesmoId(r.id, mensalidade.recebimentoId)) || null,
    mensagem: "Aluno reativado com matrícula ativa e cobrança aberta gerada."
  };
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

  const alunoNomeNormalizado = normalizar(alunoNome);
  const alunoCpfNumeros = somenteNumerosAluno(aluno?.cpf || aluno?.documento || "");
  const alunoTelefoneNumeros = somenteNumerosAluno(aluno?.telefone || aluno?.whatsapp || aluno?.celular || "");

  const pertenceAoAluno = (item = {}) => {
    if (mesmoId(item.alunoId, alunoId) || mesmoId(item.aluno_id, alunoId) || mesmoId(item.idAluno, alunoId)) return true;
    if (item.matriculaId && matriculaIds.has(String(item.matriculaId))) return true;
    if (item.matricula_id && matriculaIds.has(String(item.matricula_id))) return true;

    const cpfItem = somenteNumerosAluno(item.cpf || item.documento || item.alunoCpf || item.cpfAluno || "");
    if (alunoCpfNumeros && cpfItem && alunoCpfNumeros === cpfItem) return true;

    const telItem = somenteNumerosAluno(item.telefone || item.whatsapp || item.celular || item.alunoTelefone || "");
    if (alunoTelefoneNumeros && telItem && alunoTelefoneNumeros === telItem) return true;

    const nomeItem = normalizar(item.aluno || item.alunoNome || item.nomeAluno || item.pessoa || item.alunoFornecedor || item.pessoaFornecedor || "");
    return Boolean(alunoNomeNormalizado && nomeItem && alunoNomeNormalizado === nomeItem);
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

  const cadastro = {
    ...resultado.data,
    status: "inativo",
    situacao: "inativo",
    ativo: false,
    statusMatricula: "Sem matrícula"
  };

  delete cadastro.plano;
  delete cadastro.planoId;
  delete cadastro.valorMensal;
  delete cadastro.taxaMatricula;
  delete cadastro.matriculaId;
  delete cadastro.numeroMatricula;
  delete cadastro.data_matricula;

  return await criarAluno(cadastro);
}

export async function atualizar(id, dados) {
  const resultado = alunoUpdateSchema.safeParse(dados);
  if (!resultado.success) throw new Error(mensagemValidacao(resultado));

  const alunoAntes = await buscarAlunoPorId(id);
  const deveReativar = alunoAntes && statusSolicitaReativacao(resultado.data) &&
    ["inativo", "inativa", "cancelado", "cancelada", "desligado", "desligada", "encerrado", "encerrada", "sem matricula", "sem matrícula"].some(s =>
      [alunoAntes.status, alunoAntes.situacao, alunoAntes.statusMatricula, alunoAntes.matriculaStatus].map(normalizar).includes(s)
    );

  // A reativação precisa vir antes do desligamento. O cadastro pode enviar
  // status=ativo junto com statusMatricula=Cancelada; nesse caso é reativação.
  if (deveReativar) {
    return await reativarFluxoCompletoAluno(id, {
      ...dados,
      usuario: dados?.usuario || dados?.atualizadoPor || "sistema",
      motivo: dados?.motivoReativacao || dados?.motivo || "Aluno marcado como ativo no cadastro."
    });
  }

  const deveDesligar = alunoAntes && !deveReativar && statusSolicitaDesligamento(resultado.data);

  if (deveDesligar) {
    await cancelarVinculosFinanceirosDoAluno(alunoAntes, {
      usuario: dados?.usuario || dados?.atualizadoPor || "sistema",
      motivo: dados?.motivoCancelamento || dados?.motivoDesligamento || "Aluno marcado como cancelado/inativo no cadastro."
    });
  }

  const atualizado = await atualizarAluno(id, resultado.data);

  if (deveDesligar && atualizado) {
    return await atualizarAluno(id, {
      status: resultado.data.status || "cancelado",
      statusMatricula: "Cancelada",
      desligadoEm: atualizado.desligadoEm || agoraISO(),
      motivoDesligamento: dados?.motivoCancelamento || dados?.motivoDesligamento || "Aluno marcado como cancelado/inativo no cadastro.",
      renovacaoAutomatica: false
    });
  }

  return atualizado;
}


export async function criarCobrancaReativacao(id, opcoes = {}) {
  const aluno = await buscarAlunoPorId(id);
  if (!aluno) return null;

  const agora = agoraISO();
  const hoje = somenteDataAluno(opcoes.vencimento || opcoes.dataReativacao || hojeISO()) || hojeISO();
  const usuario = opcoes.usuario || opcoes.atualizadoPor || "sistema";
  const motivo = opcoes.motivo || opcoes.motivoReativacao || "Reativação com cobrança no caixa.";

  const [matriculas, mensalidades, financeiro, recebimentos, planos] = await Promise.all([
    lerJson("matriculas.json", []),
    lerJson("mensalidades.json", []),
    lerJson("financeiro.json", []),
    lerJson("recebimentos.json", []),
    lerJson("planos.json", [])
  ]);

  const matriculasDoAluno = Array.isArray(matriculas)
    ? matriculas
        .filter(m => mesmoId(m.alunoId, id))
        .sort((a, b) => String(b.criadoEm || b.criado_em || b.dataMatricula || b.data_matricula || "").localeCompare(String(a.criadoEm || a.criado_em || a.dataMatricula || a.data_matricula || "")))
    : [];

  const matriculaAnterior = matriculasDoAluno[0] || null;

  // Regra nova: reativação nunca reutiliza a matrícula antiga.
  // Se já existir uma nova matrícula de reativação pendente, reaproveita essa pendência
  // para não duplicar cobrança. Caso contrário, congela as matrículas antigas e cria
  // uma matrícula nova do zero, com novo ciclo financeiro.
  let matricula = matriculasDoAluno.find(m =>
    normalizar(m.origem) === "reativacao_aluno" &&
    ["pendente", "pre-matriculado", "pre matriculado"].includes(normalizar(m.status)) &&
    statusAbertoCobrancaAluno(m.statusPagamento || m.statusFinanceiroInicial || "aberto")
  ) || null;

  const baseComercial = matricula || matriculaAnterior || {};
  const planoId = opcoes.planoId || aluno.planoId || baseComercial?.planoId || "";
  const plano = Array.isArray(planos) ? planos.find(p => mesmoId(p.id, planoId) || mesmoId(p.codigo, planoId)) : null;
  const planoNome = opcoes.planoNome || aluno.plano || aluno.nomePlano || baseComercial?.plano || baseComercial?.planoNome || plano?.nome || plano?.descricao || "";
  const valorPlano = valorMensalAluno(aluno, baseComercial || {}, plano, opcoes);
  const valor = numeroAluno(opcoes.valor ?? opcoes.valorReativacao ?? valorPlano, 0);

  if (!(valor > 0)) {
    const erro = new Error("Informe um valor de reativação maior que zero.");
    erro.status = 400;
    throw erro;
  }

  if (!matricula) {
    for (const antiga of matriculasDoAluno) {
      if (["encerrada", "encerrado", "cancelada", "cancelado"].includes(normalizar(antiga.status))) continue;
      antiga.status = "Encerrada";
      antiga.statusPagamento = antiga.statusPagamento || "Histórico";
      antiga.statusFinanceiroInicial = antiga.statusFinanceiroInicial || "Histórico";
      antiga.dataFim = antiga.dataFim || hoje;
      antiga.encerradaEm = antiga.encerradaEm || agora;
      antiga.motivoEncerramento = antiga.motivoEncerramento || "Matrícula congelada por reativação com novo ciclo.";
      antiga.renovacaoAutomatica = false;
      antiga.gerarMensalidadeAutomatica = false;
      antiga.bloqueada = true;
      antiga.bloqueioCheckin = true;
      antiga.atualizadoEm = agora;
      antiga.historico = Array.isArray(antiga.historico) ? antiga.historico : [];
      antiga.historico.push({
        id: gerarIdLocal("hist_mat_cong"),
        acao: "congelamento_por_reativacao",
        descricao: "Matrícula antiga congelada. Uma nova matrícula foi criada para a reativação do aluno.",
        novaRegra: "reativacao_cria_nova_matricula",
        usuario,
        motivo,
        criadoEm: agora
      });
    }

    matricula = {
      id: gerarIdLocal("mat"),
      numero: numeroMatriculaAluno(matriculas, hoje),
      numeroMatricula: "",
      alunoId: id,
      alunoNome: nomeAluno(aluno),
      aluno: nomeAluno(aluno),
      planoId,
      plano: planoNome,
      planoNome,
      valorMensal: valorPlano || valor,
      valorMensalTotal: valorPlano || valor,
      valorPlano: valorPlano || valor,
      valorServicos: 0,
      dataMatricula: hoje,
      dataInicio: hoje,
      vencimentoInicial: hoje,
      proximoVencimento: "",
      status: "Pendente",
      statusPagamento: "Aberto",
      statusFinanceiroInicial: "Aberto",
      renovacaoAutomatica: true,
      gerarMensalidadeAutomatica: true,
      origem: "reativacao_aluno",
      tipoCobranca: "Mensal",
      tipoPlano: baseComercial.tipoPlano || aluno.tipoPlano || "Mensal",
      matriculaAnteriorId: matriculaAnterior?.id || "",
      reativacaoNovaMatricula: true,
      criadoEm: agora,
      atualizadoEm: agora,
      historico: [{
        id: gerarIdLocal("hist_mat_nova_reat"),
        acao: "nova_matricula_reativacao",
        descricao: "Nova matrícula criada para reativação. A matrícula anterior permanece congelada como histórico.",
        matriculaAnteriorId: matriculaAnterior?.id || "",
        usuario,
        motivo,
        criadoEm: agora
      }]
    };
    matricula.numeroMatricula = matricula.numero;
    matriculas.push(matricula);
  }

  matricula.status = "Pendente";
  matricula.statusPagamento = "Aberto";
  matricula.statusFinanceiroInicial = "Aberto";
  matricula.bloqueada = true;
  matricula.bloqueioCheckin = true;
  matricula.renovacaoAutomatica = true;
  matricula.gerarMensalidadeAutomatica = true;
  matricula.planoId = planoId || matricula.planoId || "";
  matricula.plano = planoNome || matricula.plano || "";
  matricula.planoNome = planoNome || matricula.planoNome || matricula.plano || "";
  matricula.valorMensal = valorPlano || numeroAluno(matricula.valorMensal, valor);
  matricula.valorMensalTotal = valorPlano || numeroAluno(matricula.valorMensalTotal, valor);
  matricula.valorPlano = valorPlano || numeroAluno(matricula.valorPlano, valor);
  matricula.atualizadoEm = agora;
  matricula.historico = Array.isArray(matricula.historico) ? matricula.historico : [];
  matricula.historico.push({
    id: gerarIdLocal("hist_mat_reat_cob"),
    acao: "reativacao_cobranca_aberta",
    descricao: "Cobrança de reativação criada. Matrícula será ativada após pagamento.",
    motivo,
    usuario,
    criadoEm: agora
  });

  const recebimentoAberto = recebimentos.find(r =>
    mesmoId(r.alunoId, id) &&
    normalizar(r.origem) === "reativacao_aluno" &&
    statusAbertoCobrancaAluno(r.status)
  );

  let recebimento = recebimentoAberto || null;
  let mensalidade = null;
  let financeiroItem = null;

  if (!recebimento) {
    const mensalidadeId = gerarIdLocal("men_reat");
    const financeiroId = `fin_${mensalidadeId}`;
    const recebimentoId = `rec_${mensalidadeId}`;
    const competencia = competenciaAtualAluno(hoje);

    mensalidade = {
      id: mensalidadeId,
      alunoId: id,
      alunoNome: nomeAluno(aluno),
      aluno: nomeAluno(aluno),
      matriculaId: matricula.id,
      planoId,
      planoNome,
      plano: planoNome,
      competencia,
      vencimento: hoje,
      valor,
      valorOriginal: valor,
      total: valor,
      valorRestante: valor,
      saldoRestante: valor,
      status: "aberto",
      descricao: `Reativação - ${nomeAluno(aluno)}`,
      origem: "reativacao_aluno",
      lancamentoFinanceiroId: financeiroId,
      recebimentoId,
      ativarMatriculaAoReceber: true,
      gerarProximaMensalidadeAposPagamento: true,
      criadoEm: agora,
      atualizadoEm: agora
    };

    financeiroItem = {
      id: financeiroId,
      tipo: "receber",
      descricao: mensalidade.descricao,
      categoria: "Reativação",
      centroCusto: "Academia",
      alunoFornecedor: nomeAluno(aluno),
      pessoa: nomeAluno(aluno),
      pessoaFornecedor: nomeAluno(aluno),
      alunoId: id,
      matriculaId: matricula.id,
      mensalidadeId,
      recebimentoId,
      planoId,
      plano: planoNome,
      valor,
      valorBruto: valor,
      total: valor,
      valorDevido: valor,
      valorLiquido: 0,
      valorPago: 0,
      valorRecebido: 0,
      valorRestante: valor,
      vencimento: hoje,
      pagamento: "",
      dataPagamento: "",
      formaPagamento: "",
      status: "Aberto",
      origem: "reativacao_aluno",
      ativarMatriculaAoReceber: true,
      criadoEm: agora,
      atualizadoEm: agora
    };

    recebimento = {
      id: recebimentoId,
      descricao: mensalidade.descricao,
      categoria: "Reativação",
      pessoa: nomeAluno(aluno),
      alunoId: id,
      matriculaId: matricula.id,
      mensalidadeId,
      lancamentoFinanceiroId: financeiroId,
      planoId,
      plano: planoNome,
      vencimento: hoje,
      valor,
      valorBruto: valor,
      valorDevido: valor,
      valorRecebido: 0,
      valorRestante: valor,
      status: "aberto",
      origem: "reativacao_aluno",
      ativarMatriculaAoReceber: true,
      gerarProximaMensalidadeAposPagamento: true,
      criadoEm: agora,
      atualizadoEm: agora
    };

    mensalidades.push(mensalidade);
    financeiro.push(financeiroItem);
    recebimentos.push(recebimento);
  } else {
    mensalidade = mensalidades.find(m => mesmoId(m.id, recebimento.mensalidadeId)) || null;
    financeiroItem = financeiro.find(f => mesmoId(f.id, recebimento.lancamentoFinanceiroId)) || null;
  }

  matricula.mensalidadeInicialId = mensalidade?.id || recebimento.mensalidadeId || matricula.mensalidadeInicialId || "";
  matricula.financeiroInicialId = financeiroItem?.id || recebimento.lancamentoFinanceiroId || matricula.financeiroInicialId || "";
  matricula.recebimentoInicialId = recebimento.id;

  await salvarJson("matriculas.json", matriculas);
  await salvarJson("mensalidades.json", mensalidades);
  await salvarJson("financeiro.json", financeiro);
  await salvarJson("recebimentos.json", recebimentos);

  await atualizarAluno(id, {
    status: "reativacao_pendente",
    situacao: "reativacao_pendente",
    statusMatricula: "Pendente",
    matriculaStatus: "Pendente",
    matriculaId: matricula.id,
    numeroMatricula: matricula.numero || matricula.numeroMatricula || aluno.numeroMatricula || "",
    planoId: planoId || aluno.planoId || "",
    plano: planoNome || aluno.plano || "",
    valorMensal: valorPlano || aluno.valorMensal || valor,
    valorPlano: valorPlano || aluno.valorPlano || valor,
    valorMensalTotal: valorPlano || aluno.valorMensalTotal || valor,
    reativacaoPendenteEm: agora,
    recebimentoReativacaoId: recebimento.id,
    atualizadoEm: agora
  });

  await registrarAuditoria({
    tipo: "aluno_reativacao_cobranca_criada",
    alunoId: id,
    aluno: nomeAluno(aluno),
    motivo,
    usuario,
    resumo: {
      matriculaId: matricula.id,
      mensalidadeId: mensalidade?.id || recebimento.mensalidadeId || "",
      financeiroId: financeiroItem?.id || recebimento.lancamentoFinanceiroId || "",
      recebimentoId: recebimento.id,
      valor
    }
  });

  return {
    ok: true,
    pendentePagamento: true,
    alunoId: id,
    aluno: nomeAluno(aluno),
    matricula,
    mensalidade,
    financeiro: financeiroItem,
    recebimento,
    mensagem: "Cobrança de reativação criada com nova matrícula. Confirme o recebimento no Financeiro para ativar o aluno e gerar a próxima fatura."
  };
}

export async function reativar(id, opcoes = {}) {
  return await reativarFluxoCompletoAluno(id, opcoes);
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

  const [matriculasRaw, mensalidadesRaw, financeiroRaw, recebimentosRaw, caixaRaw, checkinsRaw, avaliacoesRaw, treinosLegadosRaw, treinosPrescritosRaw, historicoPlanosRaw] = await Promise.all([
    lerJson("matriculas.json", []),
    lerJson("mensalidades.json", []),
    lerJson("financeiro.json", []),
    lerJson("recebimentos.json", []),
    lerJson("caixa.json", { caixas: [], movimentos: [] }),
    lerJson("checkins.json", []),
    lerJson("avaliacoes.json", []),
    lerJson("treinos.json", []),
    obterTreinos({}),
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
  const identificadoresTreinoAluno = new Set([
    id,
    aluno.id,
    aluno._id,
    aluno.codigo,
    aluno.alunoId,
    aluno.aluno_id,
    aluno.matriculaId,
    aluno.matricula_id,
    aluno.numeroMatricula,
    aluno.cpf,
    String(aluno.cpf || "").replace(/\D/g, ""),
    String(aluno.telefone || "").replace(/\D/g, "")
  ].filter(Boolean).map(v => String(v)));

  const nomeAlunoNormalizado = normalizar(nomeAluno(aluno));
  const pertenceAoAlunoTreino = (treino = {}) => {
    const idsTreino = [
      treino.alunoId,
      treino.aluno_id,
      treino.idAluno,
      treino.alunoCodigo,
      treino.matriculaId,
      treino.matricula_id,
      treino.cpf,
      String(treino.cpf || "").replace(/\D/g, "")
    ].filter(Boolean).map(v => String(v));

    if (idsTreino.some(v => identificadoresTreinoAluno.has(v))) return true;

    const nomeTreino = normalizar(treino.alunoNome || treino.aluno || treino.nomeAluno || "");
    return Boolean(nomeAlunoNormalizado && nomeTreino && nomeTreino === nomeAlunoNormalizado);
  };

  const treinosPrescritos = Array.isArray(treinosPrescritosRaw) ? treinosPrescritosRaw : [];
  const treinosLegados = Array.isArray(treinosLegadosRaw) ? treinosLegadosRaw : [];
  const treinos = [...treinosPrescritos, ...treinosLegados]
    .filter(pertenceAoAlunoTreino)
    .filter((treino, index, lista) => lista.findIndex(item => String(item.id || item._id || "") === String(treino.id || treino._id || "")) === index);

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
