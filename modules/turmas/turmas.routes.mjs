import { Router } from "express";
import {
  obterTurmas,
  obterResumoTurmas,
  obterTurma,
  cadastrarTurma,
  editarTurma,
  removerTurma
} from "./turmas.service.mjs";

const router = Router();

function responderErro(res, erro) {
  res.status(erro.statusCode || 500).json({
    erro: erro.message || "Erro interno no módulo de turmas."
  });
}

router.get("/", async (req, res) => {
  try {
    const turmas = await obterTurmas(req.query);
    res.json(turmas);
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const resumo = await obterResumoTurmas();
    res.json(resumo);
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const turma = await obterTurma(req.params.id);
    res.json(turma);
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.post("/", async (req, res) => {
  try {
    const turma = await cadastrarTurma(req.body);
    res.status(201).json(turma);
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const turma = await editarTurma(req.params.id, req.body);
    res.json(turma);
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const resultado = await removerTurma(req.params.id);
    res.json(resultado);
  } catch (erro) {
    responderErro(res, erro);
  }
});

export default router;
