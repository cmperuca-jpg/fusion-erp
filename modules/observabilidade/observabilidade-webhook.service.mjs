const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 15000;

let ultimoResultado = {
  ativo: false,
  enviado: false,
  status: null,
  ultimoEnvioEm: null,
  ultimoErro: ""
};

function texto(valor, limite = 600) {
  return String(valor ?? "").trim().slice(0, limite);
}

function timeoutMs(valor = process.env.FUSION_OBSERVABILITY_WEBHOOK_TIMEOUT_MS) {
  const n = Number(valor || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(n)) return DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(n)));
}

function configWebhook() {
  const raw = texto(process.env.FUSION_OBSERVABILITY_WEBHOOK_URL, 2000);
  if (!raw) return { ativo: false, timeoutMs: timeoutMs() };

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("FUSION_OBSERVABILITY_WEBHOOK_URL invalida.");
  }

  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Webhook de observabilidade exige HTTPS; HTTP e aceito apenas em localhost.");
  }
  if (url.username || url.password) {
    throw new Error("Webhook de observabilidade nao aceita credenciais embutidas na URL.");
  }

  return {
    ativo: true,
    url: url.toString(),
    token: texto(process.env.FUSION_OBSERVABILITY_WEBHOOK_TOKEN, 2000),
    timeoutMs: timeoutMs()
  };
}

function tenantDoEvento(notificacao = {}) {
  const eventoId = texto(notificacao.eventoId, 240);
  const partes = eventoId.split(":");
  if (partes[0] === "observabilidade" && partes[1]) return texto(partes[1], 120);
  return "";
}

function payloadWebhook(notificacao = {}) {
  return {
    schemaVersion: 1,
    sistema: "Fusion ERP",
    tipo: "observabilidade",
    eventoId: texto(notificacao.eventoId, 240),
    tenantId: tenantDoEvento(notificacao),
    prioridade: texto(notificacao.prioridade, 40),
    titulo: texto(notificacao.titulo, 160),
    mensagem: texto(notificacao.mensagem, 1000),
    referenciaId: texto(notificacao.referenciaId, 240),
    criadoEm: texto(notificacao.criadoEm, 80),
    enviadoEm: new Date().toISOString()
  };
}

function erroSeguro(erro) {
  const mensagem = texto(erro?.message || erro || "Falha desconhecida.", 300);
  return mensagem
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redigido]");
}

export async function enviarWebhookObservabilidade(notificacao = {}) {
  let config;
  try {
    config = configWebhook();
  } catch (erro) {
    const mensagem = erroSeguro(erro);
    ultimoResultado = {
      ativo: true,
      enviado: false,
      status: null,
      ultimoEnvioEm: new Date().toISOString(),
      ultimoErro: mensagem
    };
    return { ok: false, ...ultimoResultado };
  }

  if (!config.ativo) {
    ultimoResultado = {
      ativo: false,
      enviado: false,
      status: null,
      ultimoEnvioEm: null,
      ultimoErro: ""
    };
    return { ok: true, ...ultimoResultado, motivo: "nao-configurado" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  timer.unref?.();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Fusion-ERP-Observabilidade/1.0",
    "X-Fusion-Event": texto(notificacao.eventoId, 180) || "observabilidade"
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  try {
    const resposta = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadWebhook(notificacao)),
      signal: controller.signal
    });

    if (!resposta.ok) {
      throw new Error(`Webhook respondeu HTTP ${resposta.status}.`);
    }

    ultimoResultado = {
      ativo: true,
      enviado: true,
      status: resposta.status,
      ultimoEnvioEm: new Date().toISOString(),
      ultimoErro: ""
    };
    return { ok: true, ...ultimoResultado };
  } catch (erro) {
    const mensagem = erro?.name === "AbortError"
      ? `Timeout do webhook apos ${config.timeoutMs} ms.`
      : erroSeguro(erro);

    ultimoResultado = {
      ativo: true,
      enviado: false,
      status: null,
      ultimoEnvioEm: new Date().toISOString(),
      ultimoErro: mensagem
    };
    return { ok: false, ...ultimoResultado };
  } finally {
    clearTimeout(timer);
  }
}

export function statusWebhookObservabilidade() {
  let configurado = false;
  try {
    configurado = configWebhook().ativo;
  } catch {
    configurado = true;
  }

  return {
    configurado,
    ativo: ultimoResultado.ativo,
    enviado: ultimoResultado.enviado,
    status: ultimoResultado.status,
    ultimoEnvioEm: ultimoResultado.ultimoEnvioEm,
    ultimoErro: ultimoResultado.ultimoErro
  };
}
