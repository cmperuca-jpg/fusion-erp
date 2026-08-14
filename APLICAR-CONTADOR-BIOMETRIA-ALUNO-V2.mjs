import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const P = (...parts) => path.join(repo, ...parts);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = P("data", "backup-aluno-contador-biometria-v2", stamp);

function fail(message) { console.error("[ERRO] " + message); process.exit(1); }
function read(rel) {
  const file = P(...rel.split("/"));
  if (!fs.existsSync(file)) fail(`Arquivo nao encontrado: ${rel}`);
  return fs.readFileSync(file, "utf8");
}
function write(rel, content) {
  const file = P(...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
function backup(rel) {
  const file = P(...rel.split("/"));
  if (!fs.existsSync(file)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, rel.replace(/[\\/]/g, "__")));
}
function replaceOnce(text, oldText, newText, label) {
  if (!text.includes(oldText)) fail(`Patch incompativel no ponto: ${label}`);
  return text.replace(oldText, newText);
}
function run(command, args) {
  execFileSync(command, args, { cwd: repo, stdio: "inherit" });
}

console.log("============================================================");
console.log("FUSION ALUNO - CONTADOR BIOMETRIA V2 SEM POLLING");
console.log("============================================================");

const targets = [
  "modules/treinos/treinos.service.mjs",
  "modules/treinos/aluno-app-actions.service.mjs",
  "public/pages/aluno-login/actions.js",
  "public/pages/aluno-login/index.html"
];

console.log("[1/7] Salvando backup...");
for (const rel of targets) backup(rel);

console.log("[2/7] Instalando helper de contagem...");
fs.copyFileSync(
  P("aluno-app-access-counter.mjs"),
  P("modules", "treinos", "aluno-app-access-counter.mjs")
);

console.log("[3/7] Ligando X/3 aos acessos biometricos locais...");
let service = read("modules/treinos/treinos.service.mjs");

if (!service.includes('import { combinarContadorAcessos } from "./aluno-app-access-counter.mjs";')) {
  service = replaceOnce(
    service,
    'import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";',
    'import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";\nimport { tenantAtual } from "../core/persistence/tenant-context.mjs";\nimport { obterSupabaseAdmin } from "../../config/supabase.mjs";\nimport { combinarContadorAcessos } from "./aluno-app-access-counter.mjs";',
    "imports"
  );
}

if (!service.includes('if (origem === "fusion-biometria-local") return false;')) {
  service = replaceOnce(
    service,
    '  if (origem.includes("teste") || origem.includes("diagnostico") || origem.includes("simulador")) return false;\n  return dataLocalISO(log.criadoEm || log.data || log.timestamp) === dataAlvo;',
    '  if (origem.includes("teste") || origem.includes("diagnostico") || origem.includes("simulador")) return false;\n  if (origem === "fusion-biometria-local") return false;\n  return dataLocalISO(log.criadoEm || log.data || log.timestamp) === dataAlvo;',
    "dedupe edge"
  );
}

const oldCounter = `async function contadorAcessosPortal(alunoId) {
  const data = dataLocalISO();
  const logs = await listarLogsAcesso();
  const usados = logs.filter((log) => logContaComoAcessoPortal(log, alunoId, data)).length;
  const limite = LIMITE_ACESSOS_PORTAL_DIA;
  const restantes = limite > 0 ? Math.max(0, limite - usados) : null;

  return {
    data,
    limite,
    usados,
    restantes,
    limiteAtingido: limite > 0 && usados >= limite
  };
}`;

const newCounter = `async function acessosBiometriaEdgeHoje(alunoId, dataAlvo) {
  const supabase = obterSupabaseAdmin();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from("fusion_edge_daily_frequency")
    .select("entry_count")
    .eq("tenant_id", tenantAtual())
    .eq("student_id", alunoId)
    .eq("attendance_date", dataAlvo)
    .eq("modality", "biometria")
    .maybeSingle();

  if (error) {
    throw erroHttp(
      \`Nao foi possivel consultar os acessos biometricos do dia: \${error.message}\`,
      502
    );
  }

  const quantidade = Number(data?.entry_count || 0);
  return Number.isFinite(quantidade) ? Math.max(0, Math.trunc(quantidade)) : 0;
}

async function contadorAcessosPortal(alunoId) {
  const data = dataLocalISO();
  const [logs, biometricos] = await Promise.all([
    listarLogsAcesso(),
    acessosBiometriaEdgeHoje(String(alunoId || ""), data)
  ]);

  const centrais = logs.filter((log) =>
    logContaComoAcessoPortal(log, alunoId, data)
  ).length;

  return {
    data,
    ...combinarContadorAcessos({
      central: centrais,
      biometria: biometricos,
      limite: LIMITE_ACESSOS_PORTAL_DIA
    }),
    acessosCentralHoje: centrais,
    acessosBiometriaHoje: biometricos
  };
}`;

if (!service.includes("async function acessosBiometriaEdgeHoje(")) {
  service = replaceOnce(service, oldCounter, newCounter, "contador");
}
write("modules/treinos/treinos.service.mjs", service);

console.log("[4/7] Incluindo biometria no historico de frequencia...");
let actionsService = read("modules/treinos/aluno-app-actions.service.mjs");

if (!actionsService.includes("async function registrosBiometriaEdgeAluno(")) {
  const marker = 'export async function frequenciaAlunoApp(req, res, deviceToken) {';
  const helper = `async function registrosBiometriaEdgeAluno(tenantId, alunoId, limite = 400) {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_edge_access_events")
    .select("event_id,equipment_id,occurred_at,source")
    .eq("tenant_id", tenantId)
    .eq("student_id", alunoId)
    .eq("authorized", true)
    .eq("physical_confirmed", true)
    .eq("direction", "entrada")
    .order("occurred_at", { ascending: false })
    .limit(limite);

  if (error) {
    throw erroHttp(
      \`Não foi possível carregar a frequência biométrica do aluno: \${error.message}\`,
      502,
      "ERP_STUDENT_BIOMETRIC_FREQUENCY_FAILED"
    );
  }

  return (Array.isArray(data) ? data : []).map((row = {}) => ({
    record_id: \`edge:\${texto(row.event_id)}\`,
    updated_at: row.occurred_at,
    payload: {
      id: \`edge:\${texto(row.event_id)}\`,
      alunoId,
      autorizado: true,
      direcao: "entrada",
      origem: texto(row.source) || "fusion-biometria-local",
      criadoEm: row.occurred_at,
      dispositivoNome: texto(row.equipment_id) || "Catraca Henry 7X",
      edgeEventId: texto(row.event_id)
    }
  }));
}

${marker}`;
  actionsService = replaceOnce(actionsService, marker, helper, "helper historico");
}

const oldFreq = `    const [accessLogs, checkin, checkins] = await Promise.all([
      registrosFrequenciaAluno(identidade.tenantId, identidade.legacyId, "access_logs", 400),
      registrosFrequenciaAluno(identidade.tenantId, identidade.legacyId, "checkin", 400),
      registrosFrequenciaAluno(identidade.tenantId, identidade.legacyId, "checkins", 400)
    ]);

    return {
      alunoId: identidade.legacyId,
      tenantId: identidade.tenantId,
      ...resumirFrequenciaRegistros({ accessLogs, checkin, checkins }),
      atualizadoEm: new Date().toISOString()
    };`;

const newFreq = `    const [accessLogs, checkin, checkins, biometriaEdge] = await Promise.all([
      registrosFrequenciaAluno(identidade.tenantId, identidade.legacyId, "access_logs", 400),
      registrosFrequenciaAluno(identidade.tenantId, identidade.legacyId, "checkin", 400),
      registrosFrequenciaAluno(identidade.tenantId, identidade.legacyId, "checkins", 400),
      registrosBiometriaEdgeAluno(identidade.tenantId, identidade.legacyId, 400)
    ]);

    return {
      alunoId: identidade.legacyId,
      tenantId: identidade.tenantId,
      ...resumirFrequenciaRegistros({
        accessLogs: [...accessLogs, ...biometriaEdge],
        checkin,
        checkins
      }),
      acessosBiometriaLocal: biometriaEdge.length,
      atualizadoEm: new Date().toISOString()
    };`;

if (!actionsService.includes("const [accessLogs, checkin, checkins, biometriaEdge]")) {
  actionsService = replaceOnce(actionsService, oldFreq, newFreq, "historico");
}
write("modules/treinos/aluno-app-actions.service.mjs", actionsService);

console.log("[5/7] Removendo qualquer polling de 3 segundos...");
let ui = read("public/pages/aluno-login/actions.js");

// Se a V1 chegou a ser aplicada, remove apenas o polling acrescentado por ela.
ui = ui.replace(/\n\s*const CONTADOR_REFRESH_MS = 3000;\n\s*let contadorEmAndamento = false;/, "");
ui = ui.replace(/\n\s*const CONTADOR_REFRESH_MS = 3000;/, "");
ui = ui.replace(/\n\s*let contadorEmAndamento = false;/, "");

ui = ui.replace(
  'if (!deviceToken() || !$("liberarCatracaApp") || contadorEmAndamento) return;',
  'if (!deviceToken() || !$("liberarCatracaApp")) return;'
);
ui = ui.replace(/\n\s*contadorEmAndamento = true;/, "");
ui = ui.replace(/\n\s*} finally \{\n\s*contadorEmAndamento = false;\n\s*}\n\s*}/, "\n    }\n  }");

