import fs from 'node:fs/promises';
import path from 'node:path';
import { desbloquearAlunoAposPagamento } from './desbloqueio.service.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');

const RECEBIMENTOS_FILE = path.join(DATA_DIR, 'recebimentos.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');
const CAIXA_FILE = path.join(DATA_DIR, 'caixa.json');
const MENSALIDADES_FILE = path.join(DATA_DIR, 'mensalidades.json');
const MATRICULAS_FILE = path.join(DATA_DIR, 'matriculas.json');
const ALUNOS_FILE = path.join(DATA_DIR, 'alunos.json');
const CHECKINS_FILE = path.join(DATA_DIR, 'checkins.json');
const CREDITOS_FILE = path.join(DATA_DIR, 'creditos.json');

async function garantirArquivo(arquivo, conteudoPadrao = []) {
  try {
    await fs.access(arquivo);
  } catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(conteudoPadrao, null, 2), 'utf8');
  }
}

async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const txt = await fs.readFile(arquivo, 'utf8');
  if (!txt.trim()) return padrao;
  return JSON.parse(txt);
}

async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function gerarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : padrao;
}

function normalizar(valor) {
  return String(valor || '').trim().toLowerCase();
}

function statusRecebimento(status) {
  const s = normalizar(status);
  if (s === 'cancelado') return 'cancelado';
  if (s === 'estornado') return 'estornado';
  if (s === 'parcial') return 'parcial';
  if (s === 'pago' || s === 'recebido') return 'recebido';
  return 'aberto';
}

function ehEntradaMatricula(recebimento = {}) {
  const alvo = normalizar([
    recebimento.origem,
    recebimento.categoria,
    recebimento.descricao,
    recebimento.recorrencia
  ].join(' '));
  return Boolean(recebimento.ativarMatriculaAoReceber) ||
    alvo.includes('matricula_inicial_unificada') ||
    alvo.includes('entrada matricula') ||
    alvo.includes('entrada matrícula') ||
    alvo.includes('matricula + mensalidade') ||
    alvo.includes('matrícula + mensalidade') ||
    alvo.includes('matricula e mensalidade') ||
    alvo.includes('matrícula e mensalidade');
}


function calcularLiquido(valorBruto, taxaValor = 0, taxaPercentual = 0) {
  const bruto = numero(valorBruto, 0);
  const taxaFixa = numero(taxaValor, 0);
  const taxaPerc = bruto * (numero(taxaPercentual, 0) / 100);
  return Number(Math.max(0, bruto - taxaFixa - taxaPerc).toFixed(2));
}

async function lerCaixa() {
  const dados = await lerJson(CAIXA_FILE, { caixas: [], movimentos: [] });
  return {
    caixas: Array.isArray(dados.caixas) ? dados.caixas : [],
    movimentos: Array.isArray(dados.movimentos) ? dados.movimentos : []
  };
}

async function salvarCaixa(dados) {
  await salvarJson(CAIXA_FILE, dados);
}

function caixaAberto(dados) {
  return dados.caixas.find(c => c.status === 'aberto') || null;
}

function formaEhDinheiro(forma) {
  const f = normalizar(forma).normalize('NFD').replace(/[̀-ͯ]/g, '');
  return f.includes('dinheiro') || f.includes('especie');
}

