import crypto from 'node:crypto';
import { createCommand, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent } from './access-bridge.repository.mjs';
import { normalizarTenantId } from '../core/persistence/tenant-context.mjs';

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || '')); const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;
const usedAgentNonces = new Map();

function text(value, limit = 500) {
  return String(value ?? '').trim().slice(0, limit);
}

function httpError(message, status = 400, code = 'ACCESS_BRIDGE_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function unauthorized(message) {
  return httpError(message, 401, 'ACCESS_AGENT_UNAUTHORIZED');
}

function configError(message) {
  return httpError(message, 503, 'ACCESS_BRIDGE_CONFIG');
}

function parseDateMs(value) {
  const raw = text(value, 80);
  if (!raw) return null;
  const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeHash(value) {
  const hash = text(value, 120).toLowerCase().replace(/^sha256:/, '');
  return TOKEN_HASH_PATTERN.test(hash) ? hash : '';
}

function normalizeAgentId(value) {
  const agentId = normalizarTenantId(value);
  return AGENT_ID_PATTERN.test(agentId) ? agentId : '';
}

function normalizeEquipmentId(value) {
  return text(value, 120).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80);
}

function isEnabled(value) {
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function equipmentAllowed(credential, equipmentId) {
  return !credential?.equipmentIds?.length || credential.equipmentIds.includes(equipmentId);
}

function readJsonEnv(name) {
  const raw = text(process.env[name], 20000);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw configError(`${name} possui JSON invalido.`); }
}

function listFrom(value) {
  if (Array.isArray(value)) return value.map(item => text(item, 120)).filter(Boolean);
  return text(value, 1000).split(',').map(item => text(item, 120)).filter(Boolean);
}

function addTokenHash(list, item = {}) {
  const plain = text(item.token || item.agentToken || item.agent_token, 1000);
  const hash = normalizeHash(item.hash || item.tokenHash || item.token_hash || item.tokenSha256 || item.token_sha256) || (plain ? sha256(plain) : '');
  if (!hash) return;
  list.push({
    hash,
    label: text(item.label || item.nome || item.name || 'current', 80),
    notBeforeMs: parseDateMs(item.notBefore || item.not_before || item.activeFrom || item.active_from),
    expiresAtMs: parseDateMs(item.expiresAt || item.expires_at || item.tokenExpiresAt || item.token_expires_at)
  });
}

function normalizeCredential(input = {}, fallbackAgentId = '') {
  if (typeof input === 'string') input = { token: input };
  const agentId = normalizeAgentId(input.agentId || input.agent_id || fallbackAgentId);
  if (!agentId) return null;
  const tokenHashes = [];
  addTokenHash(tokenHashes, input);
  addTokenHash(tokenHashes, {
    token: input.nextToken || input.next_token || input.agentTokenNext || input.agent_token_next,
    tokenHash: input.nextTokenHash || input.next_token_hash || input.nextTokenSha256 || input.next_token_sha256,
    expiresAt: input.nextTokenExpiresAt || input.next_token_expires_at,
    notBefore: input.nextTokenNotBefore || input.next_token_not_before,
    label: 'next'
  });
  for (const token of Array.isArray(input.tokens) ? input.tokens : []) addTokenHash(tokenHashes, typeof token === 'string' ? { token } : token);
  const tenantId = normalizarTenantId(input.tenantId || input.tenant_id || '');
  return {
    agentId,
    tenantId,
    equipmentIds: listFrom(input.equipmentIds || input.equipment_ids),
    disabledAtMs: parseDateMs(input.disabledAt || input.disabled_at),
    tokenHashes
  };
}

function addCredential(map, credential) {
  if (!credential?.agentId || !credential.tokenHashes.length) return;
  map.set(credential.agentId, credential);
}

