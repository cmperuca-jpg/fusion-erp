import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const COMERCIAL_DIR = path.join(DATA_DIR, 'comercial');

const FILES = {
  contratos: path.join(COMERCIAL_DIR, 'contratos.json'),
  servicosContratados: path.join(COMERCIAL_DIR, 'servicos_contratados.json'),
  mensalidades: path.join(DATA_DIR, 'mensalidades.json'),
  financeiro: path.join(DATA_DIR, 'financeiro.json'),
  alunos: path.join(DATA_DIR, 'alunos.json')
};

async function garantirArquivo(arquivo, padrao = []) {
  try {
    await fs.access(arquivo);
  } catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), 'utf8');
  }
}

async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const raw = await fs.readFile(arquivo, 'utf8');
  if (!raw.trim()) return padrao;
  try { return JSON.parse(raw); } catch { return padrao; }
}

async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

function agoraISO() { return new Date().toISOString(); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function dinheiro(valor) {
  const n = Number(String(valor ?? 0).replace(',', '.'));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}
function texto(valor) { return String(valor ?? '').trim(); }
function normalizar(valor) {
  return texto(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function gerarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}
function statusAtivo(item = {}) {
  return !['removido', 'removida', 'cancelado', 'cancelada', 'inativo', 'inativa', 'encerrado', 'encerrada'].includes(normalizar(item.status || 'Ativo'));
}
function statusMensalidadeAberta(item = {}) {
  const st = normalizar(item.status || 'aberto');
  return ['aberto', 'aberta', 'pendente', 'parcial', 'atrasado'].includes(st);
}
function statusFinanceiro(status = '') {
  const st = normalizar(status);
  if (['pago', 'recebido', 'quitado', 'baixado'].includes(st)) return 'Pago';
  if (['cancelado', 'cancelada'].includes(st)) return 'Cancelado';
  return 'Aberto';
}
function statusMensalidade(status = '') {
  const st = normalizar(status);
  if (['pago', 'recebido', 'quitado', 'baixado'].includes(st)) return 'pago';
  if (['cancelado', 'cancelada'].includes(st)) return 'cancelado';
  if (['parcial'].includes(st)) return 'parcial';
  return 'aberto';
}
function tipoCobrancaContrato(contrato = {}) {
  const bruto = normalizar(contrato.tipoCobranca || contrato.tipoPlano || contrato.periodicidade || 'Mensal');
  if (bruto.includes('diar')) return 'Diarista';
  if (bruto.includes('pre')) return 'Pré-pago';
  if (bruto.includes('semes')) return 'Semestral';
  if (bruto.includes('anual')) return 'Anual';
  return 'Mensal';
}
function periodicidadeMeses(contrato = {}) {
  const direto = Number(contrato.periodicidadeMeses || 0);
  if (Number.isFinite(direto) && direto > 0) return Math.round(direto);
  const tipo = tipoCobrancaContrato(contrato);
  if (tipo === 'Semestral') return 6;
  if (tipo === 'Anual') return 12;
  if (tipo === 'Mensal') return 1;
  return 0;
}
function competenciaPorData(dataISO) {
  return String(dataISO || hojeISO()).slice(0, 7);
}
function adicionarMeses(dataISO, meses = 1) {
  const base = new Date(`${String(dataISO || hojeISO()).slice(0, 10)}T12:00:00`);
  const dia = base.getDate();
  base.setDate(1);
  base.setMonth(base.getMonth() + Number(meses || 1));
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(dia, ultimo));
  return base.toISOString().slice(0, 10);
}
function localizarContrato(contratos, id) {
  return contratos.find((c) =>
    String(c.id) === String(id) ||
    String(c.matriculaId || '') === String(id) ||
    String(c.numeroMatricula || '') === String(id)
  ) || null;
}
function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find(statusAtivo) || lista[0] || null;
}
function valorMatriculaContrato(contrato = {}) {
  return dinheiro(contrato.valorMatricula ?? contrato.valorBaseMatricula ?? 0);
}
function servicosDoContrato(servicosContratados, contratoId, incluirInativos = false) {
  return servicosContratados.filter((s) =>
    String(s.contratoId) === String(contratoId) &&
    (incluirInativos || statusAtivo(s))
  );
}
function resumoServicos(servicos = []) {
  return servicos.map((s) => ({
    id: s.id,
    servicoId: s.servicoId || '',
    servico: s.servico || s.nome || s.modalidade || '',
    nome: s.nome || s.servico || s.modalidade || '',
    modalidade: s.modalidade || '',
    turmaId: s.turmaId || '',
    turma: s.turma || s.nome || '',
    professor: s.professor || '',
    diasSemana: s.diasSemana || '',
    horario: s.horario || '',
    sala: s.sala || '',
    valor: dinheiro(s.valor),
    tipoCobranca: s.tipoCobranca || ''
  }));
}
function descricaoContrato(contrato = {}, competencia = '') {
  const aluno = contrato.aluno || contrato.alunoNome || contrato.nomeAluno || contrato.alunoId || 'Aluno';
  return competencia ? `Contrato comercial ${aluno} - ${competencia}` : `Contrato comercial - ${aluno}`;
}
async function carregarBase() {
  return {
    contratos: await lerJson(FILES.contratos, []),
    servicosContratados: await lerJson(FILES.servicosContratados, []),
    mensalidades: await lerJson(FILES.mensalidades, []),
    financeiro: await lerJson(FILES.financeiro, []),
    alunos: await lerJson(FILES.alunos, [])
  };
}

