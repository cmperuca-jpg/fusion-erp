import pg from "pg";
import { DATABASE_CONFIG } from "./database.config.mjs";

const { Pool } = pg;
let pool = null;

function inteiro(valor, padrao, minimo, maximo) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(maximo, Math.max(minimo, Math.trunc(n)));
}

export function tabelaRegistrosSql() {
  const nome = String(DATABASE_CONFIG.recordsTable || "fusion_v3_records").trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome)) {
    throw new Error("Nome da tabela PostgreSQL inválido.");
  }
  return `public."${nome}"`;
}

export function obterPostgresPool({ obrigatorio = false } = {}) {
  if (DATABASE_CONFIG.provider !== "postgres") {
    if (obrigatorio) throw new Error("Provider PostgreSQL não está ativo.");
    return null;
  }

  if (!pool) {
    const config = {
      host: process.env.FUSION_POSTGRES_HOST || "/var/run/postgresql",
      port: inteiro(process.env.FUSION_POSTGRES_PORT, 5432, 1, 65535),
      database: process.env.FUSION_POSTGRES_DATABASE || "fusion_erp",
      user: process.env.FUSION_POSTGRES_USER || "fusion",
      max: inteiro(process.env.FUSION_POSTGRES_POOL_MAX, 10, 1, 30),
      idleTimeoutMillis: inteiro(process.env.FUSION_POSTGRES_IDLE_MS, 30000, 1000, 300000),
      connectionTimeoutMillis: inteiro(process.env.FUSION_POSTGRES_CONNECT_MS, 5000, 1000, 30000),
      application_name: "fusion-erp"
    };

    const senha = String(process.env.FUSION_POSTGRES_PASSWORD || "");
    if (senha) config.password = senha;

    pool = new Pool(config);
    pool.on("error", (erro) => {
      console.error(`[PostgreSQL] Erro em conexão ociosa: ${erro.message}`);
    });
  }

  return pool;
}

export async function testarPostgres() {
  const db = obterPostgresPool({ obrigatorio: true });
  const tabela = tabelaRegistrosSql();
  const { rows } = await db.query(`SELECT count(*)::int AS registros FROM ${tabela}`);
  return {
    ok: true,
    provider: "postgres",
    database: process.env.FUSION_POSTGRES_DATABASE || "fusion_erp",
    registros: Number(rows?.[0]?.registros || 0)
  };
}

export async function encerrarPostgres() {
  if (!pool) return;
  const atual = pool;
  pool = null;
  await atual.end();
}
