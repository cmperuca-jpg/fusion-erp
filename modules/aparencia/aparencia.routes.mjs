import { Router } from "express";
import { obterAparencia, salvarAparencia, restaurarAparencia, salvarImagem } from "./aparencia.service.mjs";

const router = Router();
const responderErro = (res, error) => res.status(error.status || 500).json({ ok: false, mensagem: error.message || "Erro no editor visual." });

router.get("/", async (_req, res) => {
  try { res.json({ ok: true, aparencia: await obterAparencia() }); }
  catch (error) { responderErro(res, error); }
});
router.put("/", async (req, res) => {
  try { res.json({ ok: true, aparencia: await salvarAparencia(req.body || {}) }); }
  catch (error) { responderErro(res, error); }
});
router.post("/restaurar", async (_req, res) => {
  try { res.json({ ok: true, aparencia: await restaurarAparencia() }); }
  catch (error) { responderErro(res, error); }
});
router.post("/imagem", async (req, res) => {
  try { res.status(201).json({ ok: true, ...(await salvarImagem(req.body || {})) }); }
  catch (error) { responderErro(res, error); }
});

export default router;
