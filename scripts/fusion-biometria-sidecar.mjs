import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createLocalAccessEngine } from './fusion-access-local-engine.mjs';

const server = String(process.env.ACCESS_SERVER_URL || '').replace(/\/+$/, '');
const agentId = String(process.env.ACCESS_AGENT_ID || '').trim();
const token = String(process.env.ACCESS_AGENT_TOKEN || '');
const tenantId = String(process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || '').trim().toLowerCase();
const equipmentId = String(process.env.ACCESS_EQUIPMENT_ID || '').trim();
const enabled = ['1', 'true', 'sim', 'yes', 'on']
  .includes(String(process.env.FUSION_BIOMETRIA_ENABLED || '').trim().toLowerCase());
const exe = path.resolve(
  process.cwd(),
  String(process.env.FUSION_BIOMETRIA_EXE || 'scripts/biometria/FusionBiometriaFs80.exe')
);
const cooldownMs = Math.max(Number(process.env.FUSION_BIOMETRIA_COOLDOWN_MS || 5000), 2000);
const adminPollMs = Math.max(Number(process.env.FUSION_BIOMETRIA_ADMIN_POLL_MS || 1000), 700);
const once = process.argv.includes('--once');
const validateOnly = process.argv.includes('--validate');

function fail(message, code = 2) {
  console.error(`[BIOMETRIA] ${message}`);
  process.exit(code);
}

if (!server || !agentId || !token) fail('ACCESS_SERVER_URL, ACCESS_AGENT_ID e ACCESS_AGENT_TOKEN sao obrigatorios.');
if (!tenantId) fail('ACCESS_AGENT_TENANT_ID e obrigatorio. A biometria nao pode operar sem tenant.');
if (!equipmentId) fail('ACCESS_EQUIPMENT_ID e obrigatorio. A biometria nao pode operar sem equipamento vinculado.');
if (!fs.existsSync(exe)) fail(`Executavel FS80 nao encontrado: ${exe}`);

if (validateOnly) {
  console.log(JSON.stringify({
    ok: true,
    modo: 'validate',
    tenantId,
    agentId,
    equipmentId,
    servidor: new URL(server).origin,
    biometriaHabilitada: enabled,
    cadastroPeloSite: true,
    templateEnviadoAoServidor: false
  }));
  process.exit(0);
}

if (!enabled) fail('FUSION_BIOMETRIA_ENABLED esta desativada. Nenhum monitor foi iniciado.', 3);

const localAccessEngine = createLocalAccessEngine({
  tenantId,
  agentId,
  token,
  equipmentId,
  host: process.env.ACCESS_HOST || process.env.HENRY7X_HOST || '10.0.0.236',
  port: Number(process.env.ACCESS_PORT || process.env.HENRY7X_PORT || 3000)
});

function agentHeaders(json = true) {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-agent-id': agentId,
    'x-agent-token': token,
    'x-agent-timestamp': String(Date.now()),
    'x-agent-nonce': crypto.randomBytes(16).toString('hex'),
    'x-agent-tenant-id': tenantId,
    'x-agent-equipment-id': equipmentId
  };
}

function maskId(value) {
  const id = String(value || '');
  if (id.length <= 8) return '***';
  return `...${id.slice(-8)}`;
}

const lastSeen = new Map();
function inCooldown(alunoId) {
  const now = Date.now();
  const previous = Number(lastSeen.get(alunoId) || 0);
  if (now - previous < cooldownMs) return true;
  lastSeen.set(alunoId, now);
  if (lastSeen.size > 5000) {
    for (const [id, when] of lastSeen) if (now - when > cooldownMs * 10) lastSeen.delete(id);
  }
  return false;
}

let monitor = null;
let restartTimer = null;
let stopping = false;
let requestInFlight = false;
let adminCommandInFlight = false;
let adminTimer = null;
let monitorHealthy = false;
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

