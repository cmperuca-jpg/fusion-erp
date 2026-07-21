import express from "express";
import { alterarVencimentoTitulo, listarAuditoriaFinanceira, listarRecibos, obterEstruturaFinanceira, obterExtratoAluno, receberTitulos, salvarPlanoContas } from "./estrutura-financeira.service.mjs";

const router = express.Router();
const executar = (fn) => async (req, res) => { try { res.json(await fn(req, res)); } catch (erro) { res.status(erro.status || 500).json({ ok: false, mensagem: erro.message || "Erro financeiro." }); } };

router.get("/configuracao", executar(() => obterEstruturaFinanceira()));
router.post("/plano-contas", executar((req) => salvarPlanoContas(req.body || {})));
router.get("/alunos/:id/extrato", executar((req) => obterExtratoAluno(req.params.id)));
router.patch("/titulos/:id/vencimento", executar((req) => alterarVencimentoTitulo(req.params.id, req.body || {})));
router.post("/receber", executar((req) => receberTitulos(req.body || {})));
router.get("/recibos", executar((req) => listarRecibos(req.query || {})));
router.get("/auditoria", executar((req) => listarAuditoriaFinanceira(req.query || {})));

export default router;
