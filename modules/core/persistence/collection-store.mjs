import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DATABASE_CONFIG } from "../../../config/database.config.mjs";
import { obterSupabaseAdmin } from "../../../config/supabase.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TABLE = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
const WRITE_MODE = String(process.env.FUSION_PERSISTENCE_WRITE_MODE || "primary").toLowerCase();

function tenantId() {
  return String(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto")
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "academia-piloto";
}

function nomeColecao(valor = "") {
  return path.basename(String(valor)).replace(/\.json$/i, "").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}

function arquivoColecao(colecao) { return path.join(DATA_DIR, `${nomeColecao(colecao)}.json`); }
function idRegistro(item = {}) { return String(item.id || item.uuid || item.codigo || item.chave || crypto.randomUUID()); }
function fallbackPermitido() { return DATABASE_CONFIG.jsonFallbackEnabled && process.env.NODE_ENV !== "production"; }

async function lerJson(colecao, fallback = []) {
  const arquivo = arquivoColecao(colecao);
  try {
    const raw = await fs.readFile(arquivo, "utf8");
    return raw.trim() ? (JSON.parse(raw) ?? fallback) : fallback;
  } catch (erro) {
    if (erro?.code !== "ENOENT") throw erro;
    await salvarJson(colecao, fallback);
    return fallback;
  }
}

async function salvarJson(colecao, dados) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const destino = arquivoColecao(colecao);
  const temporario = `${destino}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporario, JSON.stringify(dados, null, 2), "utf8");
  await fs.rename(temporario, destino);
  return dados;
}

function normalizarLista(dados = []) {
  if (!Array.isArray(dados)) return [{ id: "__document__", __fusion_document__: dados }];
  return dados.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return item.id || item.uuid || item.codigo || item.chave ? item : { ...item, id: idRegistro(item) };
  });
}

async function lerSupabase(colecao) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from(TABLE)
    .select("record_id,payload")
    .eq("tenant_id", tenantId())
    .eq("collection", nomeColecao(colecao))
    .order("updated_at", { ascending: true });
  if (error) throw new Error(`Falha ao ler ${colecao} no Supabase: ${error.message}`);
  const linhas = data || [];
  if (linhas.length === 1 && linhas[0].record_id === "__document__" && Object.hasOwn(linhas[0].payload || {}, "__fusion_document__")) {
    return linhas[0].payload.__fusion_document__;
  }
  return linhas.map(row => ({ ...(row.payload || {}), id: row.payload?.id || row.record_id }));
}

async function salvarSupabaseAtomico(colecoes, operacaoId) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const payload = {};
  for (const [nome, dados] of Object.entries(colecoes || {})) payload[nomeColecao(nome)] = normalizarLista(dados);
  const { data, error } = await supabase.rpc("fusion_replace_collections", {
    p_tenant_id: tenantId(),
    p_collections: payload,
    p_operation_id: operacaoId
  });
  if (error) throw new Error(`Falha na transação Supabase: ${error.message}`);
  return data;
}

export function persistenciaAtiva() { return DATABASE_CONFIG.provider; }

export async function verificarPersistenciaTransacional() {
  if (DATABASE_CONFIG.provider !== "supabase") return { ok: true, provider: "json" };
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { error: tabelaErro } = await supabase.from(TABLE).select("tenant_id,record_id", { head: true, count: "exact" }).eq("tenant_id", tenantId());
  if (tabelaErro) throw new Error(`Migração V4 ausente ou inválida: ${tabelaErro.message}`);
  const operacaoId = `health-${process.env.RENDER_INSTANCE_ID || process.pid}-${Date.now()}`;
  const { error: rpcErro } = await supabase.rpc("fusion_replace_collections", {
    p_tenant_id: tenantId(), p_collections: {}, p_operation_id: operacaoId
  });
  if (rpcErro) throw new Error(`Função transacional do Supabase indisponível: ${rpcErro.message}`);
  return { ok: true, provider: "supabase", tenantId: tenantId(), tabela: TABLE };
}

export async function lerColecao(colecao, fallback = []) {
  if (DATABASE_CONFIG.provider !== "supabase") return lerJson(colecao, fallback);
  try { return await lerSupabase(colecao); }
  catch (erro) {
    if (!fallbackPermitido()) throw erro;
    console.warn(`[Persistência] ${erro.message}; ambiente local usando JSON para ${nomeColecao(colecao)}.`);
    return lerJson(colecao, fallback);
  }
}

export async function salvarColecoesAtomicas(colecoes, { operacaoId = crypto.randomUUID() } = {}) {
  const entradas = Object.entries(colecoes || {});
  if (!entradas.length) return { ok: true, operacaoId, colecoes: 0 };
  if (DATABASE_CONFIG.provider !== "supabase") {
    for (const [nome, dados] of entradas) await salvarJson(nome, dados);
    return { ok: true, provider: "json", operacaoId, colecoes: entradas.length };
  }
  try {
    const resultado = await salvarSupabaseAtomico(Object.fromEntries(entradas), operacaoId);
    if (WRITE_MODE === "mirror" || WRITE_MODE === "dual") {
      for (const [nome, dados] of entradas) await salvarJson(nome, dados);
    }
    return { ok: true, provider: "supabase", operacaoId, resultado };
  } catch (erro) {
    if (!fallbackPermitido()) throw erro;
    console.warn(`[Persistência] ${erro.message}; ambiente local gravando JSON.`);
    for (const [nome, dados] of entradas) await salvarJson(nome, dados);
    return { ok: true, provider: "json-contingencia", operacaoId };
  }
}

export async function salvarColecao(colecao, dados, opcoes = {}) {
  await salvarColecoesAtomicas({ [nomeColecao(colecao)]: dados }, opcoes);
  return dados;
}

export async function migrarColecaoJsonParaSupabase(colecao) {
  const dados = await lerJson(colecao, []);
  await salvarSupabaseAtomico({ [nomeColecao(colecao)]: dados }, `migracao-${nomeColecao(colecao)}-${crypto.randomUUID()}`);
  return { colecao: nomeColecao(colecao), registros: Array.isArray(dados) ? dados.length : 0 };
}

export async function migrarTodosJsonParaSupabase({ operacaoId = "bootstrap-json-v4" } = {}) {
  const itens = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const colecoes = {};
  const contagens = {};
  for (const item of itens.filter(item => item.isFile() && item.name.endsWith(".json"))) {
    const colecao = nomeColecao(item.name);
    const dados = await lerJson(colecao, []);
    colecoes[colecao] = dados;
    contagens[colecao] = Array.isArray(dados) ? dados.length : 1;
  }
  const resultado = await salvarSupabaseAtomico(colecoes, operacaoId);
  return { ok: true, operacaoId, totalColecoes: Object.keys(colecoes).length, contagens, resultado };
}
