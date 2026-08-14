import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const target = path.join(repo, "scripts", "fusion-biometria-sidecar.mjs");
const backupDir = path.join(repo, "data", "backup-fs80-modo-exclusivo");
fs.mkdirSync(backupDir, { recursive: true });

function fail(msg) {
  console.error("[ERRO] " + msg);
  process.exit(1);
}

if (!fs.existsSync(target)) fail("scripts/fusion-biometria-sidecar.mjs nao encontrado.");

let text = fs.readFileSync(target, "utf8");

if (text.includes("FUSION_BIOMETRIA_SDK_RELEASE_MS") && text.includes("modoCadastroExclusivo")) {
  console.log("[OK] Patch de modo exclusivo ja esta aplicado.");
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(target, path.join(backupDir, `fusion-biometria-sidecar-${stamp}.mjs`));

  const anchorVars = `let monitorHealthy = false;\n`;
  if (!text.includes(anchorVars)) fail("Versao do sidecar nao reconhecida (variaveis).");

  const newVars = `let monitorHealthy = false;
let biometricMode = 'acesso';
const sdkReleaseMs = Math.max(Number(process.env.FUSION_BIOMETRIA_SDK_RELEASE_MS || 1400), 800);
const sdkRearmMs = Math.max(Number(process.env.FUSION_BIOMETRIA_SDK_REARM_MS || 1200), 800);
const modoCadastroExclusivo = true;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setBiometricMode(mode) {
  biometricMode = mode;
  console.log(JSON.stringify({
    event: 'biometria-mode',
    modo: mode,
    tenantId,
    sensor: 'Futronic FS80',
    exclusivo: true
  }));
}
`;
  text = text.replace(anchorVars, newVars);

  const oldStop = `function stopMonitorForAdmin() {
  return new Promise(resolve => {
    if (!monitor) return resolve();
    const current = monitor;
    const done = () => resolve();
    current.once('exit', done);
    try { current.kill(); } catch { resolve(); }
    setTimeout(() => { try { current.kill('SIGKILL'); } catch {} resolve(); }, 2000);
  });
}
`;

  const newStop = `async function stopMonitorForAdmin() {
  if (!monitor) {
    await sleep(sdkReleaseMs);
    return;
  }

  const current = monitor;

  await new Promise((resolve, reject) => {
    let finished = false;
    let deadline = null;

    const finish = (error = null) => {
      if (finished) return;
      finished = true;
      if (deadline) clearTimeout(deadline);
      if (error) reject(error); else resolve();
    };

    current.once('exit', () => finish());

    try {
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(current.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore'
        });
        killer.on('error', () => {
          try { current.kill('SIGKILL'); } catch {}
        });
        killer.on('exit', code => {
          if (code !== 0) {
            try { current.kill('SIGKILL'); } catch {}
          }
        });
      } else {
        current.kill('SIGTERM');
        setTimeout(() => {
          try { if (current.exitCode === null) current.kill('SIGKILL'); } catch {}
        }, 1500);
      }
    } catch {
      try { current.kill('SIGKILL'); } catch {}
    }

    deadline = setTimeout(() => {
      if (current.exitCode !== null || current.signalCode) return finish();
      finish(new Error('O modo acesso nao liberou o leitor FS80. Cadastro cancelado para evitar conflito de SDK.'));
    }, 7000);
  });

  // O processo acabou, mas o driver USB/Futronic ainda precisa de uma pequena
  // janela para concluir FTRTerminate e liberar o dispositivo.
  await sleep(sdkReleaseMs);
}
`;

  if (!text.includes(oldStop)) fail("Versao do sidecar nao reconhecida (stopMonitorForAdmin).");
  text = text.replace(oldStop, newStop);

  const oldStatus = `result = { ok: true, conectado: Boolean(monitor), monitorAtivo: Boolean(monitor), monitorSaudavel: monitorHealthy, sensor: 'Futronic FS80', tenantId, templateExposto: false };`;
  const newStatus = `result = { ok: true, conectado: Boolean(monitor) || biometricMode === 'cadastro', monitorAtivo: Boolean(monitor), monitorSaudavel: monitorHealthy, modo: biometricMode, cadastroEmAndamento: biometricMode === 'cadastro', modoExclusivo: modoCadastroExclusivo, sensor: 'Futronic FS80', tenantId, templateExposto: false };`;
  if (!text.includes(oldStatus)) fail("Versao do sidecar nao reconhecida (status).");
  text = text.replace(oldStatus, newStatus);

  const oldEnroll = `} else if (action === 'biometria_enroll') {
      await stopMonitorForAdmin();
      result = await runExe(['enroll', alunoId, tenantId], 90000);
    } else {`;

  const newEnroll = `} else if (action === 'biometria_enroll') {
      // Um unico dono do FS80 por vez:
      // acesso OFF -> aguarda SDK liberar -> cadastro ON.
      setBiometricMode('cadastro');
      await stopMonitorForAdmin();
      result = await runExe(['enroll', alunoId, tenantId], 90000);
      // Garante que o processo de cadastro fechou FTRAPI antes do rearmamento.
      await sleep(sdkReleaseMs);
    } else {`;

  if (!text.includes(oldEnroll)) fail("Versao do sidecar nao reconhecida (enroll).");
  text = text.replace(oldEnroll, newEnroll);

  const oldFinally = `  } finally {
    adminCommandInFlight = false;
    if (!stopping && !monitor) startMonitor();
  }
}`;

  const newFinally = `  } finally {
    adminCommandInFlight = false;

    if (action === 'biometria_enroll') {
      // cadastro OFF -> aguarda USB/SDK liberar -> acesso ON.
      setBiometricMode('acesso');
      if (!stopping && !monitor) {
        await sleep(sdkRearmMs);
        startMonitor();
      }
    } else if (!stopping && !monitor) {
      startMonitor();
    }
  }
}`;

  if (!text.includes(oldFinally)) fail("Versao do sidecar nao reconhecida (finally).");
  text = text.replace(oldFinally, newFinally);

  fs.writeFileSync(target, text, "utf8");
  console.log("[OK] Alternancia exclusiva acesso/cadastro aplicada.");
}

