function texto(valor = "") {
  return String(valor ?? "").trim();
}

function numero(valor, fallback = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function ambienteAsaas() {
  const valor = texto(process.env.FUSION_ASAAS_ENV || process.env.ASAAS_ENV || "sandbox").toLowerCase();
  return ["prod", "production", "producao", "produção"].includes(valor) ? "production" : "sandbox";
}

export function configAsaas() {
  const ambiente = ambienteAsaas();
  const baseUrl = texto(process.env.FUSION_ASAAS_BASE_URL) ||
    (ambiente === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");
  return {
    ambiente,
    baseUrl,
    apiKey: texto(process.env.FUSION_ASAAS_API_KEY || process.env.ASAAS_API_KEY),
    userAgent: texto(process.env.FUSION_ASAAS_USER_AGENT) || "FusionERP/2.8 pagamentos-online"
  };
}

export function asaasConfigurado() {
  return Boolean(configAsaas().apiKey);
}

function erroAsaas(mensagem, status = 502, detalhes = {}) {
  const erro = new Error(mensagem);
  erro.status = status;
  erro.code = detalhes.code || "ASAAS_API_ERROR";
  erro.detalhes = detalhes;
  return erro;
}

function descricaoErroAsaas(json = {}, fallback = "Falha ao comunicar com o Asaas.") {
  const erros = Array.isArray(json.errors) ? json.errors : [];
  const primeiro = erros[0] || {};
  return texto(primeiro.description || primeiro.message || json.message || fallback);
}

function endpoint(pathname = "") {
  const cfg = configAsaas();
  return `${cfg.baseUrl.replace(/\/+$/, "")}/${String(pathname || "").replace(/^\/+/, "")}`;
}

async function requestAsaas(pathname, { method = "GET", body } = {}) {
  const cfg = configAsaas();
  if (!cfg.apiKey) {
    throw erroAsaas("Asaas ainda não configurado. Informe FUSION_ASAAS_API_KEY no ambiente seguro do servidor.", 503, {
      code: "ASAAS_NOT_CONFIGURED"
    });
  }

  const init = {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": cfg.userAgent,
      "access_token": cfg.apiKey
    }
  };

  if (method !== "GET" && body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(endpoint(pathname), init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw erroAsaas(descricaoErroAsaas(json), response.status || 502, {
      code: "ASAAS_HTTP_ERROR",
      status: response.status,
      ambiente: cfg.ambiente
    });
  }
  return json;
}

export async function listarClientesAsaas(filtros = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(100, Math.max(1, Number(filtros.limit || 1)))));
  for (const campo of ["externalReference", "cpfCnpj", "email", "name"]) {
    const valor = texto(filtros[campo]);
    if (valor) params.set(campo, valor);
  }
  return requestAsaas(`/customers?${params.toString()}`);
}

export async function criarClienteAsaas(payload = {}) {
  const body = {
    name: texto(payload.name || payload.nome),
    cpfCnpj: texto(payload.cpfCnpj || payload.documento).replace(/\D/g, ""),
    email: texto(payload.email),
    mobilePhone: texto(payload.mobilePhone || payload.telefone || payload.whatsapp).replace(/\D/g, ""),
    externalReference: texto(payload.externalReference),
    notificationDisabled: payload.notificationDisabled === true
  };

  Object.keys(body).forEach((campo) => {
    if (body[campo] === "" || body[campo] === undefined || body[campo] === null) delete body[campo];
  });

  if (!body.name) {
    throw erroAsaas("Nome do pagador é obrigatório para criar cliente no Asaas.", 400, {
      code: "ASAAS_CUSTOMER_NAME_REQUIRED"
    });
  }

  return requestAsaas("/customers", { method: "POST", body });
}

export async function criarCobrancaAsaas(payload = {}) {
  const body = {
    customer: texto(payload.customer),
    billingType: texto(payload.billingType || "UNDEFINED").toUpperCase(),
    value: numero(payload.value, 0),
    dueDate: texto(payload.dueDate),
    description: texto(payload.description).slice(0, 500),
    externalReference: texto(payload.externalReference)
  };

  if (payload.callback && typeof payload.callback === "object") {
    body.callback = payload.callback;
  }

  if (!body.customer) throw erroAsaas("Cliente Asaas não informado para a cobrança.", 400, { code: "ASAAS_CUSTOMER_REQUIRED" });
  if (!["UNDEFINED", "BOLETO", "CREDIT_CARD", "PIX"].includes(body.billingType)) body.billingType = "UNDEFINED";
  if (!(body.value > 0)) throw erroAsaas("Valor da cobrança deve ser maior que zero.", 400, { code: "ASAAS_PAYMENT_VALUE_REQUIRED" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) throw erroAsaas("Vencimento da cobrança inválido.", 400, { code: "ASAAS_PAYMENT_DUE_DATE_REQUIRED" });

  return requestAsaas("/payments", { method: "POST", body });
}

export async function recuperarCobrancaAsaas(id) {
  const paymentId = texto(id);
  if (!paymentId) throw erroAsaas("Cobrança Asaas não informada.", 400, { code: "ASAAS_PAYMENT_ID_REQUIRED" });
  return requestAsaas(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function recuperarStatusCobrancaAsaas(id) {
  const paymentId = texto(id);
  if (!paymentId) throw erroAsaas("Cobrança Asaas não informada.", 400, { code: "ASAAS_PAYMENT_ID_REQUIRED" });
  return requestAsaas(`/payments/${encodeURIComponent(paymentId)}/status`);
}
