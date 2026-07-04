const BASES = [
  "/api/financeiro/pagamentos",
  "/api/financeiro/contas-pagar",
  "/api/financeiro/lancamentos"
];

let baseAtiva = null;

async function lerResposta(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const body = await lerResposta(res);

  if (!res.ok) {
    const detalhe = typeof body === "object" && body?.erro ? body.erro : "";
    const msg = detalhe || `Falha HTTP ${res.status}`;
    const erro = new Error(msg);
    erro.status = res.status;
    erro.body = body;
    throw erro;
  }

  return body;
}

async function tentarBases(pathBuilder, options = {}) {
  let ultimoErro = null;
  const bases = baseAtiva ? [baseAtiva, ...BASES.filter((b) => b !== baseAtiva)] : BASES;

  for (const base of bases) {
    try {
      const resposta = await requestJson(pathBuilder(base), options);
      baseAtiva = base;
      return resposta;
    } catch (err) {
      ultimoErro = err;
      if (err.status !== 404) throw err;
    }
  }

  const erro = ultimoErro || new Error("Rota de pagamentos não encontrada");
  erro.status = erro.status || 404;
  throw erro;
}

export function obterBaseAtiva() {
  return baseAtiva;
}

export async function listarPagamentos(filtros = {}) {
  const qs = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      qs.set(chave, String(valor).trim());
    }
  });

  const sufixo = qs.toString() ? `?${qs.toString()}` : "";
  return tentarBases((base) => `${base}${sufixo}`);
}

export async function criarPagamento(payload) {
  return tentarBases((base) => `${base}`, {
    method: "POST",
    body: JSON.stringify(payload || {})
  });
}

export async function baixarPagamento(id, payload) {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/baixar`, {
    method: "POST",
    body: JSON.stringify(payload || {})
  });
}

export async function estornarPagamento(id, motivo = "") {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/estornar`, {
    method: "POST",
    body: JSON.stringify({ motivo })
  });
}

export async function cancelarPagamento(id, motivo = "") {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo })
  });
}

export async function diagnosticarPagamentos() {
  const resultados = [];

  for (const base of BASES) {
    try {
      const inicio = performance.now();
      const dados = await requestJson(base);
      const tempo = Math.round(performance.now() - inicio);
      resultados.push({ base, ok: true, tempo, tipo: Array.isArray(dados) ? "array" : typeof dados });
    } catch (err) {
      resultados.push({ base, ok: false, status: err.status || 0, erro: err.message });
    }
  }

  return resultados;
}
