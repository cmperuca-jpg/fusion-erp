import { FUSION_TIMEZONE } from "../core/time/fusion-time.mjs";
import path from 'node:path';
import { lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CAIXA_FILE = path.join(DATA_DIR, 'caixa.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');
const RECIBOS_FILE = path.join(DATA_DIR, 'recibos.json');
const RECEBIMENTOS_FILE = path.join(DATA_DIR, 'recebimentos.json');

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

async function lerRecebimentos() {
  return lerJsonDuravel(RECEBIMENTOS_FILE, []);
}

async function salvarFinanceiro(dados) {
  await salvarJsonDuravel(FINANCEIRO_FILE, dados);
}

function hojeISO() {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, parte) => {
    if (parte.type !== 'literal') acc[parte.type] = parte.value;
    return acc;
  }, {});
  return `${partes.year}-${partes.month}-${partes.day}`;
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

function taxaExplicita(registro = {}) {
  if (Number.isInteger(registro.taxaCentavos)) return numero(registro.taxaCentavos / 100, 0);
  if (Number.isInteger(registro.taxaOperadoraValorCentavos)) return numero(registro.taxaOperadoraValorCentavos / 100, 0);
  return numero(registro.taxaOperadoraValor ?? registro.taxaValor ?? registro.taxa, 0);
}

