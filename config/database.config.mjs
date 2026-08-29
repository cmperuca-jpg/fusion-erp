const providerRequested = String(process.env.FUSION_DATABASE_PROVIDER || "auto").toLowerCase();
const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const provider = providerRequested === "auto" ? (hasSupabase ? "supabase" : "json") : providerRequested;
const providersPermitidos = new Set(["supabase", "postgres", "json"]);

export const DATABASE_CONFIG = Object.freeze({
  provider,
  providerRequested,
  hasSupabase,
  hasPostgres: provider === "postgres",
  supabaseUrl: process.env.SUPABASE_URL || "",
  serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  recordsTable: process.env.FUSION_POSTGRES_RECORDS_TABLE || process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records",
  writeMode: String(process.env.FUSION_PERSISTENCE_WRITE_MODE || "primary").toLowerCase(),
  jsonFallbackEnabled: String(
    process.env.FUSION_JSON_FALLBACK ??
    (process.env.NODE_ENV === "production" ? "false" : "true")
  ).toLowerCase() !== "false",
  productionRule: "Produção exige persistência transacional em Supabase ou PostgreSQL; JSON é contingência, importação e desenvolvimento."
});

export function assertDatabaseConfiguration() {
  if (!providersPermitidos.has(DATABASE_CONFIG.provider)) {
    throw new Error(`FUSION_DATABASE_PROVIDER inválido: ${DATABASE_CONFIG.provider}.`);
  }

  if (process.env.NODE_ENV === "production" && DATABASE_CONFIG.provider === "json") {
    throw new Error("Produção não permite FUSION_DATABASE_PROVIDER=json.");
  }

  if (DATABASE_CONFIG.provider === "supabase" && !DATABASE_CONFIG.hasSupabase) {
    throw new Error("Supabase selecionado, mas SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não está configurado.");
  }

  if (process.env.NODE_ENV === "production" && DATABASE_CONFIG.jsonFallbackEnabled) {
    throw new Error("FUSION_JSON_FALLBACK deve ser false em produção para impedir confirmações sem banco.");
  }

  return DATABASE_CONFIG;
}