function credentialsFromEnv() {
  const map = new Map();
  const raw = readJsonEnv('ACCESS_AGENT_CREDENTIALS') || readJsonEnv('ACCESS_AGENT_TOKENS_JSON');
  if (Array.isArray(raw)) {
    for (const item of raw) addCredential(map, normalizeCredential(item));
  } else if (raw && typeof raw === 'object') {
    const entries = Array.isArray(raw.agents)
      ? raw.agents.map(item => [item.agentId || item.agent_id, item])
      : Object.entries(raw);
    for (const [agentId, item] of entries) addCredential(map, normalizeCredential(item, agentId));
  }

  addCredential(map, normalizeCredential({
    agentId: process.env.ACCESS_AGENT_ID,
    tenantId: process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID,
    equipmentIds: process.env.ACCESS_EQUIPMENT_IDS || process.env.ACCESS_EQUIPMENT_ID,
    token: process.env.ACCESS_AGENT_TOKEN,
    tokenHash: process.env.ACCESS_AGENT_TOKEN_SHA256,
    tokenExpiresAt: process.env.ACCESS_AGENT_TOKEN_EXPIRES_AT,
    nextToken: process.env.ACCESS_AGENT_TOKEN_NEXT,
    nextTokenHash: process.env.ACCESS_AGENT_TOKEN_SHA256_NEXT,
    nextTokenExpiresAt: process.env.ACCESS_AGENT_TOKEN_NEXT_EXPIRES_AT,
    nextTokenNotBefore: process.env.ACCESS_AGENT_TOKEN_NEXT_NOT_BEFORE
  }));
  return map;
}

function storedCredential(agent = {}, agentId = '') {
  if (!agent) return null;
  const details = agent?.details && typeof agent.details === 'object' ? agent.details : {};
  return normalizeCredential({
    agentId: agent.agent_id || agent.agentId || agentId,
    tenantId: agent.tenant_id || agent.tenantId || details.tenantId || details.tenant_id,
    equipmentIds: agent.equipment_ids || agent.equipmentIds || details.equipmentIds || details.equipment_ids,
    tokenHash: agent.token_hash || agent.tokenHash || details.tokenHash || details.token_hash,
    tokenExpiresAt: agent.token_expires_at || agent.tokenExpiresAt || details.tokenExpiresAt || details.token_expires_at,
    disabledAt: agent.disabled_at || agent.disabledAt || details.disabledAt || details.disabled_at,
    tokens: details.tokens
  }, agentId);
}

async function resolveCredential(agentId) {
  const envCredential = credentialsFromEnv().get(agentId) || null;
  const agent = await getAgent(agentId).catch(() => null);
  const dbCredential = storedCredential(agent, agentId);
  if (dbCredential?.tokenHashes.length) return dbCredential;
  if (!envCredential) return null;
  if (!agent) return envCredential;
  return {
    ...envCredential,
    tenantId: dbCredential?.tenantId || envCredential.tenantId,
    equipmentIds: dbCredential?.equipmentIds?.length ? dbCredential.equipmentIds : envCredential.equipmentIds
  };
}

function matchCredential(credential, token) {
  if (!credential?.tokenHashes?.length) return { ok: false, reason: 'Agente sem credencial cadastrada.' };
  const now = Date.now();
  if (credential.disabledAtMs && credential.disabledAtMs <= now) return { ok: false, reason: 'Agente desabilitado.' };
  const incomingHash = sha256(token);
  const matching = credential.tokenHashes.filter(item => safeEqual(incomingHash, item.hash));
  if (!matching.length) return { ok: false, reason: 'Token do agente invalido.' };
  const active = matching.find(item =>
    (!item.notBeforeMs || item.notBeforeMs <= now) &&
    (!item.expiresAtMs || item.expiresAtMs > now)
  );
  if (active) return { ok: true, label: active.label };
  return { ok: false, reason: 'Token do agente expirado ou fora da janela de rotacao.' };
}

function clockSkewMs() {
  const configured = Number(process.env.ACCESS_AGENT_MAX_CLOCK_SKEW_MS || 300000);
  if (!Number.isFinite(configured)) return 300000;
  return Math.max(30000, Math.min(900000, configured));
}

function cleanupNonces(now = Date.now()) {
  if (usedAgentNonces.size < 10000) return;
  for (const [key, expiresAt] of usedAgentNonces) if (expiresAt <= now) usedAgentNonces.delete(key);
}

function validateFreshness(req, agentId) {
  const timestampRaw = req.get('x-agent-timestamp') || req.get('x-agent-ts');
  const requestMs = parseDateMs(timestampRaw);
  if (!requestMs) throw unauthorized('Cabecalho x-agent-timestamp obrigatorio ou invalido.');
  const now = Date.now();
  const skew = clockSkewMs();
  if (Math.abs(now - requestMs) > skew) throw unauthorized('Timestamp do agente fora da janela permitida.');

  const nonce = text(req.get('x-agent-nonce'), 160);
  if (nonce.length < 16) throw unauthorized('Cabecalho x-agent-nonce obrigatorio.');
  cleanupNonces(now);
  const nonceKey = `${agentId}:${nonce}`;
  if ((usedAgentNonces.get(nonceKey) || 0) > now) throw unauthorized('Replay de requisicao do agente bloqueado.');
  usedAgentNonces.set(nonceKey, now + skew * 2);
}