function valorNumericoInformado(registro = {}, campos = []) {
  for (const campo of campos) {
    if (!Object.prototype.hasOwnProperty.call(registro, campo)) continue;
    const bruto = registro[campo];
    if (bruto === null || bruto === undefined || String(bruto).trim() === '') continue;
    const n = Number(String(bruto).replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function construirContextoFinanceiro(financeiro = [], recibos = [], recebimentos = []) {
  const financeiroPorId = new Map();
  const financeiroPorMovimento = new Map();
  const recibosPorId = new Map();
  const recebimentoPorMovimento = new Map();
  const recebimentosPorRecibo = new Map();

  for (const item of Array.isArray(financeiro) ? financeiro : []) {
    const id = String(item.id || '').trim();
    const movimentoId = String(item.movimentoCaixaId || '').trim();
    if (id) financeiroPorId.set(id, item);
    if (movimentoId) financeiroPorMovimento.set(movimentoId, item);
  }
  for (const recibo of Array.isArray(recibos) ? recibos : []) {
    const id = String(recibo.id || recibo.numero || '').trim();
    if (id) recibosPorId.set(id, recibo);
  }
  for (const recebimento of Array.isArray(recebimentos) ? recebimentos : []) {
    const movimentoId = String(recebimento.movimentoCaixaId || '').trim();
    const reciboId = String(recebimento.reciboId || recebimento.ultimoReciboId || '').trim();
    if (movimentoId) recebimentoPorMovimento.set(movimentoId, recebimento);
    if (reciboId) recebimentosPorRecibo.set(reciboId, [...(recebimentosPorRecibo.get(reciboId) || []), recebimento]);
  }

  return { financeiroPorId, financeiroPorMovimento, recibosPorId, recebimentoPorMovimento, recebimentosPorRecibo };
}

function financeiroRelacionado(movimento = {}, contexto = {}) {
  const porMovimento = contexto.financeiroPorMovimento?.get(String(movimento.id || ''));
  if (porMovimento) return porMovimento;

  const idDireto = String(movimento.lancamentoFinanceiroId || movimento.financeiroId || '').trim();
  if (idDireto && contexto.financeiroPorId?.has(idDireto)) return contexto.financeiroPorId.get(idDireto);

  // Saídas antigas de contas a pagar podem trazer o ID financeiro embutido.
  const idMovimento = String(movimento.id || '');
  const embutido = idMovimento.match(/(fin_[A-Za-z0-9_]+)(?=-|$)/)?.[1] || '';
  return embutido ? contexto.financeiroPorId?.get(embutido) || null : null;
}

function reciboRelacionado(movimento = {}, contexto = {}) {
  const reciboId = String(movimento.reciboId || movimento.ultimoReciboId || '').trim();
  return reciboId ? contexto.recibosPorId?.get(reciboId) || null : null;
}

function recebimentoRelacionado(movimento = {}, contexto = {}) {
  const porMovimento = contexto.recebimentoPorMovimento?.get(String(movimento.id || ''));
  if (porMovimento) return porMovimento;
  const reciboId = String(movimento.reciboId || movimento.ultimoReciboId || '').trim();
  const lista = reciboId ? contexto.recebimentosPorRecibo?.get(reciboId) || [] : [];
  return lista.length === 1 ? lista[0] : null;
}

function taxaMovimento(movimento = {}, contexto = {}) {
  const propria = taxaExplicita(movimento);
  if (propria > 0) return propria;

  const financeiro = financeiroRelacionado(movimento, contexto);
  const taxaFinanceiro = taxaExplicita(financeiro || {});
  if (taxaFinanceiro > 0) return taxaFinanceiro;

  const recebimento = recebimentoRelacionado(movimento, contexto);
  const taxaRecebimento = taxaExplicita(recebimento || {});
  if (taxaRecebimento > 0) return taxaRecebimento;

  const recibo = reciboRelacionado(movimento, contexto);
  const taxaRecibo = taxaExplicita(recibo || {});
  if (taxaRecibo > 0) return taxaRecibo;

  // Só infere taxa pela diferença bruto-líquido quando o líquido realmente
  // existe no registro. Campo ausente não pode ser convertido em zero.
  const liquidoInformado = valorNumericoInformado(
    movimento,
    ['valorLiquido', 'valorRecebidoLiquido']
  );
  if (liquidoInformado === null) return 0;

  const bruto = valorBrutoMovimento(movimento);
  return Math.max(0, Number((bruto - liquidoInformado).toFixed(2)));
}

function valorLiquidoMovimento(movimento = {}, contexto = {}) {
  const bruto = valorBrutoMovimento(movimento);
  const taxa = taxaMovimento(movimento, contexto);
  const liquidoCalculado = Math.max(0, Number((bruto - taxa).toFixed(2)));
  const liquidoInformado = valorNumericoInformado(
    movimento,
    ['valorLiquido', 'valorRecebidoLiquido']
  );

  // Havendo taxa explícita no movimento, no financeiro, no recebimento ou
  // no recibo, bruto - taxa = líquido é a identidade contábil canônica.
  if (taxa > 0) return liquidoCalculado;

  // Sem taxa e com líquido informado, preserva o valor explícito.
  if (liquidoInformado !== null) return Math.max(0, Number(liquidoInformado.toFixed(2)));

  // Movimento sem campo líquido e sem taxa (caso típico de saída histórica):
  // líquido = bruto. Isso impede uma saída de R$ 4.500 de virar líquido zero.
  return bruto;
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
    const liquido = valorLiquidoMovimento(m, contexto);
    const taxa = taxaMovimento(m, contexto);

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
  const [dados, recibos, financeiro, recebimentos] = await Promise.all([lerCaixa(), lerRecibos(), lerFinanceiro(), lerRecebimentos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const contextoFinanceiro = construirContextoFinanceiro(financeiro, recibos, recebimentos);
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
    totais: calcularTotais(dados.movimentos, atual, { recibosEstornados, ...contextoFinanceiro })
  };
}

export async function listarCaixas(filtros = {}) {
  const [dados, recibos, financeiro, recebimentos] = await Promise.all([lerCaixa(), lerRecibos(), lerFinanceiro(), lerRecebimentos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const contextoFinanceiro = construirContextoFinanceiro(financeiro, recibos, recebimentos);
  const status = normalizar(filtros.status);
  const data = String(filtros.data || '').trim();

  return dados.caixas
    .map(c => ({
      ...c,
      totais: calcularTotais(dados.movimentos, c, { recibosEstornados, ...contextoFinanceiro })
    }))
    .filter(c => {
      if (status && status !== 'todos' && normalizar(c.status) !== status) return false;
      if (data && c.dataAbertura !== data) return false;
      return true;
    })
    .sort((a, b) => String(b.abertoEm).localeCompare(String(a.abertoEm)));
}

export async function listarMovimentos(filtros = {}) {
  const [dados, recibos, financeiro, recebimentos] = await Promise.all([lerCaixa(), lerRecibos(), lerFinanceiro(), lerRecebimentos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const contextoFinanceiro = construirContextoFinanceiro(financeiro, recibos, recebimentos);
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
    .map(m => ({
      ...m,
      valorBruto: valorBrutoMovimento(m),
      taxaOperadoraValor: taxaMovimento(m, { recibosEstornados, ...contextoFinanceiro }),
      valorLiquido: valorLiquidoMovimento(m, { recibosEstornados, ...contextoFinanceiro })
    }))
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
  const [dados, recibos, financeiro, recebimentos] = await Promise.all([lerCaixa(), lerRecibos(), lerFinanceiro(), lerRecebimentos()]);
  const recibosEstornados = idsRecibosEstornados(recibos, dados.movimentos);
  const contextoFinanceiro = construirContextoFinanceiro(financeiro, recibos, recebimentos);
  const atual = caixaAberto(dados);

  if (!atual) {
    const erro = new Error('Não existe caixa aberto.');
    erro.status = 404;
    throw erro;
  }

  const totais = calcularTotais(dados.movimentos, atual, { recibosEstornados, ...contextoFinanceiro });
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
