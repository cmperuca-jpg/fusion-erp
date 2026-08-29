import { Router } from "express";
import { DATABASE_CONFIG } from "../../../config/database.config.mjs";
import { testarPostgres } from "../../../config/postgres.mjs";
import { testarSupabase } from "../../../config/supabase.mjs";
import { persistenciaAtiva } from "./collection-store.mjs";

const router = Router();

router.get("/status", async (_req, res) => {
  const resposta = {
    ok: true,
    provider: persistenciaAtiva(),
    supabaseConfigured: DATABASE_CONFIG.hasSupabase,
    jsonFallbackEnabled: DATABASE_CONFIG.jsonFallbackEnabled
  };

  try {
    if (DATABASE_CONFIG.provider === "postgres") resposta.postgres = await testarPostgres();
    else if (DATABASE_CONFIG.provider === "supabase") resposta.supabase = await testarSupabase();
  } catch (erro) {
    resposta.ok = false;
    resposta[DATABASE_CONFIG.provider] = { ok: false, mensagem: erro.message };
  }

  res.status(resposta.ok ? 200 : 503).json(resposta);
});

export default router;
