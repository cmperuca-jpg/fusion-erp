import { Router } from "express";
import * as service from "./backup.service.mjs";

const router = Router();

function erro(res, error, status = 500) {
  res.status(status).json({ ok: false, erro: error.message, mensagem: error.message });
}

router.get("/status", async (req, res) => {
  try { res.json(await service.statusBackup()); }
  catch (error) { erro(res, error); }
});


router.get("/config", async (req, res) => {
  try { res.json({ ok: true, config: await service.lerConfiguracaoBackup() }); }
  catch (error) { erro(res, error); }
});

router.post("/config", async (req, res) => {
  try { res.json(await service.salvarConfiguracaoBackup(req.body || {})); }
  catch (error) { erro(res, error, 400); }
});

router.put("/config", async (req, res) => {
  try { res.json(await service.salvarConfiguracaoBackup(req.body || {})); }
  catch (error) { erro(res, error, 400); }
});

router.post("/local", async (req, res) => {
  try { res.json(await service.criarBackupLocal()); }
  catch (error) { erro(res, error); }
});

router.post("/supabase", async (req, res) => {
  try { res.json(await service.enviarBackupSupabase()); }
  catch (error) { erro(res, error); }
});

router.post("/", async (req, res) => {
  try { res.json(await service.enviarBackupSupabase()); }
  catch (error) { erro(res, error); }
});

router.get("/listar", async (req, res) => {
  try { res.json(await service.listarBackupsSupabase()); }
  catch (error) { erro(res, error); }
});

export default router;
