
const BASES = ["/api/recebimentos", "/api/financeiro/recebimentos"];

async function req(url, opts = {}) {
  const resp = await fetch(url, { cache: "no-store", ...opts });
  let data = null;
  try { data = await resp.json(); } catch { data = null; }
  if (!resp.ok || data?.erro === true || data?.ok === false) {
    const erro = new Error(data?.mensagem || data?.erro || `Erro HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return data;
}

async function tentar(path, opts = {}) {
  let ultimo;
  for (const base of BASES) {
    try { return await req(`${base}${path}`, opts); }
    catch (e) { ultimo = e; if (e.status && e.status !== 404) throw e; }
  }
  throw ultimo || new Error("Nenhuma rota de recebimentos respondeu.");
}

export async function listarRecebimentos(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return tentar(qs ? `/?${qs}` : "/");
}

export async function criarRecebimento(payload) {
  return tentar("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
}

export async function baixarRecebimento(id, payload) {
  return tentar(`/${encodeURIComponent(id)}/baixar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
}

export async function estornarRecebimento(id, payload = {}) {
  return tentar(`/${encodeURIComponent(id)}/estornar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function cancelarRecebimento(id, payload = {}) {
  return tentar(`/${encodeURIComponent(id)}/cancelar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function obterBaseAtiva() {
  for (const base of BASES) {
    try { await req(`${base}/resumo`); return base; } catch {}
  }
  return BASES[0];
}

export async function diagnosticarRecebimentos() {
  const saida = [];
  for (const base of BASES) {
    const inicio = performance.now();
    try {
      const r = await fetch(`${base}/resumo`, { cache: "no-store" });
      saida.push({ base, ok: r.ok, status: r.status, tipo: "resumo", tempo: Math.round(performance.now() - inicio) });
    } catch (e) {
      saida.push({ base, ok: false, erro: e.message, tipo: "resumo", tempo: Math.round(performance.now() - inicio) });
    }
  }
  return saida;
}
