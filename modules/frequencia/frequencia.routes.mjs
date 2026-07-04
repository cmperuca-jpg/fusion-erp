import { Router } from "express";
import {
  chamadaTurma,
  listar,
  listarAlunosDaTurma,
  obterFrequenciaAluno,
  registrar,
  resumo,
  statusFrequenciaComercial
} from "./frequencia.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no módulo de frequência."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusFrequenciaComercial()); }
  catch (err) { erro(res, err); }
});

router.get("/", async (req, res) => {
  try { res.json(await listar(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/resumo", async (req, res) => {
  try { res.json(await resumo(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId", async (req, res) => {
  try { res.json(await obterFrequenciaAluno(req.params.alunoId, req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/turmas/:turmaId/alunos", async (req, res) => {
  try { res.json(await listarAlunosDaTurma(req.params.turmaId, req.query || {})); }
  catch (err) { erro(res, err); }
});

router.post("/registrar", async (req, res) => {
  try { res.status(201).json(await registrar(req.body || {})); }
  catch (err) { erro(res, err); }
});

router.post("/turmas/:turmaId/chamada", async (req, res) => {
  try { res.status(201).json(await chamadaTurma(req.params.turmaId, req.body || {})); }
  catch (err) { erro(res, err); }
});

export default router;
