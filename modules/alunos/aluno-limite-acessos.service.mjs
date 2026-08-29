// LIMITE INDIVIDUAL DE ENTRADAS DO ALUNO 20260826
import { buscarAlunoPorId, atualizarAluno } from "./alunos.repository.mjs";
import { listarLogs as listarLogsAcesso } from "../access-engine/access-engine.repository.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";
import { DATABASE_CONFIG } from "../../config/database.config.mjs";
import { obterPostgresPool } from "../../config/postgres.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { combinarContadorAcessos } from "../treinos/aluno-app-access-counter.mjs";

const TIMEZONE_SISTEMA = process.env.FUSION_TIMEZONE || "America/Sao_Paulo";

function erro(mensagem, status = 400, code = "LIMITE_ACESSOS_ALUNO") {
  const e = new Error(mensagem);
  e.status = status;
  e.statusCode = status;
  e.code = code;
  return e;
}

function texto(v = "") { return String(v ?? "").trim(); }
function inteiro(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function limitePadraoAcessosAluno() {
  const valor = Number(process.env.FUSION_PORTAL_ALUNO_LIMITE_CATRACA_DIA || 1);
  return Number.isInteger(valor) && valor >= 1 && valor <= 10 ? valor : 1;
}

export function limiteAcessosDiariosAluno(aluno = {}) {
  const individual = Number(aluno?.limiteAcessosDiarios);
  return Number.isInteger(individual) && individual >= 1 && individual <= 10
    ? individual
    : limitePadraoAcessosAluno();
}

function dataLocalISO(valor = new Date()) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_SISTEMA,
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(data);
    const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
    if (mapa.year && mapa.month && mapa.day) return `${mapa.year}-${mapa.month}-${mapa.day}`;
  } catch {}
  return data.toISOString().slice(0, 10);
}

function idAluno(aluno = {}) {
  return texto(aluno.id ?? aluno._id ?? aluno.codigo ?? aluno.alunoId ?? aluno.matriculaId ?? aluno.cpf);
}

function logContaComoEntrada(log = {}, alunoId = "", dataAlvo = dataLocalISO()) {
  if (log.autorizado !== true) return false;
  if (texto(log.alunoId || log.identificador) !== texto(alunoId)) return false;
  const origem = texto(log.origem).toLowerCase();
  const direcao = texto(log.direcao || log.movimento || "entrada").toLowerCase();
  if (direcao === "saida") return false;
  if (origem.includes("teste") || origem.includes("diagnostico") || origem.includes("simulador")) return false;
  if (origem === "fusion-biometria-local") return false;
  return dataLocalISO(log.criadoEm || log.data || log.timestamp) === dataAlvo;
}

async function entradasBiometriaEdgeHoje(alunoId, dataAlvo) {
  if (DATABASE_CONFIG.provider === "postgres") {
    try {
      const db = obterPostgresPool({ obrigatorio: true });
      const { rows } = await db.query(
        `SELECT entry_count
           FROM public.fusion_edge_daily_frequency
          WHERE tenant_id=$1 AND student_id=$2 AND attendance_date=$3::date AND modality='biometria'
          LIMIT 1`,
        [tenantAtual(), alunoId, dataAlvo]
      );
      const quantidade = inteiro(rows[0]?.entry_count, 0);
      return { quantidade: Math.max(0, quantidade), disponivel: true, aviso: "" };
    } catch (error) {
      return { quantidade: 0, disponivel: false, aviso: `Contador Edge indisponível: ${texto(error.message).slice(0, 180)}` };
    }
  }

  let supabase;
  try { supabase = obterSupabaseAdmin(); } catch { supabase = null; }
  if (!supabase) return { quantidade: 0, disponivel: false, aviso: "Contador Edge indisponível." };

  const { data, error } = await supabase
    .from("fusion_edge_daily_frequency")
    .select("entry_count")
    .eq("tenant_id", tenantAtual())
    .eq("student_id", alunoId)
    .eq("attendance_date", dataAlvo)
    .eq("modality", "biometria")
    .maybeSingle();

  if (error) return { quantidade: 0, disponivel: false, aviso: `Contador Edge indisponível: ${texto(error.message).slice(0, 180)}` };
  const quantidade = inteiro(data?.entry_count, 0);
  return { quantidade: Math.max(0, quantidade), disponivel: true, aviso: "" };
}

export async function obterControleAcessosAluno(alunoOuId) {
  const aluno = alunoOuId && typeof alunoOuId === "object"
    ? alunoOuId
    : await buscarAlunoPorId(alunoOuId);

  if (!aluno) throw erro("Aluno não encontrado.", 404, "ALUNO_NAO_ENCONTRADO");

  const alunoId = idAluno(aluno);
  const data = dataLocalISO();
  const limite = limiteAcessosDiariosAluno(aluno);

  const [logs, edge] = await Promise.all([
    listarLogsAcesso().catch(() => []),
    entradasBiometriaEdgeHoje(alunoId, data)
  ]);

  const centrais = (Array.isArray(logs) ? logs : []).filter((log) =>
    logContaComoEntrada(log, alunoId, data)
  ).length;

  const combinado = combinarContadorAcessos({
    central: centrais,
    biometria: edge.quantidade,
    limite
  });

  return {
    ok: true,
    alunoId,
    alunoNome: texto(aluno.nome || aluno.nomeCompleto || aluno.alunoNome),
    limite,
    limiteDiario: limite,
    limiteIndividualConfigurado:
      Number.isInteger(Number(aluno.limiteAcessosDiarios)) &&
      Number(aluno.limiteAcessosDiarios) >= 1 &&
      Number(aluno.limiteAcessosDiarios) <= 10,
    limitePadrao: limitePadraoAcessosAluno(),
    data,
    ...combinado,
    acessosCentralHoje: centrais,
    acessosBiometriaHoje: edge.quantidade,
    contadorEdgeDisponivel: edge.disponivel,
    avisoContador: edge.aviso,
    regraSaida: "A saída não consome entrada e não é bloqueada pelo limite diário."
  };
}

export async function salvarLimiteAcessosAluno(alunoId, payload = {}) {
  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) throw erro("Aluno não encontrado.", 404, "ALUNO_NAO_ENCONTRADO");

  const limite = Number(payload.limiteAcessosDiarios ?? payload.limite ?? payload.entradasPorDia);
  if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
    throw erro("Informe de 1 a 10 entradas permitidas por dia.", 400, "LIMITE_INVALIDO");
  }

  const atualizado = await atualizarAluno(idAluno(aluno) || alunoId, {
    limiteAcessosDiarios: limite,
    limiteAcessosAtualizadoEm: new Date().toISOString()
  });
  if (!atualizado) throw erro("Não foi possível atualizar o aluno.", 500, "ALUNO_NAO_ATUALIZADO");
  return obterControleAcessosAluno(atualizado);
}
