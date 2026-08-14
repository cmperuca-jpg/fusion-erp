const DEFAULT_REREAD_WINDOW_MS = 12000;

export function resolverJanelaReleituraBiometricaMs(valor = DEFAULT_REREAD_WINDOW_MS) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return DEFAULT_REREAD_WINDOW_MS;
  return Math.max(3000, Math.min(60000, Math.trunc(numero)));
}

function timestampEvento(row = {}) {
  const valor = row.occurred_at || row.occurredAt || row.criadoEm || row.updated_at || "";
  const ms = new Date(valor).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function pessoaEvento(row = {}) {
  return String(row.student_id || row.person_id || row.alunoId || row.personId || "").trim();
}

function dataLocalEvento(row = {}) {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload
    : {};
  return String(payload.localDate || row.local_date || row.localDate || "").slice(0, 10);
}

function ignoradoExplicitamente(row = {}) {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload
    : {};
  return payload.frequencyIgnored === true || String(payload.frequencyIgnored || "").toLowerCase() === "true";
}

export function deduplicarEventosBiometricos(rows = [], { janelaMs = DEFAULT_REREAD_WINDOW_MS } = {}) {
  const janela = resolverJanelaReleituraBiometricaMs(janelaMs);
  const ordenados = [...(Array.isArray(rows) ? rows : [])]
    .map((row, indice) => ({ row, indice, at: timestampEvento(row) }))
    .filter(item => item.at !== null)
    .sort((a, b) => a.at - b.at || a.indice - b.indice);

  const ultimoPorPessoaDia = new Map();
  const aceitos = [];

  for (const item of ordenados) {
    const row = item.row;
    if (ignoradoExplicitamente(row)) continue;

    const pessoa = pessoaEvento(row);
    const dataLocal = dataLocalEvento(row) || new Date(item.at).toISOString().slice(0, 10);
    const chave = `${pessoa}|${dataLocal}`;
    const anterior = ultimoPorPessoaDia.get(chave);

    if (pessoa && Number.isFinite(anterior) && item.at - anterior < janela) {
      continue;
    }

    ultimoPorPessoaDia.set(chave, item.at);
    aceitos.push(row);
  }

  return aceitos;
}
