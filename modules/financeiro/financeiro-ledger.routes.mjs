import express from "express";
import { alterarVencimento, auditoriaFinanceira, estornarRecibo, extratoAluno, garantirEstruturaFinanceira, listarRecibos, receberTitulos, verificarIntegridadeFinanceira } from "./financeiro-ledger.service.mjs";

const router = express.Router();
const rota = (fn, codigo = 200) => async (req, res) => { try { res.status(codigo).json(await fn(req, res)); } catch (e) { res.status(e.status || 500).json({ ok: false, erro: true, mensagem: e.message || "Erro financeiro." }); } };
router.get("/configuracao", rota(() => garantirEstruturaFinanceira()));
router.post("/receber", rota((req) => receberTitulos(req.body || {}), 201));
router.get("/recibos", rota((req) => listarRecibos(req.query || {})));
router.post("/recibos/:id/estornar", rota((req) => estornarRecibo(req.params.id, req.body || {})));
router.get("/alunos/:id/extrato", rota((req) => extratoAluno(req.params.id)));
router.patch("/titulos/:id/vencimento", rota((req) => alterarVencimento(req.params.id, req.body || {})));
router.get("/auditoria", rota((req) => auditoriaFinanceira(req.query || {})));
router.get("/integridade", rota(() => verificarIntegridadeFinanceira()));
export default router;