export async function calcularContratoFinanceiro(contratoIdOuAlunoId) {
  const base = await carregarBase();
  let contrato = localizarContrato(base.contratos, contratoIdOuAlunoId);
  if (!contrato) contrato = contratoAtivoAluno(base.contratos, contratoIdOuAlunoId);
  if (!contrato) {
    const erro = new Error('Contrato comercial não encontrado.');
    erro.status = 404;
    throw erro;
  }

  const servicos = servicosDoContrato(base.servicosContratados, contrato.id);
  const valorMatricula = valorMatriculaContrato(contrato);
  const valorServicos = dinheiro(servicos.reduce((total, item) => total + dinheiro(item.valor), 0));
  const descontos = dinheiro(contrato.descontoContrato ?? contrato.desconto ?? 0);
  const acrescimos = dinheiro(contrato.acrescimoContrato ?? contrato.acrescimos ?? 0);
  const total = dinheiro(Math.max(0, valorMatricula + valorServicos + acrescimos - descontos));

  return {
    ok: true,
    contrato: {
      id: contrato.id,
      alunoId: contrato.alunoId || '',
      aluno: contrato.aluno || '',
      matriculaId: contrato.matriculaId || '',
      numeroMatricula: contrato.numeroMatricula || '',
      tipoPlano: contrato.tipoPlano || tipoCobrancaContrato(contrato),
      tipoCobranca: contrato.tipoCobranca || tipoCobrancaContrato(contrato),
      status: contrato.status || '',
      dataInicio: contrato.dataInicio || '',
      dataFim: contrato.dataFim || '',
      periodicidadeMeses: periodicidadeMeses(contrato),
      renovacaoAutomatica: contrato.renovacaoAutomatica !== false
    },
    valorMatricula,
    valorServicos,
    descontos,
    acrescimos,
    total,
    servicos: resumoServicos(servicos)
  };
}

