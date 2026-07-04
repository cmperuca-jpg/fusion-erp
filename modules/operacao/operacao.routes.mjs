import express from "express";
import {
  listarAlunosDaTurma,
  listarTurmasDoAluno,
  listarTurmasDoProfessor,
  obterOperacaoAluno,
  registrarPresencaOperacional,
  statusOperacao
} from "./operacao.service.mjs";

const router = express.Router();

function tratarErro(res, erro) {
  return res.status(erro.status || 500).json({
    ok: false,
    erro: erro.message || "Erro no módulo de operação."
  });
}

router.get("/status", async (req, res) => {
  try {
    res.json(await statusOperacao());
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/alunos/:alunoId", async (req, res) => {
  try {
    res.json(await obterOperacaoAluno(req.params.alunoId, req.query || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/alunos/:alunoId/turmas", async (req, res) => {
  try {
    res.json(await listarTurmasDoAluno(req.params.alunoId, req.query || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/turmas/:turmaId/alunos", async (req, res) => {
  try {
    res.json(await listarAlunosDaTurma(req.params.turmaId, req.query || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get("/professores/:professor/turmas", async (req, res) => {
  try {
    res.json(await listarTurmasDoProfessor(req.params.professor, req.query || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post("/presencas", async (req, res) => {
  try {
    const resultado = await registrarPresencaOperacional(req.body || {});
    res.status(resultado.ok === false ? 403 : 201).json(resultado);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
