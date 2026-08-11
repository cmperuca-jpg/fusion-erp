import assert from 'node:assert/strict';
import crypto from 'node:crypto';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const currentToken = `tok_${crypto.randomBytes(24).toString('hex')}`;
const nextToken = `next_${crypto.randomBytes(24).toString('hex')}`;
process.env.ACCESS_AGENT_ID = 'academia-piloto-agent-01';
process.env.ACCESS_AGENT_TENANT_ID = 'academia-piloto';
process.env.ACCESS_EQUIPMENT_ID = 'catraca-entrada-01';
process.env.ACCESS_EQUIPMENT_IDS = 'catraca-entrada-01';
process.env.ACCESS_AGENT_TOKEN = currentToken;
process.env.ACCESS_AGENT_TOKEN_NEXT = nextToken;
process.env.ACCESS_AGENT_TOKEN_EXPIRES_AT = new Date(Date.now() + 60_000).toISOString();
process.env.ACCESS_AGENT_MAX_CLOCK_SKEW_MS = '300000';

const {
  validateAgent,
  resolveCommandTarget
} = await import('../modules/access-bridge/access-bridge.service.mjs');

function req(headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: name => lower[String(name).toLowerCase()] || '' };
}

function headers(overrides = {}) {
  return {
    'x-agent-id': process.env.ACCESS_AGENT_ID,
    'x-agent-token': currentToken,
    'x-agent-tenant-id': 'academia-piloto',
    'x-agent-equipment-id': 'catraca-entrada-01',
    'x-agent-timestamp': new Date().toISOString(),
    'x-agent-nonce': crypto.randomUUID(),
    ...overrides
  };
}

async function rejectsAuth(testHeaders, pattern) {
  await assert.rejects(
    () => validateAgent(req(testHeaders)),
    error => error.status === 401 && pattern.test(error.message)
  );
}

const valid = await validateAgent(req(headers()));
assert.equal(valid.agentId, 'academia-piloto-agent-01');
assert.equal(valid.tenantId, 'academia-piloto');
assert.equal(valid.equipmentId, 'catraca-entrada-01');

const rotated = await validateAgent(req(headers({ 'x-agent-token': nextToken })));
assert.equal(rotated.tokenLabel, 'next');

await rejectsAuth(headers({ 'x-agent-token': 'token-errado' }), /Token do agente invalido/);
await rejectsAuth(headers({ 'x-agent-token': '' }), /x-agent-token obrigatorio/);
await rejectsAuth(headers({ 'x-agent-id': 'outro-agent' }), /sem credencial/);
await rejectsAuth(headers({ 'x-agent-tenant-id': 'tenant-cruzado' }), /Tenant do agente/);
await rejectsAuth(headers({ 'x-agent-equipment-id': 'catraca-fundo' }), /Equipamento do agente/);
await rejectsAuth(headers({ 'x-agent-timestamp': new Date(Date.now() - 10 * 60_000).toISOString() }), /Timestamp do agente/);

const replayHeaders = headers();
await validateAgent(req(replayHeaders));
await rejectsAuth(replayHeaders, /Replay de requisicao/);

process.env.ACCESS_AGENT_TOKEN_EXPIRES_AT = new Date(Date.now() - 1000).toISOString();
await rejectsAuth(headers(), /expirado/);
const nextAfterExpiration = await validateAgent(req(headers({ 'x-agent-token': nextToken })));
assert.equal(nextAfterExpiration.tokenLabel, 'next');

const hashOnlyToken = `hash_${crypto.randomBytes(24).toString('hex')}`;
process.env.ACCESS_AGENT_TOKEN = '';
process.env.ACCESS_AGENT_TOKEN_SHA256 = crypto.createHash('sha256').update(hashOnlyToken).digest('hex');
process.env.ACCESS_AGENT_TOKEN_NEXT = '';
process.env.ACCESS_AGENT_TOKEN_EXPIRES_AT = '';
const hashOnly = await validateAgent(req(headers({ 'x-agent-token': hashOnlyToken })));
assert.equal(hashOnly.agentId, 'academia-piloto-agent-01');

process.env.ACCESS_AGENT_TOKEN = currentToken;
process.env.ACCESS_AGENT_TOKEN_SHA256 = '';
process.env.ACCESS_AGENT_TOKEN_EXPIRES_AT = new Date(Date.now() + 60_000).toISOString();
assert.deepEqual(resolveCommandTarget({}), { agentId: 'academia-piloto-agent-01', equipmentId: 'catraca-entrada-01' });
assert.throws(
  () => resolveCommandTarget({ equipmentId: 'catraca-fundo' }),
  error => error.status === 403 && /Equipamento nao autorizado/.test(error.message)
);

const savedAgentId = process.env.ACCESS_AGENT_ID;
delete process.env.ACCESS_AGENT_ID;
assert.throws(
  () => resolveCommandTarget({}),
  error => error.status === 503 && /ACCESS_AGENT_ID/.test(error.message)
);
process.env.ACCESS_AGENT_ID = savedAgentId;

console.log('Access Bridge agent auth hardening OK');
