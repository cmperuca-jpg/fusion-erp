import crypto from "node:crypto";
import { obterSupabaseAdmin, supabaseConfigurado } from "../../config/supabase.mjs";
import { executarComTenant, normalizarTenantId, tenantAtual } from "../core/persistence/tenant-context.mjs";
import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { listarMensalidades, garantirLancamentoFinanceiroMensalidade } from "../financeiro/mensalidades.service.mjs";
import { listarTitulos, receberTitulos } from "../financeiro/financeiro-ledger.service.mjs";
import { obterCaixaAtual, abrirCaixa, fecharCaixa } from "../financeiro/caixa.service.mjs";
import { programarProximaCobrancaAposPagamento } from "../cobranca/cobranca.service.mjs";
import { identidadeAlunoApp } from "../treinos/aluno-app-actions.service.mjs";
import {
  formalizarContratacaoFusion,
  obterBillingFusion,
  registrarPagamentoFusion,
  resolverPlanoFusion
} from "../saas/billing.service.mjs";
import {
  asaasConfigurado,
  criarClienteAsaas,
  criarCobrancaAsaas,
  listarClientesAsaas,
  recuperarCobrancaAsaas
} from "./asaas.client.mjs";
import {
  criarCheckoutPagbank,
  linkPagamentoPagbank,
  pagbankConfigurado
} from "./pagbank.client.mjs";

