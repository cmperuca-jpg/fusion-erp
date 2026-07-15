import { Router } from "express";
import {
  atualizarExecucaoExercicio,
  concluirExecucaoTreino,
  historicoExecucoesAluno,
  iniciarExecucaoTreino,
  painelProfessorTreinos,
  portalTreinosAluno,
  statusTreinoOperacional,
  progressaoCargaAluno,
  iaProgressaoFisicaAluno
} from "./treinos-operacional.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no treino operacional."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusTreinoOperacional()); } catch (err) { erro(res, err); }
});

router.get("/portal/alunos/:alunoId", async (req, res) => {
  try { res.json(await portalTreinosAluno(req.params.alunoId, req.query || {})); } catch (err) { erro(res, err); }
});

router.get("/professores/:professor", async (req, res) => {
  try { res.json(await painelProfessorTreinos(req.params.professor, req.query || {})); } catch (err) { erro(res, err); }
});

router.post("/treinos/:treinoId/iniciar", async (req, res) => {
  try { res.status(201).json(await iniciarExecucaoTreino(req.params.treinoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.put("/execucoes/:execucaoId/exercicios/:exercicioTreinoId", async (req, res) => {
  try { res.json(await atualizarExecucaoExercicio(req.params.execucaoId, req.params.exercicioTreinoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/execucoes/:execucaoId/concluir", async (req, res) => {
  try { res.json(await concluirExecucaoTreino(req.params.execucaoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.get("/portal/alunos/:alunoId/execucoes", async (req, res) => {
  try { res.json(await historicoExecucoesAluno(req.params.alunoId, req.query || {})); } catch (err) { erro(res, err); }
});

router.get("/progressao/alunos/:alunoId", async (req, res) => {
  try { res.json(await progressaoCargaAluno(req.params.alunoId, req.query || {})); } catch (err) { erro(res, err); }
});

router.get("/ia/alunos/:alunoId", async (req, res) => {
  try { res.json(await iaProgressaoFisicaAluno(req.params.alunoId, req.query || {})); } catch (err) { erro(res, err); }
});

export default router;
