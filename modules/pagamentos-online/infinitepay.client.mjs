function texto(valor = "") {
  return String(valor ?? "").trim();
}

function limparHandle(valor = "") {
  return texto(valor).replace(/^\$+/, "");
}

export function configInfinitePay(overrides = {}) {
  const baseUrl = texto(
    overrides.baseUrl ||
    process.env.FUSION_INFINITEPAY_BASE_URL ||
    process.env.INFINITEPAY_BASE_URL ||
    "https://api.checkout.infinitepay.io"
  ).replace(/\/+$/, "");

  return {
    baseUrl,
    handle: limparHandle(
      overrides.handle ||
      process.env.FUSION_INFINITEPAY_HANDLE ||
      process.env.INFINITEPAY_HANDLE ||
      process.env.FUSION_INFINITEPAY_TAG ||
      process.env.INFINITEPAY_TAG
    ),
    userAgent: texto(overrides.userAgent || process.env.FUSION_INFINITEPAY_USER_AGENT) || "FusionERP/2.8 pagamentos-online"
  };
}

export function infinitePayConfigurado(overrides = {}) {
  return Boolean(configInfinitePay(overrides).handle);
}

function erroInfinitePay(mensagem, status = 502, detalhes = {}) {
  const erro = new Error(mensagem);
  erro.status = status;
  erro.code = detalhes.code || "INFINITEPAY_API_ERROR";
  erro.detalhes = detalhes;
  return erro;
}

function descricaoErroInfinitePay(json = {}, fallback = "Falha ao comunicar com a InfinitePay.") {
  const erros = Array.isArray(json.errors) ? json.errors : [];
  const primeiro = erros[0] || {};
  return texto(primeiro.description || primeiro.message || json.error_description || json.message || json.error || fallback);
}

function endpoint(pathname = "", overrides = {}) {
  const cfg = configInfinitePay(overrides);
  return `${cfg.baseUrl}/${String(pathname || "").replace(/^\/+/, "")}`;
}

async function requestInfinitePay(pathname, { method = "POST", body, config = {} } = {}) {
  const cfg = configInfinitePay(config);
  if (!cfg.handle) {
    throw erroInfinitePay("InfinitePay ainda não configurada. Informe a InfiniteTag sem o $ em Pagamentos online.", 503, {
      code: "INFINITEPAY_NOT_CONFIGURED"
    });
  }

  const payload = {
    ...(body && typeof body === "object" ? body : {}),
    handle: limparHandle(body?.handle || cfg.handle)
  };

  const response = await fetch(endpoint(pathname, config), {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": cfg.userAgent
    },
    body: JSON.stringify(payload)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw erroInfinitePay(descricaoErroInfinitePay(json), response.status || 502, {
      code: "INFINITEPAY_HTTP_ERROR",
      status: response.status
    });
  }
  return json;
}

export async function criarLinkInfinitePay(payload = {}, config = {}) {
  return requestInfinitePay("/links", { method: "POST", body: payload, config });
}

export async function verificarPagamentoInfinitePay(payload = {}, config = {}) {
  return requestInfinitePay("/payment_check", { method: "POST", body: payload, config });
}