const COL_PAGAMENTOS = "pagamentos_online";
const COL_CLIENTES = "pagamentos_online_clientes";
const STATUS_ABERTOS = new Set(["criada", "pendente", "aguardando_pagamento"]);
const STATUS_PAGOS_ASAAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "APPROVED", "PAID"]);
const EVENTOS_PAGOS_ASAAS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const STATUS_PAGOS_PAGBANK = new Set(["PAID"]);

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function numero(valor, fallback = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function uid(prefixo = "payon") {
  return `${prefixo}_${crypto.randomUUID()}`;
}

function providerAtual() {
  const bruto = statusNormalizado(
    process.env.FUSION_PAYMENTS_PROVIDER ||
    process.env.FUSION_PAYMENT_PROVIDER ||
    process.env.FUSION_GATEWAY_PAGAMENTOS ||
    "asaas"
  );
  return ["pagbank", "pagseguro"].includes(bruto) ? "pagbank" : "asaas";
}

function nomeProvider(provider = "") {
  return provider === "pagbank" ? "PagBank" : "Asaas";
}

function providerConfigurado(provider = providerAtual()) {
  return provider === "pagbank" ? pagbankConfigurado() : asaasConfigurado();
}

function erro(mensagem, status = 400, code = "") {
  return Object.assign(new Error(mensagem), { status, code });
}

function documento(valor = "") {
  return texto(valor).replace(/\D/g, "");
}

function telefone(valor = "") {
  return texto(valor).replace(/\D/g, "");
}

function valorPositivo(...valores) {
  for (const valor of valores) {
    const n = numero(valor, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function statusNormalizado(valor = "") {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pago(status = "") {
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(statusNormalizado(status));
}

function cancelado(status = "") {
  return ["cancelado", "cancelada", "estornado", "estornada", "encerrado", "encerrada"].includes(statusNormalizado(status));
}

function programado(status = "") {
  return ["programada", "programado", "previsto", "prevista"].includes(statusNormalizado(status));
}

function pagamentoQuitadoAsaas(evento = "", pagamento = {}) {
  return EVENTOS_PAGOS_ASAAS.has(texto(evento).toUpperCase()) ||
    STATUS_PAGOS_ASAAS.has(texto(pagamento.status).toUpperCase());
}

function pagamentoQuitadoPagbank(_evento = "", pagamento = {}) {
  return STATUS_PAGOS_PAGBANK.has(texto(pagamento.status).toUpperCase());
}

function pagamentoQuitadoProvider(provider = "", evento = "", pagamento = {}) {
  return provider === "pagbank" ? pagamentoQuitadoPagbank(evento, pagamento) : pagamentoQuitadoAsaas(evento, pagamento);
}

function formaPagamentoAsaas(pagamento = {}) {
  const tipo = texto(pagamento.billingType || pagamento.billing_type).toUpperCase();
  if (tipo === "PIX") return "PIX";
  if (tipo === "CREDIT_CARD") return "Cartão de crédito";
  if (tipo === "BOLETO") return "Boleto online";
  return "Pagamento online";
}

function formaPagamentoPagbank(pagamento = {}) {
  const metodo = pagamento.payment_method && typeof pagamento.payment_method === "object" ? pagamento.payment_method : {};
  const tipo = texto(pagamento.billingType || pagamento.billing_type || metodo.type).toUpperCase();
  if (tipo === "PIX") return "PIX";
  if (tipo === "CREDIT_CARD") return "Cartão de crédito";
  if (tipo === "DEBIT_CARD") return "Cartão de débito";
  if (tipo === "BOLETO") return "Boleto online";
  return "Pagamento online";
}

function formaPagamentoOnline(provider = "", pagamento = {}) {
  return provider === "pagbank" ? formaPagamentoPagbank(pagamento) : formaPagamentoAsaas(pagamento);
}

function billingType(payload = {}) {
  const bruto = statusNormalizado(payload.forma || payload.billingType || payload.meio || "");
  if (bruto.includes("pix")) return "PIX";
  if (bruto.includes("cart") || bruto.includes("credit")) return "CREDIT_CARD";
  if (bruto.includes("boleto")) return "BOLETO";
  return "UNDEFINED";
}

function vencimentoSeguro(valor = "") {
  const data = texto(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeISO();
}

function parteReferencia(valor = "", limite = 16) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limite) || "x";
}

function codigoEscopo(escopo = "") {
  const normalizado = texto(escopo);
  if (normalizado === "aluno_mensalidade") return "am";
  if (normalizado === "fusion_assinatura") return "fa";
  return parteReferencia(normalizado, 8);
}

function escopoPorCodigo(codigo = "") {
  if (codigo === "am") return "aluno_mensalidade";
  if (codigo === "fa") return "fusion_assinatura";
  return texto(codigo);
}

function externalReference({ escopo, tenantId, alvoId }) {
  const tenantCompacto = parteReferencia(normalizarTenantId(tenantId), 20);
  const alvoCompacto = parteReferencia(alvoId, 16);
  const nonce = crypto.randomBytes(6).toString("hex");
  return ["fp", codigoEscopo(escopo), tenantCompacto, alvoCompacto, nonce].join("|");
}

function parseExternalReference(ref = "") {
  const partes = texto(ref).split("|");
  if (partes[0] === "fp" && partes.length >= 5) {
    return {
      escopo: escopoPorCodigo(partes[1]),
      tenantId: normalizarTenantId(partes[2]),
      alvoId: texto(partes[3]),
      nonce: texto(partes.slice(4).join("|"))
    };
  }
  if (partes[0] !== "fusion" || partes.length < 5) return null;
  return {
    escopo: texto(partes[1]),
    tenantId: normalizarTenantId(partes[2]),
    alvoId: texto(partes[3]),
    nonce: texto(partes.slice(4).join("|"))
  };
}

function checkoutUrl(cobranca = {}) {
  return texto(cobranca.invoiceUrl || cobranca.bankSlipUrl || cobranca.invoice_url || cobranca.url || "");
}

function resumoCobranca(cobranca = {}) {
  return {
    providerPaymentId: texto(cobranca.id),
    statusGateway: texto(cobranca.status),
    invoiceUrl: checkoutUrl(cobranca),
    bankSlipUrl: texto(cobranca.bankSlipUrl),
    value: numero(cobranca.value, 0),
    netValue: numero(cobranca.netValue, 0),
    dueDate: texto(cobranca.dueDate).slice(0, 10),
    billingType: texto(cobranca.billingType)
  };
}

function valorEmCentavos(valor = 0) {
  return Math.max(1, Math.round(numero(valor, 0) * 100));
}

function valorDeCentavos(valor = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? Number((n / 100).toFixed(2)) : 0;
}

function basePublicaFusion() {
  return texto(
    process.env.FUSION_PUBLIC_URL ||
    process.env.FUSION_APP_URL ||
    process.env.PUBLIC_URL ||
    "https://fusionsistema.com.br"
  ).replace(/\/+$/, "");
}

function urlWebhookPagbank() {
  const custom = texto(process.env.FUSION_PAGBANK_WEBHOOK_URL);
  return custom || `${basePublicaFusion()}/api/pagamentos-online/webhooks/pagbank`;
}

function urlRetornoPagbank({ escopo = "", tenantId = "" } = {}) {
  const customAluno = texto(process.env.FUSION_PAGBANK_ALUNO_REDIRECT_URL);
  const customFusion = texto(process.env.FUSION_PAGBANK_FUSION_REDIRECT_URL);
  const customGeral = texto(process.env.FUSION_PAGBANK_REDIRECT_URL);
  if (escopo === "aluno_mensalidade" && customAluno) return customAluno;
  if (escopo === "fusion_assinatura" && customFusion) return customFusion;
  if (customGeral) return customGeral;
  const tenant = normalizarTenantId(tenantId) || "academia-piloto";
  const caminho = escopo === "aluno_mensalidade" ? `/${tenant}/apps/aluno` : `/${tenant}/app/dashboard`;
  return `${basePublicaFusion()}${caminho}`;
}

function expiracaoCheckoutPagbank() {
  const horas = Number(process.env.FUSION_PAGBANK_CHECKOUT_EXPIRATION_HOURS || 72);
  const ms = Number.isFinite(horas) && horas > 0 ? horas * 60 * 60 * 1000 : 72 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function metodosPagamentoPagbank(payload = {}) {
  const fonte = texto(payload.pagbankPaymentMethods || payload.paymentMethods || process.env.FUSION_PAGBANK_PAYMENT_METHODS || "PIX,CREDIT_CARD");
  const permitidos = new Set(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"]);
  const tipos = fonte
    .split(/[,\s;]+/)
    .map(item => texto(item).toUpperCase())
    .filter(item => permitidos.has(item));
  const finais = tipos.length ? [...new Set(tipos)] : ["PIX", "CREDIT_CARD"];
  return finais.map(type => ({ type }));
}

function configsPagamentoPagbank() {
  const limiteParcelas = Number(process.env.FUSION_PAGBANK_INSTALLMENTS_LIMIT || 1);
  const parcelasSemJuros = Number(process.env.FUSION_PAGBANK_INTEREST_FREE_INSTALLMENTS || 1);
  const config_options = [];
  if (Number.isFinite(limiteParcelas) && limiteParcelas > 0) {
    config_options.push({ option: "INSTALLMENTS_LIMIT", value: String(Math.floor(limiteParcelas)) });
  }
  if (Number.isFinite(parcelasSemJuros) && parcelasSemJuros > 0) {
    config_options.push({ option: "INTEREST_FREE_INSTALLMENTS", value: String(Math.floor(parcelasSemJuros)) });
  }
  return config_options.length ? [{ type: "CREDIT_CARD", config_options }] : [];
}

function resumoCheckoutPagbank(checkout = {}, valor = 0) {
  const url = linkPagamentoPagbank(checkout);
  return {
    providerPaymentId: texto(checkout.id),
    statusGateway: texto(checkout.status),
    invoiceUrl: url,
    value: numero(valor, 0),
    netValue: 0,
    dueDate: hojeISO(),
    billingType: "CHECKOUT"
  };
}

async function lerLista(nome) {
  const valor = await lerJsonDuravel(nome, []);
  return Array.isArray(valor) ? valor : [];
}

async function salvarLista(nome, lista) {
  await salvarJsonDuravel(nome, Array.isArray(lista) ? lista : []);
}

function clienteKey(escopo, ownerId) {
  return `${texto(escopo)}:${texto(ownerId)}`;
}

async function obterOuCriarClienteAsaas({ escopo, ownerId, nome, documento: doc, email, telefone: fone }) {
  const key = clienteKey(escopo, ownerId);
  const clientes = await lerLista(COL_CLIENTES);
  const existente = clientes.find(item => item.key === key && item.providerCustomerId);
  if (existente) return existente;

  if (!asaasConfigurado()) {
    throw erro("Asaas ainda não configurado no servidor. Configure FUSION_ASAAS_API_KEY antes de criar cobranças.", 503, "ASAAS_NOT_CONFIGURED");
  }

  const tenantId = tenantAtual();
  const referencia = `fusion_cliente|${tenantId}|${key}`;
  let customer = null;

  try {
    const lista = await listarClientesAsaas({ externalReference: referencia, limit: 1 });
    customer = Array.isArray(lista?.data) ? lista.data[0] : null;
  } catch {
    customer = null;
  }

  if (!customer?.id) {
    customer = await criarClienteAsaas({
      name: nome,
      cpfCnpj: documento(doc),
      email,
      mobilePhone: telefone(fone),
      externalReference: referencia,
      notificationDisabled: false
    });
  }

  const registro = {
    id: existente?.id || uid("paycust"),
    key,
    tenantId,
    escopo: texto(escopo),
    ownerId: texto(ownerId),
    provider: "asaas",
    providerCustomerId: texto(customer.id),
    nome: texto(nome || customer.name),
    documento: documento(doc || customer.cpfCnpj),
    email: texto(email || customer.email),
    telefone: telefone(fone || customer.mobilePhone),
    externalReference: referencia,
    atualizadoEm: agoraISO(),
    criadoEm: existente?.criadoEm || agoraISO()
  };

  const idx = clientes.findIndex(item => item.key === key);
  if (idx >= 0) clientes[idx] = { ...clientes[idx], ...registro };
  else clientes.push(registro);
  await salvarLista(COL_CLIENTES, clientes);
  return registro;
}

async function criarRegistroCobrancaAsaas({ escopo, target, valor, descricao, vencimento, pagador, payload = {} }) {
  if (!asaasConfigurado()) {
    throw erro("Asaas ainda não configurado no servidor. Configure FUSION_ASAAS_API_KEY antes de criar cobranças.", 503, "ASAAS_NOT_CONFIGURED");
  }

  const tenantId = tenantAtual();
  const alvoId = target.mensalidadeId || target.assinaturaId || target.planoCodigo || target.tituloId || uid("alvo");
  const ref = externalReference({ escopo, tenantId, alvoId });
  const cliente = await obterOuCriarClienteAsaas({
    escopo,
    ownerId: target.alunoId || target.tenantId || tenantId,
    nome: pagador.nome,
    documento: pagador.documento,
    email: pagador.email,
    telefone: pagador.telefone
  });

  const cobranca = await criarCobrancaAsaas({
    customer: cliente.providerCustomerId,
    billingType: billingType(payload),
    value: valor,
    dueDate: vencimentoSeguro(vencimento),
    description: descricao,
    externalReference: ref
  });
  const resumo = resumoCobranca(cobranca);

  const registro = {
    id: uid("payon"),
    tenantId,
    escopo,
    provider: "asaas",
    providerCustomerId: cliente.providerCustomerId,
    providerPaymentId: resumo.providerPaymentId,
    externalReference: ref,
    status: "criada",
    statusGateway: resumo.statusGateway,
    valor: numero(valor, 0),
    moeda: "BRL",
    vencimento: vencimentoSeguro(vencimento),
    descricao,
    invoiceUrl: resumo.invoiceUrl,
    bankSlipUrl: resumo.bankSlipUrl,
    billingType: resumo.billingType,
    target,
    eventos: [],
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  const pagamentos = await lerLista(COL_PAGAMENTOS);
  pagamentos.unshift(registro);
  await salvarLista(COL_PAGAMENTOS, pagamentos);
  return registro;
}

async function criarRegistroCobrancaPagbank({ escopo, target, valor, descricao, vencimento, pagador: _pagador, payload = {} }) {
  if (!pagbankConfigurado()) {
    throw erro("PagBank ainda não configurado no servidor. Configure FUSION_PAGBANK_TOKEN antes de criar checkouts.", 503, "PAGBANK_NOT_CONFIGURED");
  }

  const tenantId = tenantAtual();
  const alvoId = target.mensalidadeId || target.assinaturaId || target.planoCodigo || target.tituloId || uid("alvo");
  const ref = externalReference({ escopo, tenantId, alvoId });
  const webhookUrl = urlWebhookPagbank();
  const paymentMethods = metodosPagamentoPagbank(payload);
  const paymentMethodsConfigs = paymentMethods.some(item => item.type === "CREDIT_CARD") ? configsPagamentoPagbank() : [];

  const checkoutPayload = {
    reference_id: ref,
    expiration_date: expiracaoCheckoutPagbank(),
    customer_modifiable: true,
    items: [
      {
        reference_id: parteReferencia(alvoId, 64),
        name: texto(descricao || "Pagamento Fusion").slice(0, 100),
        quantity: 1,
        unit_amount: valorEmCentavos(valor)
      }
    ],
    payment_methods: paymentMethods,
    redirect_url: urlRetornoPagbank({ escopo, tenantId }),
    notification_urls: [webhookUrl],
    payment_notification_urls: [webhookUrl]
  };
  if (paymentMethodsConfigs.length) checkoutPayload.payment_methods_configs = paymentMethodsConfigs;

  const checkout = await criarCheckoutPagbank(checkoutPayload);
  const resumo = resumoCheckoutPagbank(checkout, valor);

  if (!resumo.invoiceUrl) {
    throw erro("PagBank criou o checkout, mas não retornou o link de pagamento.", 502, "PAGBANK_PAY_LINK_MISSING");
  }

  const registro = {
    id: uid("payon"),
    tenantId,
    escopo,
    provider: "pagbank",
    providerPaymentId: resumo.providerPaymentId,
    providerCheckoutId: resumo.providerPaymentId,
    externalReference: ref,
    status: "criada",
    statusGateway: resumo.statusGateway,
    valor: numero(valor, 0),
    moeda: "BRL",
    vencimento: vencimentoSeguro(vencimento),
    descricao,
    invoiceUrl: resumo.invoiceUrl,
    checkoutUrl: resumo.invoiceUrl,
    billingType: resumo.billingType,
    target,
    eventos: [],
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  const pagamentos = await lerLista(COL_PAGAMENTOS);
  pagamentos.unshift(registro);
  await salvarLista(COL_PAGAMENTOS, pagamentos);
  return registro;
}

async function criarRegistroCobranca(dados = {}) {
  const provider = providerAtual();
  if (!providerConfigurado(provider)) {
    throw erro(`${nomeProvider(provider)} ainda não configurado no servidor. Configure as variáveis seguras antes de criar cobranças.`, 503, `${provider.toUpperCase()}_NOT_CONFIGURED`);
  }
  return provider === "pagbank" ? criarRegistroCobrancaPagbank(dados) : criarRegistroCobrancaAsaas(dados);
}

function pagamentoAbertoExistente(lista = [], filtro = {}) {
  const provider = filtro.provider || providerAtual();
  return lista.find(item => {
    if (item.provider !== provider) return false;
    if (!STATUS_ABERTOS.has(statusNormalizado(item.status))) return false;
    if (filtro.escopo && item.escopo !== filtro.escopo) return false;
    if (filtro.mensalidadeId && texto(item.target?.mensalidadeId) !== texto(filtro.mensalidadeId)) return false;
    if (filtro.planoCodigo && texto(item.target?.planoCodigo) !== texto(filtro.planoCodigo)) return false;
    return Boolean(item.invoiceUrl);
  });
}

function respostaCheckout(registro = {}) {
  return {
    ok: true,
    pagamento: {
      id: registro.id,
      provider: registro.provider,
      status: registro.status,
      valor: registro.valor,
      vencimento: registro.vencimento,
      escopo: registro.escopo,
      target: registro.target
    },
    checkout: {
      url: registro.invoiceUrl,
      providerPaymentId: registro.providerPaymentId,
      billingType: registro.billingType,
      mensagem: registro.invoiceUrl ? "Cobrança criada. Abra o link para concluir o pagamento." : "Cobrança criada."
    }
  };
}

function ordenarPorVencimento(a = {}, b = {}) {
  return texto(a.vencimento).localeCompare(texto(b.vencimento));
}

async function iniciarPagamentoAlunoTenant(identidade = {}, payload = {}) {
  const alunoId = texto(identidade.legacyId);
  if (!alunoId) throw erro("Aluno não identificado para pagamento.", 401, "STUDENT_NOT_IDENTIFIED");

  const mensalidades = await listarMensalidades({ alunoId });
  const candidatas = (Array.isArray(mensalidades) ? mensalidades : [])
    .filter(item => {
      if (payload.mensalidadeId && texto(item.id) !== texto(payload.mensalidadeId)) return false;
      if (pago(item.status) || cancelado(item.status) || programado(item.status)) return false;
      return valorPositivo(item.valorRestante, item.saldoRestante, item.valorAtualizado, item.valor) > 0;
    })
    .sort(ordenarPorVencimento);

  const mensalidade = candidatas[0];
  if (!mensalidade) {
    throw erro("Nenhuma mensalidade em aberto foi encontrada para pagamento online.", 404, "NO_OPEN_MONTHLY_PAYMENT");
  }

  const pagamentos = await lerLista(COL_PAGAMENTOS);
  const aberta = pagamentoAbertoExistente(pagamentos, { escopo: "aluno_mensalidade", mensalidadeId: mensalidade.id });
  if (aberta) return respostaCheckout(aberta);

  const vinculo = await garantirLancamentoFinanceiroMensalidade(mensalidade.id);
  const titulo = vinculo.lancamento || (await listarTitulos({}))
    .find(item => texto(item.mensalidadeId) === texto(mensalidade.id) || texto(item.id) === texto(vinculo.financeiroId));

  if (!titulo?.id) {
    throw erro("Esta mensalidade ainda não possui título financeiro reconciliado.", 409, "MONTHLY_LEDGER_NOT_FOUND");
  }
  if (pago(titulo.status) || cancelado(titulo.status)) {
    throw erro("Esta mensalidade não está disponível para pagamento.", 409, "MONTHLY_NOT_PAYABLE");
  }

  const valor = valorPositivo(titulo.valorRestante, titulo.saldo, mensalidade.valorRestante, mensalidade.valorAtualizado, mensalidade.valor);
  if (!(valor > 0)) throw erro("Mensalidade sem saldo para pagamento.", 409, "MONTHLY_WITHOUT_BALANCE");

  const aluno = identidade.aluno || {};
  const homeAluno = identidade.home?.aluno || {};
  const pagador = {
    nome: texto(aluno.nome || homeAluno.nome || mensalidade.alunoNome || mensalidade.aluno),
    documento: documento(aluno.cpf || aluno.documento || aluno.cpfCnpj || aluno.cpf_cnpj),
    email: texto(aluno.email || aluno.emailResponsavel || aluno.responsavelEmail || ""),
    telefone: telefone(aluno.telefone || aluno.whatsapp || aluno.celular || "")
  };

  const registro = await criarRegistroCobranca({
    escopo: "aluno_mensalidade",
    target: {
      alunoId,
      mensalidadeId: mensalidade.id,
      tituloId: titulo.id,
      matriculaId: mensalidade.matriculaId || titulo.matriculaId || "",
      competencia: mensalidade.competencia || "",
      origem: "app_aluno"
    },
    valor,
    vencimento: mensalidade.vencimento || hojeISO(),
    descricao: `Mensalidade ${mensalidade.competencia || ""} - ${pagador.nome || "Aluno"}`.trim(),
    pagador,
    payload
  });

  return respostaCheckout(registro);
}

export async function iniciarPagamentoAlunoApp(req, res, deviceToken, payload = {}) {
  const identidade = await identidadeAlunoApp(req, res, deviceToken);
  return executarComTenant(identidade.tenantId, () => iniciarPagamentoAlunoTenant(identidade, payload));
}

async function dadosTenantSaas(tenantId = tenantAtual()) {
  if (!supabaseConfigurado()) return {};
  try {
    const supabase = obterSupabaseAdmin();
    const { data, error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id,name,legal_name,document,responsible_name,responsible_email,responsible_phone")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) return {};
    return data || {};
  } catch {
    return {};
  }
}

export async function iniciarPagamentoContratacaoFusion(payload = {}, usuario = {}) {
  const plano = resolverPlanoFusion(payload.planoCodigo || payload.plano || payload.planoSistema || "mensal-sem-fidelidade");
  if (plano.codigo === "free" || !(numero(plano.valorCiclo, 0) > 0)) {
    return {
      ok: true,
      semCobranca: true,
      plano,
      mensagem: "Plano sem cobrança online."
    };
  }

  let billing = await obterBillingFusion();
  if (!billing.assinatura?.id || billing.assinatura.planoCodigo !== plano.codigo) {
    billing = await formalizarContratacaoFusion({
      planoCodigo: plano.codigo,
      periodoMeses: plano.periodoMeses,
      valorMensal: plano.valorMensal,
      valorCiclo: plano.valorCiclo,
      status: "inadimplente",
      motivo: "Aguardando pagamento online"
    }, usuario);
  }

  const pagamentos = await lerLista(COL_PAGAMENTOS);
  const aberta = pagamentoAbertoExistente(pagamentos, { escopo: "fusion_assinatura", planoCodigo: plano.codigo });
  if (aberta) return respostaCheckout(aberta);

  const tenantId = tenantAtual();
  const tenant = await dadosTenantSaas(tenantId);
  const pagadorPayload = payload.pagador || {};
  const pagador = {
    nome: texto(pagadorPayload.nome || tenant.legal_name || tenant.name || usuario.nome || tenantId),
    documento: documento(pagadorPayload.documento || tenant.document),
    email: texto(pagadorPayload.email || tenant.responsible_email || usuario.email || ""),
    telefone: telefone(pagadorPayload.telefone || tenant.responsible_phone || "")
  };

  const registro = await criarRegistroCobranca({
    escopo: "fusion_assinatura",
    target: {
      tenantId,
      assinaturaId: billing.assinatura?.id || "",
      planoCodigo: plano.codigo,
      periodoMeses: plano.periodoMeses
    },
    valor: plano.valorCiclo,
    vencimento: payload.vencimento || hojeISO(),
    descricao: `Assinatura Fusion - ${plano.nome}`,
    pagador,
    payload
  });

  return respostaCheckout(registro);
}

async function garantirCaixaParaOnline() {
  const atual = await obterCaixaAtual();
  if (atual?.aberto && atual.caixa?.id) {
    return { caixaId: atual.caixa.id, criadoOnline: false };
  }

  const caixa = await abrirCaixa({
    valorAbertura: 0,
    responsavel: "Pagamento Online",
    observacao: "Aberto automaticamente para baixa de pagamento online."
  });
  return { caixaId: caixa.id, criadoOnline: true };
}

async function fecharCaixaOnlineSeCriado(controle = {}) {
  if (!controle.criadoOnline || !controle.caixaId) return;
  const atual = await obterCaixaAtual();
  if (atual?.aberto && texto(atual.caixa?.id) === texto(controle.caixaId)) {
    await fecharCaixa({
      valorFechamentoInformado: atual.totais?.saldoAtual ?? 0,
      observacao: "Fechado automaticamente após pagamento online."
    });
  }
}

function atualizarRegistroPagamento(lista = [], registro = {}, patch = {}) {
  const idx = lista.findIndex(item =>
    texto(item.id) === texto(registro.id) ||
    texto(item.providerPaymentId) === texto(registro.providerPaymentId) ||
    texto(item.externalReference) === texto(registro.externalReference)
  );
  if (idx < 0) return lista;
  lista[idx] = { ...lista[idx], ...patch, atualizadoEm: agoraISO() };
  return lista[idx];
}

async function baixaAlunoMensalidade(registro = {}, pagamento = {}, evento = "") {
  if (statusNormalizado(registro.status) === "baixada") {
    return { ok: true, idempotente: true, registro };
  }

  const controleCaixa = await garantirCaixaParaOnline();
  try {
    const valor = valorPositivo(pagamento.value, registro.valor);
    const netValue = valorPositivo(pagamento.netValue);
    const taxa = netValue > 0 ? Math.max(0, Number((valor - netValue).toFixed(2))) : 0;
    const formaPagamento = formaPagamentoOnline(registro.provider, pagamento);
    const dataPagamento = texto(pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.confirmedDate).slice(0, 10) || hojeISO();
    const providerNome = nomeProvider(registro.provider);

    const resultado = await receberTitulos({
      operacaoId: texto(pagamento.id || registro.providerPaymentId || registro.externalReference),
      tituloId: registro.target?.tituloId,
      valor,
      valorPago: valor,
      valorEntregue: valor,
      destinoDiferenca: "credito",
      formaPagamento,
      pagamentos: [{ formaPagamento, valor, taxa }],
      dataPagamento,
      usuario: "pagamento-online",
      observacao: `Baixa automática ${providerNome} ${texto(evento)} ${texto(pagamento.id || registro.providerPaymentId)}`.trim()
    });

    let cobrancaAutomatica = { ok: true, programada: false };
    if (!resultado.idempotente) {
      try {
        cobrancaAutomatica = await programarProximaCobrancaAposPagamento({
          financeiroId: registro.target?.tituloId,
          mensalidadeId: registro.target?.mensalidadeId,
          alunoId: registro.target?.alunoId,
          usuario: "pagamento-online"
        });
      } catch (erroAgenda) {
        cobrancaAutomatica = { ok: false, aviso: true, programada: false, motivo: erroAgenda.message };
      }
    }

    return { ok: true, resultado, cobrancaAutomatica };
  } finally {
    await fecharCaixaOnlineSeCriado(controleCaixa);
  }
}

async function atualizarTenantPagoFusion(tenantId = "", assinatura = {}) {
  if (!supabaseConfigurado()) return { ok: true, atualizado: false, motivo: "supabase_nao_configurado" };
  const supabase = obterSupabaseAdmin();
  const { error } = await supabase
    .from("fusion_tenants")
    .update({
      status: "active",
      plan_code: assinatura.planoCodigo || assinatura.plan_code || null,
      trial_ends_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, atualizado: false, motivo: error.message };
  return { ok: true, atualizado: true };
}

async function baixaAssinaturaFusion(registro = {}, pagamento = {}) {
  const valor = valorPositivo(pagamento.value, registro.valor);
  const dataPagamento = texto(pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.confirmedDate).slice(0, 10) || hojeISO();
  const providerNome = nomeProvider(registro.provider);
  const resultado = await registrarPagamentoFusion({
    valor,
    forma: formaPagamentoOnline(registro.provider, pagamento),
    referencia: texto(pagamento.id || registro.providerPaymentId),
    recebidoEm: dataPagamento,
    periodoMeses: registro.target?.periodoMeses || 1,
    observacao: `Pagamento online confirmado pelo ${providerNome}.`
  }, {
    id: "pagamento-online",
    nome: "Pagamento Online",
    perfil: "sistema"
  });

  const tenant = await atualizarTenantPagoFusion(tenantAtual(), resultado.assinatura || {});
  return { ok: true, resultado, tenant };
}

async function obterRegistroPorPagamento({ providerPaymentId = "", externalReference: ref = "" } = {}) {
  const pagamentos = await lerLista(COL_PAGAMENTOS);
  return pagamentos.find(item =>
    (providerPaymentId && texto(item.providerPaymentId) === texto(providerPaymentId)) ||
    (ref && texto(item.externalReference) === texto(ref))
  ) || null;
}

async function processarPagamentoConfirmado({ tenantId, evento, pagamento }) {
  return executarComTenant(tenantId, async () => executarTransacaoJson(async () => {
    const lista = await lerLista(COL_PAGAMENTOS);
    const registro = await obterRegistroPorPagamento({
      providerPaymentId: pagamento.providerPaymentId || pagamento.checkoutId || pagamento.id,
      externalReference: pagamento.externalReference
    });
    if (!registro) return { ok: true, ignorado: true, motivo: "registro_nao_encontrado" };

    const eventoId = texto(pagamento.webhookEventId || pagamento.eventId || `${evento}:${pagamento.id}:${pagamento.status}`);
    if (Array.isArray(registro.eventos) && registro.eventos.some(item => texto(item.id) === eventoId)) {
      return { ok: true, idempotente: true, registro };
    }

    const baseEvento = {
      id: eventoId,
      evento: texto(evento),
      providerPaymentId: texto(pagamento.id),
      statusGateway: texto(pagamento.status),
      recebidoEm: agoraISO()
    };

    let baixa = { ok: true, pendente: true };
    const quitado = pagamentoQuitadoProvider(registro.provider, evento, pagamento);
    let statusFinal = quitado ? "paga" : "pendente";
    if (quitado) {
      if (registro.escopo === "aluno_mensalidade") {
        baixa = await baixaAlunoMensalidade(registro, pagamento, evento);
        statusFinal = "baixada";
      } else if (registro.escopo === "fusion_assinatura") {
        baixa = await baixaAssinaturaFusion(registro, pagamento);
        statusFinal = "baixada";
      }
    }

    const atualizado = atualizarRegistroPagamento(lista, registro, {
      status: statusFinal,
      statusGateway: texto(pagamento.status),
      valorConfirmado: valorPositivo(pagamento.value, registro.valor),
      confirmadoEm: statusFinal === "baixada" ? agoraISO() : registro.confirmadoEm || "",
      baixa,
      eventos: [...(Array.isArray(registro.eventos) ? registro.eventos : []), baseEvento]
    });

    await salvarLista(COL_PAGAMENTOS, lista);
    return { ok: true, registro: atualizado, baixa };
  }, { operacaoId: `pagamento-online-webhook-${pagamento.id || crypto.randomUUID()}` }));
}

function validarWebhookToken(headers = {}) {
  const esperado = texto(process.env.FUSION_ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_TOKEN);
  if (!esperado) {
    throw erro("Token de webhook Asaas não configurado no servidor.", 503, "ASAAS_WEBHOOK_TOKEN_NOT_CONFIGURED");
  }
  const recebido = texto(headers["asaas-access-token"] || headers["Asaas-Access-Token"]);
  if (!recebido || recebido !== esperado) {
    throw erro("Webhook Asaas não autorizado.", 401, "ASAAS_WEBHOOK_UNAUTHORIZED");
  }
}

function headerValor(headers = {}, nome = "") {
  const alvo = texto(nome).toLowerCase();
  const direto = headers[alvo] || headers[nome] || headers[nome.toUpperCase()];
  if (direto) return texto(direto);
  const entrada = Object.entries(headers).find(([chave]) => texto(chave).toLowerCase() === alvo);
  return texto(entrada?.[1]);
}

function validarWebhookPagbank({ headers = {}, rawBody = "" } = {}) {
  const esperado = texto(
    process.env.FUSION_PAGBANK_WEBHOOK_TOKEN ||
    process.env.PAGBANK_WEBHOOK_TOKEN ||
    process.env.FUSION_PAGBANK_NOTIFICATION_TOKEN
  );
  if (!esperado) {
    throw erro("Token de webhook PagBank não configurado no servidor.", 503, "PAGBANK_WEBHOOK_TOKEN_NOT_CONFIGURED");
  }

  const payload = typeof rawBody === "string" ? rawBody : "";
  if (!payload) {
    throw erro("Payload bruto do webhook PagBank não disponível para validação.", 400, "PAGBANK_WEBHOOK_RAW_BODY_REQUIRED");
  }

  const recebido = headerValor(headers, "x-authenticity-token");
  const assinatura = crypto.createHash("sha256").update(`${esperado}-${payload}`).digest("hex");
  const a = Buffer.from(assinatura, "utf8");
  const b = Buffer.from(recebido, "utf8");
  if (!recebido || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw erro("Webhook PagBank não autorizado.", 401, "PAGBANK_WEBHOOK_UNAUTHORIZED");
  }
}

function primeiraCobrancaPagbank(body = {}) {
  const charges = Array.isArray(body.charges) ? body.charges : [];
  return charges.find(item => texto(item.status)) || charges[0] || {};
}

function pagamentoDoWebhookPagbank(body = {}) {
  const charge = primeiraCobrancaPagbank(body);
  const amount = charge.amount && typeof charge.amount === "object" ? charge.amount : (body.amount || {});
  const summary = amount.summary && typeof amount.summary === "object" ? amount.summary : {};
  const valorCentavos = Number(summary.paid || amount.value || summary.total || 0);
  const liquidoCentavos = Number(summary.net || summary.net_value || summary.netValue || 0);
  const checkoutId = texto(body.id).startsWith("CHEC_") ? texto(body.id) : texto(body.checkout_id || body.checkoutId);
  const status = texto(charge.status || body.status);
  const eventId = texto(body.notification_id || body.notificationId || `${checkoutId || body.id}:${charge.id || ""}:${status}`);
  return {
    id: texto(charge.id || body.payment_id || body.paymentId || checkoutId || body.id),
    providerPaymentId: checkoutId,
    checkoutId,
    webhookEventId: eventId,
    externalReference: texto(body.reference_id || body.external_reference || body.externalReference || charge.reference_id),
    status,
    value: valorDeCentavos(valorCentavos),
    netValue: valorDeCentavos(liquidoCentavos),
    billingType: texto(charge.payment_method?.type || body.payment_method?.type),
    payment_method: charge.payment_method || body.payment_method || {},
    paymentDate: texto(charge.paid_at || body.paid_at || body.updated_at || body.created_at).slice(0, 10)
  };
}

export async function receberWebhookAsaas({ headers = {}, body = {} } = {}) {
  validarWebhookToken(headers);

  const evento = texto(body.event || body.type);
  const payloadPagamento = body.payment && typeof body.payment === "object" ? body.payment : {};
  const providerPaymentId = texto(payloadPagamento.id || body.paymentId || body.id);
  if (!providerPaymentId) return { ok: true, ignorado: true, motivo: "sem_payment_id" };

  let pagamento = { ...payloadPagamento, id: providerPaymentId, webhookEventId: texto(body.id) };
  if (asaasConfigurado()) {
    try {
      const completo = await recuperarCobrancaAsaas(providerPaymentId);
      pagamento = { ...pagamento, ...completo, id: providerPaymentId, webhookEventId: texto(body.id) };
    } catch {
      // Mantém o payload recebido para não travar uma baixa quando o Asaas já
      // enviou o status final e a consulta pontual falhou momentaneamente.
    }
  }

  const referencia = texto(pagamento.externalReference || payloadPagamento.externalReference);
  const parsed = parseExternalReference(referencia);
  if (!parsed?.tenantId) return { ok: true, ignorado: true, motivo: "external_reference_fora_do_fusion" };

  pagamento.externalReference = referencia;
  return processarPagamentoConfirmado({
    tenantId: parsed.tenantId,
    evento,
    pagamento
  });
}

export async function receberWebhookPagbank({ headers = {}, body = {}, rawBody = "" } = {}) {
  validarWebhookPagbank({ headers, rawBody });

  const pagamento = pagamentoDoWebhookPagbank(body);
  if (!pagamento.id && !pagamento.externalReference) return { ok: true, ignorado: true, motivo: "sem_identificador_pagbank" };

  const parsed = parseExternalReference(pagamento.externalReference);
  if (!parsed?.tenantId) return { ok: true, ignorado: true, motivo: "external_reference_fora_do_fusion" };

  return processarPagamentoConfirmado({
    tenantId: parsed.tenantId,
    evento: "PAGBANK_WEBHOOK",
    pagamento
  });
}

export async function consultarPagamentoOnline(id = "") {
  const pagamentoId = texto(id);
  if (!pagamentoId) throw erro("Pagamento não informado.", 400, "PAYMENT_ID_REQUIRED");
  const lista = await lerLista(COL_PAGAMENTOS);
  const registro = lista.find(item => texto(item.id) === pagamentoId || texto(item.providerPaymentId) === pagamentoId);
  if (!registro) throw erro("Pagamento online não encontrado.", 404, "PAYMENT_NOT_FOUND");
  return respostaCheckout(registro);
}
