import express from 'express';
import { validateAgent, validateCommandApi, queueRelease, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent } from './access-bridge.service.mjs';
import * as accessEngine from '../access-engine/access-engine.service.mjs';
import { executarComTenant } from '../core/persistence/tenant-context.mjs';

const router = express.Router();
const wrap = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    res.status(e.status || e.statusCode || 500).json({ ok: false, erro: e.message });
  }
};

function biometricEnabled() {
  return ['1', 'true', 'sim', 'yes', 'on']
    .includes(String(process.env.ACCESS_BIOMETRIA_ENABLED || '').trim().toLowerCase());
}

function texto(value, limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

router.get('/health', (req, res) => res.json({
  ok: true,
  modulo: 'access-bridge',
  versao: '1.2.0',
  storage: process.env.SUPABASE_URL ? 'supabase' : 'json-local',
  biometria: biometricEnabled() ? 'enabled' : 'disabled'
}));

router.post('/commands/release', wrap(async (req, res) => {
  if (!validateCommandApi(req)) return res.status(401).json({ ok: false, erro: 'API key invalida' });
  const command = await queueRelease(req.body || {});
  res.status(202).json({ ok: true, command });
}));

router.get('/commands/:id', wrap(async (req, res) => {
  if (!validateCommandApi(req)) return res.status(401).json({ ok: false, erro: 'API key invalida' });
  const command = await getCommand(req.params.id);
  if (!command) return res.status(404).json({ ok: false, erro: 'Comando nao encontrado' });
  res.json({ ok: true, command });
}));

router.post('/agent/heartbeat', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await saveHeartbeat(agent.agentId, {
    ...(req.body || {}),
    tenantId: agent.tenantId || undefined,
    authenticatedAt: new Date().toISOString()
  });
  res.json({ ok: true, serverTime: new Date().toISOString() });
}));

router.get('/agent/next', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await saveHeartbeat(agent.agentId, { state: 'polling', tenantId: agent.tenantId || undefined });
  const command = await claimNext(agent.agentId);
  res.json({ ok: true, command });
}));

router.post('/agent/commands/:id/result', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  const command = await finishCommand(req.params.id, agent.agentId, req.body || {});
  if (!command) return res.status(404).json({ ok: false, erro: 'Comando nao encontrado' });
  res.json({ ok: true, command });
}));

router.post('/agent/biometria/acesso', wrap(async (req, res) => {
  const agent = await validateAgent(req);

  if (!biometricEnabled()) {
    return res.status(503).json({ ok: false, erro: 'Biometria do Access Agent desativada no servidor.' });
  }

  if (!agent.tenantId) {
    return res.status(503).json({ ok: false, erro: 'Tenant do Access Agent nao configurado.' });
  }

  const alunoId = texto(req.body?.alunoId);
  if (!alunoId) {
    return res.status(400).json({ ok: false, erro: 'alunoId obrigatorio.' });
  }

  const direcao = texto(req.body?.direcao, 20) === 'saida' ? 'saida' : 'entrada';
  const dispositivoId = agent.equipmentId || '';

  const resultado = await executarComTenant(agent.tenantId, () =>
    accessEngine.avaliarAcesso({
      identificador: alunoId,
      dispositivoId,
      direcao,
      origem: 'biometria-fs80'
    })
  );

  res.json({
    ok: true,
    autorizado: resultado.autorizado === true,
    motivo: resultado.motivo || '',
    alunoId,
    commandId: resultado.catraca?.commandId || resultado.catraca?.command?.id || null,
    logId: resultado.log?.id || null
  });
}));

router.get('/agent/:agentId/status', wrap(async (req, res) => {
  if (!validateCommandApi(req)) return res.status(401).json({ ok: false, erro: 'API key invalida' });
  const agent = await getAgent(req.params.agentId);
  res.json({ ok: true, agent, online: Boolean(agent && Date.now() - new Date(agent.last_seen_at).getTime() < 30000) });
}));

export default router;