async function criarSaidaTrocoCaixa({ caixaId, recebimento, valorTroco }) {
  const dados = await lerCaixa();
  const caixa = dados.caixas.find(c => String(c.id) === String(caixaId)) || caixaAberto(dados);
  if (!caixa || !(valorTroco > 0)) return null;

  const movimento = {
    id: gerarId('mov_troco'),
    caixaId: caixa.id,
    tipo: 'saida',
    descricao: `Troco - ${recebimento.pessoa || recebimento.descricao || 'Recebimento'}`,
    categoria: 'Troco',
    pessoa: recebimento.pessoa || '',
    formaPagamento: 'Dinheiro',
    valor: numero(valorTroco, 0),
    valorBruto: numero(valorTroco, 0),
    valorLiquido: numero(valorTroco, 0),
    data: recebimento.dataRecebimento || hojeISO(),
    status: 'ativo',
    origem: 'troco_recebimento',
    recebimentoId: recebimento.id,
    mensalidadeId: recebimento.mensalidadeId || '',
    lancamentoFinanceiroId: recebimento.lancamentoFinanceiroId || '',
    observacao: `Troco devolvido no recebimento ${recebimento.id}.`,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  dados.movimentos.push(movimento);
  await salvarCaixa(dados);
  return movimento;
}

async function criarCreditoAluno({ recebimento, valorCredito }) {
  if (!(valorCredito > 0)) return null;
  const creditos = await lerJson(CREDITOS_FILE, []);
  const credito = {
    id: gerarId('cred'),
    alunoId: recebimento.alunoId || '',
    aluno: recebimento.aluno || recebimento.pessoa || recebimento.cliente || '',
    pessoa: recebimento.pessoa || recebimento.aluno || '',
    recebimentoId: recebimento.id,
    lancamentoFinanceiroId: recebimento.lancamentoFinanceiroId || '',
    mensalidadeId: recebimento.mensalidadeId || '',
    origem: 'pagamento_maior_que_saldo',
    descricao: `Crédito gerado por pagamento acima do saldo - ${recebimento.descricao || 'Recebimento'}`,
    valorOriginal: numero(valorCredito, 0),
    saldo: numero(valorCredito, 0),
    valorUtilizado: 0,
    status: 'Ativo',
    data: recebimento.dataRecebimento || hojeISO(),
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };
  creditos.unshift(credito);
  await salvarJson(CREDITOS_FILE, creditos);
  return credito;
}

async function criarMovimentoCaixa(recebimento) {
  const dados = await lerCaixa();
  const caixa = caixaAberto(dados);

  if (!caixa) {
    const novoCaixa = {
      id: gerarId('cx'),
      dataAbertura: hojeISO(),
      valorAbertura: 0,
      responsavel: 'Administrador',
      observacaoAbertura: 'Caixa aberto automaticamente pela baixa de recebimento.',
      status: 'aberto',
      abertoEm: agoraISO(),
      fechadoEm: '',
      valorFechamentoInformado: null,
      diferenca: null,
      observacaoFechamento: ''
    };
    dados.caixas.push(novoCaixa);
    caixa = novoCaixa;
  }

  const movimentoId = recebimento.movimentoCaixaId || gerarId('mov');
  const existente = dados.movimentos.findIndex(m => String(m.id) === String(movimentoId));

  const movimento = {
    id: movimentoId,
    caixaId: caixa.id,
    tipo: 'entrada',
    descricao: recebimento.descricao || 'Recebimento',
    categoria: recebimento.categoria || 'Recebimentos',
    pessoa: recebimento.pessoa || '',
    formaPagamento: recebimento.formaPagamento || 'Dinheiro',
    valor: numero(recebimento.valorBaixa ?? recebimento.valorBruto ?? recebimento.valorRecebido ?? recebimento.valorLiquido, 0),
    valorBruto: numero(recebimento.valorBaixa ?? recebimento.valorBruto ?? recebimento.valorRecebido ?? recebimento.valorLiquido, 0),
    desconto: numero(recebimento.desconto, 0),
    acrescimo: numero(recebimento.acrescimo, 0),
    juros: numero(recebimento.juros, 0),
    multa: numero(recebimento.multa, 0),
    valorLiquido: numero(recebimento.valorLiquido ?? recebimento.valorBaixa ?? recebimento.valorRecebido, 0),
    data: recebimento.dataRecebimento || hojeISO(),
    status: 'ativo',
    origem: recebimento.origem || 'recebimentos',
    recebimentoId: recebimento.id,
    mensalidadeId: recebimento.mensalidadeId || '',
    observacao: recebimento.observacao || '',
    lancamentoFinanceiroId: recebimento.lancamentoFinanceiroId || `fin_${recebimento.id}`,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  if (existente >= 0) dados.movimentos[existente] = { ...dados.movimentos[existente], ...movimento };
  else dados.movimentos.push(movimento);

  await salvarCaixa(dados);

  return {
    caixaId: caixa.id,
    movimentoCaixaId: movimento.id
  };
}

async function marcarMovimentoCaixaEstornado(movimentoId) {
  if (!movimentoId) return null;

  const dados = await lerCaixa();
  const idx = dados.movimentos.findIndex(m => String(m.id) === String(movimentoId));
  if (idx < 0) return null;

  dados.movimentos[idx] = {
    ...dados.movimentos[idx],
    status: 'estornado',
    estornadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  await salvarCaixa(dados);
  return dados.movimentos[idx];
}

async function upsertFinanceiro(recebimento) {
  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  const lancamentoId = recebimento.lancamentoFinanceiroId || `fin_${recebimento.id}`;
  const existente = financeiro.findIndex(l => String(l.id) === String(lancamentoId));

  const statusFin =
    recebimento.status === 'recebido' ? 'Pago' :
    recebimento.status === 'parcial' ? 'Parcial' :
    recebimento.status === 'cancelado' ? 'Cancelado' :
    'Aberto';

  const lancamento = {
    id: lancamentoId,
    tipo: 'receber',
    descricao: recebimento.descricao || 'Recebimento',
    categoria: recebimento.categoria || 'Recebimentos',
    centroCusto: recebimento.centroCusto || 'Caixa',
    alunoFornecedor: recebimento.pessoa || '',
    pessoa: recebimento.pessoa || '',
    pessoaFornecedor: recebimento.pessoa || '',
    alunoId: recebimento.alunoId || '',
    valor: numero(recebimento.valorBruto, 0),
    valorBruto: numero(recebimento.valorBruto, 0),
    total: numero(recebimento.valorDevido ?? recebimento.valorBruto, 0),
    valorDevido: numero(recebimento.valorDevido ?? recebimento.valorBruto, 0),
    desconto: numero(recebimento.desconto, 0),
    acrescimo: numero(recebimento.acrescimo, 0),
    juros: numero(recebimento.juros, 0),
    multa: numero(recebimento.multa, 0),
    valorLiquido: numero(recebimento.valorLiquido ?? recebimento.valorRecebido, 0),
    valorPago: numero(recebimento.valorRecebido, 0),
    valorRecebido: numero(recebimento.valorRecebido, 0),
    valorRestante: numero(recebimento.valorRestante, 0),
    taxaValor: numero(recebimento.taxaValor, 0),
    taxaPercentual: numero(recebimento.taxaPercentual, 0),
    vencimento: recebimento.vencimento || recebimento.dataRecebimento || hojeISO(),
    pagamento: ['recebido', 'parcial'].includes(recebimento.status) ? recebimento.dataRecebimento || hojeISO() : '',
    dataPagamento: ['recebido', 'parcial'].includes(recebimento.status) ? recebimento.dataRecebimento || hojeISO() : '',
    formaPagamento: ['recebido', 'parcial'].includes(recebimento.status) ? recebimento.formaPagamento || '' : '',
    status: statusFin,
    origem: recebimento.origem || 'recebimentos',
    recebimentoId: recebimento.id,
    mensalidadeId: recebimento.mensalidadeId || '',
    matriculaId: recebimento.matriculaId || '',
    ativarMatriculaAoReceber: Boolean(recebimento.ativarMatriculaAoReceber),
    caixaId: recebimento.caixaId || '',
    movimentoCaixaId: recebimento.movimentoCaixaId || '',
    observacoes: recebimento.observacao || '',
    observacao: recebimento.observacao || '',
    atualizadoEm: agoraISO()
  };

  if (existente >= 0) financeiro[existente] = { ...financeiro[existente], ...lancamento };
  else financeiro.push({ ...lancamento, criadoEm: agoraISO() });

  await salvarJson(FINANCEIRO_FILE, financeiro);
  return lancamentoId;
}


async function atualizarMensalidadeAposRecebimento(recebimento) {
  if (!recebimento.mensalidadeId) return null;

  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const idx = mensalidades.findIndex(m => String(m.id) === String(recebimento.mensalidadeId));
  if (idx < 0) return null;

  const mensalidade = mensalidades[idx];
  const valorOriginal = numero(mensalidade.total ?? mensalidade.valorTotalInicial ?? mensalidade.valorOriginal ?? mensalidade.valor ?? recebimento.valorBruto, 0);
  const desconto = numero(recebimento.desconto ?? mensalidade.desconto, 0);
  const acrescimo = numero(recebimento.acrescimo, 0);
  const juros = numero(recebimento.juros, 0);
  const multa = numero(recebimento.multa, 0);
  const valorTotal = Math.max(0, Number((valorOriginal + acrescimo + juros + multa - desconto).toFixed(2)));
  const valorPago = Math.min(valorTotal, numero(recebimento.valorRecebido ?? recebimento.valorBaixa ?? 0, 0));
  const valorRestante = Math.max(0, Number((valorTotal - valorPago).toFixed(2)));

  mensalidades[idx] = {
    ...mensalidade,
    valorOriginal,
    valorDevido: valorTotal,
    total: valorTotal,
    desconto,
    acrescimo,
    juros,
    multa,
    valorPago,
    valorRecebido: valorPago,
    valorBrutoRecebido: valorPago,
    valorRestante,
    saldoRestante: valorRestante,
    valorLiquido: numero(recebimento.valorLiquido ?? valorPago, 0),
    status: valorRestante <= 0 ? 'pago' : 'parcial',
    statusPagamento: valorRestante <= 0 ? 'Pago' : 'Parcial',
    situacao: valorRestante <= 0 ? 'pago' : 'parcial',
    dataPagamento: recebimento.dataRecebimento || hojeISO(),
    pagamento: recebimento.dataRecebimento || hojeISO(),
    formaPagamento: recebimento.formaPagamento || '',
    caixaId: recebimento.caixaId || mensalidade.caixaId || '',
    movimentoCaixaId: recebimento.movimentoCaixaId || mensalidade.movimentoCaixaId || '',
    lancamentoFinanceiroId: recebimento.lancamentoFinanceiroId || mensalidade.lancamentoFinanceiroId || `fin_${mensalidade.id}`,
    observacao: recebimento.observacao || mensalidade.observacao || '',
    atualizadoEm: agoraISO()
  };

  await salvarJson(MENSALIDADES_FILE, mensalidades);
  return mensalidades[idx];
}


function statusFinanceiroParaRecebimento(status) {
  const s = normalizar(status);
  if (['pago', 'recebido', 'quitado', 'baixado'].includes(s)) return 'recebido';
  if (['parcial', 'baixado parcial', 'parcialmente pago'].includes(s)) return 'parcial';
  if (['cancelado', 'cancelada'].includes(s)) return 'cancelado';
  if (['estornado', 'estornada'].includes(s)) return 'estornado';
  return 'aberto';
}

function recebimentoDeFinanceiro(lancamento = {}) {
  const valorBruto = numero(lancamento.valor ?? lancamento.valorBruto ?? lancamento.total ?? 0, 0);
  const valorRecebido = numero(lancamento.valorRecebido ?? lancamento.valorPago ?? lancamento.valorLiquido ?? 0, 0);
  const status = statusFinanceiroParaRecebimento(lancamento.status);
  const valorRestante = status === 'recebido'
    ? 0
    : Math.max(0, numero(lancamento.valorRestante ?? lancamento.saldo ?? (valorBruto - valorRecebido), 0));

  return {
    id: lancamento.recebimentoId || `rec_${lancamento.id}`,
    descricao: lancamento.descricao || 'Recebimento',
    referencia: lancamento.referencia || lancamento.documento || lancamento.numeroDocumento || '',
    categoria: lancamento.categoria || 'Recebimentos',
    centroCusto: lancamento.centroCusto || 'Caixa',
    pessoa: lancamento.pessoa || lancamento.aluno || lancamento.alunoFornecedor || lancamento.pessoaFornecedor || '',
    cliente: lancamento.pessoa || lancamento.aluno || lancamento.alunoFornecedor || lancamento.pessoaFornecedor || '',
    aluno: lancamento.aluno || lancamento.pessoa || lancamento.alunoFornecedor || '',
    alunoId: lancamento.alunoId || '',
    mensalidadeId: lancamento.mensalidadeId || '',
    matriculaId: lancamento.matriculaId || '',
    ativarMatriculaAoReceber: Boolean(lancamento.ativarMatriculaAoReceber),
    formaPagamento: lancamento.formaPagamento || lancamento.forma || '',
    valorBruto,
    taxaValor: numero(lancamento.taxaValor ?? lancamento.taxaOperadoraValor, 0),
    taxaPercentual: numero(lancamento.taxaPercentual ?? lancamento.taxaOperadoraPercentual, 0),
    valorLiquido: numero(lancamento.valorLiquido ?? valorRecebido, 0),
    valorRecebido,
    vencimento: lancamento.vencimento || lancamento.dataVencimento || hojeISO(),
    dataRecebimento: lancamento.dataPagamento || lancamento.pagamento || '',
    valorRestante,
    status,
    observacao: lancamento.observacao || lancamento.observacoes || '',
    caixaId: lancamento.caixaId || '',
    movimentoCaixaId: lancamento.movimentoCaixaId || '',
    lancamentoFinanceiroId: lancamento.id || '',
    origem: lancamento.origem || 'financeiro',
    criadoPor: lancamento.criadoPor || 'sistema',
    criadoEm: lancamento.criadoEm || agoraISO(),
    atualizadoEm: lancamento.atualizadoEm || agoraISO(),
    sincronizadoDoFinanceiro: true
  };
}

async function montarBaseRecebimentos() {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const financeiro = await lerJson(FINANCEIRO_FILE, []);

  const lista = Array.isArray(recebimentos) ? [...recebimentos] : [];
  const chaves = new Set();

  for (const r of lista) {
    if (r?.id) chaves.add(String(r.id));
    if (r?.lancamentoFinanceiroId) chaves.add(String(r.lancamentoFinanceiroId));
  }

  for (const lancamento of Array.isArray(financeiro) ? financeiro : []) {
    if (normalizar(lancamento?.tipo) !== 'receber') continue;

    const idFinanceiro = String(lancamento.id || '');
    const idRecebimento = String(lancamento.recebimentoId || `rec_${idFinanceiro}`);

    if (chaves.has(idFinanceiro) || chaves.has(idRecebimento)) continue;

    lista.push(recebimentoDeFinanceiro(lancamento));
    if (idFinanceiro) chaves.add(idFinanceiro);
    if (idRecebimento) chaves.add(idRecebimento);
  }

  return lista;
}

function filtrosNormalizados(filtros = {}) {
  return {
    q: normalizar(filtros.q || filtros.busca || filtros.pesquisa || ''),
    status: normalizar(filtros.status || ''),
    formaPagamento: normalizar(filtros.formaPagamento || filtros.forma || ''),
    dataInicio: String(filtros.dataInicio || filtros.inicio || filtros.de || '').trim(),
    dataFim: String(filtros.dataFim || filtros.fim || filtros.ate || filtros.até || '').trim()
  };
}

function aplicarFiltrosRecebimentos(lista = [], filtros = {}) {
  const f = filtrosNormalizados(filtros);

  return lista
    .filter(r => {
      if (f.q) {
        const alvo = normalizar(`${r.descricao} ${r.pessoa} ${r.cliente} ${r.aluno} ${r.categoria} ${r.formaPagamento} ${r.referencia}`);
        if (!alvo.includes(f.q)) return false;
      }
      if (f.status && f.status !== 'todos' && statusRecebimento(r.status) !== f.status) return false;
      if (f.formaPagamento && f.formaPagamento !== 'todos' && normalizar(r.formaPagamento) !== f.formaPagamento) return false;

      const dataBase = String(r.dataRecebimento || r.vencimento || '').slice(0, 10);
      if (f.dataInicio && dataBase && dataBase < f.dataInicio) return false;
      if (f.dataFim && dataBase && dataBase > f.dataFim) return false;

      return true;
    })
    .sort((a, b) => String(b.criadoEm || b.vencimento || '').localeCompare(String(a.criadoEm || a.vencimento || '')));
}

async function persistirRecebimentoFinanceiro(id) {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const idxExistente = recebimentos.findIndex(r =>
    String(r.id) === String(id) ||
    String(r.lancamentoFinanceiroId || '') === String(id)
  );

  if (idxExistente >= 0) return { recebimentos, idx: idxExistente };

  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  const lancamento = financeiro.find(l =>
    String(l.id) === String(id) ||
    String(l.recebimentoId || '') === String(id)
  );

  if (!lancamento || normalizar(lancamento.tipo) !== 'receber') {
    return { recebimentos, idx: -1 };
  }

  const novo = recebimentoDeFinanceiro(lancamento);
  recebimentos.push(novo);
  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  return { recebimentos, idx: recebimentos.length - 1 };
}



async function ativarMatriculaAposRecebimento(recebimento) {
  if (!recebimento.ativarMatriculaAoReceber && recebimento.origem !== 'matricula_inicial_unificada') return null;
  if (recebimento.status !== 'recebido') return null;

  const matriculas = await lerJson(MATRICULAS_FILE, []);
  const alunos = await lerJson(ALUNOS_FILE, []);
  const checkins = await lerJson(CHECKINS_FILE, []);

  const idx = matriculas.findIndex(m =>
    String(m.id) === String(recebimento.matriculaId || '') ||
    String(m.financeiroInicialId || '') === String(recebimento.lancamentoFinanceiroId || '') ||
    String(m.mensalidadeInicialId || '') === String(recebimento.mensalidadeId || '')
  );

  if (idx < 0) return null;

  const matricula = matriculas[idx];
  matriculas[idx] = {
    ...matricula,
    status: 'Ativa',
    statusPagamento: 'Pago',
    statusFinanceiroInicial: 'Pago',
    bloqueada: false,
    bloqueioCheckin: false,
    motivoBloqueio: '',
    motivoBloqueioCheckin: '',
    formaPagamento: recebimento.formaPagamento || matricula.formaPagamento || '',
    dataAtivacao: recebimento.dataRecebimento || hojeISO(),
    pagamentoInicialId: recebimento.id,
    liberadaAcessoEm: agoraISO(),
    liberadaPorPagamentoEm: agoraISO(),
    cacheAcessoLimpoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    historico: [
      ...(Array.isArray(matricula.historico) ? matricula.historico : []),
      {
        id: `hist_mat_${Date.now()}_${Math.floor(Math.random()*999999)}`,
        acao: 'ativacao_por_pagamento',
        descricao: 'Matrícula ativada após pagamento da entrada única.',
        usuario: recebimento.confirmadoPor || 'Administrador',
        dados: {
          recebimentoId: recebimento.id,
          lancamentoFinanceiroId: recebimento.lancamentoFinanceiroId || '',
          valorRecebido: recebimento.valorRecebido,
          formaPagamento: recebimento.formaPagamento || ''
        },
        criadoEm: agoraISO()
      }
    ]
  };

  const alunoIdx = alunos.findIndex(a => String(a.id) === String(matricula.alunoId));
  if (alunoIdx >= 0) {
    alunos[alunoIdx] = {
      ...alunos[alunoIdx],
      status: 'ativo',
      ativo: true,
      situacao: 'ativo',
      status_legado_access: 'ativo',
      statusMatricula: 'Ativa',
      matriculaStatus: 'Ativa',
      bloqueado: false,
      bloqueioCheckin: false,
      inadimplente: false,
      emAtraso: false,
      motivoBloqueio: '',
      motivoBloqueioCheckin: '',
      reativacaoPendenteEm: '',
      recebimentoReativacaoId: '',
      matriculaId: matricula.id,
      numeroMatricula: matricula.numero,
      liberadoAcessoEm: agoraISO(),
      liberadoPorPagamentoEm: agoraISO(),
      cacheAcessoLimpoEm: agoraISO(),
      atualizadoEm: agoraISO()
    };
  }

  const chkIdx = checkins.findIndex(c => String(c.matriculaId || '') === String(matricula.id) || (String(c.alunoId || '') === String(matricula.alunoId) && c.tipo === 'vinculo_matricula'));
  if (chkIdx >= 0) {
    checkins[chkIdx] = {
      ...checkins[chkIdx],
      status: 'Ativo',
      bloqueado: false,
      bloqueioCheckin: false,
      motivoBloqueio: '',
      motivoBloqueioCheckin: '',
      cacheAcessoLimpoEm: agoraISO(),
      atualizadoEm: agoraISO()
    };
  }

  await salvarJson(MATRICULAS_FILE, matriculas);
  await salvarJson(ALUNOS_FILE, alunos);
  await salvarJson(CHECKINS_FILE, checkins);

  return matriculas[idx];
}


export async function obterRecebimento(id) {
  const lista = await montarBaseRecebimentos();
  const item = lista.find(r =>
    String(r.id) === String(id) ||
    String(r.lancamentoFinanceiroId || '') === String(id) ||
    String(r.mensalidadeId || '') === String(id)
  );
  if (!item) {
    const erro = new Error('Recebimento não encontrado.');
    erro.status = 404;
    throw erro;
  }
  return item;
}

export async function listarRecebimentos(filtros = {}) {
  const lista = await montarBaseRecebimentos();
  return aplicarFiltrosRecebimentos(lista, filtros);
}

export async function resumoRecebimentos(filtros = {}) {
  const lista = await listarRecebimentos(filtros);

  const resumo = {
    total: lista.length,
    abertos: 0,
    recebidos: 0,
    parciais: 0,
    cancelados: 0,
    estornados: 0,
    vencidos: 0,
    valorBruto: 0,
    valorLiquido: 0,
    valorAberto: 0,
    taxas: 0
  };

  const hoje = hojeISO();

  for (const r of lista) {
    const status = statusRecebimento(r.status);
    const bruto = numero(r.valorBruto ?? r.valor, 0);
    const liquido = numero(r.valorLiquido ?? r.valorRecebido, 0);
    const aberto = numero(r.valorRestante ?? Math.max(0, bruto - numero(r.valorRecebido, 0)), 0);

    if (status === 'aberto') resumo.abertos++;
    if (status === 'recebido') resumo.recebidos++;
    if (status === 'parcial') resumo.parciais++;
    if (status === 'cancelado') resumo.cancelados++;
    if (status === 'estornado') resumo.estornados++;
    if (['aberto', 'parcial'].includes(status) && String(r.vencimento || '').slice(0, 10) < hoje) resumo.vencidos++;

    if (!['cancelado', 'estornado'].includes(status)) {
      resumo.valorBruto += bruto;
      resumo.valorLiquido += liquido;
      resumo.valorAberto += aberto;
      resumo.taxas += Math.max(0, bruto - liquido - aberto);
    }
  }

  for (const k of Object.keys(resumo)) {
    if (k.startsWith('valor') || k === 'taxas') resumo[k] = Number(resumo[k].toFixed(2));
  }

  return resumo;
}

export async function criarRecebimento(dados = {}) {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const valorBruto = numero(dados.valorBruto ?? dados.valor, 0);

  if (valorBruto <= 0) {
    const erro = new Error('Valor do recebimento deve ser maior que zero.');
    erro.status = 400;
    throw erro;
  }

  const taxaValor = numero(dados.taxaValor, 0);
  const taxaPercentual = numero(dados.taxaPercentual, 0);
  const valorLiquido = calcularLiquido(valorBruto, taxaValor, taxaPercentual);

  const statusInicial = statusRecebimento(dados.status || 'aberto');
  const valorRecebidoInicial = statusInicial === 'recebido' ? valorLiquido : numero(dados.valorRecebido, 0);

  const recebimento = {
    id: gerarId('rec'),
    descricao: dados.descricao || 'Recebimento',
    referencia: dados.referencia || '',
    categoria: dados.categoria || 'Recebimentos',
    centroCusto: dados.centroCusto || 'Caixa',
    pessoa: dados.pessoa || '',
    alunoId: dados.alunoId || '',
    mensalidadeId: dados.mensalidadeId || '',
    formaPagamento: dados.formaPagamento || 'Dinheiro',
    valorBruto,
    taxaValor,
    taxaPercentual,
    valorLiquido,
    valorRecebido: valorRecebidoInicial,
    vencimento: dados.vencimento || hojeISO(),
    dataRecebimento: dados.dataRecebimento || '',
    valorRestante: Math.max(0, Number((valorBruto - valorRecebidoInicial).toFixed(2))),
    status: statusInicial,
    observacao: dados.observacao || '',
    caixaId: '',
    movimentoCaixaId: '',
    lancamentoFinanceiroId: '',
    criadoPor: dados.usuario || 'Administrador',
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  recebimento.lancamentoFinanceiroId = await upsertFinanceiro(recebimento);
  recebimentos.push(recebimento);
  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  return recebimento;
}

export async function confirmarRecebimento(id, dados = {}) {
  const persistido = await persistirRecebimentoFinanceiro(id);
  const recebimentos = persistido.recebimentos;
  const idx = persistido.idx;

  if (idx < 0) {
    const erro = new Error('Recebimento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  const atual = recebimentos[idx];

  if (atual.status === 'recebido') {
    const erro = new Error('Este recebimento já foi confirmado.');
    erro.status = 409;
    throw erro;
  }

  if (['cancelado', 'estornado'].includes(atual.status)) {
    const erro = new Error('Recebimento cancelado ou estornado não pode receber baixa.');
    erro.status = 400;
    throw erro;
  }

  const valorOriginal = numero(atual.valorBruto ?? atual.valor ?? atual.total, 0);
  const desconto = numero(dados.desconto ?? atual.desconto, 0);
  const acrescimo = numero(dados.acrescimo ?? dados.acrescimoJuros ?? atual.acrescimo, 0);
  const juros = numero(dados.juros ?? atual.juros, 0);
  const multa = numero(dados.multa ?? atual.multa, 0);
  const taxaValor = numero(dados.taxaValor ?? dados.taxaOperadoraValor ?? atual.taxaValor, 0);
  const taxaPercentual = numero(dados.taxaPercentual ?? dados.taxaOperadoraPercentual ?? atual.taxaPercentual, 0);

  const valorDevido = Math.max(0, Number((valorOriginal + acrescimo + juros + multa - desconto).toFixed(2)));
  const valorJaRecebido = ['parcial', 'recebido'].includes(String(atual.status || '').toLowerCase())
    ? numero(atual.valorRecebido, 0)
    : 0;
  const saldoAtual = Math.max(0, Number((valorDevido - valorJaRecebido).toFixed(2)));
  const valorBaixa = numero(dados.valorBaixa ?? dados.valorRecebido ?? dados.valorPago ?? dados.valor ?? saldoAtual, saldoAtual);

  if (!(valorBaixa > 0)) {
    const erro = new Error('Informe um valor recebido maior que zero.');
    erro.status = 400;
    throw erro;
  }

  const diferencaRecebida = Math.max(0, Number((valorBaixa - saldoAtual).toFixed(2)));
  const destinoDiferencaBruto = normalizar(dados.destinoDiferenca || dados.tratamentoDiferenca || dados.destinoTrocoCredito || '');
  const pagamentoEmDinheiro = formaEhDinheiro(dados.formaPagamento || dados.forma || atual.formaPagamento || 'Dinheiro');
  let destinoDiferenca = diferencaRecebida > 0 ? destinoDiferencaBruto : '';

  if (diferencaRecebida > 0) {
    if (!pagamentoEmDinheiro) {
      destinoDiferenca = 'credito';
    } else if (!['troco', 'credito'].includes(destinoDiferenca)) {
      destinoDiferenca = 'troco';
    }
  }

  const valorAplicadoNaDivida = Math.min(valorBaixa, saldoAtual);
  const valorRecebidoTotal = Number((valorJaRecebido + valorAplicadoNaDivida).toFixed(2));
  const valorRestante = Math.max(0, Number((valorDevido - valorRecebidoTotal).toFixed(2)));
  const valorLiquido = calcularLiquido(valorAplicadoNaDivida, taxaValor, taxaPercentual);
  const statusFinal = valorRestante <= 0 ? 'recebido' : 'parcial';

  const confirmado = {
    ...atual,
    formaPagamento: dados.formaPagamento || dados.forma || atual.formaPagamento || 'Dinheiro',
    valorBruto: valorOriginal,
    valorDevido,
    desconto,
    acrescimo,
    juros,
    multa,
    taxaValor,
    taxaPercentual,
    taxaOperadoraValor: taxaValor,
    taxaOperadoraPercentual: taxaPercentual,
    valorBaixa,
    valorAplicadoNaDivida,
    diferencaRecebida,
    destinoDiferenca,
    valorTroco: destinoDiferenca === 'troco' ? diferencaRecebida : 0,
    valorCreditoGerado: destinoDiferenca === 'credito' ? diferencaRecebida : 0,
    valorLiquido,
    valorRecebido: valorRecebidoTotal,
    valorRestante,
    dataRecebimento: dados.dataRecebimento || dados.dataPagamento || hojeISO(),
    status: statusFinal,
    observacao: dados.observacao ?? atual.observacao ?? '',
    confirmadoPor: dados.usuario || 'Administrador',
    confirmadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  const vinculosCaixa = await criarMovimentoCaixa(confirmado);

  confirmado.caixaId = vinculosCaixa.caixaId;
  confirmado.movimentoCaixaId = vinculosCaixa.movimentoCaixaId;

  let movimentoTroco = null;
  let creditoGerado = null;
  if (diferencaRecebida > 0 && destinoDiferenca === 'troco') {
    movimentoTroco = await criarSaidaTrocoCaixa({ caixaId: vinculosCaixa.caixaId, recebimento: confirmado, valorTroco: diferencaRecebida });
    confirmado.movimentoTrocoId = movimentoTroco?.id || '';
  }
  if (diferencaRecebida > 0 && destinoDiferenca === 'credito') {
    creditoGerado = await criarCreditoAluno({ recebimento: confirmado, valorCredito: diferencaRecebida });
    confirmado.creditoId = creditoGerado?.id || '';
  }

  confirmado.lancamentoFinanceiroId = await upsertFinanceiro(confirmado);
  const mensalidadeAtualizada = await atualizarMensalidadeAposRecebimento(confirmado);
  const matriculaAtivada = await ativarMatriculaAposRecebimento(confirmado);
  const desbloqueioAcesso = await desbloquearAlunoAposPagamento(confirmado, {
    origem: "recebimento_confirmado"
  });

  recebimentos[idx] = confirmado;
  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  return {
    ok: true,
    success: true,
    recebimento: confirmado,
    mensalidade: mensalidadeAtualizada,
    matricula: matriculaAtivada,
    desbloqueioAcesso,
    caixa: vinculosCaixa,
    troco: movimentoTroco,
    credito: creditoGerado,
    mensagem: statusFinal === 'recebido'
      ? 'Recebimento confirmado, caixa movimentado e financeiro atualizado.'
      : 'Recebimento parcial confirmado, caixa movimentado e financeiro atualizado.'
  };
}

export async function atualizarRecebimento(id, dados = {}) {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const idx = recebimentos.findIndex(r => String(r.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Recebimento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  if (recebimentos[idx].status === 'recebido') {
    const erro = new Error('Recebimento confirmado não pode ser editado. Estorne antes.');
    erro.status = 400;
    throw erro;
  }

  const valorBruto = dados.valorBruto !== undefined ? numero(dados.valorBruto, 0) : numero(recebimentos[idx].valorBruto, 0);
  const taxaValor = dados.taxaValor !== undefined ? numero(dados.taxaValor, 0) : numero(recebimentos[idx].taxaValor, 0);
  const taxaPercentual = dados.taxaPercentual !== undefined ? numero(dados.taxaPercentual, 0) : numero(recebimentos[idx].taxaPercentual, 0);
  const valorLiquido = calcularLiquido(valorBruto, taxaValor, taxaPercentual);

  const atualizado = {
    ...recebimentos[idx],
    ...dados,
    valorBruto,
    taxaValor,
    taxaPercentual,
    valorLiquido,
    valorRecebido: numero(dados.valorRecebido ?? recebimentos[idx].valorRecebido, 0),
    status: statusRecebimento(dados.status || recebimentos[idx].status),
    atualizadoEm: agoraISO()
  };

  atualizado.lancamentoFinanceiroId = await upsertFinanceiro(atualizado);
  recebimentos[idx] = atualizado;
  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  return atualizado;
}

export async function estornarRecebimento(id, dados = {}) {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const idx = recebimentos.findIndex(r => String(r.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Recebimento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  const atual = recebimentos[idx];

  if (atual.status !== 'recebido') {
    const erro = new Error('Apenas recebimentos confirmados podem ser estornados.');
    erro.status = 400;
    throw erro;
  }

  await marcarMovimentoCaixaEstornado(atual.movimentoCaixaId);

  const estornado = {
    ...atual,
    status: 'estornado',
    motivoEstorno: dados.motivo || 'Estorno de recebimento.',
    estornadoPor: dados.usuario || 'Administrador',
    estornadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  estornado.lancamentoFinanceiroId = await upsertFinanceiro(estornado);
  recebimentos[idx] = estornado;
  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  return estornado;
}

export async function cancelarRecebimento(id, dados = {}) {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const idx = recebimentos.findIndex(r => String(r.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Recebimento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  if (recebimentos[idx].status === 'recebido') {
    const erro = new Error('Recebimento confirmado não pode ser cancelado. Estorne antes.');
    erro.status = 400;
    throw erro;
  }

  const cancelado = {
    ...recebimentos[idx],
    status: 'cancelado',
    motivoCancelamento: dados.motivo || 'Recebimento cancelado.',
    canceladoPor: dados.usuario || 'Administrador',
    canceladoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  cancelado.lancamentoFinanceiroId = await upsertFinanceiro(cancelado);
  recebimentos[idx] = cancelado;
  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  return cancelado;
}

export async function excluirRecebimento(id) {
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);
  const item = recebimentos.find(r => String(r.id) === String(id));

  if (!item) {
    const erro = new Error('Recebimento não encontrado.');
    erro.status = 404;
    throw erro;
  }

  if (item.status === 'recebido') {
    const erro = new Error('Recebimento confirmado não pode ser excluído. Estorne antes.');
    erro.status = 400;
    throw erro;
  }

  await salvarJson(RECEBIMENTOS_FILE, recebimentos.filter(r => String(r.id) !== String(id)));

  return { ok: true };
}
