const providerRequested = String(process.env.FUSION_DATABASE_PROVIDER || "auto").toLowerCase();
const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const provider = providerRequested === "auto" ? (hasSupabase ? "supabase" : "json") : providerRequested;
export const DATABASE_CONFIG = Object.freeze({
  provider,
  providerRequested,
  hasSupabase,
  supabaseUrl: process.env.SUPABASE_URL || "",
  serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  recordsTable: process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records",
  writeMode: String(process.env.FUSION_PERSISTENCE_WRITE_MODE || "primary").toLowerCase(),
  jsonFallbackEnabled: String(process.env.FUSION_JSON_FALLBACK ?? (process.env.NODE_ENV === "production" ? "false" : "true")).toLowerCase() !== "false",
  productionRule: "Supabase é a fonte oficial em produção; JSON é contingência, importação e desenvolvimento."
});
export function assertDatabaseConfiguration() {
  if (process.env.NODE_ENV === "production" && DATABASE_CONFIG.provider !== "supabase") throw new Error("Produção exige FUSION_DATABASE_PROVIDER=supabase.");
  if (process.env.NODE_ENV === "production" && !DATABASE_CONFIG.hasSupabase) throw new Error("Supabase selecionado, mas SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não está configurado.");
  if (process.env.NODE_ENV === "production" && DATABASE_CONFIG.jsonFallbackEnabled) throw new Error("FUSION_JSON_FALLBACK deve ser false em produção para impedir confirmações sem banco.");
  return DATABASE_CONFIG;
}