async function sendIdentifiedOnline(evt, skipCooldown = false) {
  const alunoId = String(evt?.alunoId || '').trim().slice(0, 160);
  if (!alunoId || requestInFlight || adminCommandInFlight || (!skipCooldown && inCooldown(alunoId))) return;
  if (String(evt?.tenantId || '').trim().toLowerCase() !== tenantId) {
    console.error('[BIOMETRIA] Evento rejeitado: tenant do monitor diverge do tenant do Agent.');
    return;
  }

  requestInFlight = true;
  try {
    const response = await fetch(`${server}/api/access-bridge/agent/biometria/acesso`, {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify({
        alunoId,
        direcao: 'entrada',
        sensor: 'futronic-fs80',
        farNumerico: evt?.farNumerico ?? null
      }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[BIOMETRIA] servidor HTTP ${response.status}: ${data.erro || data.mensagem || 'falha'}`);
      return;
    }

    console.log(JSON.stringify({
      event: 'access-result',
      tenantId,
      aluno: maskId(alunoId),
      autorizado: data.autorizado === true,
      motivo: data.motivo || '',
      commandId: data.commandId || null,
      logId: data.logId || null,
      templateEnviadoAoServidor: false
    }));
  } catch (error) {
    console.error(`[BIOMETRIA] falha ao consultar servidor: ${error.message}`);
  } finally {
    requestInFlight = false;
    if (once) stop(0);
  }
}

async function sendIdentified(evt) {
  const alunoId = String(evt?.alunoId || '').trim().slice(0, 160);
  if (!alunoId || requestInFlight || adminCommandInFlight || inCooldown(alunoId)) return;

  if (String(evt?.tenantId || '').trim().toLowerCase() !== tenantId) {
    console.error('[BIOMETRIA] Evento rejeitado: tenant do monitor diverge do tenant do Agent.');
    return;
  }

  requestInFlight = true;
  try {
    const local = await localAccessEngine.handleIdentified(alunoId, evt?.farNumerico ?? null);
    if (local?.handled) {
      console.log(JSON.stringify({
        event: 'local-access-result',
        tenantId,
        aluno: maskId(alunoId),
        autorizado: local.autorizado === true,
        motivo: local.motivo || '',
        modo: 'local',
        acessosHoje: local.acessosHoje ?? null,
        templateEnviadoAoServidor: false
      }));
      if (once) stop(local.autorizado ? 0 : 4);
      return;
    }
  } catch (error) {
    console.error(`[BIOMETRIA] motor local falhou; usando fallback online: ${error.message}`);
  } finally {
    requestInFlight = false;
  }

  // Antes do primeiro snapshot, ou se o motor local ainda nao conhece a pessoa,
  // preserva o fluxo online ja validado.
  await sendIdentifiedOnline(evt, true);
}

function processLine(line) {
  const text = String(line || '').trim();
  if (!text) return;
  let evt;
  try { evt = JSON.parse(text); } catch { console.log(`[BIOMETRIA] ${text}`); return; }

  if (evt.event === 'identified') { void sendIdentified(evt); return; }
  if (evt.event === 'status') {
    monitorHealthy = true;
    console.log(JSON.stringify({ event: 'status', estado: evt.estado || 'status', tenantId: evt.tenantId || tenantId, sensor: evt.sensor || 'Futronic FS80' }));
    return;
  }
  if (evt.event === 'no-match') {
    monitorHealthy = true;
    console.log(JSON.stringify({ event: 'no-match', tenantId }));
    if (once) stop(4);
    return;
  }
  if (evt.event === 'error') console.error(`[BIOMETRIA] ${evt.erro || 'erro no monitor FS80'}`);
}

function scheduleRestart() {
  if (once || stopping || restartTimer || adminCommandInFlight) return;
  restartTimer = setTimeout(() => { restartTimer = null; startMonitor(); }, 2500);
}

function startMonitor() {
  if (stopping || monitor || adminCommandInFlight) return;
  monitorHealthy = false;
  console.log(JSON.stringify({
    event: 'sidecar-starting', tenantId, agentId, equipmentId,
    modo: once ? 'once' : 'continuous', cadastroPeloSite: true, templateEnviadoAoServidor: false
  }));

  monitor = spawn(exe, ['monitor', tenantId], {
    cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });

  let buffer = '';
  monitor.stdout.setEncoding('utf8');
  monitor.stdout.on('data', chunk => {
    buffer += chunk;
    let pos;
    while ((pos = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, pos);
      buffer = buffer.slice(pos + 1);
      processLine(line);
    }
  });

  monitor.stderr.setEncoding('utf8');
  monitor.stderr.on('data', chunk => {
    const text = String(chunk || '').trim();
    if (text) console.error(`[BIOMETRIA STDERR] ${text}`);
  });

  monitor.on('error', error => console.error(`[BIOMETRIA] falha ao iniciar monitor: ${error.message}`));
  monitor.on('exit', (code, signal) => {
    monitor = null;
    monitorHealthy = false;
    if (!stopping && !adminCommandInFlight) {
      console.error(`[BIOMETRIA] monitor encerrou code=${code ?? ''} signal=${signal ?? ''}`);
      scheduleRestart();
    }
  });
}

async function stopMonitorForAdmin() {
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

function runExe(args, timeoutMs = 90000, onEvent = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let liveBuffer = '';

    const emitLine = line => {
      const text = String(line || '').trim();
      if (!text || typeof onEvent !== 'function') return;
      try { onEvent(JSON.parse(text)); } catch {}
    };

    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('Tempo limite da operacao biometrica excedido.'));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      const text = String(chunk || '');
      out += text;
      liveBuffer += text;
      let pos;
      while ((pos = liveBuffer.indexOf('\n')) >= 0) {
        emitLine(liveBuffer.slice(0, pos));
        liveBuffer = liveBuffer.slice(pos + 1);
      }
    });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      if (liveBuffer.trim()) emitLine(liveBuffer);
      const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      let payload = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const candidate = JSON.parse(lines[i]);
          if (candidate && (Object.prototype.hasOwnProperty.call(candidate, 'ok') || candidate.acao)) {
            payload = candidate;
            break;
          }
        } catch {}
      }
      if (!payload) return reject(new Error(err.trim() || `Operacao biometrica encerrou sem resposta valida (code=${code}).`));
      if (code !== 0 || payload.ok === false) return reject(new Error(payload.erro || err.trim() || 'Falha na operacao biometrica.'));
      resolve(payload);
    });
  });
}

async function sendAdminProgress(commandId, progress = {}) {
  try {
    const response = await fetch(`${server}/api/access-bridge/agent/commands/${encodeURIComponent(commandId)}/progress`, {
      method: 'POST',
      headers: agentHeaders(),
      body: JSON.stringify(progress),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok && response.status !== 404) {
      console.error(`[BIOMETRIA] progresso HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`[BIOMETRIA] falha ao enviar progresso: ${error.message}`);
  }
}

async function finishAdminCommand(commandId, outcome) {
  try {
    await fetch(`${server}/api/access-bridge/agent/commands/${encodeURIComponent(commandId)}/result`, {
      method: 'POST', headers: agentHeaders(), body: JSON.stringify(outcome), signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    console.error(`[BIOMETRIA] falha ao concluir comando administrativo ${commandId}: ${error.message}`);
  }
}

async function executeAdminCommand(command) {
  const action = String(command?.action || '');
  const payload = command?.payload || {};
  const alunoId = String(payload.alunoId || '').trim().slice(0, 160);

  adminCommandInFlight = true;
  try {
    let result;
    if (action === 'biometria_status') {
      result = { ok: true, conectado: Boolean(monitor) || biometricMode === 'cadastro', monitorAtivo: Boolean(monitor), monitorSaudavel: monitorHealthy, modo: biometricMode, cadastroEmAndamento: biometricMode === 'cadastro', modoExclusivo: modoCadastroExclusivo, sensor: 'Futronic FS80', tenantId, templateExposto: false, motorLocal: localAccessEngine.status() };
    } else if (action === 'biometria_exists') {
      result = await runExe(['exists', alunoId, tenantId], 15000);
    } else if (action === 'biometria_delete') {
      result = await runExe(['delete', alunoId, tenantId], 15000);
    } else if (action === 'biometria_enroll') {
      // Um unico dono do FS80 por vez:
      // acesso OFF -> aguarda SDK liberar -> cadastro ON.
      setBiometricMode('cadastro');
      await sendAdminProgress(command.id, {
        percentual: 5,
        etapa: 'preparando',
        mensagem: 'Preparando o leitor Futronic para cadastro.',
        atividade: 0
      });

      await stopMonitorForAdmin();

      await sendAdminProgress(command.id, {
        percentual: 12,
        etapa: 'leitor_exclusivo',
        mensagem: 'Leitor reservado para o cadastro. Verificando a digital.',
        atividade: 0
      });

      result = await runExe(['enroll', alunoId, tenantId], 90000, evt => {
        if (evt?.event !== 'enroll-progress') return;
        void sendAdminProgress(command.id, {
          percentual: Number(evt.percentual || 0),
          etapa: String(evt.etapa || 'capturando'),
          mensagem: String(evt.mensagem || 'Capturando amostras no Futronic.'),
          atividade: Number(evt.atividade || 0)
        });
      });

      await sendAdminProgress(command.id, {
        percentual: 97,
        etapa: 'finalizando',
        mensagem: 'Template protegido e salvo. Finalizando cadastro.',
        atividade: 3
      });

      // Garante que o processo de cadastro fechou FTRAPI antes do rearmamento.
      await sleep(sdkReleaseMs);
    } else {
      throw new Error(`Acao biometrica nao suportada: ${action}`);
    }
    await finishAdminCommand(command.id, { ok: true, result: { ...result, templateExposto: false } });
    console.log(JSON.stringify({ event: 'admin-command-completed', action, commandId: command.id, tenantId, aluno: alunoId ? maskId(alunoId) : undefined, templateEnviadoAoServidor: false }));
  } catch (error) {
    await finishAdminCommand(command.id, { ok: false, error: error.message });
    console.error(`[BIOMETRIA] comando administrativo falhou ${action}: ${error.message}`);
  } finally {
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
}

async function pollAdminCommand() {
  if (stopping || adminCommandInFlight) return;
  try {
    const response = await fetch(`${server}/api/access-bridge/agent/next?consumer=biometria`, {
      method: 'GET', headers: agentHeaders(false), signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[BIOMETRIA] fila administrativa HTTP ${response.status}: ${data.erro || data.mensagem || 'falha'}`);
      return;
    }
    if (data.command) await executeAdminCommand(data.command);
  } catch (error) {
    if (!stopping) console.error(`[BIOMETRIA] falha na fila administrativa: ${error.message}`);
  }
}

function scheduleAdminPoll() {
  if (stopping || once) return;
  adminTimer = setInterval(() => { void pollAdminCommand(); }, adminPollMs);
  setTimeout(() => { void pollAdminCommand(); }, 500);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (adminTimer) clearInterval(adminTimer);
  restartTimer = null;
  adminTimer = null;
  try { monitor?.kill(); } catch {}
  try { localAccessEngine.stop(); } catch {}
  setTimeout(() => process.exit(code), 50);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

startMonitor();
scheduleAdminPoll();
