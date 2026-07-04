import express from "express";
import { listarServicos, obterServico, criarServico, atualizarServico, removerServico, sincronizarServicosAPartirDasTurmas } from "./servicos.service.mjs";
const router = express.Router();
function erro(res, e) { res.status(e.status || 500).json({ ok: false, erro: e.message || "Erro no módulo de serviços." }); }
router.get("/", async (req, res) => { try { res.json({ ok: true, dados: await listarServicos(req.query || {}) }); } catch (e) { erro(res, e); } });
router.get("/:id", async (req, res) => { try { res.json({ ok: true, dados: await obterServico(req.params.id) }); } catch (e) { erro(res, e); } });
router.post("/", async (req, res) => { try { res.status(201).json({ ok: true, dados: await criarServico(req.body || {}) }); } catch (e) { erro(res, e); } });
router.post("/sincronizar-turmas", async (req, res) => { try { res.json({ ok: true, dados: await sincronizarServicosAPartirDasTurmas() }); } catch (e) { erro(res, e); } });
router.put("/:id", async (req, res) => { try { res.json({ ok: true, dados: await atualizarServico(req.params.id, req.body || {}) }); } catch (e) { erro(res, e); } });
router.delete("/:id", async (req, res) => { try { res.json({ ok: true, dados: await removerServico(req.params.id) }); } catch (e) { erro(res, e); } });
export default router;
