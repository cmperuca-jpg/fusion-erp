import crypto from "node:crypto";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQ_CONFIG = "pagamentos_online_config.json";
const PREFIXO_SEGREDO = "enc:v1:";

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function statusNormalizado(valor = "") {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function numeroInteiro(valor, fallback = 1, minimo = 1, maximo = 99) {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(maximo, Math.max(minimo, n));
}

function bool(valor) {
  return ["1", "true", "sim", "yes", "on"].includes(statusNormalizado(valor));
}

function providerSeguro(valor = "") {
  const normalizado = statusNormalizado(valor);
  if (["pagbank", "pagseguro"].includes(normalizado)) return "pagbank";
  if (["infinitepay", "infinite-pay", "infinite_pay", "infinite", "infinyt"].includes(normalizado)) return "infinitepay";
  return "asaas";
}

function ambienteSeguro(valor = "") {
  const normalizado = statusNormalizado(valor);
  return ["prod", "production", "producao"].includes(normalizado) ? "production" : "sandbox";
}

function metodosSeguros(valor = "") {
  const bruto = Array.isArray(valor) ? valor.join(",") : texto(valor);
  const permitidos = new Set(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"]);
  const metodos = bruto
    .split(/[,\s;]+/)
    .map(item => texto(item).toUpperCase())
    .filter(item => permitidos.has(item));
  return metodos.length ? [...new Set(metodos)] : ["PIX", "CREDIT_CARD"];
}

function chaveCripto() {
  const segredo = texto(process.env.FUSION_CONFIG_SECRET_KEY || process.env.JWT_SECRET || process.env.FUSION_APP_SUPABASE_SECRET);
  if (!segredo) return null;
  return crypto.createHash("sha256").update(segredo).digest();
}

function criptografarSegredo(valor = "") {
  const segredo = texto(valor);
  if (!segredo) return "";
  const chave = chaveCripto();
  if (!chave) return segredo;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const criptografado = Buffer.concat([cipher.update(segredo, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIXO_SEGREDO}${iv.toString("base64")}:${tag.toString("base64")}:${criptografado.toString("base64")}`;
}

function descriptografarSegredo(valor = "") {
  const segredo = texto(valor);
  if (!segredo || !segredo.startsWith(PREFIXO_SEGREDO)) return segredo;
  const chave = chaveCripto();
  if (!chave) return "";
  const partes = segredo.slice(PREFIXO_SEGREDO.length).split(":");
  if (partes.length !== 3) return "";
  try {
    const [iv64, tag64, conteudo64] = partes;
    const decipher = crypto.createDecipheriv("aes-256-gcm", chave, Buffer.from(iv64, "base64"));
    decipher.setAuthTag(Buffer.from(tag64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(conteudo64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function mascararSegredo(valor = "") {
  const segredo = texto(valor);
  if (!segredo) return "";
  if (segredo.length <= 8) return "********";
  return `${segredo.slice(0, 4)}...${segredo.slice(-4)}`;
}

function urlBasePublica(valor = "") {
  return texto(valor || process.env.FUSION_PUBLIC_URL || process.env.FUSION_APP_URL || process.env.PUBLIC_URL || "https://fusionsistema.com.br")
    .replace(/\/+$/, "");
}

function handleInfinitePay(valor = "") {
  return texto(valor).replace(/^\$+/, "");
}

function configEnvPagbank() {
  return {
    ambiente: ambienteSeguro(process.env.FUSION_PAGBANK_ENV || process.env.PAGBANK_ENV || "sandbox"),
    publicUrl: urlBasePublica(),
    token: texto(process.env.FUSION_PAGBANK_TOKEN || process.env.PAGBANK_TOKEN),
    webhookToken: texto(process.env.FUSION_PAGBANK_WEBHOOK_TOKEN || process.env.PAGBANK_WEBHOOK_TOKEN || process.env.FUSION_PAGBANK_NOTIFICATION_TOKEN),
    paymentMethods: metodosSeguros(process.env.FUSION_PAGBANK_PAYMENT_METHODS || "PIX,CREDIT_CARD"),
    installmentsLimit: numeroInteiro(process.env.FUSION_PAGBANK_INSTALLMENTS_LIMIT || 1, 1, 1, 18),
    interestFreeInstallments: numeroInteiro(process.env.FUSION_PAGBANK_INTEREST_FREE_INSTALLMENTS || 1, 1, 1, 18),
    checkoutExpirationHours: numeroInteiro(process.env.FUSION_PAGBANK_CHECKOUT_EXPIRATION_HOURS || 72, 72, 1, 720),
    redirectUrl: texto(process.env.FUSION_PAGBANK_REDIRECT_URL),
    alunoRedirectUrl: texto(process.env.FUSION_PAGBANK_ALUNO_REDIRECT_URL),
    fusionRedirectUrl: texto(process.env.FUSION_PAGBANK_FUSION_REDIRECT_URL),
    webhookUrl: texto(process.env.FUSION_PAGBANK_WEBHOOK_URL)
  };
}

function configEnvInfinitePay() {
  return {
    publicUrl: urlBasePublica(),
    handle: handleInfinitePay(process.env.FUSION_INFINITEPAY_HANDLE || process.env.INFINITEPAY_HANDLE || process.env.FUSION_INFINITEPAY_TAG || process.env.INFINITEPAY_TAG),
    baseUrl: texto(process.env.FUSION_INFINITEPAY_BASE_URL || process.env.INFINITEPAY_BASE_URL || "https://api.checkout.infinitepay.io").replace(/\/+$/, ""),
    redirectUrl: texto(process.env.FUSION_INFINITEPAY_REDIRECT_URL || process.env.INFINITEPAY_REDIRECT_URL),
    alunoRedirectUrl: texto(process.env.FUSION_INFINITEPAY_ALUNO_REDIRECT_URL || process.env.INFINITEPAY_ALUNO_REDIRECT_URL),
    fusionRedirectUrl: texto(process.env.FUSION_INFINITEPAY_FUSION_REDIRECT_URL || process.env.INFINITEPAY_FUSION_REDIRECT_URL),
    webhookUrl: texto(process.env.FUSION_INFINITEPAY_WEBHOOK_URL || process.env.INFINITEPAY_WEBHOOK_URL)
  };
}

async function configArquivo() {
  const atual = await lerJsonDuravel(ARQ_CONFIG, {});
  return atual && typeof atual === "object" ? atual : {};
}

function configPagbankComFallback(atual = {}) {
  const env = configEnvPagbank();
  const pagbank = atual.pagbank && typeof atual.pagbank === "object" ? atual.pagbank : {};
  const tokenTela = descriptografarSegredo(pagbank.token);
  const webhookTela = descriptografarSegredo(pagbank.webhookToken);
  const publicUrl = urlBasePublica(pagbank.publicUrl || env.publicUrl);

  return {
    ambiente: ambienteSeguro(pagbank.ambiente || env.ambiente),
    publicUrl,
    token: tokenTela || env.token,
    webhookToken: webhookTela || env.webhookToken,
    paymentMethods: metodosSeguros(pagbank.paymentMethods || env.paymentMethods),
    installmentsLimit: numeroInteiro(pagbank.installmentsLimit ?? env.installmentsLimit, 1, 1, 18),
    interestFreeInstallments: numeroInteiro(pagbank.interestFreeInstallments ?? env.interestFreeInstallments, 1, 1, 18),
    checkoutExpirationHours: numeroInteiro(pagbank.checkoutExpirationHours ?? env.checkoutExpirationHours, 72, 1, 720),
    redirectUrl: texto(pagbank.redirectUrl || env.redirectUrl),
    alunoRedirectUrl: texto(pagbank.alunoRedirectUrl || env.alunoRedirectUrl),
    fusionRedirectUrl: texto(pagbank.fusionRedirectUrl || env.fusionRedirectUrl),
    webhookUrl: texto(pagbank.webhookUrl || env.webhookUrl || `${publicUrl}/api/pagamentos-online/webhooks/pagbank`),
    origemToken: tokenTela ? "tela" : (env.token ? "env" : ""),
    origemWebhookToken: webhookTela ? "tela" : (env.webhookToken ? "env" : "")
  };
}

function configInfinitePayComFallback(atual = {}) {
  const env = configEnvInfinitePay();
  const infinitepay = atual.infinitepay && typeof atual.infinitepay === "object" ? atual.infinitepay : {};
  const handleTela = handleInfinitePay(infinitepay.handle);
  const publicUrl = urlBasePublica(infinitepay.publicUrl || env.publicUrl);

  return {
    publicUrl,
    handle: handleTela || env.handle,
    baseUrl: texto(infinitepay.baseUrl || env.baseUrl || "https://api.checkout.infinitepay.io").replace(/\/+$/, ""),
    redirectUrl: texto(infinitepay.redirectUrl || env.redirectUrl),
    alunoRedirectUrl: texto(infinitepay.alunoRedirectUrl || env.alunoRedirectUrl),
    fusionRedirectUrl: texto(infinitepay.fusionRedirectUrl || env.fusionRedirectUrl),
    webhookUrl: texto(infinitepay.webhookUrl || env.webhookUrl || `${publicUrl}/api/pagamentos-online/webhooks/infinitepay`),
    origemHandle: handleTela ? "tela" : (env.handle ? "env" : "")
  };
}

export async function obterConfiguracaoPagamentosRuntime() {
  const atual = await configArquivo();
  const provider = providerSeguro(atual.provider || process.env.FUSION_PAYMENTS_PROVIDER || process.env.FUSION_GATEWAY_PAGAMENTOS || "asaas");
  return {
    provider,
    pagbank: configPagbankComFallback(atual),
    infinitepay: configInfinitePayComFallback(atual)
  };
}

export async function obterConfiguracaoPagamentosPublica() {
  const runtime = await obterConfiguracaoPagamentosRuntime();
  const providerConfigurado = runtime.provider === "pagbank"
    ? Boolean(runtime.pagbank.token && runtime.pagbank.webhookToken)
    : runtime.provider === "infinitepay"
      ? Boolean(runtime.infinitepay.handle)
      : Boolean(process.env.FUSION_ASAAS_API_KEY || process.env.ASAAS_API_KEY);
  return {
    ok: true,
    configuracao: {
      provider: runtime.provider,
      providerConfigurado,
      pagbank: {
        ambiente: runtime.pagbank.ambiente,
        publicUrl: runtime.pagbank.publicUrl,
        paymentMethods: runtime.pagbank.paymentMethods,
        installmentsLimit: runtime.pagbank.installmentsLimit,
        interestFreeInstallments: runtime.pagbank.interestFreeInstallments,
        checkoutExpirationHours: runtime.pagbank.checkoutExpirationHours,
        redirectUrl: runtime.pagbank.redirectUrl,
        alunoRedirectUrl: runtime.pagbank.alunoRedirectUrl,
        fusionRedirectUrl: runtime.pagbank.fusionRedirectUrl,
        webhookUrl: runtime.pagbank.webhookUrl,
        tokenConfigurado: Boolean(runtime.pagbank.token),
        webhookTokenConfigurado: Boolean(runtime.pagbank.webhookToken),
        tokenResumo: mascararSegredo(runtime.pagbank.token),
        webhookTokenResumo: mascararSegredo(runtime.pagbank.webhookToken),
        origemToken: runtime.pagbank.origemToken,
        origemWebhookToken: runtime.pagbank.origemWebhookToken
      },
      infinitepay: {
        publicUrl: runtime.infinitepay.publicUrl,
        handle: runtime.infinitepay.handle,
        baseUrl: runtime.infinitepay.baseUrl,
        redirectUrl: runtime.infinitepay.redirectUrl,
        alunoRedirectUrl: runtime.infinitepay.alunoRedirectUrl,
        fusionRedirectUrl: runtime.infinitepay.fusionRedirectUrl,
        webhookUrl: runtime.infinitepay.webhookUrl,
        handleConfigurado: Boolean(runtime.infinitepay.handle),
        handleResumo: runtime.infinitepay.handle ? `$${runtime.infinitepay.handle}` : "",
        origemHandle: runtime.infinitepay.origemHandle
      }
    }
  };
}

export async function salvarConfiguracaoPagamentos(dados = {}, usuario = {}) {
  const atual = await configArquivo();
  const entradaPagbank = dados.pagbank && typeof dados.pagbank === "object" ? dados.pagbank : {};
  const existentePagbank = atual.pagbank && typeof atual.pagbank === "object" ? atual.pagbank : {};
  const entradaInfinitePay = dados.infinitepay && typeof dados.infinitepay === "object" ? dados.infinitepay : {};
  const existenteInfinitePay = atual.infinitepay && typeof atual.infinitepay === "object" ? atual.infinitepay : {};

  const novoPagbank = {
    ...existentePagbank,
    ambiente: ambienteSeguro(entradaPagbank.ambiente || existentePagbank.ambiente || "production"),
    publicUrl: urlBasePublica(entradaPagbank.publicUrl || existentePagbank.publicUrl),
    paymentMethods: metodosSeguros(entradaPagbank.paymentMethods || existentePagbank.paymentMethods || "PIX,CREDIT_CARD"),
    installmentsLimit: numeroInteiro(entradaPagbank.installmentsLimit ?? existentePagbank.installmentsLimit ?? 1, 1, 1, 18),
    interestFreeInstallments: numeroInteiro(entradaPagbank.interestFreeInstallments ?? existentePagbank.interestFreeInstallments ?? 1, 1, 1, 18),
    checkoutExpirationHours: numeroInteiro(entradaPagbank.checkoutExpirationHours ?? existentePagbank.checkoutExpirationHours ?? 72, 72, 1, 720),
    redirectUrl: texto(entradaPagbank.redirectUrl ?? existentePagbank.redirectUrl),
    alunoRedirectUrl: texto(entradaPagbank.alunoRedirectUrl ?? existentePagbank.alunoRedirectUrl),
    fusionRedirectUrl: texto(entradaPagbank.fusionRedirectUrl ?? existentePagbank.fusionRedirectUrl),
    webhookUrl: texto(entradaPagbank.webhookUrl ?? existentePagbank.webhookUrl)
  };

  if (entradaPagbank.limparToken === true) novoPagbank.token = "";
  else if (texto(entradaPagbank.token)) novoPagbank.token = criptografarSegredo(entradaPagbank.token);

  if (entradaPagbank.limparWebhookToken === true) novoPagbank.webhookToken = "";
  else if (texto(entradaPagbank.webhookToken)) novoPagbank.webhookToken = criptografarSegredo(entradaPagbank.webhookToken);

  const novoInfinitePay = {
    ...existenteInfinitePay,
    publicUrl: urlBasePublica(entradaInfinitePay.publicUrl || existenteInfinitePay.publicUrl),
    handle: handleInfinitePay(entradaInfinitePay.handle ?? existenteInfinitePay.handle),
    baseUrl: texto(entradaInfinitePay.baseUrl ?? existenteInfinitePay.baseUrl ?? "https://api.checkout.infinitepay.io").replace(/\/+$/, ""),
    redirectUrl: texto(entradaInfinitePay.redirectUrl ?? existenteInfinitePay.redirectUrl),
    alunoRedirectUrl: texto(entradaInfinitePay.alunoRedirectUrl ?? existenteInfinitePay.alunoRedirectUrl),
    fusionRedirectUrl: texto(entradaInfinitePay.fusionRedirectUrl ?? existenteInfinitePay.fusionRedirectUrl),
    webhookUrl: texto(entradaInfinitePay.webhookUrl ?? existenteInfinitePay.webhookUrl)
  };

  const novo = {
    ...atual,
    provider: providerSeguro(dados.provider || atual.provider || "pagbank"),
    pagbank: novoPagbank,
    infinitepay: novoInfinitePay,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: texto(usuario.email || usuario.nome || usuario.id || "sistema")
  };

  await salvarJsonDuravel(ARQ_CONFIG, novo);
  return obterConfiguracaoPagamentosPublica();
}
