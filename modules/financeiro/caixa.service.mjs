import path from 'node:path';
import { lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CAIXA_FILE = path.join(DATA_DIR, 'caixa.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');
const RECIBOS_FILE = path.join(DATA_DIR, 'recibos.json');

async function lerCaixa() {
  const dados = await lerJsonDuravel(CAIXA_FILE, { caixas: [], movimentos: [] });
  return {
    caixas: Array.isArray(dados.caixas) ? dados.caixas : [],
    movimentos: Array.isArray(dados.movimentos) ? dados.movimentos : []
  };
}

async function salvarCaixa(dados) {
  await salvarJsonDuravel(CAIXA_FILE, dados);
}

async function lerFinanceiro() {
  return lerJsonDuravel(FINANCEIRO_FILE, []);
}

async function lerRecibos() {
  return lerJsonDuravel(RECIBOS_FILE, []);
}

async function salvarFinanceiro(dados) {
  await salvarJsonDuravel(FINANCEIRO_FILE, dados);
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

function caixaAberto(dados) {
  return dados.caixas.find(c => c.status === 'aberto') || null;
}

function dataMovimento(movimento = {}) {
  return String(movimento.data || movimento.dataPagamento || movimento.criadoEm || '').slice(0, 10);
}

function statusAtivoMovimento(movimento = {}) {
  return !['cancelado', 'estornado'].includes(normalizar(movimento.status));
}

function reciboEstornado(recibo = {}) {
  return recibo.cancelado === true || ['cancelado', 'cancelada', 'estornado', 'estornada'].includes(normalizar(recibo.status));
}

function idsRecibosEstornados(recibos = [], movimentos = []) {
  const ids = new Set();
  for (const recibo of Array.isArray(recibos) ? recibos : []) {
    if (!reciboEstornado(recibo)) continue;
    const id = String(recibo.id || recibo.numero || '').trim();
    if (id) ids.add(id);
  }
  for (const movimento of Array.isArray(movimentos) ? movimentos : []) {
    if (normalizar(movimento.origem) !== 'estorno_recibo') continue;
    const id = String(movimento.reciboEstornadoId || movimento.reciboId || '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

function movimentoNeutroPorEstorno(movimento = {}, recibosEstornados = new Set()) {
  const origem = normalizar(movimento.origem);
  if (['estorno_recibo', 'estorno_troco'].includes(origem)) return true;

  const reciboId = String(movimento.reciboId || movimento.reciboEstornadoId || '').trim();
  if (!reciboId || !recibosEstornados.has(reciboId)) return false;
  return ['recibo', 'troco_recibo'].includes(origem);
}

function pertenceAoCaixa(movimento = {}, caixa = {}) {
  const caixaId = String(caixa.id || caixa).trim();
  const movimentoCaixaId = String(movimento.caixaId || '').trim();
  if (movimentoCaixaId) return movimentoCaixaId === caixaId;

  // Compatibilidade com saídas antigas de contas a pagar que foram gravadas sem caixaId.
  if (normalizar(caixa.status) !== 'aberto') return false;
  const data = dataMovimento(movimento);
  const abertura = String(caixa.dataAbertura || caixa.abertoEm || '').slice(0, 10);
  return !abertura || !data || data >= abertura;
}

function valorBrutoMovimento(movimento = {}) {
  return numero(movimento.valorBruto ?? movimento.valor, 0);
}

function taxaMovimento(movimento = {}) {
  const taxaInformada = numero(movimento.taxaOperadoraValor ?? movimento.taxaValor, 0);
  if (taxaInformada > 0) return taxaInformada;

  const bruto = valorBrutoMovimento(movimento);
  const liquido = numero(movimento.valorLiquido ?? movimento.valorRecebidoLiquido, bruto);
  return Math.max(0, Number((bruto - liquido).toFixed(2)));
}

function valorLiquidoMovimento(movimento = {}) {
  const bruto = valorBrutoMovimento(movimento);
  const liquidoInformado = numero(movimento.valorLiquido ?? movimento.valorRecebidoLiquido, NaN);
  if (Number.isFinite(liquidoInformado) && liquidoInformado > 0) return liquidoInformado;
  return Math.max(0, Number((bruto - taxaMovimento(movimento)).toFixed(2)));
}

function criarTotaisZerados() {
  return {
    entradas: 0,
    entradasBrutas: 0,
    entradasLiquidas: 0,
    saidas: 0,
    saidasBrutas: 0,
    saidasLiquidas: 0,
    taxas: 0,
    dinheiro: 0,
    dinheiroBruto: 0,
    dinheiroLiquido: 0,
    pix: 0,
    pixBruto: 0,
    pixLiquido: 0,
    cartao: 0,
    cartaoBruto: 0,
    cartaoLiquido: 0,
    outros: 0,
    outrosBruto: 0,
    outrosLiquido: 0,
    saldoAtual: 0,
    saldoAtualBruto: 0,
    saldoAtualLiquido: 0,
    saldoBruto: 0,
    saldoLiquido: 0,
    quantidadeMovimentos: 0,
    quantidadeMovimentosHistorico: 0,
    movimentosNeutralizadosPorEstorno: 0
  };
}

function calcularTotais(movimentos, caixa, contexto = {}) {
  const recibosEstornados = contexto.recibosEstornados || new Set();
  const listaHistorica = movimentos.filter(m => pertenceAoCaixa(m, caixa) && statusAtivoMovimento(m));
  const lista = listaHistorica.filter(m => !movimentoNeutroPorEstorno(m, recibosEstornados));

  const totais = criarTotaisZerados();
  totais.quantidadeMovimentos = lista.length;
  totais.quantidadeMovimentosHistorico = listaHistorica.length;
  totais.movimentosNeutralizadosPorEstorno = listaHistorica.length - lista.length;

  for (const m of lista) {
    const bruto = valorBrutoMovimento(m);
    const liquido = valorLiquidoMovimento(m);
    const taxa = taxaMovimento(m);

    const tipoMovimento = normalizar(m.tipo).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const saida = tipoMovimento.includes('saida');
    const entrada = !saida;

    if (entrada) {
      totais.entradasBrutas += bruto;
      totais.entradasLiquidas += liquido;
      totais.taxas += taxa;
    }
    if (saida) {
      totais.saidasBrutas += bruto;
      totais.saidasLiquidas += liquido;
    }

    const forma = normalizar(m.formaPagamento);
    const valorBrutoForma = saida ? -bruto : bruto;
    const valorLiquidoForma = saida ? -liquido : liquido;
    if (forma.includes('dinheiro')) {
      totais.dinheiroBruto += valorBrutoForma;
      totais.dinheiroLiquido += valorLiquidoForma;
    } else if (forma.includes('pix')) {
      totais.pixBruto += valorBrutoForma;
      totais.pixLiquido += valorLiquidoForma;
    } else if (forma.includes('cart')) {
      totais.cartaoBruto += valorBrutoForma;
      totais.cartaoLiquido += valorLiquidoForma;
    } else {
      totais.outrosBruto += valorBrutoForma;
      totais.outrosLiquido += valorLiquidoForma;
    }
  }

  totais.entradas = totais.entradasBrutas;
  totais.saidas = totais.saidasBrutas;
  totais.dinheiro = totais.dinheiroLiquido;
  totais.pix = totais.pixLiquido;
  totais.cartao = totais.cartaoLiquido;
  totais.outros = totais.outrosLiquido;
  totais.saldoAtualBruto = Number((totais.entradasBrutas - totais.saidasBrutas).toFixed(2));
  totais.saldoAtualLiquido = Number((totais.entradasLiquidas - totais.saidasLiquidas).toFixed(2));
  totais.saldoBruto = totais.saldoAtualBruto;
  totais.saldoLiquido = totais.saldoAtualLiquido;
  totais.saldoAtual = totais.saldoAtualLiquido;

  for (const k of Object.keys(totais)) {
    if (typeof totais[k] === 'number') totais[k] = Number(totais[k].toFixed(2));
  }

  return totais;
}

async function criarLancamentoFinanceiro(movimento) {
  const financeiro = await lerFinanceiro();

  const lancamentoId = movimento.lancamentoFinanceiroId || `fin_${movimento.id}`;
  const existente = financeiro.findIndex(l => String(l.id) === String(lancamentoId));

  const lancamento = {
    id: lancamentoId,
    tipo: movimento.tipo === 'entrada' ? 'receber' : 'pagar',
    descricao: movimento.descricao,
    categoria: movimento.categoria || 'Caixa',
    centroCusto: 'Caixa',
    alunoFornecedor: movimento.pessoa || '',
    pessoa: movimento.pessoa || '',
    pessoaFornecedor: movimento.pessoa || '',
    valor: numero(movimento.valor, 0),
    valorBruto: numero(movimento.valorBruto ?? movimento.valor, 0),
    valorLiquido: numero(movimento.valorLiquido ?? movimento.valor, 0),
    desconto: numero(movimento.desconto, 0),
    acrescimo: numero(movimento.acrescimo, 0),
    juros: numero(movimento.juros, 0),
    multa: numero(movimento.multa, 0),
    taxaOperadoraValor: numero(movimento.taxaOperadoraValor, 0),
    taxaOperadoraPercentual: numero(movimento.taxaOperadoraPercentual, 0),
    taxaOperadoraFixa: numero(movimento.taxaOperadoraFixa, 0),
    bandeiraCartao: movimento.bandeiraCartao || '',
    modalidadeCartao: movimento.modalidadeCartao || '',
    parcelasCartao: movimento.parcelasCartao || '',
    mensalidadeId: movimento.mensalidadeId || '',
    matriculaId: movimento.matriculaId || '',
    recebimentoId: movimento.recebimentoId || '',
    vencimento: movimento.data,
    pagamento: movimento.data,
    dataPagamento: movimento.data,
    formaPagamento: movimento.formaPagamento || 'Dinheiro',
    status: 'Pago',
    origem: 'caixa',
    caixaId: movimento.caixaId,
    movimentoCaixaId: movimento.id,
    observacoes: movimento.observacao || '',
    observacao: movimento.observacao || '',
    atualizadoEm: agoraISO()
  };

  if (existente >= 0) financeiro[existente] = { ...financeiro[existente], ...lancamento };
  else financeiro.push({ ...lancamento, criadoEm: agoraISO() });

  await salvarFinanceiro(financeiro);
  return lancamentoId;
}

async function removerLancamentoFinanceiro(movimentoId) {
  const financeiro = await lerFinanceiro();
  await salvarFinanceiro(financeiro.filter(l => String(l.movimentoCaixaId) !== String(movimentoId)));
}

export async function obterCaixaAtual() {
  const [dados, recibos] = await Promise.all([lerCaixa(), lerRecibos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const atual = caixaAberto(dados);

  if (!atual) {
    return {
      aberto: false,
      caixa: null,
      totais: criarTotaisZerados()
    };
  }

  return {
    aberto: true,
    caixa: atual,
    totais: calcularTotais(dados.movimentos, atual, { recibosEstornados })
  };
}

export async function listarCaixas(filtros = {}) {
  const [dados, recibos] = await Promise.all([lerCaixa(), lerRecibos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const status = normalizar(filtros.status);
  const data = String(filtros.data || '').trim();

  return dados.caixas
    .map(c => ({
      ...c,
      totais: calcularTotais(dados.movimentos, c, { recibosEstornados })
    }))
    .filter(c => {
      if (status && status !== 'todos' && normalizar(c.status) !== status) return false;
      if (data && c.dataAbertura !== data) return false;
      return true;
    })
    .sort((a, b) => String(b.abertoEm).localeCompare(String(a.abertoEm)));
}

export async function listarMovimentos(filtros = {}) {
  const [dados, recibos] = await Promise.all([lerCaixa(), lerRecibos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const q = normalizar(filtros.q);
  const tipo = normalizar(filtros.tipo);
  const formaPagamento = normalizar(filtros.formaPagamento);
  const caixaId = String(filtros.caixaId || '').trim();
  const caixaFiltro = caixaId ? dados.caixas.find(c => String(c.id) === caixaId) : null;

  return dados.movimentos
    .filter(m => {
      if (!statusAtivoMovimento(m) || movimentoNeutroPorEstorno(m, recibosEstornados)) return false;
      if (caixaId && !pertenceAoCaixa(m, caixaFiltro || { id: caixaId, status: 'aberto' })) return false;
      if (tipo && tipo !== 'todos' && normalizar(m.tipo) !== tipo) return false;
      if (formaPagamento && formaPagamento !== 'todos' && normalizar(m.formaPagamento) !== formaPagamento) return false;
      if (q) {
        const alvo = normalizar(`${m.descricao} ${m.categoria} ${m.pessoa} ${m.formaPagamento}`);
        if (!alvo.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

export async function abrirCaixa(dadosEntrada = {}) {
  const dados = await lerCaixa();

  if (caixaAberto(dados)) {
    const erro = new Error('Já existe um caixa aberto.');
    erro.status = 409;
    throw erro;
  }

  const valorAbertura = numero(dadosEntrada.valorAbertura, 0);

  const caixa = {
    id: gerarId('cx'),
    dataAbertura: dadosEntrada.dataAbertura || hojeISO(),
    valorAbertura,
    valorAberturaCentavos: Math.round(valorAbertura * 100),
    responsavel: dadosEntrada.responsavel || 'Administrador',
    observacaoAbertura: dadosEntrada.observacao || '',
    status: 'aberto',
    abertoEm: agoraISO(),
    fechadoEm: '',
    valorFechamentoInformado: null,
    diferenca: null,
    observacaoFechamento: ''
  };

  dados.caixas.push(caixa);

  if (valorAbertura > 0) {
    dados.movimentos.push({
      id: gerarId('mov'),
      caixaId: caixa.id,
      tipo: 'entrada',
      descricao: 'Abertura de caixa',
      categoria: 'Abertura',
      pessoa: caixa.responsavel,
      formaPagamento: 'Dinheiro',
      valor: valorAbertura,
      valorCentavos: Math.round(valorAbertura * 100),
      data: caixa.dataAbertura,
      status: 'ativo',
      origem: 'abertura',
      observacao: dadosEntrada.observacao || '',
      lancamentoFinanceiroId: '',
      criadoEm: agoraISO(),
      atualizadoEm: agoraISO()
    });
  }

  await salvarCaixa(dados);
  return caixa;
}

export async function fecharCaixa(dadosEntrada = {}) {
  const [dados, recibos] = await Promise.all([lerCaixa(), lerRecibos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const atual = caixaAberto(dados);

  if (!atual) {
    const erro = new Error('Não existe caixa aberto.');
    erro.status = 404;
    throw erro;
  }

  const totais = calcularTotais(dados.movimentos, atual, { recibosEstornados });
  const valorFechamentoInformado = numero(dadosEntrada.valorFechamentoInformado, totais.saldoAtual);

  atual.status = 'fechado';
  atual.fechadoEm = agoraISO();
  atual.valorFechamentoInformado = valorFechamentoInformado;
  atual.valorFechamentoInformadoCentavos = Math.round(valorFechamentoInformado * 100);
  atual.diferenca = Number((valorFechamentoInformado - totais.saldoAtual).toFixed(2));
  atual.observacaoFechamento = dadosEntrada.observacao || '';

  await salvarCaixa(dados);

  return {
    caixa: atual,
    totais
  };
}

export async function criarMovimento(dadosEntrada = {}) {
  const dados = await lerCaixa();
  const atual = caixaAberto(dados);

  if (!atual) {
    const erro = new Error('Abra o caixa antes de lançar movimentos.');
    erro.status = 400;
    throw erro;
  }

  const tipo = normalizar(dadosEntrada.tipo) === 'saida' ? 'saida' : 'entrada';
  const valor = numero(dadosEntrada.valor, 0);

  if (valor <= 0) {
    const erro = new Error('Valor deve ser maior que zero.');
    erro.status = 400;
    throw erro;
  }

  const movimento = {
    id: gerarId('mov'),
    caixaId: atual.id,
    tipo,
    descricao: dadosEntrada.descricao || (tipo === 'entrada' ? 'Entrada de caixa' : 'Saída de caixa'),
    categoria: dadosEntrada.categoria || (tipo === 'entrada' ? 'Receita' : 'Despesa'),
    pessoa: dadosEntrada.pessoa || '',
    formaPagamento: dadosEntrada.formaPagamento || 'Dinheiro',
    valor,
    valorCentavos: Math.round(valor * 100),
    data: dadosEntrada.data || hojeISO(),
    status: 'ativo',
    origem: dadosEntrada.origem || 'manual',
    observacao: dadosEntrada.observacao || '',
    lancamentoFinanceiroId: dadosEntrada.lancamentoFinanceiroId || '',
    mensalidadeId: dadosEntrada.mensalidadeId || '',
    matriculaId: dadosEntrada.matriculaId || '',
    recebimentoId: dadosEntrada.recebimentoId || '',
    valorBruto: numero(dadosEntrada.valorBruto ?? valor, 0),
    valorLiquido: numero(dadosEntrada.valorLiquido ?? valor, 0),
    desconto: numero(dadosEntrada.desconto, 0),
    acrescimo: numero(dadosEntrada.acrescimo, 0),
    juros: numero(dadosEntrada.juros, 0),
    multa: numero(dadosEntrada.multa, 0),
    taxaOperadoraValor: numero(dadosEntrada.taxaOperadoraValor ?? dadosEntrada.taxaValor, 0),
    taxaOperadoraPercentual: numero(dadosEntrada.taxaOperadoraPercentual ?? dadosEntrada.taxaPercentual, 0),
    taxaOperadoraFixa: numero(dadosEntrada.taxaOperadoraFixa, 0),
    bandeiraCartao: dadosEntrada.bandeiraCartao || '',
    modalidadeCartao: dadosEntrada.modalidadeCartao || '',
    parcelasCartao: dadosEntrada.parcelasCartao || '',
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  // Suprimentos e retiradas pertencem ao caixa. Contas a pagar/receber são
  // criadas nos módulos financeiros e apenas vinculam seu movimento aqui.
  movimento.lancamentoFinanceiroId = dadosEntrada.lancamentoFinanceiroId || '';

  dados.movimentos.push(movimento);
  await salvarCaixa(dados);

  return movimento;
}

export async function cancelarMovimento(id) {
  const dados = await lerCaixa();
  const idx = dados.movimentos.findIndex(m => String(m.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Movimento de caixa não encontrado.');
    erro.status = 404;
    throw erro;
  }

  if (dados.movimentos[idx].reciboId || ['recibo', 'estorno_recibo', 'pagamentos'].includes(normalizar(dados.movimentos[idx].origem))) {
    const erro = new Error('Movimento financeiro vinculado não pode ser cancelado pelo caixa. Use o estorno no módulo de origem.');
    erro.status = 409;
    throw erro;
  }

  dados.movimentos[idx].status = 'cancelado';
  dados.movimentos[idx].atualizadoEm = agoraISO();

  await salvarCaixa(dados);

  return dados.movimentos[idx];
}

export async function excluirMovimento(id) {
  return cancelarMovimento(id);
}
