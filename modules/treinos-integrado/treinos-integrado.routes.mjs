import { Router } from "express";
import {
  arquivarTreinoIntegrado,
  atualizarTreinoIntegrado,
  criarTreinoIntegrado,
  gerarTreinoAutomatico,
  listarTreinosIntegrados,
  obterContextoTreinoAluno,
  statusMotorTreinos
} from "./treinos-integrado.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no motor de treinos integrado."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusMotorTreinos()); }
  catch (err) { erro(res, err); }
});

router.get("/", async (req, res) => {
  try { res.json(await listarTreinosIntegrados(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId/contexto", async (req, res) => {
  try { res.json(await obterContextoTreinoAluno(req.params.alunoId)); }
  catch (err) { erro(res, err); }
});

router.post("/", async (req, res) => {
  try { res.status(201).json(await criarTreinoIntegrado(req.body || {})); }
  catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/gerar-automatico", async (req, res) => {
  try { res.status(201).json(await gerarTreinoAutomatico(req.params.alunoId, req.body || {})); }
  catch (err) { erro(res, err); }
});

router.put("/:id", async (req, res) => {
  try { res.json(await atualizarTreinoIntegrado(req.params.id, req.body || {})); }
  catch (err) { erro(res, err); }
});

router.patch("/:id/arquivar", async (req, res) => {
  try { res.json(await arquivarTreinoIntegrado(req.params.id, req.body || {})); }
  catch (err) { erro(res, err); }
});

export default router;
