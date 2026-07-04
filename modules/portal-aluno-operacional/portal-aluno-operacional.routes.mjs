import { Router } from "express";
import {
  obterAgendaAluno,
  obterFinanceiroAluno,
  obterPortalAluno,
  statusPortalAlunoOperacional
} from "./portal-aluno-operacional.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no portal do aluno operacional."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusPortalAlunoOperacional()); }
  catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId", async (req, res) => {
  try { res.json(await obterPortalAluno(req.params.alunoId, req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId/agenda", async (req, res) => {
  try { res.json(await obterAgendaAluno(req.params.alunoId, req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId/financeiro", async (req, res) => {
  try { res.json(await obterFinanceiroAluno(req.params.alunoId)); }
  catch (err) { erro(res, err); }
});

export default router;
