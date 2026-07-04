const BASES = [
  "/api/financeiro/pagamentos",
  "/api/pagamentos",
  "/api/financeiro/contas-pagar",
  "/api/contas-pagar"
];

let baseAtiva = "";

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.erro || data?.error || data?.mensagem || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function tentarBases(montarUrl, options) {
  let ultimoErro;
  for (const base of BASES) {
    try {
      const data = await requestJson(montarUrl(base), options);
      baseAtiva = base;
      return data;
    } catch (err) {
      ultimoErro = err;
      if (![404, 405].includes(Number(err.status || 0))) throw err;
    }
  }
  const erro = ultimoErro || new Error("Rota de pagamentos não encontrada");
  erro.status = erro.status || 404;
  throw erro;
}

export function obterBaseAtiva() { return baseAtiva; }

export async function listarPagamentos(filtros = {}) {
  const qs = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") qs.set(k, String(v).trim());
  });
  const sufixo = qs.toString() ? `?${qs.toString()}` : "";
  return tentarBases((base) => `${base}${sufixo}`);
}

export async function criarPagamento(payload) {
  return tentarBases((base) => base, { method: "POST", body: JSON.stringify(payload || {}) });
}

export async function parcelarPagamento(payload) {
  return tentarBases((base) => `${base}/parcelar`, { method: "POST", body: JSON.stringify(payload || {}) });
}

export async function editarPagamento(id, payload) {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload || {}) });
}

export async function excluirPagamento(id) {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function duplicarPagamento(id, payload = {}) {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/duplicar`, { method: "POST", body: JSON.stringify(payload || {}) });
}

export async function baixarPagamento(id, payload) {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/baixar`, { method: "POST", body: JSON.stringify(payload || {}) });
}

export async function estornarPagamento(id, motivo = "") {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/estornar`, { method: "POST", body: JSON.stringify({ motivo }) });
}

export async function cancelarPagamento(id, motivo = "") {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/cancelar`, { method: "POST", body: JSON.stringify({ motivo }) });
}

export async function diagnosticarPagamentos() {
  const resultados = [];
  for (const base of BASES) {
    try {
      const inicio = performance.now();
      const dados = await requestJson(base);
      resultados.push({ base, ok: true, tempo: Math.round(performance.now() - inicio), tipo: Array.isArray(dados) ? "array" : typeof dados });
    } catch (err) {
      resultados.push({ base, ok: false, status: err.status || 0, erro: err.message });
    }
  }
  return resultados;
}


export async function obterHistoricoPagamento(id) {
  return tentarBases((base) => `${base}/${encodeURIComponent(id)}/historico`);
}

export async function baixarPagamentosEmLote(ids = [], payload = {}) {
  return tentarBases((base) => `${base}/lote/baixar`, { method: "POST", body: JSON.stringify({ ...(payload || {}), ids }) });
}

export async function listarConciliacaoPagamentos(filtros = {}) {
  const qs = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") qs.set(k, String(v).trim());
  });
  const sufixo = qs.toString() ? `?${qs.toString()}` : "";
  return tentarBases((base) => `${base}/conciliacao${sufixo}`);
}

export async function fecharPeriodoPagamentos(payload = {}) {
  return tentarBases((base) => `${base}/fechamento`, { method: "POST", body: JSON.stringify(payload || {}) });
}


export async function dashboardPagamentos(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  const r = await fetch(`/api/financeiro/pagamentos/dashboard${qs ? `?${qs}` : ""}`);
  return r.json();
}

export async function aprovarPagamento(id, payload = {}) {
  const r = await fetch(`/api/financeiro/pagamentos/${id}/aprovar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
}

export async function reprovarPagamento(id, payload = {}) {
  const r = await fetch(`/api/financeiro/pagamentos/${id}/reprovar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
}

export async function agendarPagamento(id, payload = {}) {
  const r = await fetch(`/api/financeiro/pagamentos/${id}/agendar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
}

export async function anexarComprovantePagamento(id, payload = {}) {
  const r = await fetch(`/api/financeiro/pagamentos/${id}/comprovantes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
}

export async function criarPagamentosRecorrentes(payload = {}) {
  const r = await fetch(`/api/financeiro/pagamentos/recorrentes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
}
