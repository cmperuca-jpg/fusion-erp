import express from "express";
import { studentEmergencyStatus, sendEmergencyReceipt, validateTemporaryEmergencyAccess, updateEmergencyRequest } from "./emergency-access.service.mjs";

const router = express.Router();
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status || 500).json({ ok:false, mensagem:e.message || "Erro na liberação emergencial." }); } };

router.get("/alunos/:alunoId/status", wrap(async (req, res) => res.json(await studentEmergencyStatus(req.params.alunoId))));
router.post("/comprovante", wrap(async (req, res) => res.status(201).json(await sendEmergencyReceipt(req.body || {}, { alunoId:req.usuario?.id, ip:req.ip, userAgent:req.get("user-agent") }))));
router.get("/alunos/:alunoId/validar-acesso", wrap(async (req, res) => res.json(await validateTemporaryEmergencyAccess(req.params.alunoId))));
router.post("/solicitacoes/:id/:acao", wrap(async (req, res) => res.json(await updateEmergencyRequest(req.params.id, req.params.acao, req.usuario || {}))));

export default router;
