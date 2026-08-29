import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DATABASE_CONFIG } from "../../../config/database.config.mjs";
import { obterSupabaseAdmin } from "../../../config/supabase.mjs";
import { obterPostgresPool, tabelaRegistrosSql } from "../../../config/postgres.mjs";
import { normalizarTenantId, tenantAtual, tenantPadrao } from "./tenant-context.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TABLE = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
const WRITE_MODE = String(process.env.FUSION_PERSISTENCE_WRITE_MODE || "primary").toLowerCase();

function tenantId() { return tenantAtual(); }

function nomeColecao(valor = "") {
  return path.basename(String(valor))
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();
}

function tenantJsonAtual() {
  return normalizarTenantId(tenantId()) || tenantPadrao();
}

function arquivoColecao(colecao) {
  const nomeArquivo = `${nomeColecao(colecao)}.json`;
  const tenant = tenantJsonAtual();
  const padrao = tenantPadrao();
  if (!tenant || tenant === padrao) return path.join(DATA_DIR, nomeArquivo);
  return path.join(DATA_DIR, "tenants", tenant, nomeArquivo);
}

function idRegistro(item = {}) {
  return String(item.id || item.uuid || item.codigo || item.chave || crypto.randomUUID());
}

function fallbackPermitido() {
  return DATABASE_CONFIG.jsonFallbackEnabled && process.env.NODE_ENV !== "production";
}

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
  const destino = arquivoColecao(colecao);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  const temporario = `${destino}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporario, JSON.stringify(dados, null, 2), "utf8");
  await fs.rename(temporario, destino);
  return dados;
}

function normalizarLista(dados = []) {
  if (!Array.isArray(dados)) {
    return [{ id: "__document__", __fusion_document__: dados }];
  }

  return dados.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return item.id || item.uuid || item.codigo || item.chave
      ? item
      : { ...item, id: idRegistro(item) };
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
  if (
    linhas.length === 1 &&
    linhas[0].record_id === "__document__" &&
    Object.hasOwn(linhas[0].payload || {}, "__fusion_document__")
  ) {
    return linhas[0].payload.__fusion_document__;
  }

  return linhas.map((row) => ({
    ...(row.payload || {}),
    id: row.payload?.id || row.record_id
  }));
}

async function salvarSupabaseAtomico(colecoes, operacaoId) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const payload = {};

  for (const [nome, dados] of Object.entries(colecoes || {})) {
    payload[nomeColecao(nome)] = normalizarLista(dados);
  }

  const { data, error } = await supabase.rpc("fusion_replace_collections", {
    p_tenant_id: tenantId(),
    p_collections: payload,
    p_operation_id: operacaoId
  });

  if (error) throw new Error(`Falha na transação Supabase: ${error.message}`);
  return data;
}

function linhasPostgres(dados) {
  return normalizarLista(dados).map((item, position) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("PostgreSQL exige registros JSON em formato de objeto.");
    }

    const recordId = String(
      item.id || item.uuid || item.codigo || item.chave || crypto.randomUUID()
    );

    return { record_id: recordId, payload: item, position };
  });
}

async function lerPostgres(colecao) {
  const db = obterPostgresPool({ obrigatorio: true });
  const tabela = tabelaRegistrosSql();

  const { rows } = await db.query(
    `SELECT record_id, payload
       FROM ${tabela}
      WHERE tenant_id = $1
        AND collection = $2
      ORDER BY position ASC, updated_at ASC, record_id ASC`,
    [tenantId(), nomeColecao(colecao)]
  );

  if (
    rows.length === 1 &&
    rows[0].record_id === "__document__" &&
    Object.hasOwn(rows[0].payload || {}, "__fusion_document__")
  ) {
    return rows[0].payload.__fusion_document__;
  }

  return rows.map((row) => ({
    ...(row.payload || {}),
    id: row.payload?.id || row.record_id
  }));
}

async function salvarPostgresAtomico(colecoes, operacaoId) {
  const db = obterPostgresPool({ obrigatorio: true });
  const tabela = tabelaRegistrosSql();
  const client = await db.connect();
  const tenant = tenantId();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [tenant]);

    for (const [nome, dados] of Object.entries(colecoes || {})) {
      const collection = nomeColecao(nome);
      const linhas = linhasPostgres(dados);

      await client.query(
        `DELETE FROM ${tabela}
          WHERE tenant_id = $1
            AND collection = $2`,
        [tenant, collection]
      );

      if (!linhas.length) continue;

      const atualizadoEm = new Date().toISOString();
      const payloadJson = JSON.stringify(linhas);

      await client.query(
        `INSERT INTO ${tabela}
          (tenant_id, collection, record_id, payload, updated_at, position)
         SELECT
           $1,
           $2,
           item.record_id,
           item.payload,
           $4::timestamptz,
           item.position
         FROM jsonb_to_recordset($3::jsonb)
           AS item(record_id text, payload jsonb, position integer)`,
        [tenant, collection, payloadJson, atualizadoEm]
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      provider: "postgres",
      operacaoId,
      colecoes: Object.keys(colecoes || {}).length
    };
  } catch (erro) {
    try { await client.query("ROLLBACK"); } catch {}
    throw erro;
  } finally {
    client.release();
  }
}

export function persistenciaAtiva() {
  return DATABASE_CONFIG.provider;
}

export async function verificarPersistenciaTransacional() {
  if (DATABASE_CONFIG.provider === "json") {
    return { ok: true, provider: "json" };
  }

  if (DATABASE_CONFIG.provider === "postgres") {
    const db = obterPostgresPool({ obrigatorio: true });
    const tabela = tabelaRegistrosSql();

    await db.query(
      `SELECT record_id
         FROM ${tabela}
        WHERE tenant_id = $1
        LIMIT 1`,
      [tenantId()]
    );

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [tenantId()]);
      await client.query("ROLLBACK");
    } catch (erro) {
      try { await client.query("ROLLBACK"); } catch {}
      throw new Error(`Persistência PostgreSQL indisponível: ${erro.message}`);
    } finally {
      client.release();
    }

    return {
      ok: true,
      provider: "postgres",
      tenantId: tenantId(),
      tabela: DATABASE_CONFIG.recordsTable
    };
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { error: tabelaErro } = await supabase
    .from(TABLE)
    .select("tenant_id,record_id", { head: true, count: "exact" })
    .eq("tenant_id", tenantId());

  if (tabelaErro) {
    throw new Error(`Migração V4 ausente ou inválida: ${tabelaErro.message}`);
  }

  const operacaoId = `health-${process.env.RENDER_INSTANCE_ID || process.pid}-${Date.now()}`;
  const { error: rpcErro } = await supabase.rpc("fusion_replace_collections", {
    p_tenant_id: tenantId(),
    p_collections: {},
    p_operation_id: operacaoId
  });

  if (rpcErro) {
    throw new Error(`Função transacional do Supabase indisponível: ${rpcErro.message}`);
  }

  return {
    ok: true,
    provider: "supabase",
    tenantId: tenantId(),
    tabela: TABLE
  };
}

export async function lerColecao(colecao, fallback = []) {
  if (DATABASE_CONFIG.provider === "json") {
    return lerJson(colecao, fallback);
  }

  try {
    if (DATABASE_CONFIG.provider === "postgres") {
      return await lerPostgres(colecao);
    }
    return await lerSupabase(colecao);
  } catch (erro) {
    if (!fallbackPermitido()) throw erro;
    console.warn(
      `[Persistência] ${erro.message}; ambiente local usando JSON para ${nomeColecao(colecao)}.`
    );
    return lerJson(colecao, fallback);
  }
}

export async function salvarColecoesAtomicas(
  colecoes,
  { operacaoId = crypto.randomUUID() } = {}
) {
  const entradas = Object.entries(colecoes || {});
  if (!entradas.length) return { ok: true, operacaoId, colecoes: 0 };

  if (DATABASE_CONFIG.provider === "json") {
    for (const [nome, dados] of entradas) await salvarJson(nome, dados);
    return { ok: true, provider: "json", operacaoId, colecoes: entradas.length };
  }

  try {
    if (DATABASE_CONFIG.provider === "postgres") {
      return await salvarPostgresAtomico(Object.fromEntries(entradas), operacaoId);
    }

    const resultado = await salvarSupabaseAtomico(
      Object.fromEntries(entradas),
      operacaoId
    );

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
  await salvarSupabaseAtomico(
    { [nomeColecao(colecao)]: dados },
    `migracao-${nomeColecao(colecao)}-${crypto.randomUUID()}`
  );
  return {
    colecao: nomeColecao(colecao),
    registros: Array.isArray(dados) ? dados.length : 0
  };
}

export async function migrarTodosJsonParaSupabase(
  { operacaoId = "bootstrap-json-v4" } = {}
) {
  const itens = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const colecoes = {};
  const contagens = {};

  for (const item of itens.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
    const colecao = nomeColecao(item.name);
    const dados = await lerJson(colecao, []);
    colecoes[colecao] = dados;
    contagens[colecao] = Array.isArray(dados) ? dados.length : 1;
  }

  const resultado = await salvarSupabaseAtomico(colecoes, operacaoId);
  return {
    ok: true,
    operacaoId,
    totalColecoes: Object.keys(colecoes).length,
    contagens,
    resultado
  };
}
