import { createCommand, getCommand, getAgent, getAgentForTenant } from '../access-bridge/access-bridge.repository.mjs';
import { tenantAtual } from '../core/persistence/tenant-context.mjs';

const ACOES = new Set(['biometria_status', 'biometria_exists', 'biometria_enroll', 'biometria_delete']);

function texto(value = '', limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

function biometriaAtiva() {
  return ['1', 'true', 'sim', 'yes', 'on']
    .includes(String(process.env.ACCESS_BIOMETRIA_ENABLED || '').trim().toLowerCase());
}

function erro(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function equipmentIdsDoAgent(agent = {}) {
  const details = agent?.details && typeof agent.details === 'object' ? agent.details : {};
  const raw =
    agent.equipment_ids ??
    agent.equipmentIds ??
    details.equipmentIds ??
    details.equipment_ids ??
    details.equipmentId ??
    details.equipment_id ??
    [];

  if (Array.isArray(raw)) return raw.map(item => texto(item, 120)).filter(Boolean);
  return String(raw || '').split(',').map(item => texto(item, 120)).filter(Boolean);
}

async function targetAtual() {
  const tenantId = tenantAtual();
  const agent = await getAgentForTenant(tenantId).catch(() => null);

  if (!agent) {
    throw erro('Nenhum Fusion Access Agent foi localizado para esta academia.', 503);
  }

  const details = agent?.details && typeof agent.details === 'object' ? agent.details : {};
  const agentTenant = texto(agent.tenant_id || agent.tenantId || details.tenantId || details.tenant_id, 120);
  if (agentTenant && agentTenant !== tenantId) {
    throw erro('Agente biometrico pertence a outro tenant.', 403);
  }

  const agentId = texto(agent.agent_id || agent.agentId, 120);
  const equipmentId = equipmentIdsDoAgent(agent)[0] || '';

  if (!agentId) throw erro('Fusion Access Agent sem identificador valido.', 503);
  if (!equipmentId) {
    throw erro('O Fusion Access Agent ainda nao informou o equipamento desta academia. Aguarde alguns segundos e tente novamente.', 503);
  }

  return { agentId, tenantId, equipmentId };
}

async function agenteOnline(agentId) {
  const agent = await getAgent(agentId).catch(() => null);
  const seen = agent?.last_seen_at || agent?.lastSeenAt || null;
  if (!seen) return false;
  const ms = new Date(seen).getTime();
  return Number.isFinite(ms) && Date.now() - ms < 45000;
}

export async function enfileirarBiometria(action, payload = {}, ttlSeconds = 100) {
  if (!biometriaAtiva()) throw erro('Biometria desativada no servidor.', 503);
  if (!ACOES.has(action)) throw erro('Acao biometrica invalida.', 400);

  const target = await targetAtual();
  if (!(await agenteOnline(target.agentId))) {
    throw erro('Fusion Access Agent offline. Verifique o computador da academia.', 503);
  }

  const alunoId = texto(payload.alunoId);
  if (['biometria_exists', 'biometria_enroll', 'biometria_delete'].includes(action) && !alunoId) {
    throw erro('alunoId obrigatorio.', 400);
  }

  return createCommand({
    agentId: target.agentId,
    tenantId: target.tenantId,
    equipmentId: target.equipmentId,
    action,
    payload: {
      alunoId: alunoId || undefined,
      origem: 'painel-biometria',
      sensor: 'futronic-fs80'
    },
    expiresAt: new Date(Date.now() + Math.min(Math.max(Number(ttlSeconds || 30), 5), 120) * 1000).toISOString()
  });
}

export async function aguardarComando(commandId, timeoutMs = 15000) {
  const tenantId = tenantAtual();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const command = await getCommand(commandId);
    if (!command) throw erro('Comando biometrico nao encontrado.', 404);
    if (command.tenantId !== tenantId) throw erro('Comando pertence a outro tenant.', 403);
    if (command.status === 'completed') return command.result || {};
    if (command.status === 'failed') throw erro(command.error || 'Falha na operacao biometrica.', 502);
    if (command.status === 'expired') throw erro('Operacao biometrica expirou.', 504);
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw erro('O computador da academia nao respondeu a tempo.', 504);
}

export async function executarBiometria(action, payload = {}, { ttlSeconds = 100, timeoutMs = 15000 } = {}) {
  const command = await enfileirarBiometria(action, payload, ttlSeconds);
  const result = await aguardarComando(command.id, timeoutMs);
  return { command, result };
}


export async function consultarComandoBiometria(commandId) {
  const id = texto(commandId, 160);
  if (!id) throw erro('commandId obrigatorio.', 400);

  const command = await getCommand(id);
  if (!command) throw erro('Comando biometrico nao encontrado.', 404);

  const tenantId = tenantAtual();
  if (command.tenantId !== tenantId) throw erro('Comando pertence a outro tenant.', 403);
  if (command.action !== 'biometria_enroll') throw erro('Comando nao pertence ao cadastro biometrico.', 400);

  return command;
}
