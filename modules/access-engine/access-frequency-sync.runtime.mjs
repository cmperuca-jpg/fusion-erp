import {
  executarTransacaoJson,
  lerJsonDuravel,
  salvarJsonMultiplosAtomico
} from "../core/persistence/durable-json.mjs";
import { aplicarAccessLogNaFrequencia } from "./access-frequency-sync.mjs";

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function acessoReal(log = {}) {
  const origem = texto(log.origem)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const diagnostico = ["teste", "diagnostico", "simulador"].some(v => origem.includes(v));
  const real = Boolean(
    log.catraca ||
    origem.includes("portal-aluno") ||
    origem.includes("henry") ||
    origem.includes("biometr") ||
    origem.includes("catraca") ||
    origem.includes("checkin")
  );
  return log.autorizado === true && texto(log.alunoId || log.aluno_id) && real && !diagnostico;
}

export async function sincronizarAccessLogFrequenciaDuravel(log = {}) {
  return executarTransacaoJson(async () => {
    const [alunos, matriculas, checkin, checkins] = await Promise.all([
      lerJsonDuravel("alunos.json", []),
      lerJsonDuravel("matriculas.json", []),
      lerJsonDuravel("checkin.json", []),
      lerJsonDuravel("checkins.json", [])
    ]);

    const resultado = aplicarAccessLogNaFrequencia({
      log,
      alunos: Array.isArray(alunos) ? alunos : [],
      matriculas: Array.isArray(matriculas) ? matriculas : [],
      checkin: Array.isArray(checkin) ? checkin : [],
      checkins: Array.isArray(checkins) ? checkins : []
    });

    if (resultado.alterado) {
      await salvarJsonMultiplosAtomico({
        "checkin.json": resultado.checkin,
        "checkins.json": resultado.checkins
      });
    }

    return resultado;
  }, { operacaoId: `sync-frequencia-${texto(log.id) || Date.now()}` });
}

export async function reconciliarAccessLogsFrequenciaDuravel() {
  return executarTransacaoJson(async () => {
    const [logs, alunos, matriculas, checkin, checkins] = await Promise.all([
      lerJsonDuravel("access_logs.json", []),
      lerJsonDuravel("alunos.json", []),
      lerJsonDuravel("matriculas.json", []),
      lerJsonDuravel("checkin.json", []),
      lerJsonDuravel("checkins.json", [])
    ]);

    const estado = {
      alunos: Array.isArray(alunos) ? alunos : [],
      matriculas: Array.isArray(matriculas) ? matriculas : [],
      checkin: Array.isArray(checkin) ? checkin : [],
      checkins: Array.isArray(checkins) ? checkins : []
    };

    let alterados = 0;
    let checkinsCriados = 0;
    let vinculosAtualizados = 0;

    const ordenados = (Array.isArray(logs) ? logs : [])
      .filter(acessoReal)
      .sort((a, b) => texto(a.criadoEm || a.at).localeCompare(texto(b.criadoEm || b.at)));

    for (const log of ordenados) {
      const r = aplicarAccessLogNaFrequencia({ log, ...estado });
      if (r.alterado) alterados += 1;
      if (r.alteradoCheckin) checkinsCriados += 1;
      if (r.alteradoVinculo) vinculosAtualizados += 1;
    }

    if (alterados) {
      await salvarJsonMultiplosAtomico({
        "checkin.json": estado.checkin,
        "checkins.json": estado.checkins
      });
    }

    return {
      ok: true,
      logsElegiveis: ordenados.length,
      alterados,
      checkinsCriados,
      vinculosAtualizados
    };
  }, { operacaoId: `reconciliar-frequencia-${Date.now()}` });
}
