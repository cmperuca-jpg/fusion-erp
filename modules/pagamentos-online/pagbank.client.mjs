function texto(valor = "") {
  return String(valor ?? "").trim();
}

function ambientePagbank() {
  const valor = texto(process.env.FUSION_PAGBANK_ENV || process.env.PAGBANK_ENV || "sandbox").toLowerCase();
  return ["prod", "production", "producao", "produção"].includes(valor) ? "production" : "sandbox";
}

export function configPagbank() {
  const ambiente = ambientePagbank();
  const baseUrl = texto(process.env.FUSION_PAGBANK_BASE_URL) ||
    (ambiente === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com");
  return {
    ambiente,
    baseUrl,
    token: texto(process.env.FUSION_PAGBANK_TOKEN || process.env.PAGBANK_TOKEN),
    userAgent: texto(process.env.FUSION_PAGBANK_USER_AGENT) || "FusionERP/2.8 pagamentos-online"
  };
}

export function pagbankConfigurado() {
  return Boolean(configPagbank().token);
}

function erroPagbank(mensagem, status = 502, detalhes = {}) {
  const erro = new Error(mensagem);
  erro.status = status;
  erro.code = detalhes.code || "PAGBANK_API_ERROR";
  erro.detalhes = detalhes;
  return erro;
}

function descricaoErroPagbank(json = {}, fallback = "Falha ao comunicar com o PagBank.") {
  const erros = Array.isArray(json.errors) ? json.errors : [];
  const primeiro = erros[0] || {};
  return texto(primeiro.description || primeiro.message || json.error_description || json.message || fallback);
}

function endpoint(pathname = "") {
  const cfg = configPagbank();
  return `${cfg.baseUrl.replace(/\/+$/, "")}/${String(pathname || "").replace(/^\/+/, "")}`;
}

async function requestPagbank(pathname, { method = "GET", body } = {}) {
  const cfg = configPagbank();
  if (!cfg.token) {
    throw erroPagbank("PagBank ainda não configurado. Informe FUSION_PAGBANK_TOKEN no ambiente seguro do servidor.", 503, {
      code: "PAGBANK_NOT_CONFIGURED"
    });
  }

  const init = {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": cfg.userAgent,
      "Authorization": `Bearer ${cfg.token}`
    }
  };

  if (method !== "GET" && body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(endpoint(pathname), init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw erroPagbank(descricaoErroPagbank(json), response.status || 502, {
      code: "PAGBANK_HTTP_ERROR",
      status: response.status,
      ambiente: cfg.ambiente
    });
  }
  return json;
}

export async function criarCheckoutPagbank(payload = {}) {
  return requestPagbank("/checkouts", { method: "POST", body: payload });
}

export async function consultarCheckoutPagbank(id) {
  const checkoutId = texto(id);
  if (!checkoutId) throw erroPagbank("Checkout PagBank não informado.", 400, { code: "PAGBANK_CHECKOUT_ID_REQUIRED" });
  return requestPagbank(`/checkouts/${encodeURIComponent(checkoutId)}`);
}

export function linkPagamentoPagbank(checkout = {}) {
  const links = Array.isArray(checkout.links) ? checkout.links : [];
  const pay = links.find(item => texto(item.rel).toUpperCase() === "PAY" && texto(item.href));
  return texto(pay?.href);
}
