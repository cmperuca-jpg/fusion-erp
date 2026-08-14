import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";

const root = process.cwd();
const envPath = path.join(root, "data", "fusion-access-live-agent.env");
const exe = path.join(root, "scripts", "biometria", "FusionBiometriaFs80.exe");
const outDir = path.join(root, "data", "biometria-calibracao");
const reportPath = path.join(outDir, `calibracao-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

function fail(message) {
  console.error(`[ERRO] ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function loadEnv(file) {
  const map = {};
  if (!fs.existsSync(file)) return map;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) map[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return map;
}

function maskId(value) {
  const s = String(value || "");
  return s.length > 8 ? `...${s.slice(-8)}` : "***";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stopSidecar() {
  try { execFileSync("schtasks.exe", ["/End", "/TN", "Fusion Biometria FS80"], { stdio: "ignore" }); } catch {}
  try {
    const csv = execFileSync(
      "wmic.exe",
      ["process", "where", "Name='node.exe'", "get", "ProcessId,CommandLine", "/format:csv"],
      { encoding: "utf8", windowsHide: true }
    );
    for (const line of csv.split(/\r?\n/)) {
      if (!line.includes("fusion-biometria-sidecar.mjs")) continue;
      const pid = line.split(",").at(-1)?.trim();
      if (/^\d+$/.test(pid || "")) {
        try { execFileSync("taskkill.exe", ["/PID", pid, "/F"], { stdio: "ignore" }); } catch {}
      }
    }
  } catch {}
}

function startSidecar() {
  try {
    execFileSync("schtasks.exe", ["/Run", "/TN", "Fusion Biometria FS80"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ask(rl, message) {
  return new Promise(resolve => rl.question(message, () => resolve()));
}

function captureOnce(tenantId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ["monitor", tenantId], {
      cwd: path.dirname(exe),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let buffer = "";
    let stderr = "";
    let finished = false;

    const done = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        if (process.platform === "win32") {
          execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          child.kill("SIGKILL");
        }
      } catch {}
      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => done(new Error("Tempo limite aguardando a leitura do FS80.")), timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { stderr += String(chunk || ""); });

    child.stdout.on("data", chunk => {
      buffer += chunk;
      let pos;
      while ((pos = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, pos).trim();
        buffer = buffer.slice(pos + 1);
        if (!line) continue;

        let evt;
        try { evt = JSON.parse(line); } catch { continue; }

        if (evt.event === "identified") {
          return done(null, {
            resultado: "identified",
            farNumerico: Number.isFinite(Number(evt.farNumerico)) ? Number(evt.farNumerico) : null,
            candidato: maskId(evt.alunoId)
          });
        }
        if (evt.event === "no-match") {
          return done(null, {
            resultado: "no-match",
            farNumerico: null,
            candidato: null
          });
        }
        if (evt.event === "error") {
          return done(new Error(evt.erro || "Erro do monitor FS80."));
        }
      }
    });

    child.on("error", err => done(err));
    child.on("exit", code => {
      if (!finished) done(new Error(stderr.trim() || `Monitor FS80 encerrou antes da captura (code=${code}).`));
    });
  });
}

function stats(rows) {
  const nums = rows.map(x => x.farNumerico).filter(Number.isFinite);
  const sorted = [...nums].sort((a,b) => a-b);
  const median = sorted.length
    ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2)
    : null;
  return {
    leituras: rows.length,
    identificadas: rows.filter(x => x.resultado === "identified").length,
    naoReconhecidas: rows.filter(x => x.resultado === "no-match").length,
    farMin: sorted.length ? sorted[0] : null,
    farMax: sorted.length ? sorted.at(-1) : null,
    farMediana: median,
    valores: nums
  };
}

const env = loadEnv(envPath);
const tenantId = String(
  env.ACCESS_AGENT_TENANT_ID ||
  process.env.ACCESS_AGENT_TENANT_ID ||
  process.env.FUSION_TENANT_ID ||
  ""
).trim().toLowerCase();

if (!tenantId) fail("Tenant da biometria nao encontrado.");
if (!fs.existsSync(exe)) fail(`Executavel FS80 nao encontrado: ${exe}`);

fs.mkdirSync(outDir, { recursive: true });

console.log("============================================================");
console.log("FUSION ERP - CALIBRACAO SEGURA FS80");
console.log("============================================================");
console.log("Durante este teste a biometria de acesso fica parada.");
console.log("A catraca NAO sera liberada pelas leituras deste teste.");
console.log("");

stopSidecar();
await sleep(1800);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const known = [];
const unknown = [];

try {
  console.log("ETAPA 1 - DEDOS CADASTRADOS");
  console.log("Faca 5 leituras usando dedos que voce sabe que estao cadastrados.");
  console.log("Pode alternar entre os dedos cadastrados.");
  console.log("");

  for (let i = 1; i <= 5; i++) {
    await ask(rl, `[${i}/5] Retire o dedo do leitor. Pressione ENTER e depois coloque um dedo CADASTRADO... `);
    await sleep(700);
    const r = await captureOnce(tenantId);
    known.push(r);
    console.log(`      Resultado: ${r.resultado}${r.farNumerico !== null ? ` | FAR=${r.farNumerico}` : ""}`);
    await sleep(900);
  }

  console.log("");
  console.log("ETAPA 2 - DEDO NAO CADASTRADO");
  console.log("Faca 5 leituras com uma pessoa/dedo que NAO possui biometria cadastrada.");
  console.log("");

  for (let i = 1; i <= 5; i++) {
    await ask(rl, `[${i}/5] Retire o dedo do leitor. Pressione ENTER e depois coloque um dedo NAO CADASTRADO... `);
    await sleep(700);
    const r = await captureOnce(tenantId);
    unknown.push(r);
    console.log(`      Resultado: ${r.resultado}${r.farNumerico !== null ? ` | FAR=${r.farNumerico}` : ""}`);
    await sleep(900);
  }

  const conhecido = stats(known);
  const desconhecido = stats(unknown);

  let separacao = "inconclusiva";
  let limiteSugerido = null;

  if (conhecido.farMediana !== null && desconhecido.farMediana !== null) {
    if (conhecido.farMediana > desconhecido.farMediana &&
        conhecido.farMin !== null && desconhecido.farMax !== null &&
        conhecido.farMin > desconhecido.farMax) {
      separacao = "maior_far_mais_forte_com_gap";
      limiteSugerido = (conhecido.farMin + desconhecido.farMax) / 2;
    } else if (conhecido.farMediana < desconhecido.farMediana &&
               conhecido.farMax !== null && desconhecido.farMin !== null &&
               conhecido.farMax < desconhecido.farMin) {
      separacao = "menor_far_mais_forte_com_gap";
      limiteSugerido = (conhecido.farMax + desconhecido.farMin) / 2;
    } else {
      separacao = "valores_sobrepostos";
    }
  } else if (desconhecido.identificadas === 0) {
    separacao = "nao_cadastrado_nao_foi_identificado";
  }

  const report = {
    ok: true,
    tenantId,
    criadoEm: new Date().toISOString(),
    modo: "calibracao-sem-liberacao",
    amostrasConhecidas: conhecido,
    amostrasNaoCadastradas: desconhecido,
    separacao,
    limiteSugeridoSomenteParaAnalise: limiteSugerido,
    observacao: "Nenhum template biometrico foi incluido neste relatorio."
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("============================================================");
  console.log("CALIBRACAO_FS80_OK");
  console.log(`CADASTRADOS     FAR: min=${conhecido.farMin} max=${conhecido.farMax} mediana=${conhecido.farMediana}`);
  console.log(`NAO CADASTRADOS FAR: min=${desconhecido.farMin} max=${desconhecido.farMax} mediana=${desconhecido.farMediana}`);
  console.log(`RESULTADO=${separacao}`);
  if (limiteSugerido !== null) console.log(`LIMITE_ANALISE=${limiteSugerido}`);
  console.log("Relatorio salvo localmente em data\\biometria-calibracao\\");
  console.log("============================================================");
} finally {
  rl.close();
  await sleep(1000);
  const started = startSidecar();
  console.log(started ? "[OK] Modo acesso rearmado." : "[AVISO] Nao foi possivel rearmar a tarefa automaticamente.");
}
