import { Router } from "express";
import { DATABASE_CONFIG } from "../../../config/database.config.mjs";
import { testarSupabase } from "../../../config/supabase.mjs";
import { persistenciaAtiva } from "./collection-store.mjs";

const router = Router();
router.get("/status", async (_req, res) => {
  const resposta = { ok: true, provider: persistenciaAtiva(), supabaseConfigured: DATABASE_CONFIG.hasSupabase, jsonFallbackEnabled: DATABASE_CONFIG.jsonFallbackEnabled };
  if (DATABASE_CONFIG.hasSupabase) {
    try { resposta.supabase = await testarSupabase(); }
    catch (erro) { resposta.ok = false; resposta.supabase = { ok: false, mensagem: erro.message }; }
  }
  res.status(resposta.ok ? 200 : 503).json(resposta);
});
export default router;