function encontrarMensalidadeAberta(mensalidades, contrato, competenciaAlvo = '') {
  const candidatas = mensalidades.filter((m) => {
    const mesmoContrato = String(m.contratoId || '') === String(contrato.id);
    const mesmaMatricula = contrato.matriculaId && String(m.matriculaId || '') === String(contrato.matriculaId);
    const mesmoAluno = String(m.alunoId || '') === String(contrato.alunoId || '');
    const compOK = !competenciaAlvo || String(m.competencia || '').slice(0, 7) === String(competenciaAlvo).slice(0, 7);
    return (mesmoContrato || mesmaMatricula || mesmoAluno) && compOK && statusMensalidadeAberta(m);
  });
  return candidatas.sort((a, b) => String(b.vencimento || '').localeCompare(String(a.vencimento || '')))[0] || null;
}
function encontrarFinanceiroPorMensalidade(financeiro, mensalidadeId) {
  return financeiro.find((f) => String(f.mensalidadeId || '') === String(mensalidadeId)) || null;
}
function montarMensalidadeContrato(contrato, calculo, existente = null, opcoes = {}) {
  const meses = periodicidadeMeses(contrato);
  const hoje = hojeISO();
  const vencimento = opcoes.vencimento || existente?.vencimento || contrato.proximoVencimento || contrato.dataFim || adicionarMeses(contrato.dataInicio || hoje, meses || 1);
  const competencia = opcoes.competencia || existente?.competencia || competenciaPorData(vencimento);
  const origem = meses > 0 ? 'contrato_comercial' : 'contrato_comercial_avulso';

  return {
    ...(existente || {}),
    id: existente?.id || gerarId('men_ctr'),
    alunoId: contrato.alunoId || '',
    aluno: contrato.aluno || '',
    alunoNome: contrato.aluno || '',
    contratoId: contrato.id,
    matriculaId: contrato.matriculaId || '',
    numeroMatricula: contrato.numeroMatricula || '',
    competencia,
    vencimento,
    valor: calculo.total,
    valorOriginal: calculo.total,
    valorMatricula: calculo.valorMatricula,
    valorServicos: calculo.valorServicos,
    desconto: calculo.descontos,
    acrescimos: calculo.acrescimos,
    total: calculo.total,
    valorPago: dinheiro(existente?.valorPago || 0),
    valorRestante: Math.max(0, dinheiro(calculo.total) - dinheiro(existente?.valorPago || 0)),
    status: statusMensalidade(existente?.status),
    origem,
    tipoCobranca: contrato.tipoCobranca || tipoCobrancaContrato(contrato),
    periodicidade: contrato.tipoPlano || contrato.tipoCobranca || tipoCobrancaContrato(contrato),
    periodicidadeMeses: meses,
    renovacaoAutomatica: contrato.renovacaoAutomatica !== false && meses > 0,
    servicos: calculo.servicos,
    descricao: descricaoContrato(contrato, competencia),
    atualizadoEm: agoraISO(),
    criadoEm: existente?.criadoEm || agoraISO()
  };
}
function montarFinanceiroContrato(contrato, mensalidade, existente = null) {
  const valorPago = dinheiro(mensalidade.valorPago || existente?.valorPago || 0);
  const valor = dinheiro(mensalidade.total ?? mensalidade.valor ?? 0);
  const status = statusFinanceiro(mensalidade.status);
  return {
    ...(existente || {}),
    id: existente?.id || `fin_${mensalidade.id}`,
    tipo: 'receber',
    descricao: mensalidade.descricao || descricaoContrato(contrato, mensalidade.competencia),
    categoria: 'Contratos e Serviços',
    centroCusto: 'Academia',
    alunoFornecedor: contrato.aluno || '',
    pessoa: contrato.aluno || '',
    pessoaFornecedor: contrato.aluno || '',
    alunoId: contrato.alunoId || '',
    contratoId: contrato.id,
    matriculaId: contrato.matriculaId || '',
    numeroMatricula: contrato.numeroMatricula || '',
    mensalidadeId: mensalidade.id,
    valor,
    valorBruto: valor,
    valorOriginal: valor,
    valorMatricula: dinheiro(mensalidade.valorMatricula),
    valorServicos: dinheiro(mensalidade.valorServicos),
    total: valor,
    valorPago,
    valorRecebido: valorPago,
    valorRestante: status === 'Pago' ? 0 : Math.max(0, valor - valorPago),
    vencimento: mensalidade.vencimento,
    pagamento: mensalidade.pagamento || mensalidade.dataPagamento || '',
    dataPagamento: mensalidade.dataPagamento || mensalidade.pagamento || '',
    formaPagamento: mensalidade.formaPagamento || existente?.formaPagamento || '',
    status,
    origem: mensalidade.origem || 'contrato_comercial',
    tipoCobranca: mensalidade.tipoCobranca || contrato.tipoCobranca || '',
    periodicidade: mensalidade.periodicidade || contrato.tipoPlano || '',
    periodicidadeMeses: mensalidade.periodicidadeMeses || periodicidadeMeses(contrato),
    servicos: mensalidade.servicos || [],
    observacoes: mensalidade.observacao || mensalidade.observacoes || '',
    observacao: mensalidade.observacao || mensalidade.observacoes || '',
    atualizadoEm: agoraISO(),
    criadoEm: existente?.criadoEm || agoraISO()
  };
}

