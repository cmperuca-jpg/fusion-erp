import path from 'node:path';
import { lerJsonDuravel } from '../core/persistence/durable-json.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CAIXA_FILE = path.join(DATA_DIR, 'caixa.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');
const RECEBIMENTOS_FILE = path.join(DATA_DIR, 'recebimentos.json');
const PAGAMENTOS_FILE = path.join(DATA_DIR, 'financeiro', 'pagamentos.json');
const PAGAMENTOS_FILE_LEGADO = path.join(DATA_DIR, 'pagamentos.json');

async function lerJson(arquivo, padrao) {
  try { return await lerJsonDuravel(arquivo, padrao); } catch { return padrao; }
}

async function lerJsonOpcional(arquivos, padrao) {
  for (const arquivo of arquivos) {
    try { return await lerJsonDuravel(arquivo, padrao); } catch {}
  }
  return padrao;
}

function arrayDe(raw, chave) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw[chave])) return raw[chave];
  if (raw && Array.isArray(raw.dados)) return raw.dados;
  if (raw && Array.isArray(raw.lancamentos)) return raw.lancamentos;
  return [];
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function dataISO(v) { return String(v || '').slice(0, 10); }
function mesISO(v) { const d = dataISO(v); return d ? d.slice(0, 7) : 'Sem data'; }
function normalizar(v) { return String(v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function numero(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}
function arred(v) { return Number(numero(v).toFixed(2)); }
function dentroPeriodo(data, inicio, fim) {
  const d = dataISO(data);
  if (!d) return false;
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

function statusAtivo(item = {}) {
  const st = normalizar(item.status);
  return !['cancelado', 'cancelada', 'estornado', 'estornada'].includes(st);
}
function statusPago(item = {}) {
  const st = normalizar(item.status);
  return ['pago', 'recebido', 'quitado', 'baixado'].includes(st);
}
function statusAberto(item = {}) {
  const st = normalizar(item.status || 'aberto');
  return !statusPago(item) && !['cancelado', 'cancelada', 'estornado', 'estornada'].includes(st);
}
function tipoReceita(item = {}) {
  const t = normalizar(item.tipo || item.natureza || item.categoriaTipo);
  if (t.includes('entrada') || t.includes('receber') || t.includes('receita')) return true;
  if (t.includes('saida') || t.includes('saída') || t.includes('pagar') || t.includes('despesa')) return false;
  return true;
}
function tipoDespesa(item = {}) { return !tipoReceita(item); }
function calcularTaxa(item = {}) {
  if (Number.isInteger(item.taxaCentavos)) return arred(item.taxaCentavos / 100);
  if (Number.isInteger(item.taxaOperadoraValorCentavos)) return arred(item.taxaOperadoraValorCentavos / 100);
  return arred(item.taxaOperadoraValor ?? item.taxaValor ?? item.taxa ?? 0);
}
function valorBruto(item = {}) { return arred(item.valorBrutoRecebido ?? item.valorRecebido ?? item.valorPago ?? item.totalPago ?? item.valor ?? item.valorBruto ?? item.valorTotal ?? 0); }
function valorLiquido(item = {}) {
  const liquido = numero(item.valorLiquido ?? item.valorRecebidoLiquido ?? 0);
  if (liquido > 0) return arred(liquido);
  return arred(valorBruto(item) - calcularTaxa(item));
}
function valorOriginal(item = {}) { return arred(item.valor ?? item.valorBruto ?? item.valorTotal ?? item.total ?? item.valorLiquido ?? 0); }
function valorPago(item = {}) { return arred(item.valorPago ?? item.valorPagoTotal ?? item.totalPago ?? item.valorRecebido ?? 0); }
function dataPagamento(item = {}) { return dataISO(item.dataPagamento || item.pagamento || item.dataBaixa || item.recebidoEm || item.pagoEm || item.atualizadoEm || item.updatedAt || item.criadoEm || item.createdAt); }
function dataVencimento(item = {}) { return dataISO(item.vencimento || item.dataVencimento || item.data || item.criadoEm); }
function categoria(item = {}, padrao = 'Sem categoria') { return item.categoria || item.centroCusto || item.origem || padrao; }
function descricao(item = {}, padrao = 'Lançamento') { return item.descricao || item.titulo || item.observacao || padrao; }
function pessoa(item = {}) { return item.alunoFornecedor || item.pessoa || item.pessoaFornecedor || item.cliente || item.fornecedor || item.alunoNome || ''; }
function horaItem(item = {}) {
  const fonte = item.criadoEm || item.atualizadoEm || item.dataPagamento || item.data || '';
  const txt = String(fonte || '');
  if (txt.includes('T')) return txt.slice(11, 16);
  return '';
}

function somaPorMapa(mapa, chave, campo, valor) {
  const atual = mapa.get(chave) || { chave, [campo]: 0 };
  atual[campo] = arred((atual[campo] || 0) + valor);
  mapa.set(chave, atual);
}
function mapCategoria(mapa, nome, valor) {
  const atual = mapa.get(nome) || { categoria: nome, valor: 0 };
  atual.valor = arred(atual.valor + valor);
  mapa.set(nome, atual);
}

function formaGrupo(forma = '') {
  const f = normalizar(forma);
  if (f.includes('dinheiro')) return 'Dinheiro';
  if (f.includes('pix')) return 'PIX';
  if (f.includes('débito') || f.includes('debito')) return 'Débito';
  if (f.includes('crédito') || f.includes('credito') || f.includes('cart')) return 'Crédito/Cartão';
  if (f.includes('boleto')) return 'Boleto';
  if (f.includes('transfer')) return 'Transferência';
  return forma || 'Outros';
}

function tokensFiltro(valor = '') {
  return normalizar(valor).split(/[;,|]/).map(t => t.trim()).filter(Boolean);
}

function passaCategoriaFiltro(item = {}, filtro = '') {
  const tokens = tokensFiltro(filtro);
  if (!tokens.length) return true;
  const alvo = normalizar(`${categoria(item)} ${descricao(item)} ${pessoa(item)}`);
  return tokens.some(token => alvo.includes(token));
}

function passaFormaFiltro(item = {}, filtro = '') {
  const f = normalizar(filtro);
  if (!f) return true;
  const alvo = normalizar(item.formaPagamento || item.forma || item.meioPagamento || '');
  if (f.includes('credito')) return alvo.includes('credito') || alvo.includes('cart');
  if (f.includes('debito')) return alvo.includes('debito') || alvo.includes('cart');
  return alvo.includes(f);
}

function referencias(item = {}) {
  return [...new Set([
    item.id,
    item.movimentoCaixaId,
    item.lancamentoFinanceiroId,
    item.financeiroId,
    item.recebimentoId,
    item.pagamentoId,
    item.referenciaId,
    item.mensalidadeId,
    item.reciboId,
    item.ultimoReciboId,
    item.reciboEstornadoId
  ].map(v => String(v || '').trim()).filter(Boolean))];
}

function jaVisto(vistos, item = {}) {
  return referencias(item).some(ref => vistos.has(ref));
}

function marcarVisto(vistos, item = {}) {
  referencias(item).forEach(ref => vistos.add(ref));
}

export async function movimentoDiarioCaixa(filtros = {}) {
  const dataInicio = dataISO(filtros.dataInicio || filtros.inicio || filtros.data || hojeISO());
  const dataFim = dataISO(filtros.dataFim || filtros.fim || filtros.data || dataInicio);
  const formaFiltro = normalizar(filtros.formaPagamento || filtros.forma || '');
  const categoriaFiltro = normalizar(filtros.categoria || '');

  const caixaRaw = await lerJson(CAIXA_FILE, { caixas: [], movimentos: [] });
  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  const recebimentosRaw = await lerJson(RECEBIMENTOS_FILE, []);
  const pagamentosRaw = await lerJsonOpcional([PAGAMENTOS_FILE, PAGAMENTOS_FILE_LEGADO], []);

  const caixas = Array.isArray(caixaRaw.caixas) ? caixaRaw.caixas : [];
  const movimentos = Array.isArray(caixaRaw.movimentos) ? caixaRaw.movimentos : [];
  const recebimentosBase = arrayDe(recebimentosRaw, 'recebimentos');
  const pagamentosBase = arrayDe(pagamentosRaw, 'pagamentos');

  const recebimentosPorRecibo = new Map();
  for (const recebimento of recebimentosBase) {
    const reciboId = String(recebimento.reciboId || recebimento.ultimoReciboId || '').trim();
    if (!reciboId) continue;
    recebimentosPorRecibo.set(reciboId, [...(recebimentosPorRecibo.get(reciboId) || []), recebimento]);
  }

  const movimentosPeriodo = movimentos.filter((m) => {
    const data = dataISO(m.data || m.dataPagamento || m.criadoEm);
    if (!data || data < dataInicio || data > dataFim) return false;
    if (!statusAtivo(m)) return false;
    if (!passaFormaFiltro(m, formaFiltro)) return false;
    if (!passaCategoriaFiltro(m, categoriaFiltro)) return false;
    return true;
  });

  const entradas = movimentosPeriodo.filter(m => normalizar(m.tipo).includes('entrada'));
  const saidas = movimentosPeriodo.filter(m => normalizar(m.tipo).includes('saida') || normalizar(m.tipo).includes('saída'));
  const quantidadeMovimentosPorRecibo = new Map();
  for (const entrada of entradas) {
    const reciboId = String(entrada.reciboId || '').trim();
    if (reciboId) quantidadeMovimentosPorRecibo.set(reciboId, (quantidadeMovimentosPorRecibo.get(reciboId) || 0) + 1);
  }

  const financeiroPorMovimento = new Map();
  const financeiroPorId = new Map();
  for (const f of Array.isArray(financeiro) ? financeiro : []) {
    if (f.movimentoCaixaId) financeiroPorMovimento.set(String(f.movimentoCaixaId), f);
    if (f.id) financeiroPorId.set(String(f.id), f);
  }

  let recebimentos = entradas.map((m) => {
    const fin = financeiroPorMovimento.get(String(m.id)) || financeiroPorId.get(String(m.lancamentoFinanceiroId || m.financeiroId || '')) || {};
    const relacionados = recebimentosPorRecibo.get(String(m.reciboId || '')) || [];
    const categoriasRelacionadas = [...new Set(relacionados.map((item) => categoria(item, '')).filter(Boolean))];
    const categoriaMovimento = normalizar(m.categoria) === 'recebimentos'
      ? (fin.categoria || (categoriasRelacionadas.length === 1 ? categoriasRelacionadas[0] : '') || m.categoria)
      : (m.categoria || fin.categoria);
    const bruto = valorBruto(m) || valorBruto(fin);
    const taxaRelacionada = quantidadeMovimentosPorRecibo.get(String(m.reciboId || '')) === 1
      ? arred(relacionados.reduce((soma, item) => soma + numero(item.ultimaTaxaOperadoraValor ?? item.taxaOperadoraValor ?? item.taxaValor ?? 0), 0))
      : 0;
    const taxa = calcularTaxa(m) || calcularTaxa(fin) || taxaRelacionada;
    const liquidoInformado = numero(m.valorLiquido ?? m.valorRecebidoLiquido);
    const liquido = liquidoInformado > 0 ? arred(liquidoInformado) : arred(bruto - taxa);
    return {
      id: m.id,
      reciboId: m.reciboId || '',
      recebimentoId: m.recebimentoId || '',
      lancamentoFinanceiroId: m.lancamentoFinanceiroId || m.financeiroId || '',
      mensalidadeId: m.mensalidadeId || '',
      hora: horaItem(m),
      data: dataISO(m.data || m.criadoEm),
      cliente: m.pessoa || fin.alunoFornecedor || fin.pessoa || fin.pessoaFornecedor || '',
      descricao: m.descricao || fin.descricao || 'Recebimento',
      categoria: categoriaMovimento || 'Recebimentos',
      formaPagamento: m.formaPagamento || fin.formaPagamento || '',
      bruto,
      taxa,
      liquido,
      status: m.status || 'ativo'
    };
  });

  let pagamentos = saidas.map((m) => ({
    id: m.id,
    hora: horaItem(m),
    data: dataISO(m.data || m.criadoEm),
    pessoa: m.pessoa || '',
    descricao: m.descricao || 'Saída',
    categoria: m.categoria || 'Despesas',
    formaPagamento: m.formaPagamento || '',
    valor: arred(m.valor || 0),
    status: m.status || 'ativo'
  }));

  const vistosRecebimentos = new Set();
  recebimentos.forEach(m => marcarVisto(vistosRecebimentos, m));
  entradas.forEach(m => marcarVisto(vistosRecebimentos, m));

  const recebimentosExtras = recebimentosBase
    .filter(r => statusAtivo(r) && statusPago(r))
    .filter(r => dentroPeriodo(dataPagamento(r) || dataVencimento(r), dataInicio, dataFim))
    .filter(r => passaFormaFiltro(r, formaFiltro) && passaCategoriaFiltro(r, categoriaFiltro))
    .filter(r => !jaVisto(vistosRecebimentos, r))
    .map(r => {
      const item = {
        id: r.id,
        hora: horaItem(r),
        data: dataPagamento(r) || dataVencimento(r),
        cliente: pessoa(r),
        descricao: descricao(r, 'Recebimento'),
        categoria: categoria(r, 'Recebimentos'),
        formaPagamento: r.formaPagamento || r.forma || '',
        bruto: valorBruto(r),
        taxa: calcularTaxa(r),
        liquido: valorLiquido(r),
        status: r.status || 'recebido'
      };
      marcarVisto(vistosRecebimentos, r);
      return item;
    });
  recebimentos = [...recebimentos, ...recebimentosExtras];

  const vistosPagamentos = new Set();
  pagamentos.forEach(m => marcarVisto(vistosPagamentos, m));
  saidas.forEach(m => marcarVisto(vistosPagamentos, m));

  const pagamentosExtras = pagamentosBase
    .filter(p => statusAtivo(p) && statusPago(p))
    .filter(p => dentroPeriodo(dataPagamento(p) || dataVencimento(p), dataInicio, dataFim))
    .filter(p => passaFormaFiltro(p, formaFiltro) && passaCategoriaFiltro(p, categoriaFiltro))
    .filter(p => !jaVisto(vistosPagamentos, p))
    .map(p => {
      const item = {
        id: p.id,
        hora: horaItem(p),
        data: dataPagamento(p) || dataVencimento(p),
        pessoa: pessoa(p),
        descricao: descricao(p, 'Pagamento'),
        categoria: categoria(p, 'Pagamentos'),
        formaPagamento: p.formaPagamento || p.forma || '',
        valor: valorPago(p) || valorOriginal(p),
        status: p.status || 'pago'
      };
      marcarVisto(vistosPagamentos, p);
      return item;
    });

  const pagamentosFinanceiroExtras = (Array.isArray(financeiro) ? financeiro : [])
    .filter(f => statusAtivo(f) && statusPago(f) && tipoDespesa(f))
    .filter(f => dentroPeriodo(dataPagamento(f) || dataVencimento(f), dataInicio, dataFim))
    .filter(f => passaFormaFiltro(f, formaFiltro) && passaCategoriaFiltro(f, categoriaFiltro))
    .filter(f => !jaVisto(vistosPagamentos, f))
    .map(f => {
      const item = {
        id: f.id,
        hora: horaItem(f),
        data: dataPagamento(f) || dataVencimento(f),
        pessoa: pessoa(f),
        descricao: descricao(f, 'Pagamento'),
        categoria: categoria(f, 'Pagamentos'),
        formaPagamento: f.formaPagamento || f.forma || '',
        valor: valorPago(f) || valorOriginal(f),
        status: f.status || 'pago'
      };
      marcarVisto(vistosPagamentos, f);
      return item;
    });
  pagamentos = [...pagamentos, ...pagamentosExtras, ...pagamentosFinanceiroExtras];

  const porForma = new Map();
  const acumularForma = (forma, bruto, taxa, liquido) => {
    const chave = formaGrupo(forma);
    const atual = porForma.get(chave) || { forma: chave, quantidade: 0, bruto: 0, taxa: 0, liquido: 0 };
    atual.quantidade += 1;
    atual.bruto = arred(atual.bruto + bruto);
    atual.taxa = arred(atual.taxa + taxa);
    atual.liquido = arred(atual.liquido + liquido);
    porForma.set(chave, atual);
  };
  recebimentos.forEach(r => acumularForma(r.formaPagamento, r.bruto, r.taxa, r.liquido));

  const porCategoria = new Map();
  for (const r of recebimentos) {
    const chave = r.categoria || 'Sem categoria';
    const atual = porCategoria.get(chave) || { categoria: chave, quantidade: 0, bruto: 0, taxa: 0, liquido: 0 };
    atual.quantidade += 1;
    atual.bruto = arred(atual.bruto + r.bruto);
    atual.taxa = arred(atual.taxa + r.taxa);
    atual.liquido = arred(atual.liquido + r.liquido);
    porCategoria.set(chave, atual);
  }

  const totalBrutoRecebido = arred(recebimentos.reduce((s, r) => s + r.bruto, 0));
  const totalTaxas = arred(recebimentos.reduce((s, r) => s + r.taxa, 0));
  const totalLiquidoRecebido = arred(recebimentos.reduce((s, r) => s + r.liquido, 0));
  const totalPagamentos = arred(pagamentos.reduce((s, p) => s + p.valor, 0));

  const caixasPeriodo = caixas.filter(c => {
    const data = dataISO(c.dataAbertura || c.abertoEm || c.criadoEm);
    return data >= dataInicio && data <= dataFim;
  });
  const saldoInicial = arred(caixasPeriodo.reduce((s, c) => s + numero(c.valorAbertura || 0), 0));
  const saldoFinal = arred(saldoInicial + totalLiquidoRecebido - totalPagamentos);

  return {
    ok: true,
    filtros: { dataInicio, dataFim, formaPagamento: filtros.formaPagamento || '', categoria: filtros.categoria || '' },
    resumo: { saldoInicial, totalBrutoRecebido, totalTaxas, totalLiquidoRecebido, totalPagamentos, saldoFinal, quantidadeRecebimentos: recebimentos.length, quantidadePagamentos: pagamentos.length },
    recebimentos: recebimentos.sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
    pagamentos: pagamentos.sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
    porForma: [...porForma.values()].sort((a, b) => b.liquido - a.liquido),
    porCategoria: [...porCategoria.values()].sort((a, b) => b.liquido - a.liquido)
  };
}

export async function biFinanceiro(filtros = {}) {
  const inicio = dataISO(filtros.inicio || filtros.dataInicio || '');
  const fim = dataISO(filtros.fim || filtros.dataFim || hojeISO());
  const hoje = hojeISO();

  const financeiroRaw = await lerJson(FINANCEIRO_FILE, []);
  const recebimentosRaw = await lerJsonOpcional([RECEBIMENTOS_FILE], []);
  const pagamentosRaw = await lerJsonOpcional([PAGAMENTOS_FILE, PAGAMENTOS_FILE_LEGADO], []);
  const caixaRaw = await lerJson(CAIXA_FILE, { caixas: [], movimentos: [] });

  const financeiro = arrayDe(financeiroRaw, 'lancamentos').filter(statusAtivo);
  const recebimentos = arrayDe(recebimentosRaw, 'recebimentos').filter(statusAtivo);
  const pagamentos = arrayDe(pagamentosRaw, 'pagamentos').filter(statusAtivo);
  const movimentos = arrayDe(caixaRaw.movimentos || [], 'movimentos').filter(statusAtivo);

  const linhas = [];
  const referencias = item => [...new Set([
    item.id, item.lancamentoFinanceiroId, item.financeiroId, item.recebimentoId,
    item.pagamentoId, item.referenciaId, item.movimentoCaixaId, item.mensalidadeId,
    item.reciboId, item.ultimoReciboId, item.reciboEstornadoId
  ].map(v => String(v || '').trim()).filter(Boolean))];
  for (const f of financeiro) {
    const receita = tipoReceita(f);
    const dVenc = dataVencimento(f);
    const dPag = dataPagamento(f);
    const base = valorOriginal(f);
    const pago = valorPago(f) || (statusPago(f) ? valorLiquido(f) : 0);
    const valorRealizado = statusPago(f) ? valorLiquido(f) : pago;
    linhas.push({
      origem: 'financeiro', id: f.id, tipo: receita ? 'receita' : 'despesa', status: f.status || 'Aberto',
      data: dPag || dVenc, vencimento: dVenc, realizado: statusPago(f), valor: base,
      valorRealizado, taxa: calcularTaxa(f), categoria: categoria(f, receita ? 'Receitas' : 'Despesas'), descricao: descricao(f), pessoa: pessoa(f), referencias: referencias(f)
    });
  }

  for (const r of recebimentos) {
    const data = dataPagamento(r) || dataVencimento(r);
    linhas.push({ origem: 'recebimentos', id: r.id, tipo: 'receita', status: r.status || 'Recebido', data, vencimento: dataVencimento(r), realizado: true, valor: valorOriginal(r), valorRealizado: valorLiquido(r), taxa: calcularTaxa(r), categoria: categoria(r, 'Recebimentos'), descricao: descricao(r, 'Recebimento'), pessoa: pessoa(r), referencias: referencias(r) });
  }

  for (const p of pagamentos) {
    const data = dataPagamento(p) || dataVencimento(p);
    linhas.push({ origem: 'pagamentos', id: p.id, tipo: 'despesa', status: p.status || 'Pago', data, vencimento: dataVencimento(p), realizado: statusPago(p), valor: valorOriginal(p), valorRealizado: statusPago(p) ? valorBruto(p) : valorPago(p), taxa: 0, categoria: categoria(p, 'Pagamentos'), descricao: descricao(p, 'Pagamento'), pessoa: pessoa(p), referencias: referencias(p) });
  }

  // Usa também o caixa como fonte de segurança para valores já movimentados,
  // principalmente quando o relatório diário já mostra o movimento, mas o BI antigo fica zerado.
  for (const m of movimentos) {
    const t = normalizar(m.tipo);
    const receita = t.includes('entrada');
    const despesa = t.includes('saida') || t.includes('saída');
    if (!receita && !despesa) continue;
    const data = dataISO(m.data || m.dataPagamento || m.criadoEm);
    linhas.push({ origem: 'caixa', id: m.id, tipo: receita ? 'receita' : 'despesa', status: m.status || 'ativo', data, vencimento: data, realizado: true, valor: valorBruto(m), valorRealizado: valorLiquido(m), taxa: calcularTaxa(m), categoria: categoria(m, receita ? 'Caixa - entradas' : 'Caixa - saídas'), descricao: descricao(m, receita ? 'Entrada de caixa' : 'Saída de caixa'), pessoa: pessoa(m), referencias: referencias(m) });
  }

  // A mesma baixa existe em financeiro, recebimentos e caixa. Consolida pelos
  // IDs cruzados e prioriza a fonte operacional mais específica.
  const prioridade = { recebimentos: 1, pagamentos: 1, financeiro: 2, caixa: 3 };
  const vistos = new Set();
  const consolidadas = [...linhas].sort((a, b) => (prioridade[a.origem] || 9) - (prioridade[b.origem] || 9)).filter(linha => {
    if (!linha.realizado) return true;
    const refs = linha.referencias || [];
    if (refs.some(ref => vistos.has(ref))) return false;
    refs.forEach(ref => vistos.add(ref));
    return true;
  });
  const periodo = consolidadas.filter(l => dentroPeriodo(l.data || l.vencimento, inicio, fim));
  const receitas = periodo.filter(l => l.tipo === 'receita');
  const despesas = periodo.filter(l => l.tipo === 'despesa');

  const recebido = arred(receitas.filter(l => l.realizado).reduce((s, l) => s + numero(l.valorRealizado || l.valor), 0));
  const receber = arred(receitas.filter(l => !l.realizado).reduce((s, l) => s + numero(l.valor), 0));
  const pago = arred(despesas.filter(l => l.realizado).reduce((s, l) => s + numero(l.valorRealizado || l.valor), 0));
  const pagar = arred(despesas.filter(l => !l.realizado).reduce((s, l) => s + numero(l.valor), 0));
  const vencidoReceber = arred(receitas.filter(l => !l.realizado && l.vencimento && l.vencimento < hoje).reduce((s, l) => s + numero(l.valor), 0));
  const vencidoPagar = arred(despesas.filter(l => !l.realizado && l.vencimento && l.vencimento < hoje).reduce((s, l) => s + numero(l.valor), 0));

  const receitasMes = new Map();
  const despesasMes = new Map();
  const fluxoMes = new Map();
  const receitaCategoria = new Map();
  const despesaCategoria = new Map();
  const statusMapa = new Map();

  for (const l of periodo) {
    const valor = numero(l.realizado ? (l.valorRealizado || l.valor) : l.valor);
    const mes = mesISO(l.data || l.vencimento);
    if (l.tipo === 'receita') {
      somaPorMapa(receitasMes, mes, 'valor', valor);
      somaPorMapa(fluxoMes, mes, 'receitas', valor);
      mapCategoria(receitaCategoria, l.categoria, valor);
    } else {
      somaPorMapa(despesasMes, mes, 'valor', valor);
      somaPorMapa(fluxoMes, mes, 'despesas', valor);
      mapCategoria(despesaCategoria, l.categoria, valor);
    }
    const st = l.realizado ? (l.tipo === 'receita' ? 'Recebido' : 'Pago') : (l.vencimento && l.vencimento < hoje ? 'Vencido' : 'Aberto');
    const atual = statusMapa.get(st) || { status: st, quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    atual.valor = arred(atual.valor + valor);
    statusMapa.set(st, atual);
  }

  const fluxo = [...fluxoMes.entries()].map(([mes, v]) => ({ mes, receitas: arred(v.receitas || 0), despesas: arred(v.despesas || 0), saldo: arred((v.receitas || 0) - (v.despesas || 0)) })).sort((a, b) => a.mes.localeCompare(b.mes));

  const vencidos = periodo.filter(l => !l.realizado && l.vencimento && l.vencimento < hoje)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 20);
  const topReceitas = receitas.sort((a, b) => numero(b.valorRealizado || b.valor) - numero(a.valorRealizado || a.valor)).slice(0, 20);

  return {
    ok: true,
    filtros: { inicio, fim },
    resumo: { recebido, receber, pago, pagar, vencidoReceber, vencidoPagar, saldoRealizado: arred(recebido - pago), saldoPrevisto: arred((recebido + receber) - (pago + pagar)), totalLancamentos: periodo.length, taxasFinanceiras: arred(periodo.reduce((s, l) => s + numero(l.taxa || 0), 0)), qtdReceitas: receitas.length, qtdDespesas: despesas.length },
    receitasPorMes: [...receitasMes.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map(x => ({ mes: x.chave, valor: x.valor })),
    despesasPorMes: [...despesasMes.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map(x => ({ mes: x.chave, valor: x.valor })),
    fluxo,
    statusFinanceiro: [...statusMapa.values()].sort((a, b) => b.valor - a.valor),
    receitaPorCategoria: [...receitaCategoria.values()].sort((a, b) => b.valor - a.valor),
    despesaPorCategoria: [...despesaCategoria.values()].sort((a, b) => b.valor - a.valor),
    vencidos,
    topReceitas,
    linhas: periodo
  };
}
