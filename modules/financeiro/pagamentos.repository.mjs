import path from "path";
import { lerJsonDuravel, salvarJsonDuravel, salvarJsonMultiplosAtomico, executarTransacaoJson } from "../core/persistence/durable-json.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const PAGAMENTOS_PATH = path.join(DATA_DIR, "pagamentos.json");
const FINANCEIRO_PATH = path.join(DATA_DIR, "financeiro.json");
const CAIXA_PATH = path.join(DATA_DIR, "caixa.json");

async function lerJson(filePath, padrao) {
  return lerJsonDuravel(filePath, padrao);
}

async function salvarJson(filePath, dados) {
  return salvarJsonDuravel(filePath, dados);
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

async function inserirPagamentoRawInterno(pagamento) {
  const item = { ...pagamento, tipo: pagamento.tipo || "pagar", natureza: pagamento.natureza || "pagar", modulo: pagamento.modulo || "pagamentos" };

  const pagamentos = upsert(await lerPagamentosArquivo(), item);
  const financeiro = upsert(await lerFinanceiroArquivo(), item);
  const { db, filePath } = await lerDb();
  db.pagamentos = upsert(db.pagamentos, item);
  db.lancamentosFinanceiros = upsert(db.lancamentosFinanceiros, item);
  await salvarJsonMultiplosAtomico({ [PAGAMENTOS_PATH]: pagamentos, [FINANCEIRO_PATH]: financeiro, [filePath]: db });

  return item;
}
export async function inserirPagamentoRaw(pagamento) {
  return executarTransacaoJson(() => inserirPagamentoRawInterno(pagamento), { operacaoId: `pagamento-inserir-${idItem(pagamento) || Date.now()}` });
}

async function atualizarPagamentoRawInterno(id, updater) {
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
  const financeiro = atualizarLista(await lerFinanceiroArquivo(), true);

  const { db, filePath } = await lerDb();
  db.pagamentos = atualizarLista(db.pagamentos);
  db.lancamentosFinanceiros = atualizarLista(db.lancamentosFinanceiros, true);

  if (!atualizado) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }

  await salvarJsonMultiplosAtomico({ [PAGAMENTOS_PATH]: pagamentos, [FINANCEIRO_PATH]: financeiro, [filePath]: db });

  return atualizado;
}
export async function atualizarPagamentoRaw(id, updater) {
  return executarTransacaoJson(() => atualizarPagamentoRawInterno(id, updater), { operacaoId: `pagamento-atualizar-${id}-${Date.now()}` });
}

async function removerPagamentoRawInterno(id) {
  const idStr = String(id);
  let removido = false;
  const remover = (lista = [], somentePagar = false) => lista.filter((item) => {
    if (idItem(item) !== idStr) return true;
    if (somentePagar && !isPagar(item)) return true;
    removido = true;
    return false;
  });

  const pagamentos = remover(await lerPagamentosArquivo());
  const financeiro = remover(await lerFinanceiroArquivo(), true);

  const { db, filePath } = await lerDb();
  db.pagamentos = remover(db.pagamentos);
  db.lancamentosFinanceiros = remover(db.lancamentosFinanceiros, true);

  if (!removido) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }


  await salvarJsonMultiplosAtomico({ [PAGAMENTOS_PATH]: pagamentos, [FINANCEIRO_PATH]: financeiro, [filePath]: db });

  return { id: idStr, removido: true };
}
export async function removerPagamentoRaw(id) {
  return executarTransacaoJson(() => removerPagamentoRawInterno(id), { operacaoId: `pagamento-remover-${id}-${Date.now()}` });
}

async function registrarMovimentoCaixaInterno(movimento) {
  const caixa = await lerJson(CAIXA_PATH, { caixas: [], movimentos: [] });
  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);
  let movimentoCaixa = {
    ...movimento,
    data: String(movimento.data || hoje).slice(0, 10),
    status: movimento.status || "ativo",
    criadoEm: movimento.criadoEm || agora,
    atualizadoEm: agora
  };

  if (Array.isArray(caixa)) {
    caixa.push(movimentoCaixa);
  } else {
    if (!Array.isArray(caixa.caixas)) caixa.caixas = [];
    if (!Array.isArray(caixa.movimentos)) caixa.movimentos = [];

    let aberto = caixa.caixas.find((item) => String(item.status || "").toLowerCase() === "aberto");
    if (!aberto) {
      aberto = {
        id: `cx_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        dataAbertura: hoje,
        valorAbertura: 0,
        responsavel: "Administrador",
        observacaoAbertura: "Caixa aberto automaticamente pela baixa de pagamento.",
        status: "aberto",
        abertoEm: agora,
        fechadoEm: "",
        valorFechamentoInformado: null,
        diferenca: null,
        observacaoFechamento: ""
      };
      caixa.caixas.push(aberto);
    }

    movimentoCaixa = {
      ...movimentoCaixa,
      caixaId: movimentoCaixa.caixaId || aberto.id,
      pessoa: movimentoCaixa.pessoa || movimentoCaixa.fornecedor || movimentoCaixa.credor || ""
    };
    caixa.movimentos.push(movimentoCaixa);
  }

  const { db, filePath } = await lerDb();
  if (!Array.isArray(db.caixaMovimentos)) db.caixaMovimentos = [];
  db.caixaMovimentos.push(movimentoCaixa);
  await salvarJsonMultiplosAtomico({ [CAIXA_PATH]: caixa, [filePath]: db });

  return movimentoCaixa;
}
export async function registrarMovimentoCaixa(movimento) {
  return executarTransacaoJson(() => registrarMovimentoCaixaInterno(movimento), { operacaoId: `caixa-movimento-${idItem(movimento) || Date.now()}` });
}