export async function sincronizarContratoFinanceiro(contratoId, opcoes = {}) {
  const base = await carregarBase();
  const contrato = localizarContrato(base.contratos, contratoId) || contratoAtivoAluno(base.contratos, contratoId);
  if (!contrato) {
    const erro = new Error('Contrato comercial não encontrado.');
    erro.status = 404;
    throw erro;
  }
  const calculo = await calcularContratoFinanceiro(contrato.id);
  const meses = periodicidadeMeses(contrato);
  const tipo = tipoCobrancaContrato(contrato);
  const vencimento = opcoes.vencimento || contrato.proximoVencimento || contrato.dataFim || adicionarMeses(contrato.dataInicio || hojeISO(), meses || 1);
  const competencia = opcoes.competencia || competenciaPorData(vencimento);
  const criarAvulsa = ['Pré-pago', 'Diarista'].includes(tipo);

  let mensalidade = encontrarMensalidadeAberta(base.mensalidades, contrato, criarAvulsa ? '' : competencia);
  if (!mensalidade || opcoes.forcarNova === true || criarAvulsa) {
    mensalidade = null;
  }

  const novaMensalidade = montarMensalidadeContrato(contrato, calculo, mensalidade, { vencimento, competencia });
  const idxMen = base.mensalidades.findIndex((m) => String(m.id) === String(novaMensalidade.id));
  if (idxMen >= 0) base.mensalidades[idxMen] = novaMensalidade;
  else base.mensalidades.push(novaMensalidade);

  let lancamento = encontrarFinanceiroPorMensalidade(base.financeiro, novaMensalidade.id);
  const novoFinanceiro = montarFinanceiroContrato(contrato, novaMensalidade, lancamento);
  const idxFin = base.financeiro.findIndex((f) => String(f.id) === String(novoFinanceiro.id));
  if (idxFin >= 0) base.financeiro[idxFin] = novoFinanceiro;
  else base.financeiro.push(novoFinanceiro);

  novaMensalidade.lancamentoFinanceiroId = novoFinanceiro.id;
  novaMensalidade.financeiroInicialId = novoFinanceiro.id;

  const idxMen2 = base.mensalidades.findIndex((m) => String(m.id) === String(novaMensalidade.id));
  if (idxMen2 >= 0) base.mensalidades[idxMen2] = novaMensalidade;

  contrato.valorMatricula = calculo.valorMatricula;
  contrato.valorServicos = calculo.valorServicos;
  contrato.valorTotal = calculo.total;
  contrato.totalMensal = calculo.total;
  contrato.quantidadeServicos = calculo.servicos.length;
  contrato.ultimaSincronizacaoFinanceira = agoraISO();
  contrato.ultimaMensalidadeId = novaMensalidade.id;
  contrato.ultimoFinanceiroId = novoFinanceiro.id;
  contrato.proximoVencimento = vencimento;
  contrato.atualizadoEm = agoraISO();

  const idxContrato = base.contratos.findIndex((c) => String(c.id) === String(contrato.id));
  if (idxContrato >= 0) base.contratos[idxContrato] = contrato;

  await salvarJson(FILES.mensalidades, base.mensalidades);
  await salvarJson(FILES.financeiro, base.financeiro);
  await salvarJson(FILES.contratos, base.contratos);

  return {
    ok: true,
    mensagem: criarAvulsa ? 'Cobrança avulsa do contrato comercial gerada.' : 'Mensalidade e financeiro sincronizados pelo contrato comercial.',
    contrato,
    calculo,
    mensalidade: novaMensalidade,
    financeiro: novoFinanceiro
  };
}

