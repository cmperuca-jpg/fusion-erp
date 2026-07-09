import { Router } from "express";
import * as service from "./natacao.service.mjs";

const router = Router();

function erro(res, e, status = 500) {
  res.status(status).json({ ok: false, erro: e.message, mensagem: e.message });
}

router.get("/sessoes", async (req, res) => {
  try { res.json({ ok: true, sessoes: await service.listarSessoes(req.query.limit || 50) }); }
  catch (e) { erro(res, e); }
});

router.post("/sessoes", async (req, res) => {
  try {
    const sessao = await service.criarSessao(req.body || {});
    res.status(201).json({ ok: true, sessao, mensagem: "Sessão de natação salva com sucesso." });
  } catch (e) { erro(res, e, 400); }
});

router.get("/recordes", async (req, res) => {
  try { res.json({ ok: true, recordes: await service.listarRecordes() }); }
  catch (e) { erro(res, e); }
});

router.post("/recordes/recalcular", async (req, res) => {
  try { res.json({ ok: true, recordes: await service.recalcularRecordes(), mensagem: "Recordes recalculados." }); }
  catch (e) { erro(res, e); }
});

router.get("/estatisticas", async (req, res) => {
  try { res.json({ ok: true, estatisticas: await service.estatisticas() }); }
  catch (e) { erro(res, e); }
});

router.get("/ranking", async (req, res) => {
  try { res.json({ ok: true, rankings: await service.ranking(req.query || {}) }); }
  catch (e) { erro(res, e); }
});


router.get("/tecnico", async (req, res) => {
  try { res.json({ ok: true, tecnico: await service.painelTecnico() }); }
  catch (e) { erro(res, e); }
});

router.get("/comparar", async (req, res) => {
  try { res.json({ ok: true, comparacao: await service.compararAlunos(req.query || {}) }); }
  catch (e) { erro(res, e); }
});

router.get("/relatorio/:id", async (req, res) => {
  try { res.json({ ok: true, relatorio: await service.relatorioTecnicoAluno(req.params.id) }); }
  catch (e) { erro(res, e); }
});

router.get("/alunos/:id", async (req, res) => {
  try { res.json({ ok: true, ...(await service.historicoAluno(req.params.id)) }); }
  catch (e) { erro(res, e); }
});

export default router;
