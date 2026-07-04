import { Router } from "express";
import {
  listarAgendaOperacional,
  listarAgendaPorProfessores,
  listarAgendaPorTurmas,
  materializarAgendaDia,
  obterAgendaAluno,
  obterAgendaProfessor,
  resumoAgendaOperacional,
  statusAgendaOperacional
} from "./agenda-operacional.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no módulo de agenda operacional."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusAgendaOperacional()); }
  catch (err) { erro(res, err); }
});

router.get("/", async (req, res) => {
  try { res.json(await listarAgendaOperacional(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/resumo", async (req, res) => {
  try { res.json(await resumoAgendaOperacional(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/turmas", async (req, res) => {
  try { res.json(await listarAgendaPorTurmas(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/professores", async (req, res) => {
  try { res.json(await listarAgendaPorProfessores(req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId", async (req, res) => {
  try { res.json(await obterAgendaAluno(req.params.alunoId, req.query || {})); }
  catch (err) { erro(res, err); }
});

router.get("/professores/:professor", async (req, res) => {
  try { res.json(await obterAgendaProfessor(req.params.professor, req.query || {})); }
  catch (err) { erro(res, err); }
});

router.post("/materializar", async (req, res) => {
  try { res.status(201).json(await materializarAgendaDia(req.body || {})); }
  catch (err) { erro(res, err); }
});

export default router;
