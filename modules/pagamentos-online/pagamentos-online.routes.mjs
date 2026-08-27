import express from "express";
import {
  obterConfiguracaoPagamentosPublica,
  salvarConfiguracaoPagamentos
} from "./pagamentos-online.config.mjs";
import {
  consultarPagamentoOnline,
  iniciarPagamentoContratacaoFusion,
  receberWebhookAsaas,
  receberWebhookInfinitePay,
  receberWebhookPagbank
} from "./pagamentos-online.service.mjs";

const router = express.Router();

function podeGerenciarPagamentos(usuario = {}) {
  const perfil = String(usuario.perfil || "").toLowerCase();
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return ["administrador", "admin", "gerente", "responsavel_tecnico", "tecnico", "dono", "master"].includes(perfil) ||
    permissoes.includes("*") ||
    permissoes.some((permissao) => ["financeiro", "pagamentos_online", "configuracoes"].includes(String(permissao).toLowerCase()));
}

function exigirGestor(req, res, next) {
  if (podeGerenciarPagamentos(req.usuario || {})) return next();
  return res.status(403).json({
    ok: false,
    mensagem: "Esta operação exige permissão financeira."
  });
}

function tratarErro(res, erro, fallback = "Não foi possível processar o pagamento online.") {
  return res.status(erro.status || erro.statusCode || 500).json({
    ok: false,
    code: erro.code || "",
    mensagem: erro.message || fallback
  });
}

router.post("/fusion/contratacao", exigirGestor, async (req, res) => {
  try {
    res.status(201).json(await iniciarPagamentoContratacaoFusion(req.body || {}, req.usuario || {}));
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível criar a cobrança da assinatura Fusion.");
  }
});

router.get("/configuracao", exigirGestor, async (_req, res) => {
  try {
    res.json(await obterConfiguracaoPagamentosPublica());
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível carregar a configuração de pagamentos online.");
  }
});

router.put("/configuracao", exigirGestor, async (req, res) => {
  try {
    res.json(await salvarConfiguracaoPagamentos(req.body || {}, req.usuario || {}));
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível salvar a configuração de pagamentos online.");
  }
});

router.get("/:id", exigirGestor, async (req, res) => {
  try {
    res.json(await consultarPagamentoOnline(req.params.id));
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível consultar o pagamento online.");
  }
});

router.post("/webhooks/asaas", async (req, res) => {
  try {
    res.json(await receberWebhookAsaas({ headers: req.headers, body: req.body || {} }));
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível processar o webhook Asaas.");
  }
});

router.post("/webhooks/pagbank", async (req, res) => {
  try {
    res.json(await receberWebhookPagbank({ headers: req.headers, body: req.body || {}, rawBody: req.rawBody || "" }));
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível processar o webhook PagBank.");
  }
});

router.post("/webhooks/infinitepay", async (req, res) => {
  try {
    res.json(await receberWebhookInfinitePay({ body: req.body || {} }));
  } catch (erro) {
    tratarErro(res, erro, "Não foi possível processar o webhook InfinitePay.");
  }
});

export default router;
