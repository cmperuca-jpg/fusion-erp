import crypto from 'node:crypto';
import express from 'express';
import { DATABASE_CONFIG } from '../../config/database.config.mjs';
import { validateAgent, validateCommandApi, queueRelease, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent, updateCommandProgress } from './access-bridge.service.mjs';
import * as accessEngine from '../access-engine/access-engine.service.mjs';
import { executarComTenant } from '../core/persistence/tenant-context.mjs';
import { saveEdgeDeviceCredential } from './access-bridge.repository.mjs';
import { pullEdgeSnapshot, pushEdgeEvents } from './access-edge-postgres.service.mjs';

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

function agentEquipmentDetails(agent = {}) {
  const equipmentIds = Array.isArray(agent.equipmentIds) ? agent.equipmentIds.filter(Boolean) : [];
  const equipmentId = agent.equipmentId || (equipmentIds.length === 1 ? equipmentIds[0] : '');
  return {
    equipmentId: equipmentId || undefined,
    equipmentIds: equipmentIds.length ? equipmentIds : (equipmentId ? [equipmentId] : undefined)
  };
}

async function syncEdgeCredential(req, agent) {
  const rawToken = String(req.get('x-agent-token') || '');
  if (!rawToken || !agent?.tenantId || !agent?.agentId) return;
  await saveEdgeDeviceCredential({
    agentId: agent.agentId,
    tenantId: agent.tenantId,
    equipmentId: agent.equipmentId || agent.equipmentIds?.[0] || '',
    secretHash: crypto.createHash('sha256').update(rawToken).digest('hex')
  });
}

router.get('/health', (req, res) => res.json({
  ok: true,
  modulo: 'access-bridge',
  versao: '1.2.1',
  storage: DATABASE_CONFIG.provider === 'postgres' ? 'postgres' : (DATABASE_CONFIG.provider === 'supabase' ? 'supabase' : 'json-local'),
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
  await syncEdgeCredential(req, agent);
  await saveHeartbeat(agent.agentId, {
    ...(req.body || {}),
    tenantId: agent.tenantId || undefined,
    ...agentEquipmentDetails(agent),
    authenticatedAt: new Date().toISOString()
  });
  res.json({ ok: true, serverTime: new Date().toISOString() });
}));

router.get('/agent/next', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  const consumer = String(req.query?.consumer || 'catraca').trim().toLowerCase();
  const actions = consumer === 'biometria'
    ? ['biometria_status', 'biometria_exists', 'biometria_enroll', 'biometria_delete']
    : ['release'];

  await saveHeartbeat(agent.agentId, {
    state: 'polling',
    consumer,
    tenantId: agent.tenantId || undefined,
    ...agentEquipmentDetails(agent)
  });

  const command = await claimNext(agent.agentId, actions);
  res.json({ ok: true, command });
}));

router.post('/agent/commands/:id/progress', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  const command = await updateCommandProgress(req.params.id, agent.agentId, req.body || {});
  if (!command) return res.status(404).json({ ok: false, erro: 'Comando em processamento nao encontrado' });
  res.json({ ok: true });
}));

router.post('/agent/commands/:id/result', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  const command = await finishCommand(req.params.id, agent.agentId, req.body || {});
  if (!command) return res.status(404).json({ ok: false, erro: 'Comando nao encontrado' });
  res.json({ ok: true, command });
}));

import { obterControleAcessosAluno } from "../alunos/aluno-limite-acessos.service.mjs";

router.post('/agent/edge/pull', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  const result = await pullEdgeSnapshot({
    tenantId: agent.tenantId,
    agentId: agent.agentId,
    since: req.body?.since || null,
    full: req.body?.full === true
  });
  res.json(result);
}));

router.post('/agent/edge/events', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  const result = await pushEdgeEvents({
    tenantId: agent.tenantId,
    agentId: agent.agentId,
    equipmentId: agent.equipmentId || agent.equipmentIds?.[0] || '',
    events: Array.isArray(req.body?.events) ? req.body.events : []
  });
  res.json(result);
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

  // LIMITE ENTRADAS ALUNO CATRACA FISICA 20260826
  // Saida ignora este limite. Demais regras do Access Engine continuam intactas.
  if (direcao !== 'saida') {
    const controle = await executarComTenant(agent.tenantId, () =>
      obterControleAcessosAluno(alunoId)
    );

    if (controle?.limiteAtingido) {
      return res.json({
        ok: true,
        autorizado: false,
        motivo: `Limite diario de ${controle.limite} entradas atingido. Procure a recepcao.`,
        alunoId,
        direcao,
        limiteAtingido: true,
        limiteDiario: controle.limite,
        acessosUsadosHoje: controle.usados,
        acessosRestantesHoje: controle.restantes,
        controleAcessos: controle,
        commandId: null,
        logId: null
      });
    }
  }

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
