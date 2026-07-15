import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DATABASE_CONFIG } from "../../../config/database.config.mjs";
import { obterSupabaseAdmin } from "../../../config/supabase.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TABLE = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
const WRITE_MODE = String(process.env.FUSION_PERSISTENCE_WRITE_MODE || "primary").toLowerCase();

function nomeColecao(valor = "") {
  return path.basename(String(valor)).replace(/\.json$/i, "").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}
function arquivoColecao(colecao) { return path.join(DATA_DIR, `${nomeColecao(colecao)}.json`); }
function idRegistro(item = {}) { return String(item.id || item.uuid || item.codigo || crypto.randomUUID()); }

async function lerJson(colecao, fallback = []) {
  const arquivo = arquivoColecao(colecao);
  try {
    const raw = await fs.readFile(arquivo, "utf8");
    const dados = raw.trim() ? JSON.parse(raw) : fallback;
    return dados ?? fallback;
  } catch (erro) {
    if (erro?.code !== "ENOENT") throw erro;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}
async function salvarJson(colecao, dados) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(arquivoColecao(colecao), JSON.stringify(dados, null, 2), "utf8");
  return dados;
}
async function lerSupabase(colecao) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase.from(TABLE).select("record_id,payload").eq("collection", nomeColecao(colecao)).order("updated_at", { ascending: true });
  if (error) throw new Error(`Falha ao ler ${colecao} no Supabase: ${error.message}`);
  return (data || []).map(row => ({ ...(row.payload || {}), id: row.payload?.id || row.record_id }));
}
async function salvarSupabase(colecao, dados = []) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const collection = nomeColecao(colecao);
  const lista = Array.isArray(dados) ? dados : [];
  const linhas = lista.map(item => {
    const id = idRegistro(item);
    return { collection, record_id: id, payload: { ...item, id }, updated_at: new Date().toISOString() };
  });
  const { error: delError } = await supabase.from(TABLE).delete().eq("collection", collection);
  if (delError) throw new Error(`Falha ao sincronizar ${collection}: ${delError.message}`);
  for (let i = 0; i < linhas.length; i += 250) {
    const { error } = await supabase.from(TABLE).upsert(linhas.slice(i, i + 250), { onConflict: "collection,record_id" });
    if (error) throw new Error(`Falha ao gravar ${collection}: ${error.message}`);
  }
  return lista;
}

export function persistenciaAtiva() { return DATABASE_CONFIG.provider; }
export async function lerColecao(colecao, fallback = []) {
  if (DATABASE_CONFIG.provider !== "supabase") return lerJson(colecao, fallback);
  try {
    const dados = await lerSupabase(colecao);
    if (dados.length || !DATABASE_CONFIG.jsonFallbackEnabled) return dados;
    return lerJson(colecao, fallback);
  } catch (erro) {
    if (!DATABASE_CONFIG.jsonFallbackEnabled) throw erro;
    console.warn(`[Persistência V3] ${erro.message}; usando JSON para ${nomeColecao(colecao)}.`);
    return lerJson(colecao, fallback);
  }
}
export async function salvarColecao(colecao, dados) {
  if (DATABASE_CONFIG.provider !== "supabase") return salvarJson(colecao, dados);
  if (WRITE_MODE === "mirror" || WRITE_MODE === "dual") await salvarJson(colecao, dados);
  try { return await salvarSupabase(colecao, dados); }
  catch (erro) {
    if (!DATABASE_CONFIG.jsonFallbackEnabled) throw erro;
    console.warn(`[Persistência V3] ${erro.message}; gravando JSON de contingência.`);
    return salvarJson(colecao, dados);
  }
}
export async function migrarColecaoJsonParaSupabase(colecao) {
  const dados = await lerJson(colecao, []);
  await salvarSupabase(colecao, dados);
  return { colecao: nomeColecao(colecao), registros: Array.isArray(dados) ? dados.length : 0 };
}