export async function sincronizarTodosContratosFinanceiro(opcoes = {}) {
  const base = await carregarBase();
  const contratos = base.contratos.filter((c) => statusAtivo(c));
  const resultados = [];
  for (const contrato of contratos) {
    try {
      resultados.push(await sincronizarContratoFinanceiro(contrato.id, opcoes));
    } catch (err) {
      resultados.push({ ok: false, contratoId: contrato.id, erro: err.message });
    }
  }
  return { ok: true, total: resultados.length, resultados };
}

export async function gerarAjusteContratoFinanceiro(contratoId, dados = {}) {
  const calculo = await calcularContratoFinanceiro(contratoId);
  const base = await carregarBase();
  const contrato = localizarContrato(base.contratos, calculo.contrato.id);
  const valorAnterior = dinheiro(dados.valorAnterior ?? contrato.valorTotalAnterior ?? 0);
  const valorAtual = dinheiro(calculo.total);
  const diferenca = dinheiro(valorAtual - valorAnterior);
  if (diferenca === 0) return { ok: true, mensagem: 'Sem diferença para ajustar.', diferenca: 0, calculo };

  const mensalidade = {
    id: gerarId('men_ajuste_ctr'),
    alunoId: contrato.alunoId || '',
    aluno: contrato.aluno || '',
    alunoNome: contrato.aluno || '',
    contratoId: contrato.id,
    matriculaId: contrato.matriculaId || '',
    numeroMatricula: contrato.numeroMatricula || '',
    competencia: competenciaPorData(dados.vencimento || hojeISO()),
    vencimento: dados.vencimento || hojeISO(),
    valor: Math.abs(diferenca),
    valorOriginal: Math.abs(diferenca),
    total: Math.abs(diferenca),
    status: 'aberto',
    origem: diferenca > 0 ? 'ajuste_complementar_contrato' : 'credito_contrato',
    tipoCobranca: contrato.tipoCobranca || '',
    descricao: diferenca > 0 ? `Complemento de contrato - ${contrato.aluno || ''}` : `Crédito de contrato - ${contrato.aluno || ''}`,
    servicos: calculo.servicos,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };
  const financeiro = montarFinanceiroContrato(contrato, mensalidade, null);
  financeiro.id = `fin_${mensalidade.id}`;
  financeiro.descricao = mensalidade.descricao;
  financeiro.categoria = diferenca > 0 ? 'Ajustes Comerciais' : 'Créditos Comerciais';
  financeiro.valor = Math.abs(diferenca);
  financeiro.valorBruto = Math.abs(diferenca);
  financeiro.total = Math.abs(diferenca);
  financeiro.origem = mensalidade.origem;

  mensalidade.lancamentoFinanceiroId = financeiro.id;
  mensalidade.financeiroInicialId = financeiro.id;

  base.mensalidades.push(mensalidade);
  base.financeiro.push(financeiro);
  contrato.valorTotalAnterior = valorAnterior;
  contrato.valorTotal = valorAtual;
  contrato.ultimoAjusteFinanceiroId = financeiro.id;
  contrato.atualizadoEm = agoraISO();

  const idx = base.contratos.findIndex((c) => String(c.id) === String(contrato.id));
  if (idx >= 0) base.contratos[idx] = contrato;

  await salvarJson(FILES.mensalidades, base.mensalidades);
  await salvarJson(FILES.financeiro, base.financeiro);
  await salvarJson(FILES.contratos, base.contratos);

  return { ok: true, diferenca, tipo: diferenca > 0 ? 'complemento' : 'credito', calculo, mensalidade, financeiro };
}
