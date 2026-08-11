import express from 'express';
import { validateAgent, validateCommandApi, queueRelease, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent } from './access-bridge.service.mjs';

const router = express.Router();
const wrap = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    res.status(e.status || e.statusCode || 500).json({ ok: false, erro: e.message });
  }
};

router.get('/health', (req, res) => res.json({
  ok: true,
  modulo: 'access-bridge',
  versao: '1.1.0',
  storage: process.env.SUPABASE_URL ? 'supabase' : 'json-local'
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

router.get('/agent/:agentId/status', wrap(async (req, res) => {
  if (!validateCommandApi(req)) return res.status(401).json({ ok: false, erro: 'API key invalida' });
  const agent = await getAgent(req.params.agentId);
  res.json({ ok: true, agent, online: Boolean(agent && Date.now() - new Date(agent.last_seen_at).getTime() < 30000) });
}));

export default router;
