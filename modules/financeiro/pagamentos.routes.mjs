import { Router } from "express";
import {
  agendarPagamento,
  anexarComprovantePagamento,
  aprovarPagamento,
  baixarPagamento,
  cancelarPagamento,
  criarPagamento,
  duplicarPagamento,
  editarPagamento,
  estornarPagamento,
  excluirPagamento,
  obterHistoricoPagamento,
  baixarPagamentosEmLote,
  listarConciliacaoPagamentos,
  fecharPeriodoPagamentos,
  criarPagamentosRecorrentes,
  listarPagamentos,
  obterDashboardPagamentos,
  obterPagamento,
  reprovarPagamento,
  parcelarPagamento
} from "./pagamentos.service.mjs";

const router = Router();

function respostaErro(res, err) {
  const status = err.status || 500;
  return res.status(status).json({ ok: false, erro: err.message || "Erro interno no módulo de pagamentos." });
}

router.get(["/", "/pagamentos"], async (req, res) => {
  try { return res.json(await listarPagamentos(req.query || {})); }
  catch (err) { return respostaErro(res, err); }
});


router.get(["/conciliacao", "/pagamentos/conciliacao"], async (req, res) => {
  try { return res.json(await listarConciliacaoPagamentos(req.query || {})); }
  catch (err) { return respostaErro(res, err); }
});

router.get(["/dashboard", "/pagamentos/dashboard"], async (req, res) => {
  try { return res.json(await obterDashboardPagamentos(req.query || {})); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/recorrentes", "/pagamentos/recorrentes"], async (req, res) => {
  try { return res.status(201).json({ ok: true, pagamentos: await criarPagamentosRecorrentes(req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/lote/baixar", "/pagamentos/lote/baixar"], async (req, res) => {
  try { return res.json(await baixarPagamentosEmLote(req.body || {})); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/fechamento", "/pagamentos/fechamento"], async (req, res) => {
  try { return res.status(201).json({ ok: true, fechamento: await fecharPeriodoPagamentos(req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.get(["/:id", "/pagamentos/:id"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await obterPagamento(req.params.id) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/", "/pagamentos"], async (req, res) => {
  try { return res.status(201).json({ ok: true, pagamento: await criarPagamento(req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/parcelar", "/pagamentos/parcelar"], async (req, res) => {
  try { return res.status(201).json({ ok: true, pagamentos: await parcelarPagamento(req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.put(["/:id", "/pagamentos/:id"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await editarPagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.delete(["/:id", "/pagamentos/:id"], async (req, res) => {
  try { return res.json({ ok: true, ...(await excluirPagamento(req.params.id)) }); }
  catch (err) { return respostaErro(res, err); }
});


router.get(["/:id/historico", "/pagamentos/:id/historico"], async (req, res) => {
  try { return res.json({ ok: true, historico: await obterHistoricoPagamento(req.params.id) }); }
  catch (err) { return respostaErro(res, err); }
});


router.post(["/:id/aprovar", "/pagamentos/:id/aprovar"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await aprovarPagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/reprovar", "/pagamentos/:id/reprovar"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await reprovarPagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/agendar", "/pagamentos/:id/agendar"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await agendarPagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/comprovantes", "/pagamentos/:id/comprovantes"], async (req, res) => {
  try { return res.status(201).json({ ok: true, pagamento: await anexarComprovantePagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/baixar", "/pagamentos/:id/baixar"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await baixarPagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/estornar", "/pagamentos/:id/estornar"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await estornarPagamento(req.params.id, req.body?.motivo || "") }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/cancelar", "/pagamentos/:id/cancelar"], async (req, res) => {
  try { return res.json({ ok: true, pagamento: await cancelarPagamento(req.params.id, req.body?.motivo || "") }); }
  catch (err) { return respostaErro(res, err); }
});

router.post(["/:id/duplicar", "/pagamentos/:id/duplicar"], async (req, res) => {
  try { return res.status(201).json({ ok: true, pagamento: await duplicarPagamento(req.params.id, req.body || {}) }); }
  catch (err) { return respostaErro(res, err); }
});

export default router;
