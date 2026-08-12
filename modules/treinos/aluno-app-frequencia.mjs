function texto(valor = "") {
  return String(valor ?? "").trim();
}

function normalizar(valor = "") {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function payloadRegistro(row = {}) {
  if (row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)) return row.payload;
  return row && typeof row === "object" ? row : {};
}

function dataAcesso(item = {}) {
  const valor =
    item.criadoEm || item.createdAt || item.entradaEm || item.dataHora ||
    item.data_hora || item.timestamp || item.data || "";
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function origemIgnorada(origem = "") {
  const n = normalizar(origem);
  return ["teste", "diagnostico", "simulador"].some(v => n.includes(v));
}

function checkinReal(item = {}) {
  if (normalizar(item.tipo) === "vinculo_matricula") return false;
  const status = normalizar(item.status || item.resultado);
  if (["negado", "bloqueado", "cancelado", "recusado"].some(v => status.includes(v))) return false;
  if (normalizar(item.direcao || item.movimento) === "saida") return false;
  if (origemIgnorada(item.origem)) return false;
  return Boolean(dataAcesso(item));
}

function accessLogReal(item = {}) {
  if (item.autorizado !== true && String(item.autorizado).toLowerCase() !== "true") return false;
  if (normalizar(item.direcao || item.movimento) === "saida") return false;
  if (origemIgnorada(item.origem)) return false;
  return Boolean(dataAcesso(item));
}

function resumoItem(item, data, fonte) {
  return {
    data: data.toISOString(),
    status: texto(item.status || item.resultado || "Liberado"),
    local: texto(item.dispositivoNome || item.dispositivo || item.local || item.sala || item.turma || "Catraca"),
    origem: texto(item.origem),
    fonte
  };
}

export function resumirFrequenciaRegistros(
  { accessLogs = [], checkin = [], checkins = [] } = {},
  { agora = new Date(), limiteHistorico = 8 } = {}
) {
  const referencia = agora instanceof Date ? agora : new Date(agora);
  const agoraMs = Number.isNaN(referencia.getTime()) ? Date.now() : referencia.getTime();
  const inicio30 = agoraMs - (30 * 24 * 60 * 60 * 1000);

  const registros = new Map();
  const accessLogsRepresentados = new Set();

  // Fonte principal: presença já sincronizada em checkin/checkins.
  for (const [fonte, rows] of [["checkin", checkin], ["checkins", checkins]]) {
    for (const row of rows) {
      const item = payloadRegistro(row);
      if (!checkinReal(item)) continue;
      const data = dataAcesso(item);
      const accessLogId = texto(item.accessLogId || item.access_log_id);
      const id = texto(row.record_id || item.id);
      const chave = accessLogId ? `access:${accessLogId}` : `checkin:${fonte}:${id || data.toISOString()}`;
      if (accessLogId) accessLogsRepresentados.add(accessLogId);
      registros.set(chave, { item, data, fonte });
    }
  }

  // Fallback/reconciliação: log autorizado ainda não espelhado em checkin.
  for (const row of accessLogs) {
    const item = payloadRegistro(row);
    if (!accessLogReal(item)) continue;
    const id = texto(row.record_id || item.id);
    if (id && accessLogsRepresentados.has(id)) continue;
    const data = dataAcesso(item);
    const chave = id ? `access:${id}` : `access:fallback:${data.toISOString()}`;
    registros.set(chave, { item, data, fonte: "access_logs_fallback" });
  }

  const acessos = [...registros.values()]
    .sort((a, b) => b.data.getTime() - a.data.getTime());

  return {
    total: acessos.length,
    ultimos_30_dias: acessos.filter(r => r.data.getTime() >= inicio30 && r.data.getTime() <= agoraMs).length,
    ultimo_acesso: acessos[0]?.data?.toISOString() || "",
    acessos: acessos.slice(0, Math.max(1, Number(limiteHistorico) || 8))
      .map(r => resumoItem(r.item, r.data, r.fonte)),
    fonte_principal: "checkin",
    fallback_access_logs: acessos.some(r => r.fonte === "access_logs_fallback")
  };
}