try {
  execFileSync(process.execPath, ["--check", target], { stdio: "inherit" });
  console.log("[OK] Sintaxe validada.");
} catch {
  fail("Falha na validacao do sidecar.");
}

try {
  execFileSync("git", ["add", "--", "scripts/fusion-biometria-sidecar.mjs"], { cwd: repo, stdio: "inherit" });
  const diff = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repo, encoding: "utf8" }).trim();
  if (diff.includes("scripts/fusion-biometria-sidecar.mjs")) {
    execFileSync("git", ["commit", "-m", "fix: alterna FS80 entre acesso e cadastro"], { cwd: repo, stdio: "inherit" });
    try {
      execFileSync("git", ["push"], { cwd: repo, stdio: "inherit" });
      console.log("[OK] Correcao enviada ao GitHub.");
    } catch {
      console.log("[AVISO] Commit criado, mas git push falhou. A correcao local continua aplicada.");
    }
  } else {
    console.log("[OK] Nao havia nova alteracao para commit.");
  }
} catch (e) {
  console.log("[AVISO] Nao foi possivel criar/enviar commit automaticamente: " + e.message);
}

// Reinicia somente a biometria local. Nao toca no Access Agent/Henry.
try {
  execFileSync("schtasks.exe", ["/End", "/TN", "Fusion Biometria FS80"], { stdio: "ignore" });
} catch {}

try {
  const csv = execFileSync(
    "wmic.exe",
    ["process", "where", "Name='node.exe'", "get", "ProcessId,CommandLine", "/format:csv"],
    { encoding: "utf8", windowsHide: true }
  );
  for (const line of csv.split(/\r?\n/)) {
    if (!line.includes("fusion-biometria-sidecar.mjs")) continue;
    const parts = line.split(",");
    const pid = parts.at(-1)?.trim();
    if (/^\d+$/.test(pid)) {
      try { execFileSync("taskkill.exe", ["/PID", pid, "/F"], { stdio: "ignore" }); } catch {}
    }
  }
} catch {}

try {
  execFileSync("schtasks.exe", ["/Run", "/TN", "Fusion Biometria FS80"], { stdio: "inherit" });
  console.log("[OK] Biometria reiniciada.");
} catch {
  console.log("[AVISO] Execute a tarefa 'Fusion Biometria FS80' manualmente se ela nao iniciar.");
}

console.log("");
console.log("============================================================");
console.log("FS80_MODO_EXCLUSIVO_OK");
console.log("ACESSO -> desarma -> CADASTRO -> desarma -> ACESSO");
console.log("============================================================");
