import express from "express";
import { listarContratos, obterContrato, criarContrato, atualizarContrato, encerrarContrato } from "./contratos.service.mjs";
const router = express.Router();
function erro(res, e) { res.status(e.status || 500).json({ ok: false, erro: e.message || "Erro no módulo de contratos." }); }
router.get("/", async (req, res) => { try { res.json({ ok: true, dados: await listarContratos(req.query || {}) }); } catch (e) { erro(res, e); } });
router.get("/:id", async (req, res) => { try { res.json({ ok: true, dados: await obterContrato(req.params.id) }); } catch (e) { erro(res, e); } });
router.post("/", async (req, res) => { try { res.status(201).json({ ok: true, dados: await criarContrato(req.body || {}) }); } catch (e) { erro(res, e); } });
router.put("/:id", async (req, res) => { try { res.json({ ok: true, dados: await atualizarContrato(req.params.id, req.body || {}) }); } catch (e) { erro(res, e); } });
router.patch("/:id/encerrar", async (req, res) => { try { res.json({ ok: true, dados: await encerrarContrato(req.params.id, req.body?.motivo || "") }); } catch (e) { erro(res, e); } });
export default router;
