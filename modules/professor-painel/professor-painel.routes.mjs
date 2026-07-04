import { Router } from "express";
import {
  chamadaProfessorTurma,
  listarProfessoresPainel,
  obterDashboardProfessor,
  obterPainelProfessor,
  obterTurmaProfessor,
  registrarPresencaProfessor,
  statusPainelProfessor
} from "./professor-painel.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({ ok: false, mensagem: err.message || "Erro no painel do professor." });
}

router.get("/status", async (req, res) => { try { res.json(await statusPainelProfessor()); } catch (err) { erro(res, err); } });
router.get("/professores", async (req, res) => { try { res.json(await listarProfessoresPainel(req.query || {})); } catch (err) { erro(res, err); } });
router.get("/:professor/dashboard", async (req, res) => { try { res.json(await obterDashboardProfessor(req.params.professor, req.query || {})); } catch (err) { erro(res, err); } });
router.get("/:professor/operacional", async (req, res) => { try { res.json(await obterDashboardProfessor(req.params.professor, req.query || {})); } catch (err) { erro(res, err); } });
router.get("/:professor", async (req, res) => { try { res.json(await obterPainelProfessor(req.params.professor, req.query || {})); } catch (err) { erro(res, err); } });
router.get("/:professor/turmas/:turmaId", async (req, res) => { try { res.json(await obterTurmaProfessor(req.params.professor, req.params.turmaId, req.query || {})); } catch (err) { erro(res, err); } });
router.post("/:professor/presenca", async (req, res) => { try { res.status(201).json(await registrarPresencaProfessor(req.params.professor, req.body || {})); } catch (err) { erro(res, err); } });
router.post("/:professor/turmas/:turmaId/chamada", async (req, res) => { try { res.status(201).json(await chamadaProfessorTurma(req.params.professor, req.params.turmaId, req.body || {})); } catch (err) { erro(res, err); } });

export default router;
