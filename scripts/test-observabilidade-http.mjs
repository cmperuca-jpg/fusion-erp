import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-observabilidade-'));
const dataDir = path.join(temporario, 'data');
const jwtSecret = 'observabilidade-http-test-secret-32chars';

function iso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function data(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return d.toISOString().slice(0, 10);
}

async function portaLivre() {
  return await new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const porta = servidor.address().port;
      servidor.close(() => resolve(porta));
    });
  });
}

async function escrever(nome, valor) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, `${nome}.json`), JSON.stringify(valor, null, 2), 'utf8');
}

await escrever('usuarios', [{
  id: 'usr_obs',
  nome: 'Admin Observabilidade',
  email: 'obs@example.local',
  perfil: 'Administrador',
  status: 'ativo',
  permissoes: ['*']
}]);
await escrever('access_bridge_agents', [{
  agent_id: 'agent-online',
  tenant_id: 'academia-piloto',
  equipment_ids: ['catraca-01'],
  last_seen_at: iso(-5000),
  status: 'online',
  details: { state: 'polling' }
}]);
await escrever('access_bridge_commands', [
  { id: 'cmd-ok', agentId: 'agent-online', equipmentId: 'catraca-01', status: 'completed', createdAt: iso(-60000), finishedAt: iso(-55000) },
  { id: 'cmd-fail', agentId: 'agent-online', equipmentId: 'catraca-01', status: 'failed', createdAt: iso(-50000), finishedAt: iso(-45000), error: 'Falha TCP simulada' },
  { id: 'cmd-expired', agentId: 'agent-online', equipmentId: 'catraca-01', status: 'pending', createdAt: iso(-240000), expiresAt: iso(-120000) }
]);
await escrever('access_logs', [
  { id: 'log-ok', criadoEm: iso(-20000), autorizado: true, alunoId: 'alu-1', alunoNome: 'Aluno OK', catraca: { ok: true, commandId: 'cmd-ok' } },
  { id: 'log-block', criadoEm: iso(-15000), autorizado: false, alunoId: 'alu-2', alunoNome: 'Aluno Bloqueado', motivo: 'Pagamento em atraso' },
  { id: 'log-fail', criadoEm: iso(-10000), autorizado: false, alunoId: 'alu-3', alunoNome: 'Aluno Falha', motivo: 'Acesso aprovado, mas o comando nao foi enfileirado', catraca: { ok: false, erro: 'Bridge indisponivel' } }
]);
await escrever('cobranca_log', [
  { acao: 'programar_proxima_cobranca', sucesso: true, alunoId: 'alu-1', criadoEm: iso(-60000) },
  { acao: 'executar_motor_cobranca', sucesso: false, alunoId: 'alu-2', erro: 'Plano sem valorMensal', criadoEm: iso(-30000) }
]);
await escrever('financeiro', [
  { id: 'fin-vencido', tipo: 'receber', alunoId: 'alu-2', valor: 100, valorRestante: 100, vencimento: data(-10), status: 'Aberto' },
  { id: 'fin-pago', tipo: 'receber', alunoId: 'alu-1', valor: 80, vencimento: data(-5), status: 'Pago' }
]);
await escrever('mensalidades', [
  { id: 'men-vencida', alunoId: 'alu-2', valor: 100, valorRestante: 100, vencimento: data(-10), status: 'aberto' },
  { id: 'men-programada', alunoId: 'alu-1', valor: 80, valorRestante: 0, vencimento: data(20), status: 'programada', programada: true }
]);

const porta = await portaLivre();
const processo = spawn(process.execPath, [path.join(raiz, 'server.mjs')], {
  cwd: temporario,
  env: {
    ...process.env,
    PORT: String(porta),
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    FUSION_TENANT_ID: 'academia-piloto',
    FUSION_DATABASE_PROVIDER: 'json',
    FUSION_JSON_FALLBACK: 'true',
    FUSION_SYNC_DATA_ON_LOCAL: 'false',
    FUSION_REQUIRE_SUPABASE_DATA: 'false',
    FUSION_BACKUP_AUTO_ON_LOCAL: 'false',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let saida = '';
let encerrado = null;
processo.stdout.on('data', parte => { saida += parte; });
processo.stderr.on('data', parte => { saida += parte; });
processo.once('exit', (code, signal) => { encerrado = { code, signal }; });

async function esperarServidor() {
  for (let i = 0; i < 200; i += 1) {
    if (encerrado) throw new Error(`Servidor encerrou antes do teste: ${JSON.stringify(encerrado)}.\n${saida}`);
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (resposta.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor nao respondeu.\n${saida}`);
}

async function getObservabilidade(headers = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}/api/sistema/observabilidade`, { headers });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

try {
  await esperarServidor();

  let resultado = await getObservabilidade();
  assert.equal(resultado.resposta.status, 401);

  const token = jwt.sign(
    { sub: 'usr_obs', email: 'obs@example.local', perfil: 'Administrador', permissoes: ['*'], tenantId: 'academia-piloto' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  resultado = await getObservabilidade({ authorization: `Bearer ${token}` });
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));

  const obs = resultado.json;
  assert.equal(obs.modulo, 'observabilidade');
  assert.equal(obs.tenantId, 'academia-piloto');
  assert.equal(obs.ok, false);
  assert.equal(obs.agentes.online, 1);
  assert.equal(obs.accessBridge.falhos, 1);
  assert.equal(obs.accessBridge.expirados, 1);
  assert.equal(obs.accessBridge.pendentesAntigos, 1);
  assert.equal(obs.acessos.logsHoje, 3);
  assert.equal(obs.acessos.bloqueadosHoje, 2);
  assert.equal(obs.acessos.falhasCatraca, 1);
  assert.equal(obs.cobranca.falhasLog, 1);
  assert.equal(obs.cobranca.financeiroVencido, 1);
  assert.equal(obs.cobranca.mensalidadesVencidas, 1);
  assert.equal(obs.cobranca.mensalidadesProgramadas, 1);
  assert.equal(obs.alertas.some(item => item.codigo === 'ACCESS_COMMAND_FAILURES'), true);
  assert.equal(obs.alertas.some(item => item.codigo === 'BILLING_JOB_FAILURE'), true);
  assert.equal(obs.alertas.some(item => item.codigo === 'BILLING_OVERDUE'), true);

  console.log(JSON.stringify({
    ok: true,
    endpoint: '/api/sistema/observabilidade',
    alertas: obs.resumo.alertas,
    criticos: obs.resumo.criticos,
    agentesOnline: obs.resumo.agentesOnline
  }, null, 2));
} finally {
  processo.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => processo.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  await fs.rm(temporario, { recursive: true, force: true });
}
