import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { liberarCatraca } from '../modules/henry7x/henry7x.service.mjs';
dotenv.config();

const server = String(process.env.ACCESS_SERVER_URL || '').replace(/\/$/, '');
const agentId = String(process.env.ACCESS_AGENT_ID || '').trim();
const tenantId = String(process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || '').trim();
const equipmentId = String(process.env.ACCESS_EQUIPMENT_ID || '').trim();
const token = process.env.ACCESS_AGENT_TOKEN || '';
const pollMs = Math.max(Number(process.env.ACCESS_AGENT_POLL_MS || 1500), 1000);

const biometriaAtiva = ['1', 'true', 'sim', 'yes', 'on']
  .includes(String(process.env.FUSION_BIOMETRIA_ENABLED || '').trim().toLowerCase());
const biometriaExe = path.resolve(
  process.cwd(),
  String(process.env.FUSION_BIOMETRIA_EXE || 'scripts/biometria/FusionBiometriaFs80.exe')
);
const biometriaCooldownMs = Math.max(Number(process.env.FUSION_BIOMETRIA_COOLDOWN_MS || 5000), 2000);

if (!server || !agentId || !token) {
  console.error('Configure ACCESS_SERVER_URL, ACCESS_AGENT_ID e ACCESS_AGENT_TOKEN no .env');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function agentHeaders() {
  const headers = {
    'content-type': 'application/json',
    'x-agent-id': agentId,
    'x-agent-token': token,
    'x-agent-timestamp': new Date().toISOString(),
    'x-agent-nonce': crypto.randomUUID()
  };
  if (tenantId) {
    headers['x-agent-tenant-id'] = tenantId;
    headers['x-tenant-id'] = tenantId;
  }
  if (equipmentId) headers['x-agent-equipment-id'] = equipmentId;
  return headers;
}

async function request(pathname, options = {}) {
  const res = await fetch(`${server}${pathname}`, {
    ...options,
    headers: { ...agentHeaders(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || data.mensagem || `HTTP ${res.status}`);
  return data;
}

async function execute(command) {
  if (!command || command.action !== 'release') {
    throw new Error(`Ação não suportada: ${command?.action}`);
  }
  const p = command.payload || {};
  return liberarCatraca({
    host: p.host || process.env.HENRY_HOST || '10.0.0.236',
    port: Number(p.port || process.env.HENRY_PORT || 3000),
    tempoSegundos: Number(p.tempoSegundos || 5),
    alunoId: p.alunoId,
    alunoNome: p.alunoNome,
    operadorId: p.operadorId,
    origem: p.origem || 'fusion-access-agent',
    motivo: p.motivo
  });
}

const ultimasBiometrias = new Map();
let biometriaProcess = null;
let biometriaRestartTimer = null;

function dentroCooldown(alunoId) {
  const agora = Date.now();
  const anterior = ultimasBiometrias.get(alunoId) || 0;
  if (agora - anterior < biometriaCooldownMs) return true;
  ultimasBiometrias.set(alunoId, agora);

  if (ultimasBiometrias.size > 5000) {
    for (const [id, quando] of ultimasBiometrias) {
      if (agora - quando > biometriaCooldownMs * 10) ultimasBiometrias.delete(id);
    }
  }
  return false;
}

async function enviarBiometria(alunoId, farNumerico = null) {
  const id = String(alunoId || '').trim().slice(0, 160);
  if (!id || dentroCooldown(id)) return;

  try {
    const resultado = await request('/api/access-bridge/agent/biometria/acesso', {
      method: 'POST',
      body: JSON.stringify({
        alunoId: id,
        direcao: 'entrada',
        sensor: 'futronic-fs80',
        farNumerico
      })
    });

    console.log(
      `[BIOMETRIA] aluno=${id} autorizado=${resultado.autorizado === true} motivo=${resultado.motivo || ''}`
    );
  } catch (error) {
    console.error(`[BIOMETRIA] acesso não processado: ${error.message}`);
  }
}

function processarLinhaBiometria(line) {
  const texto = String(line || '').trim();
  if (!texto) return;

  let evt;
  try {
    evt = JSON.parse(texto);
  } catch {
    console.log(`[BIOMETRIA] ${texto}`);
    return;
  }

  if (evt.event === 'identified' && evt.alunoId) {
    void enviarBiometria(evt.alunoId, evt.farNumerico ?? null);
    return;
  }

  if (evt.event === 'status') {
    console.log(`[BIOMETRIA] ${evt.estado || evt.state || 'status'}`);
    return;
  }

  if (evt.event === 'error') {
    console.error(`[BIOMETRIA] ${evt.erro || 'erro no monitor FS80'}`);
  }
}

function agendarReinicioBiometria() {
  if (!biometriaAtiva || biometriaRestartTimer) return;
  biometriaRestartTimer = setTimeout(() => {
    biometriaRestartTimer = null;
    iniciarBiometria();
  }, 5000);
}

function iniciarBiometria() {
  if (!biometriaAtiva) {
    console.log('Biometria FS80 desativada (FUSION_BIOMETRIA_ENABLED=false).');
    return;
  }

  if (!fs.existsSync(biometriaExe)) {
    console.error(`Biometria FS80 ativa, mas executável não encontrado: ${biometriaExe}`);
    return;
  }

  if (biometriaProcess && !biometriaProcess.killed) return;

  console.log(`Biometria FS80 iniciando: ${biometriaExe}`);
  biometriaProcess = spawn(biometriaExe, ['monitor'], {
    cwd: path.dirname(biometriaExe),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let buffer = '';
  biometriaProcess.stdout.setEncoding('utf8');
  biometriaProcess.stdout.on('data', chunk => {
    buffer += chunk;
    let pos;
    while ((pos = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, pos);
      buffer = buffer.slice(pos + 1);
      processarLinhaBiometria(line);
    }
  });

  biometriaProcess.stderr.setEncoding('utf8');
  biometriaProcess.stderr.on('data', chunk => {
    const text = String(chunk || '').trim();
    if (text) console.error(`[BIOMETRIA STDERR] ${text}`);
  });

  biometriaProcess.on('error', error => {
    console.error(`[BIOMETRIA] falha ao iniciar monitor: ${error.message}`);
  });

  biometriaProcess.on('exit', (code, signal) => {
    biometriaProcess = null;
    console.error(`[BIOMETRIA] monitor encerrou code=${code ?? ''} signal=${signal ?? ''}`);
    agendarReinicioBiometria();
  });
}

function encerrarBiometria() {
  if (biometriaRestartTimer) {
    clearTimeout(biometriaRestartTimer);
    biometriaRestartTimer = null;
  }
  try {
    biometriaProcess?.kill();
  } catch {}
}

process.on('SIGINT', () => {
  encerrarBiometria();
  process.exit(0);
});
process.on('SIGTERM', () => {
  encerrarBiometria();
  process.exit(0);
});

console.log(`Fusion Access Agent ativo: ${agentId} -> ${server}`);
iniciarBiometria();

let failures = 0;
while (true) {
  try {
    const { command } = await request('/api/access-bridge/agent/next');
    failures = 0;
    if (!command) {
      await sleep(pollMs);
      continue;
    }
    console.log(`[${new Date().toISOString()}] comando ${command.id}`);
    try {
      const result = await execute(command);
      await request(`/api/access-bridge/agent/commands/${command.id}/result`, {
        method: 'POST',
        body: JSON.stringify({ ok: true, result })
      });
      console.log(`Comando ${command.id} concluído`);
    } catch (error) {
      await request(`/api/access-bridge/agent/commands/${command.id}/result`, {
        method: 'POST',
        body: JSON.stringify({ ok: false, error: error.message })
      }).catch(() => {});
      console.error(`Comando ${command.id} falhou: ${error.message}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`Conexão falhou: ${error.message}`);
    await sleep(Math.min(30000, pollMs * Math.max(2, failures)));
  }
}
