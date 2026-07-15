import { APP_CONFIG } from "../../config/app.config.mjs";
import { assertDatabaseConfiguration, DATABASE_CONFIG } from "../../config/database.config.mjs";
import { STORAGE_CONFIG } from "../../config/storage.config.mjs";
import { securityWarnings } from "../../config/security.config.mjs";
import { architectureHealth } from "./healthcheck.mjs";
import { logger } from "./logger.mjs";

export function initializeArchitecture(app) {
  assertDatabaseConfiguration();
  app.locals.fusionArchitecture = architectureHealth();
  app.get("/api/v3/architecture/status", (_req, res) => res.json(architectureHealth()));
  logger.info("Base de arquitetura 3.0 carregada", { database: DATABASE_CONFIG.provider, storage: STORAGE_CONFIG.provider, environment: APP_CONFIG.environment });
  for (const warning of securityWarnings()) logger.warn(warning);
  return app.locals.fusionArchitecture;
}
