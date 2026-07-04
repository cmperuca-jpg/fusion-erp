import { Router } from "express";
import {
  consolidarAluno,
  iniciarCicloLimpo,
  painelConsolidadoAluno,
  relatorioConsolidado,
  statusConsolidacaoTreino
} from "./treinos-consolidacao.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro na consolidação de treinos."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusConsolidacaoTreino()); } catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId", async (req, res) => {
  try { res.json(await painelConsolidadoAluno(req.params.alunoId)); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/ciclo-limpo", async (req, res) => {
  try { res.status(201).json(await iniciarCicloLimpo(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/consolidar", async (req, res) => {
  try { res.json(await consolidarAluno(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.get("/relatorio/geral", async (req, res) => {
  try { res.json(await relatorioConsolidado()); } catch (err) { erro(res, err); }
});

export default router;
