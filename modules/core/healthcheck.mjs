import { APP_CONFIG } from "../../config/app.config.mjs";
import { DATABASE_CONFIG } from "../../config/database.config.mjs";
import { STORAGE_CONFIG } from "../../config/storage.config.mjs";
import { securityWarnings } from "../../config/security.config.mjs";
import { OFFICIAL_MODULES } from "../../config/modules.config.mjs";

export function architectureHealth() {
  return {
    ok: true,
    system: APP_CONFIG.name,
    applicationVersion: APP_CONFIG.version,
    architectureVersion: APP_CONFIG.architectureVersion,
    environment: APP_CONFIG.environment,
    database: { provider: DATABASE_CONFIG.provider, supabaseConfigured: DATABASE_CONFIG.hasSupabase, jsonFallbackEnabled: DATABASE_CONFIG.jsonFallbackEnabled },
    storage: { provider: STORAGE_CONFIG.provider, alunoFotosBucket: STORAGE_CONFIG.alunoFotosBucket },
    modules: { officialCount: OFFICIAL_MODULES.length },
    warnings: securityWarnings(),
    timestamp: new Date().toISOString()
  };
}
