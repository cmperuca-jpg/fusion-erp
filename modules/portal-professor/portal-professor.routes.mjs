import { Router } from "express";
import { acessarPortalProfessor, obterPortalProfessor, statusPortalProfessor } from "./portal-professor.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({ ok: false, mensagem: err.message || "Erro no portal do professor." });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusPortalProfessor()); }
  catch (err) { erro(res, err); }
});

router.post("/acessar", async (req, res) => {
  try { res.json(await acessarPortalProfessor(req.body || {})); }
  catch (err) { erro(res, err); }
});

router.get("/professores/:professorId", async (req, res) => {
  try { res.json(await obterPortalProfessor(req.params.professorId, req.query || {})); }
  catch (err) { erro(res, err); }
});

export default router;
