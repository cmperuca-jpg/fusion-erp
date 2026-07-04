import express from "express";
import { listarServicosContratados, obterServicoContratado, contratarServico, atualizarServicoContratado, removerServicoContratado, removerTodosServicosDoContrato } from "./servicos-contratados.service.mjs";
const router = express.Router();
function erro(res, e) { res.status(e.status || 500).json({ ok: false, erro: e.message || "Erro no módulo de serviços contratados." }); }
router.get("/", async (req, res) => { try { res.json({ ok: true, dados: await listarServicosContratados(req.query || {}) }); } catch (e) { erro(res, e); } });
router.get("/:id", async (req, res) => { try { res.json({ ok: true, dados: await obterServicoContratado(req.params.id) }); } catch (e) { erro(res, e); } });
router.post("/", async (req, res) => { try { res.status(201).json({ ok: true, dados: await contratarServico(req.body || {}) }); } catch (e) { erro(res, e); } });
router.put("/:id", async (req, res) => { try { res.json({ ok: true, dados: await atualizarServicoContratado(req.params.id, req.body || {}) }); } catch (e) { erro(res, e); } });
router.delete("/:id", async (req, res) => { try { res.json({ ok: true, dados: await removerServicoContratado(req.params.id, req.body?.motivo || "") }); } catch (e) { erro(res, e); } });
router.delete("/contrato/:contratoId/todos", async (req, res) => { try { res.json({ ok: true, dados: await removerTodosServicosDoContrato(req.params.contratoId, req.body?.motivo || "") }); } catch (e) { erro(res, e); } });
export default router;
