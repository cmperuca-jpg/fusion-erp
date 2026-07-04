import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const MENSALIDADES_FILE = path.join(DATA_DIR, 'mensalidades.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');

async function lerJson(file, fallback = []) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return txt.trim() ? JSON.parse(txt) : fallback;
  } catch {
    return fallback;
  }
}

async function salvarJson(file, dados) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(dados, null, 2), 'utf8');
}

function normalizar(v) {
  return String(v || '').trim().toLowerCase();
}

function ehInicial(m = {}) {
  const txt = normalizar([m.origem, m.descricao, m.categoria].join(' '));
  return txt.includes('matricula_inicial') || txt.includes('matrícula inicial') || txt.includes('matricula inicial');
}

const mensalidades = await lerJson(MENSALIDADES_FILE, []);
let financeiro = await lerJson(FINANCEIRO_FILE, []);
let corrigidas = 0;
let removidos = 0;

for (const mensalidade of mensalidades) {
  if (!ehInicial(mensalidade)) continue;

  const vinculados = financeiro.filter(f => String(f.mensalidadeId || '') === String(mensalidade.id));
  if (!vinculados.length) continue;

  let original = vinculados.find(f => ehInicial(f)) || vinculados[0];
  const duplicados = vinculados.filter(f => String(f.id) !== String(original.id));

  const pago = duplicados.find(f => ['pago', 'recebido', 'quitado'].includes(normalizar(f.status))) ||
    (['pago', 'recebido', 'quitado'].includes(normalizar(original.status)) ? original : null);

  if (pago && String(pago.id) !== String(original.id)) {
    original = {
      ...original,
      status: pago.status,
      valorPago: pago.valorPago ?? pago.valorRecebido ?? pago.valorBrutoRecebido ?? pago.valor,
      valorRecebido: pago.valorRecebido ?? pago.valorPago ?? pago.valorBrutoRecebido ?? pago.valor,
      valorBrutoRecebido: pago.valorBrutoRecebido ?? pago.valorPago ?? pago.valor,
      valorLiquido: pago.valorLiquido ?? pago.valorPago ?? pago.valor,
      taxaOperadoraPercentual: pago.taxaOperadoraPercentual ?? original.taxaOperadoraPercentual ?? 0,
      taxaOperadoraValor: pago.taxaOperadoraValor ?? original.taxaOperadoraValor ?? 0,
      taxaOperadoraFixa: pago.taxaOperadoraFixa ?? original.taxaOperadoraFixa ?? 0,
      bandeiraCartao: pago.bandeiraCartao ?? original.bandeiraCartao ?? '',
      modalidadeCartao: pago.modalidadeCartao ?? original.modalidadeCartao ?? '',
      parcelasCartao: pago.parcelasCartao ?? original.parcelasCartao ?? '',
      pagamento: pago.pagamento ?? pago.dataPagamento ?? original.pagamento ?? '',
      dataPagamento: pago.dataPagamento ?? pago.pagamento ?? original.dataPagamento ?? '',
      formaPagamento: pago.formaPagamento ?? original.formaPagamento ?? '',
      caixaId: pago.caixaId ?? original.caixaId ?? '',
      movimentoCaixaId: pago.movimentoCaixaId ?? original.movimentoCaixaId ?? '',
      atualizadoEm: new Date().toISOString()
    };
  }

  original.descricao = original.descricao || `Matrícula inicial - ${mensalidade.alunoNome || mensalidade.aluno || mensalidade.alunoId || ''}`;
  original.categoria = 'Matrículas';
  original.origem = 'matricula_inicial';
  original.valor = Number(mensalidade.total ?? mensalidade.valorTotalInicial ?? original.valor ?? mensalidade.valor ?? 0);
  original.valorBruto = original.valor;
  original.total = original.valor;

  financeiro = financeiro
    .filter(f => !(String(f.mensalidadeId || '') === String(mensalidade.id) && String(f.id) !== String(original.id)))
    .map(f => String(f.id) === String(original.id) ? original : f);

  mensalidade.lancamentoFinanceiroId = original.id;
  mensalidade.financeiroInicialId = original.id;
  corrigidas += 1;
  removidos += duplicados.length;
}

await salvarJson(MENSALIDADES_FILE, mensalidades);
await salvarJson(FINANCEIRO_FILE, financeiro);

console.log(JSON.stringify({ ok: true, corrigidas, duplicadosRemovidos: removidos }, null, 2));