export async function validateAgent(req) {
  const agentId = normalizeAgentId(req.get('x-agent-id'));
  if (!agentId) throw unauthorized('Cabecalho x-agent-id obrigatorio ou invalido.');
  const token = text(req.get('x-agent-token'), 1000);
  if (!token) throw unauthorized('Cabecalho x-agent-token obrigatorio.');

  const credential = await resolveCredential(agentId);
  const match = matchCredential(credential, token);
  if (!match.ok) throw unauthorized(match.reason);

  const tenantHeader = normalizarTenantId(req.get('x-tenant-id') || req.get('x-agent-tenant-id') || '');
  if (tenantHeader && credential?.tenantId && tenantHeader !== credential.tenantId) {
    throw unauthorized('Tenant do agente incompativel com a credencial.');
  }
  const equipmentHeader = normalizeEquipmentId(req.get('x-equipment-id') || req.get('x-agent-equipment-id'));
  if (equipmentHeader && !equipmentAllowed(credential, equipmentHeader)) {
    throw unauthorized('Equipamento do agente incompativel com a credencial.');
  }
  if (!equipmentHeader && credential?.equipmentIds?.length && isEnabled(process.env.ACCESS_AGENT_REQUIRE_EQUIPMENT_HEADER)) {
    throw unauthorized('Cabecalho x-agent-equipment-id obrigatorio para este agente.');
  }
  validateFreshness(req, agentId);
  return {
    agentId,
    tenantId: credential?.tenantId || tenantHeader || '',
    equipmentIds: credential?.equipmentIds || [],
    equipmentId: equipmentHeader || (credential?.equipmentIds?.length === 1 ? credential.equipmentIds[0] : ''),
    tokenLabel: match.label || 'current'
  };
}

export function validateCommandApi(req) {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return Boolean(process.env.ACCESS_COMMAND_API_KEY && safeEqual(token, process.env.ACCESS_COMMAND_API_KEY));
}

export function resolveCommandTarget(body = {}) {
  const requestedAgent = body.agentId || body.agent_id || process.env.ACCESS_AGENT_ID;
  const agentId = normalizeAgentId(requestedAgent);
  if (!agentId) throw configError('ACCESS_AGENT_ID deve ser configurado ou informado no comando.');
  const tenantId = normalizarTenantId(body.tenantId || body.tenant_id || process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || '');
  if (!tenantId) throw configError('ACCESS_AGENT_TENANT_ID ou FUSION_TENANT_ID deve ser configurado para comandos da catraca.');
  const equipmentId = normalizeEquipmentId(body.equipmentId || body.equipment_id || process.env.ACCESS_EQUIPMENT_ID);
  if (!equipmentId) throw configError('ACCESS_EQUIPMENT_ID deve ser configurado ou informado no comando.');
  const credential = credentialsFromEnv().get(agentId);
  if (credential?.tenantId && tenantId !== credential.tenantId) {
    throw httpError('Tenant nao autorizado para o agente configurado.', 403, 'ACCESS_BRIDGE_TENANT_DENIED');
  }
  if (credential && !equipmentAllowed(credential, equipmentId)) {
    throw httpError('Equipamento nao autorizado para o agente configurado.', 403, 'ACCESS_BRIDGE_EQUIPMENT_DENIED');
  }
  return { agentId, tenantId, equipmentId };
}

export async function queueRelease(body = {}) {
  const target = resolveCommandTarget(body);
  return createCommand({
    agentId: target.agentId,
    tenantId: target.tenantId,
    equipmentId: target.equipmentId, action: 'release',
    expiresAt: new Date(Date.now() + Math.min(Math.max(Number(body.ttlSeconds || 30), 5), 120) * 1000).toISOString(),
    payload: {
      host: body.host || '10.0.0.236', port: Number(body.port || 3000),
      tempoSegundos: Math.min(Math.max(Number(body.tempoSegundos || 5), 1), 10),
      tenantId: target.tenantId, equipmentId: target.equipmentId,
      direcao: body.direcao || 'ambos', alunoId: body.alunoId || null,
      alunoNome: body.alunoNome || null, operadorId: body.operadorId || null,
      origem: body.origem || 'render', motivo: body.motivo || 'liberacao-remota'
    }
  });
}

export { claimNext, finishCommand, getCommand, saveHeartbeat, getAgent };
