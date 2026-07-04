import fs from "fs/promises";
import path from "path";

const DB_PATHS = [
  path.resolve(process.cwd(), "data", "db.json"),
  path.resolve(process.cwd(), "db.json")
];

async function pathExiste(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

export async function resolverDbPath() {
  for (const filePath of DB_PATHS) {
    if (await pathExiste(filePath)) return filePath;
  }
  await fs.mkdir(path.dirname(DB_PATHS[0]), { recursive: true });
  await fs.writeFile(DB_PATHS[0], JSON.stringify({ pagamentos: [], lancamentosFinanceiros: [], caixaMovimentos: [] }, null, 2));
  return DB_PATHS[0];
}

export async function lerDb() {
  const filePath = await resolverDbPath();
  const raw = await fs.readFile(filePath, "utf8").catch(() => "{}");
  let db;
  try { db = JSON.parse(raw || "{}"); } catch { db = {}; }
  if (!Array.isArray(db.pagamentos)) db.pagamentos = [];
  if (!Array.isArray(db.lancamentosFinanceiros)) db.lancamentosFinanceiros = [];
  if (!Array.isArray(db.caixaMovimentos)) db.caixaMovimentos = [];
  return { db, filePath };
}

export async function salvarDb(db, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(db, null, 2));
  return db;
}

function idItem(item = {}) {
  return String(item.id || item._id || item.codigo || item.uuid || item.chave || "");
}

function isPagar(item = {}) {
  return item?.tipo === "pagar" || item?.natureza === "pagar" || item?.conta === "pagar" || item?.modulo === "pagamentos";
}

export async function listarPagamentosRaw() {
  const { db } = await lerDb();
  const pagamentos = Array.isArray(db.pagamentos) ? db.pagamentos : [];
  const lancamentos = Array.isArray(db.lancamentosFinanceiros) ? db.lancamentosFinanceiros.filter(isPagar) : [];
  const ids = new Set();
  return [...pagamentos, ...lancamentos].filter((item) => {
    const id = idItem(item);
    if (!id) return true;
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

export async function inserirPagamentoRaw(pagamento) {
  const { db, filePath } = await lerDb();
  db.pagamentos.push(pagamento);
  db.lancamentosFinanceiros.push({ ...pagamento, tipo: "pagar", natureza: "pagar", modulo: "pagamentos" });
  await salvarDb(db, filePath);
  return pagamento;
}

export async function atualizarPagamentoRaw(id, updater) {
  const { db, filePath } = await lerDb();
  const idStr = String(id);
  const atualizarLista = (lista = []) => {
    let alterado = null;
    const nova = lista.map((item) => {
      if (idItem(item) !== idStr) return item;
      const atualizado = updater(item);
      alterado = atualizado;
      return atualizado;
    });
    return { nova, alterado };
  };

  let r = atualizarLista(db.pagamentos);
  db.pagamentos = r.nova;
  let atualizado = r.alterado;

  r = atualizarLista(db.lancamentosFinanceiros);
  db.lancamentosFinanceiros = r.nova;
  atualizado = atualizado || r.alterado;

  if (!atualizado) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }

  await salvarDb(db, filePath);
  return atualizado;
}

export async function removerPagamentoRaw(id) {
  const { db, filePath } = await lerDb();
  const idStr = String(id);
  const antes = db.pagamentos.length + db.lancamentosFinanceiros.length;
  db.pagamentos = db.pagamentos.filter((item) => idItem(item) !== idStr);
  db.lancamentosFinanceiros = db.lancamentosFinanceiros.filter((item) => idItem(item) !== idStr);
  const depois = db.pagamentos.length + db.lancamentosFinanceiros.length;
  if (antes === depois) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }
  await salvarDb(db, filePath);
  return { id: idStr, removido: true };
}

export async function registrarMovimentoCaixa(movimento) {
  const { db, filePath } = await lerDb();
  if (!Array.isArray(db.caixaMovimentos)) db.caixaMovimentos = [];
  db.caixaMovimentos.push(movimento);
  await salvarDb(db, filePath);
  return movimento;
}
