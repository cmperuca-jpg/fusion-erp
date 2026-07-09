import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const PAGAMENTOS_PATH = path.join(DATA_DIR, "pagamentos.json");
const FINANCEIRO_PATH = path.join(DATA_DIR, "financeiro.json");
const CAIXA_PATH = path.join(DATA_DIR, "caixa.json");

async function garantirArquivo(filePath, padrao) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(padrao, null, 2), "utf8");
  }
}

async function lerJson(filePath, padrao) {
  await garantirArquivo(filePath, padrao);
  const raw = await fs.readFile(filePath, "utf8").catch(() => "");
  if (!raw.trim()) return padrao;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(filePath, dados) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(dados, null, 2), "utf8");
  return dados;
}

function listaDe(dados, chave = "pagamentos") {
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.[chave])) return dados[chave];
  if (Array.isArray(dados?.lancamentos)) return dados.lancamentos;
  return [];
}

function idItem(item = {}) {
  return String(item.id || item._id || item.codigo || item.uuid || item.chave || "");
}

function isPagar(item = {}) {
  const alvo = String([
    item.tipo,
    item.natureza,
    item.conta,
    item.modulo,
    item.origem,
    item.categoria
  ].filter(Boolean).join(" ")).toLowerCase();

  return alvo.includes("pagar") || alvo.includes("pagamento") || alvo.includes("despesa") || alvo.includes("fornecedor");
}

function deduplicarPorId(lista = []) {
  const ids = new Set();
  return lista.filter((item) => {
    const id = idItem(item);
    if (!id) return true;
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

export async function resolverDbPath() {
  await garantirArquivo(DB_PATH, { pagamentos: [], lancamentosFinanceiros: [], caixaMovimentos: [] });
  return DB_PATH;
}

export async function lerDb() {
  const db = await lerJson(DB_PATH, { pagamentos: [], lancamentosFinanceiros: [], caixaMovimentos: [] });
  if (!Array.isArray(db.pagamentos)) db.pagamentos = [];
  if (!Array.isArray(db.lancamentosFinanceiros)) db.lancamentosFinanceiros = [];
  if (!Array.isArray(db.caixaMovimentos)) db.caixaMovimentos = [];
  return { db, filePath: DB_PATH };
}

export async function salvarDb(db, filePath = DB_PATH) {
  return salvarJson(filePath, db);
}

async function lerPagamentosArquivo() {
  const dados = await lerJson(PAGAMENTOS_PATH, []);
  return listaDe(dados, "pagamentos");
}

async function salvarPagamentosArquivo(lista) {
  return salvarJson(PAGAMENTOS_PATH, lista);
}

async function lerFinanceiroArquivo() {
  const dados = await lerJson(FINANCEIRO_PATH, []);
  return listaDe(dados, "lancamentos");
}

async function salvarFinanceiroArquivo(lista) {
  return salvarJson(FINANCEIRO_PATH, lista);
}

export async function listarPagamentosRaw() {
  const [{ db }, pagamentosArquivo, financeiroArquivo] = await Promise.all([
    lerDb(),
    lerPagamentosArquivo(),
    lerFinanceiroArquivo()
  ]);

  const pagamentosDb = Array.isArray(db.pagamentos) ? db.pagamentos : [];
  const lancamentosDb = Array.isArray(db.lancamentosFinanceiros) ? db.lancamentosFinanceiros.filter(isPagar) : [];
  const lancamentosFinanceiros = financeiroArquivo.filter(isPagar);

  return deduplicarPorId([
    ...pagamentosArquivo,
    ...pagamentosDb,
    ...lancamentosDb,
    ...lancamentosFinanceiros
  ]);
}

function upsert(lista, item) {
  const id = idItem(item);
  if (!id) return [...lista, item];
  const idx = lista.findIndex((atual) => idItem(atual) === id);
  if (idx >= 0) {
    const nova = [...lista];
    nova[idx] = { ...nova[idx], ...item };
    return nova;
  }
  return [...lista, item];
}

export async function inserirPagamentoRaw(pagamento) {
  const item = { ...pagamento, tipo: pagamento.tipo || "pagar", natureza: pagamento.natureza || "pagar", modulo: pagamento.modulo || "pagamentos" };

  const pagamentos = await lerPagamentosArquivo();
  await salvarPagamentosArquivo(upsert(pagamentos, item));

  const financeiro = await lerFinanceiroArquivo();
  await salvarFinanceiroArquivo(upsert(financeiro, item));

  const { db, filePath } = await lerDb();
  db.pagamentos = upsert(db.pagamentos, item);
  db.lancamentosFinanceiros = upsert(db.lancamentosFinanceiros, item);
  await salvarDb(db, filePath);

  return item;
}

export async function atualizarPagamentoRaw(id, updater) {
  const idStr = String(id);
  let atualizado = null;

  const atualizarLista = (lista = [], somentePagar = false) => {
    return lista.map((item) => {
      if (idItem(item) !== idStr) return item;
      if (somentePagar && !isPagar(item)) return item;
      atualizado = updater(item);
      return atualizado;
    });
  };

  const pagamentos = atualizarLista(await lerPagamentosArquivo());
  await salvarPagamentosArquivo(pagamentos);

  const financeiro = atualizarLista(await lerFinanceiroArquivo(), true);
  await salvarFinanceiroArquivo(financeiro);

  const { db, filePath } = await lerDb();
  db.pagamentos = atualizarLista(db.pagamentos);
  db.lancamentosFinanceiros = atualizarLista(db.lancamentosFinanceiros, true);
  await salvarDb(db, filePath);

  if (!atualizado) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }

  return atualizado;
}

export async function removerPagamentoRaw(id) {
  const idStr = String(id);
  let removido = false;
  const remover = (lista = [], somentePagar = false) => lista.filter((item) => {
    if (idItem(item) !== idStr) return true;
    if (somentePagar && !isPagar(item)) return true;
    removido = true;
    return false;
  });

  await salvarPagamentosArquivo(remover(await lerPagamentosArquivo()));
  await salvarFinanceiroArquivo(remover(await lerFinanceiroArquivo(), true));

  const { db, filePath } = await lerDb();
  db.pagamentos = remover(db.pagamentos);
  db.lancamentosFinanceiros = remover(db.lancamentosFinanceiros, true);
  await salvarDb(db, filePath);

  if (!removido) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }

  return { id: idStr, removido: true };
}

export async function registrarMovimentoCaixa(movimento) {
  const caixa = await lerJson(CAIXA_PATH, { caixas: [], movimentos: [] });
  if (Array.isArray(caixa)) {
    caixa.push(movimento);
    await salvarJson(CAIXA_PATH, caixa);
  } else {
    if (!Array.isArray(caixa.movimentos)) caixa.movimentos = [];
    caixa.movimentos.push(movimento);
    await salvarJson(CAIXA_PATH, caixa);
  }

  const { db, filePath } = await lerDb();
  if (!Array.isArray(db.caixaMovimentos)) db.caixaMovimentos = [];
  db.caixaMovimentos.push(movimento);
  await salvarDb(db, filePath);

  return movimento;
}
