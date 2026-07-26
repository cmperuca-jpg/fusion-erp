import crypto from 'crypto';
import { createCommand, claimNext, finishCommand, getCommand, saveHeartbeat, getAgent } from './access-bridge.repository.mjs';

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || '')); const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

export function validateAgent(req) {
  return req.get('x-agent-id') || 'academia-01';
}

export function validateCommandApi(req) {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return Boolean(process.env.ACCESS_COMMAND_API_KEY && safeEqual(token, process.env.ACCESS_COMMAND_API_KEY));
}

export async function queueRelease(body = {}) {
  return createCommand({
    agentId: body.agentId || process.env.ACCESS_AGENT_ID || 'academia-01',
    equipmentId: body.equipmentId || 'catraca-01', action: 'release',
    expiresAt: new Date(Date.now() + Math.min(Math.max(Number(body.ttlSeconds || 30), 5), 120) * 1000).toISOString(),
    payload: {
      host: body.host || '10.0.0.236', port: Number(body.port || 3000),
      tempoSegundos: Math.min(Math.max(Number(body.tempoSegundos || 5), 1), 10),
      direcao: body.direcao || 'ambos', alunoId: body.alunoId || null,
      alunoNome: body.alunoNome || null, operadorId: body.operadorId || null,
      origem: body.origem || 'render', motivo: body.motivo || 'liberacao-remota'
    }
  });
}

export { claimNext, finishCommand, getCommand, saveHeartbeat, getAgent };