ui = ui.replace(
  /\n\s*\/\/ A biometria ocorre fora do navegador;[^\n]*\n\s*const contadorTimer = window\.setInterval\(\(\) => \{\n[\s\S]*?window\.addEventListener\("pagehide", \(\) => \{\n\s*window\.clearInterval\(contadorTimer\);\n\s*}, \{ once: true }\);\n/,
  "\n"
);

write("public/pages/aluno-login/actions.js", ui);

console.log("[6/7] Atualizando cache do navegador e instalando teste...");
let html = read("public/pages/aluno-login/index.html");
html = html.replace(
  /\/pages\/aluno-login\/actions\.js\?v=[^"]+/,
  "/pages/aluno-login/actions.js?v=20260813-3"
);
write("public/pages/aluno-login/index.html", html);

fs.copyFileSync(
  P("test-aluno-app-biometria-contador.mjs"),
  P("scripts", "test-aluno-app-biometria-contador.mjs")
);

console.log("[7/7] Validando e enviando...");
for (const rel of [
  "modules/treinos/aluno-app-access-counter.mjs",
  "modules/treinos/treinos.service.mjs",
  "modules/treinos/aluno-app-actions.service.mjs",
  "public/pages/aluno-login/actions.js",
  "scripts/test-aluno-app-biometria-contador.mjs"
]) {
  run(process.execPath, ["--check", P(...rel.split("/"))]);
}

run(process.execPath, ["scripts/test-aluno-app-biometria-contador.mjs"]);
run(process.execPath, ["scripts/test-aluno-app-frequencia.mjs"]);
run(process.execPath, ["scripts/test-access-frequencia-sync.mjs"]);
run(process.execPath, ["scripts/test-aluno-app-acoes.mjs"]);

const tracked = [
  "modules/treinos/aluno-app-access-counter.mjs",
  "modules/treinos/treinos.service.mjs",
  "modules/treinos/aluno-app-actions.service.mjs",
  "public/pages/aluno-login/actions.js",
  "public/pages/aluno-login/index.html",
  "scripts/test-aluno-app-biometria-contador.mjs"
];

run("git", ["add", "--", ...tracked]);
run("git", ["diff", "--cached", "--check"]);

const changed = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: repo, encoding: "utf8"
}).trim();

if (changed) {
  run("git", ["commit", "-m", "fix: integra biometria ao contador do Fusion Aluno"]);
  try {
    run("git", ["push"]);
    console.log("[OK] Codigo enviado ao GitHub.");
  } catch {
    console.log("[AVISO] Commit criado, mas git push falhou.");
  }
} else {
  console.log("[OK] Correcao ja estava aplicada.");
}

console.log("");
console.log("============================================================");
console.log("FUSION_ALUNO_BIOMETRIA_CONTADOR_V2_OK");
console.log("Sem consulta automatica a cada 3 segundos.");
console.log("Contador consulta ao abrir/voltar e apos comando do painel.");
console.log("Biometria sincronizada entra no X/3 e na frequencia.");
console.log("Mensagem de aluno dentro da academia foi preservada.");
console.log("============================================================");
