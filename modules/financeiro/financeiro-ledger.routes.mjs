import express from "express";
import { alterarVencimento, auditoriaFinanceira, calcularEncargosAtrasoTitulo, extratoAluno, garantirEstruturaFinanceira, listarRecibos, receberTitulos, verificarIntegridadeFinanceira } from "./financeiro-ledger.service.mjs";
import { estornarReciboIntegrado } from "./estorno-integrado.service.mjs";
import { reconciliarFinanceiroCaixa } from "./financeiro-reconciliacao.service.mjs";

const router = express.Router();
const rota = (fn, codigo = 200) => async (req, res) => { try { res.status(codigo).json(await fn(req, res)); } catch (e) { res.status(e.status || 500).json({ ok: false, erro: true, code: e.code || "", mensagem: e.message || "Erro financeiro." }); } };
router.get("/configuracao", rota(() => garantirEstruturaFinanceira()));
router.get("/titulos/:id/encargos-atraso", rota((req) => calcularEncargosAtrasoTitulo(req.params.id, req.query.dataPagamento || req.query.pagamento)));
router.post("/receber", rota((req) => receberTitulos(req.body || {}), 201));
router.get("/recibos", rota((req) => listarRecibos(req.query || {})));
router.post("/recibos/:id/estornar", rota((req) => estornarReciboIntegrado(req.params.id, req.body || {}, { operacaoId: req.idempotencyKey })));
router.get("/alunos/:id/extrato", rota((req) => extratoAluno(req.params.id)));
router.patch("/titulos/:id/vencimento", rota((req) => alterarVencimento(req.params.id, req.body || {})));
router.get("/auditoria", rota((req) => auditoriaFinanceira(req.query || {})));
router.get("/integridade", rota(() => verificarIntegridadeFinanceira()));
router.post("/reconciliar", rota((req) => reconciliarFinanceiroCaixa(req.body || {})));
export default router;
