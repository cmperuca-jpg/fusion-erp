import { FUSION_TIMEZONE } from "../core/time/fusion-time.mjs";
import path from 'node:path';
import { lerJsonDuravel } from '../core/persistence/durable-json.mjs';
import { listarPagamentosRaw } from './pagamentos.repository.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CAIXA_FILE = path.join(DATA_DIR, 'caixa.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');
const RECEBIMENTOS_FILE = path.join(DATA_DIR, 'recebimentos.json');
const RECIBOS_FILE = path.join(DATA_DIR, 'recibos.json');
const RECIBOS_ITENS_FILE = path.join(DATA_DIR, 'recibos_itens.json');
const PAGAMENTOS_FILE = path.join(DATA_DIR, 'financeiro', 'pagamentos.json');
const PAGAMENTOS_FILE_LEGADO = path.join(DATA_DIR, 'pagamentos.json');
const TIMEZONE_OPERACAO = FUSION_TIMEZONE;

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

function dataLocalISO(valor = new Date()) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor || '').slice(0, 10);
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_OPERACAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(data).reduce((acc, parte) => {
    if (parte.type !== 'literal') acc[parte.type] = parte.value;
    return acc;
  }, {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}
function hojeISO() { return dataLocalISO(new Date()); }
function dataISO(v) {
  const txt = String(v || '');
  if (!txt) return '';
  if (txt.includes('T')) return dataLocalISO(txt);
  return txt.slice(0, 10);
}
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
function statusProgramado(item = {}) {
  const st = normalizar(item.status || item.situacao || '');
  return st.includes('programad') || st.includes('agendad') || st.includes('previst');
}
function reciboEstornado(item = {}) {
  return item.cancelado === true || ['cancelado', 'cancelada', 'estornado', 'estornada'].includes(normalizar(item.status));
}
function idsRecibosEstornados({ recibos = [], recebimentos = [], movimentos = [] } = {}) {
  const ids = new Set();
  for (const recibo of recibos) {
    if (!reciboEstornado(recibo)) continue;
    [recibo.id, recibo.numero].map(v => String(v || '').trim()).filter(Boolean).forEach(v => ids.add(v));
  }
  for (const recebimento of recebimentos) {
    if (!reciboEstornado(recebimento)) continue;
    [recebimento.reciboId, recebimento.ultimoReciboId].map(v => String(v || '').trim()).filter(Boolean).forEach(v => ids.add(v));
  }
  for (const movimento of movimentos) {
    if (normalizar(movimento.origem) !== 'estorno_recibo') continue;
    [movimento.reciboId, movimento.reciboEstornadoId].map(v => String(v || '').trim()).filter(Boolean).forEach(v => ids.add(v));
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
function valorBruto(item = {}) { return arred(item.valorBrutoRecebido ?? item.valorRecebidoBruto ?? item.valorRecebido ?? item.valorPago ?? item.totalPago ?? item.valor ?? item.valorBruto ?? item.valorTotal ?? 0); }

function liquidoCanonico(brutoValor, taxaValor, liquidoInformado = 0) {
  const bruto = Math.max(0, numero(brutoValor));
  const taxa = Math.max(0, numero(taxaValor));
  const calculado = arred(Math.max(0, bruto - taxa));
  const informado = numero(liquidoInformado);

  // Taxa explícita é autoridade contábil. Isso corrige registros históricos
  // onde o líquido foi salvo com a taxa descontada duas vezes.
  if (taxa > 0) return calculado;
  if (informado > 0) return arred(informado);
  return calculado;
}

function valorLiquido(item = {}) {
  return liquidoCanonico(
    valorBruto(item),
    calcularTaxa(item),
    item.valorLiquido ?? item.valorRecebidoLiquido ?? 0
  );
}
function valorOriginal(item = {}) { return arred(item.valor ?? item.valorBruto ?? item.valorTotal ?? item.total ?? item.valorLiquido ?? 0); }
function valorPago(item = {}) { return arred(item.valorPago ?? item.valorPagoTotal ?? item.totalPago ?? item.valorRecebido ?? 0); }

/*
 * Valor que ainda falta realizar.
 *
 * Não usa o valor original de um título parcial como se ele estivesse inteiro
 * em aberto. Para títulos explicitamente Programados, ignora aliases antigos
 * de saldo zerado, porque "programado" não significa "sem valor a receber/pagar".
 */
function valorPendente(item = {}) {
  if (!statusAtivo(item) || statusPago(item)) return 0;

  const original = Math.max(0, valorOriginal(item));
  const pago = Math.max(0, Math.min(original, valorPago(item)));
  const saldoInformado = item.valorRestante ?? item.saldoRestante ?? item.saldo ?? item.valorAberto;

  if (!statusProgramado(item) && saldoInformado !== undefined && saldoInformado !== null && String(saldoInformado).trim() !== '') {
    const saldo = Math.max(0, numero(saldoInformado));
    if (saldo <= original + 0.009) return arred(saldo);
  }

  return arred(Math.max(0, original - pago));
}
function dataPagamento(item = {}) { return dataISO(item.dataPagamento || item.pagamento || item.dataBaixa || item.recebidoEm || item.pagoEm || item.atualizadoEm || item.updatedAt || item.criadoEm || item.createdAt); }
function dataVencimento(item = {}) { return dataISO(item.vencimento || item.dataVencimento || item.data || item.criadoEm); }
function categoria(item = {}, padrao = 'Sem categoria') { return item.categoria || item.centroCusto || item.origem || padrao; }
function descricao(item = {}, padrao = 'Lançamento') { return item.descricao || item.titulo || item.observacao || padrao; }
function pessoa(item = {}) { return item.alunoFornecedor || item.pessoa || item.pessoaFornecedor || item.cliente || item.fornecedor || item.alunoNome || item.aluno || ''; }
function horaItem(item = {}) {
  if (item.hora) return String(item.hora).slice(0, 5);
  const fonte = item.criadoEm || item.atualizadoEm || item.dataPagamento || item.data || '';
  const txt = String(fonte || '');
  if (txt.includes('T')) {
    const data = new Date(txt);
    if (!Number.isNaN(data.getTime())) {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE_OPERACAO,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(data);
    }
    return txt.slice(11, 16);
  }
  return '';
}

function formasRecibo(recibo = {}) {
  const formas = Array.isArray(recibo.formasPagamento) ? recibo.formasPagamento.filter(Boolean) : [];
  if (formas.length) return formas;
  return [{
    formaPagamento: recibo.formaPagamento || recibo.forma || 'Dinheiro',
    valor: recibo.valorPago ?? recibo.valorBrutoRecebido ?? recibo.valorLiquido ?? 0,
    taxaOperadoraValor: recibo.taxaOperadoraValor ?? recibo.taxa ?? 0,
    valorLiquido: recibo.valorLiquido
  }];
}

function taxaFormaRecibo(forma = {}, recibo = {}, bruto = 0, totalBruto = 0) {
  const taxa = numero(forma.taxaOperadoraValor ?? forma.taxaValor ?? forma.taxa);
  if (taxa > 0) return arred(taxa);
  const taxaTotal = numero(recibo.taxaOperadoraValor ?? recibo.taxaValor ?? recibo.taxa);
  if (taxaTotal <= 0) return 0;
  if (totalBruto > 0 && bruto > 0) return arred(taxaTotal * bruto / totalBruto);
  return arred(taxaTotal / Math.max(1, formasRecibo(recibo).length));
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
  const refs = [
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
  ].map(v => String(v || '').trim()).filter(Boolean);

  // Compatibilidade com saídas legadas sem campos de vínculo. Exemplo:
  // cx_baixa-pagamento-fin_pag_...-timestamp contém o ID financeiro no próprio ID.
  const id = String(item.id || '');
  const embutido = id.match(/(fin_[A-Za-z0-9_]+)(?=-|$)/);
  if (embutido?.[1]) refs.push(embutido[1]);

  return [...new Set(refs)];
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
  const recibosRaw = await lerJson(RECIBOS_FILE, []);
  const recibosItensRaw = await lerJson(RECIBOS_ITENS_FILE, []);
  const pagamentosRaw = await listarPagamentosRaw();

  const caixas = Array.isArray(caixaRaw.caixas) ? caixaRaw.caixas : [];
  const movimentos = Array.isArray(caixaRaw.movimentos) ? caixaRaw.movimentos : [];
  const recebimentosBase = arrayDe(recebimentosRaw, 'recebimentos');
  const recibosBase = arrayDe(recibosRaw, 'recibos');
  const recibosItensBase = arrayDe(recibosItensRaw, 'itens');
  const pagamentosBase = arrayDe(pagamentosRaw, 'pagamentos');
  const recibosEstornados = idsRecibosEstornados({ recibos: recibosBase, recebimentos: recebimentosBase, movimentos });

  const recebimentosPorRecibo = new Map();
  for (const recebimento of recebimentosBase) {
    const reciboId = String(recebimento.reciboId || recebimento.ultimoReciboId || '').trim();
    if (!reciboId) continue;
    recebimentosPorRecibo.set(reciboId, [...(recebimentosPorRecibo.get(reciboId) || []), recebimento]);
  }
  const itensPorRecibo = new Map();
  for (const item of recibosItensBase) {
    const reciboId = String(item.reciboId || '').trim();
    if (!reciboId) continue;
    itensPorRecibo.set(reciboId, [...(itensPorRecibo.get(reciboId) || []), item]);
  }

  const movimentosPeriodoHistorico = movimentos.filter((m) => {
    const data = dataISO(m.data || m.dataPagamento || m.criadoEm);
    if (!data || data < dataInicio || data > dataFim) return false;
    if (!statusAtivo(m)) return false;
    if (!passaFormaFiltro(m, formaFiltro)) return false;
    if (!passaCategoriaFiltro(m, categoriaFiltro)) return false;
    return true;
  });
  const movimentosPeriodo = movimentosPeriodoHistorico.filter((m) => !movimentoNeutroPorEstorno(m, recibosEstornados));

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
  const categoriaDoRecibo = (recibo = {}) => {
    const relacionados = recebimentosPorRecibo.get(String(recibo.id || '')) || [];
    const categoriasRecebimentos = [...new Set(relacionados.map((item) => categoria(item, '')).filter(Boolean))];
    if (categoriasRecebimentos.length === 1) return categoriasRecebimentos[0];

    const itens = itensPorRecibo.get(String(recibo.id || '')) || [];
    const categoriasTitulos = [...new Set(itens
      .map((item) => financeiroPorId.get(String(item.tituloId || '')))
      .filter(Boolean)
      .map((titulo) => categoria(titulo, ''))
      .filter(Boolean))];
    if (categoriasTitulos.length === 1) return categoriasTitulos[0];

    return recibo.categoria || 'Recebimentos';
  };

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
    const liquido = liquidoCanonico(bruto, taxa, liquidoInformado);
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

  const recibosExtras = recibosBase
    .filter(r => statusAtivo(r) && !reciboEstornado(r))
    .filter(r => dentroPeriodo(r.data || dataISO(r.criadoEm), dataInicio, dataFim))
    .filter(r => passaCategoriaFiltro({ ...r, categoria: categoriaDoRecibo(r), descricao: `Recibo ${r.numero || r.id}`, pessoa: r.aluno }, categoriaFiltro))
    .filter(r => !jaVisto(vistosRecebimentos, r))
    .flatMap(r => {
      marcarVisto(vistosRecebimentos, r);
      const formas = formasRecibo(r);
      const totalBruto = formas.reduce((soma, forma) => soma + numero(forma.valor ?? forma.valorPago ?? forma.valorBruto), 0) || valorBruto(r);
      const categoriaRecibo = categoriaDoRecibo(r);
      return formas.map((forma, indice) => {
        const bruto = numero(forma.valor ?? forma.valorPago ?? forma.valorBruto) || (indice === 0 ? valorBruto(r) : 0);
        const taxa = taxaFormaRecibo(forma, r, bruto, totalBruto);
        const liquidoForma = numero(forma.valorLiquido ?? forma.valorRecebidoLiquido);
        const liquido = liquidoCanonico(bruto, taxa, liquidoForma);
        return {
          id: `${r.id || r.numero || 'recibo'}:${indice}`,
          reciboId: r.id || '',
          hora: horaItem(r),
          data: dataISO(r.data || r.criadoEm),
          cliente: r.aluno || r.pessoa || '',
          descricao: `Recibo ${r.numero || r.id || ''}${r.aluno ? ` - ${r.aluno}` : ''}`.trim(),
          categoria: categoriaRecibo,
          formaPagamento: forma.formaPagamento || forma.forma || 'Dinheiro',
          bruto,
          taxa,
          liquido,
          status: r.status || 'recebido'
        };
      }).filter(item => passaFormaFiltro(item, formaFiltro));
    });
  recebimentos = [...recebimentos, ...recibosExtras];

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
    resumo: { saldoInicial, totalBrutoRecebido, totalTaxas, totalLiquidoRecebido, totalPagamentos, saldoFinal, quantidadeRecebimentos: recebimentos.length, quantidadePagamentos: pagamentos.length, movimentosHistoricos: movimentosPeriodoHistorico.length, movimentosNeutralizadosPorEstorno: movimentosPeriodoHistorico.length - movimentosPeriodo.length },
    recebimentos: recebimentos.sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
    pagamentos: pagamentos.sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
    porForma: [...porForma.values()].sort((a, b) => b.liquido - a.liquido),
    porCategoria: [...porCategoria.values()].sort((a, b) => b.liquido - a.liquido)
  };
}

function ehTituloRecorrenteFinanceiro(item = {}) {
  const origem = normalizar(item.origem);
  const categoriaItem = normalizar(item.categoria);
  const descricaoItem = normalizar(item.descricao);
  if (origem.includes('matricula_inicial') || categoriaItem.includes('matricula') || descricaoItem.includes('entrada matricula')) return false;
  return origem.includes('mensalidade') ||
    origem.includes('recorrencia') ||
    categoriaItem.includes('mensalidade') ||
    Boolean(item.mensalidadeId && (item.competencia || item.vencimento));
}

function chaveRecorrenciaFinanceira(item = {}) {
  if (!ehTituloRecorrenteFinanceiro(item)) return '';
  const aluno = String(item.alunoId || pessoa(item) || '').trim();
  if (!aluno) return '';
  const matricula = String(item.matriculaId || '').trim();
  const plano = String(item.planoId || '').trim();
  const comp = String(item.competencia || dataVencimento(item).slice(0, 7) || '').slice(0, 7);
  if (!comp) return '';
  return [aluno, matricula, plano, comp].join('|');
}

function ocultarProgramadosDuplicadosFinanceiro(lista = []) {
  const emitidas = new Set();
  for (const item of lista) {
    if (!statusAtivo(item) || statusProgramado(item)) continue;
    const chave = chaveRecorrenciaFinanceira(item);
    if (chave) emitidas.add(chave);
  }
  return lista.filter(item => {
    if (!statusProgramado(item)) return true;
    const chave = chaveRecorrenciaFinanceira(item);
    return !chave || !emitidas.has(chave);
  });
}

export async function biFinanceiro(filtros = {}) {
  const inicio = dataISO(filtros.inicio || filtros.dataInicio || '');
  const fim = dataISO(filtros.fim || filtros.dataFim || (inicio ? hojeISO() : ''));
  const hoje = hojeISO();

  const financeiroRaw = await lerJson(FINANCEIRO_FILE, []);
  const recebimentosRaw = await lerJsonOpcional([RECEBIMENTOS_FILE], []);
  const recibosRaw = await lerJson(RECIBOS_FILE, []);
  const pagamentosRaw = await listarPagamentosRaw();
  const caixaRaw = await lerJson(CAIXA_FILE, { caixas: [], movimentos: [] });

  const financeiro = ocultarProgramadosDuplicadosFinanceiro(arrayDe(financeiroRaw, 'lancamentos').filter(statusAtivo));
  const recebimentosTodos = arrayDe(recebimentosRaw, 'recebimentos');
  const recibosTodos = arrayDe(recibosRaw, 'recibos');
  const recebimentos = recebimentosTodos.filter(statusAtivo).filter(statusPago);
  const pagamentos = arrayDe(pagamentosRaw, 'pagamentos').filter(statusAtivo).filter((p) => statusPago(p) || valorPago(p) > 0);
  const movimentosHistoricos = arrayDe(caixaRaw.movimentos || [], 'movimentos').filter(statusAtivo);

  // Um estorno deve permanecer no histórico físico do caixa como entrada +
  // saída, mas não pode continuar compondo receita, taxa ou despesa no BI.
  const recibosEstornados = idsRecibosEstornados({ recibos: recibosTodos, recebimentos: recebimentosTodos, movimentos: movimentosHistoricos });
  const movimentos = movimentosHistoricos.filter((m) => !movimentoNeutroPorEstorno(m, recibosEstornados));

  const linhas = [];
  for (const f of financeiro) {
    const receita = tipoReceita(f);
    const dVenc = dataVencimento(f);
    const pagoStatus = statusPago(f);
    const dPag = pagoStatus ? dataPagamento(f) : '';
    const base = valorOriginal(f);
    const pago = valorPago(f) || (pagoStatus ? valorBruto(f) : 0);
    const pendente = pagoStatus ? 0 : valorPendente(f);
    const parcial = !pagoStatus && pago > 0 && pendente > 0;
    const brutoRealizado = numero(f.valorBrutoRecebido ?? f.valorRecebidoBruto ?? f.valorRecebido ?? pago);
    const valorRealizado = pagoStatus
      ? valorLiquido(f)
      : (receita ? liquidoCanonico(brutoRealizado || pago, calcularTaxa(f), f.valorLiquido ?? f.valorRecebidoLiquido) : pago);

    // Compatibilidade com títulos antigos gravados como "Aberto":
    // se ainda não houve baixa e o vencimento é futuro, operacionalmente é Programado.
    const programado = !parcial && !pagoStatus && pago <= 0 && (
      (dVenc && dVenc > hoje) ||
      (!dVenc && statusProgramado(f))
    );

    linhas.push({
      origem: 'financeiro', id: f.id, tipo: receita ? 'receita' : 'despesa', status: f.status || 'Aberto',
      data: dPag || dVenc, vencimento: dVenc, realizado: pagoStatus, valor: base,
      valorPendente: pendente, valorRealizado, parcial, programado, taxa: parcial ? 0 : calcularTaxa(f),
      categoria: categoria(f, receita ? 'Receitas' : 'Despesas'), descricao: descricao(f),
      pessoa: pessoa(f), referencias: referencias(f)
    });

    /*
     * Se o título está parcial e não existir uma fonte operacional separada
     * (recebimento/pagamento/caixa), preserva a parte já realizada.
     * A deduplicação por referências elimina este componente quando a baixa
     * específica também estiver presente.
     */
    if (parcial && pago > 0) {
      linhas.push({
        origem: 'financeiro', id: `${f.id}:parcial-realizado`, tipo: receita ? 'receita' : 'despesa',
        status: receita ? 'Recebido parcial' : 'Pago parcial',
        data: dataPagamento(f) || dVenc, vencimento: dVenc, realizado: true,
        valor: pago, valorPendente: 0,
        valorRealizado,
        programado: false, componenteParcialRealizado: true,
        taxa: calcularTaxa(f), categoria: categoria(f, receita ? 'Receitas' : 'Despesas'),
        descricao: descricao(f), pessoa: pessoa(f), referencias: referencias(f)
      });
    }
  }

  // Recebimentos historicos podem ter sido gravados apenas com IDs de vinculo,
  // sem pessoa/descricao. O financeiro vinculado conserva a identificacao.
  const financeiroPorReferencia = new Map();
  for (const f of financeiro) {
    for (const ref of referencias(f)) {
      if (!financeiroPorReferencia.has(ref)) financeiroPorReferencia.set(ref, f);
    }
  }

  for (const r of recebimentos) {
    const data = dataPagamento(r) || dataVencimento(r);
    const refsRecebimento = referencias(r);
    const financeiroVinculado = refsRecebimento
      .map((ref) => financeiroPorReferencia.get(ref))
      .find(Boolean);
    const pessoaRecebimento = pessoa(r) || pessoa(financeiroVinculado || {});
    const descricaoRecebimento = descricao(r, '') || descricao(financeiroVinculado || {}, 'Recebimento');
    const categoriaRecebimento = categoria(r, '') || categoria(financeiroVinculado || {}, 'Recebimentos');

    linhas.push({
      origem: 'recebimentos',
      id: r.id,
      tipo: 'receita',
      status: r.status || 'Recebido',
      data,
      vencimento: dataVencimento(r),
      realizado: true,
      valor: valorOriginal(r),
      valorPendente: 0,
      valorRealizado: valorLiquido(r),
      taxa: calcularTaxa(r),
      categoria: categoriaRecebimento,
      descricao: descricaoRecebimento,
      pessoa: pessoaRecebimento,
      referencias: refsRecebimento
    });
  }

  for (const p of pagamentos) {
    const data = dataPagamento(p) || dataVencimento(p);
    const pagoParcialOuTotal = valorPago(p);
    const realizado = statusPago(p) || pagoParcialOuTotal > 0;
    linhas.push({
      origem: 'pagamentos',
      id: p.id,
      tipo: 'despesa',
      status: p.status || (realizado ? 'Pago' : 'Aberto'),
      data,
      vencimento: dataVencimento(p),
      realizado,
      valor: valorOriginal(p),
      valorPendente: 0,
      valorRealizado: statusPago(p) ? valorBruto(p) : pagoParcialOuTotal,
      taxa: 0,
      categoria: categoria(p, 'Pagamentos'),
      descricao: descricao(p, 'Pagamento'),
      pessoa: pessoa(p),
      referencias: referencias(p)
    });
  }

  // Usa também o caixa como fonte de segurança para valores já movimentados,
  // principalmente quando o relatório diário já mostra o movimento, mas o BI antigo fica zerado.
  for (const m of movimentos) {
    const t = normalizar(m.tipo);
    const receita = t.includes('entrada');
    const despesa = t.includes('saida') || t.includes('saída');
    if (!receita && !despesa) continue;

    const origemMovimento = normalizar(m.origem);
    const reciboMovimento = String(m.reciboId || m.reciboEstornadoId || '').trim();
    const movimentoDeEstorno = origemMovimento === 'estorno_recibo';
    const vinculadoAReciboEstornado = reciboMovimento && recibosEstornados.has(reciboMovimento);

    // Entrada original e saída do estorno ficam no caixa, porém são neutras no BI.
    if (movimentoDeEstorno || vinculadoAReciboEstornado) continue;

    const data = dataISO(m.data || m.dataPagamento || m.criadoEm);
    linhas.push({ origem: 'caixa', id: m.id, tipo: receita ? 'receita' : 'despesa', status: m.status || 'ativo', data, vencimento: data, realizado: true, valor: valorBruto(m), valorPendente: 0, valorRealizado: valorLiquido(m), taxa: calcularTaxa(m), categoria: categoria(m, receita ? 'Caixa - entradas' : 'Caixa - saídas'), descricao: descricao(m, receita ? 'Entrada de caixa' : 'Saída de caixa'), pessoa: pessoa(m), referencias: referencias(m) });
  }

  // A mesma baixa existe em financeiro, recebimentos e caixa. Consolida pelos
  // IDs cruzados e prioriza a fonte operacional mais específica.
  function prioridadeLinha(linha = {}) {
    const valor = numero(linha.valorRealizado || linha.valor);
    if (linha.realizado && valor <= 0) return 90;
    if (linha.realizado && linha.tipo === 'receita') {
      // Recebimentos é a fonte contábil preferida para bruto/taxa/líquido.
      // Caixa fica como fallback operacional quando o recebimento não existe.
      if (linha.origem === 'recebimentos') return 1;
      if (linha.origem === 'caixa') return 2;
      if (linha.origem === 'financeiro') return 3;
    }
    if (linha.realizado && linha.tipo === 'despesa') {
      if (linha.origem === 'pagamentos') return 1;
      if (linha.origem === 'caixa') return 2;
      if (linha.origem === 'financeiro') return 3;
    }
    return ({ financeiro: 1, recebimentos: 2, pagamentos: 2, caixa: 3 }[linha.origem] || 9);
  }
  const vistos = new Set();
  const consolidadas = [...linhas].sort((a, b) => prioridadeLinha(a) - prioridadeLinha(b)).filter(linha => {
    if (!linha.realizado) return true;
    const valor = numero(linha.valorRealizado || linha.valor);
    if (valor <= 0) return true;
    const refs = linha.referencias || [];
    if (refs.some(ref => vistos.has(ref))) return false;
    refs.forEach(ref => vistos.add(ref));
    return true;
  });
  const periodo = consolidadas.filter(l => dentroPeriodo(l.data || l.vencimento, inicio, fim));
  const receitas = periodo.filter(l => l.tipo === 'receita');
  const despesas = periodo.filter(l => l.tipo === 'despesa');

  const receitasAbertas = receitas.filter(l => !l.realizado && !l.programado);
  const despesasAbertas = despesas.filter(l => !l.realizado && !l.programado);
  const receitasProgramadas = receitas.filter(l => !l.realizado && l.programado);
  const despesasProgramadas = despesas.filter(l => !l.realizado && l.programado);
  const valorLinhaPendente = (l = {}) => numero(l.valorPendente ?? l.valor);
  const recebido = arred(receitas.filter(l => l.realizado).reduce((s, l) => s + numero(l.valorRealizado || l.valor), 0));
  const receber = arred(receitasAbertas.reduce((s, l) => s + valorLinhaPendente(l), 0));
  const pago = arred(despesas.filter(l => l.realizado).reduce((s, l) => s + numero(l.valorRealizado || l.valor), 0));
  const pagar = arred(despesasAbertas.reduce((s, l) => s + valorLinhaPendente(l), 0));
  const vencidoReceber = arred(receitasAbertas.filter(l => l.vencimento && l.vencimento < hoje).reduce((s, l) => s + valorLinhaPendente(l), 0));
  const vencidoPagar = arred(despesasAbertas.filter(l => l.vencimento && l.vencimento < hoje).reduce((s, l) => s + valorLinhaPendente(l), 0));
  const programadoReceber = arred(receitasProgramadas.reduce((s, l) => s + valorLinhaPendente(l), 0));
  const programadoPagar = arred(despesasProgramadas.reduce((s, l) => s + valorLinhaPendente(l), 0));

  const receitasMes = new Map();
  const despesasMes = new Map();
  const fluxoMes = new Map();
  const receitaCategoria = new Map();
  const despesaCategoria = new Map();
  const statusMapa = new Map();

  for (const l of periodo) {
    const valor = numero(l.realizado ? (l.valorRealizado || l.valor) : (l.valorPendente ?? l.valor));
    const mes = mesISO(l.data || l.vencimento);
    if (!l.programado) {
      if (l.tipo === 'receita') {
        somaPorMapa(receitasMes, mes, 'valor', valor);
        somaPorMapa(fluxoMes, mes, 'receitas', valor);
        mapCategoria(receitaCategoria, l.categoria, valor);
      } else {
        somaPorMapa(despesasMes, mes, 'valor', valor);
        somaPorMapa(fluxoMes, mes, 'despesas', valor);
        mapCategoria(despesaCategoria, l.categoria, valor);
      }
    }
    if (!l.componenteParcialRealizado) {
      const st = l.programado
        ? 'Programado'
        : (l.parcial ? 'Parcial' : (l.realizado ? (l.tipo === 'receita' ? 'Recebido' : 'Pago') : (l.vencimento && l.vencimento < hoje ? 'Vencido' : 'Aberto')));
      const atual = statusMapa.get(st) || { status: st, quantidade: 0, valor: 0 };
      atual.quantidade += 1;
      atual.valor = arred(atual.valor + valor);
      statusMapa.set(st, atual);
    }
  }

  const fluxo = [...fluxoMes.entries()].map(([mes, v]) => ({ mes, receitas: arred(v.receitas || 0), despesas: arred(v.despesas || 0), saldo: arred((v.receitas || 0) - (v.despesas || 0)) })).sort((a, b) => a.mes.localeCompare(b.mes));

  const vencidos = periodo.filter(l => !l.realizado && !l.programado && l.vencimento && l.vencimento < hoje)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 20);
  const topReceitas = receitas.filter(l => !l.programado).sort((a, b) => numero(b.valorRealizado || b.valor) - numero(a.valorRealizado || a.valor)).slice(0, 20);

  return {
    ok: true,
    filtros: { inicio, fim },
    resumo: { recebido, receber, pago, pagar, vencidoReceber, vencidoPagar, programadoReceber, programadoPagar, saldoRealizado: arred(recebido - pago), saldoPrevisto: arred((recebido + receber + programadoReceber) - (pago + pagar + programadoPagar)), totalLancamentos: periodo.filter(l => !l.componenteParcialRealizado).length, taxasFinanceiras: arred(periodo.filter(l => l.realizado).reduce((s, l) => s + numero(l.taxa || 0), 0)), qtdReceitas: receitas.filter(l => !l.componenteParcialRealizado).length, qtdDespesas: despesas.filter(l => !l.componenteParcialRealizado).length },
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
