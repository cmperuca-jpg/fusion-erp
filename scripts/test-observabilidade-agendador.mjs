import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-observabilidade-agendador-'));
const dataDir = path.join(temporario, 'data');
const jwtSecret = 'observabilidade-agendador-test-secret-32chars';

function iso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
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

async function lerJson(nome, fallback = []) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, `${nome}.json`), 'utf8'));
  } catch (erro) {
    if (erro.code === 'ENOENT') return fallback;
    throw erro;
  }
}

async function esperarAte(descricao, fn) {
  for (let i = 0; i < 80; i += 1) {
    const valor = await fn();
    if (valor) return valor;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout aguardando ${descricao}`);
}

await escrever('usuarios', [{
  id: 'usr_obs_agendador',
  nome: 'Admin Observabilidade',
  email: 'obs-agendador@example.local',
  perfil: 'Administrador',
  status: 'ativo',
  permissoes: ['*']
}]);
await escrever('access_bridge_agents', [{
  agent_id: 'agent-offline',
  tenant_id: 'academia-piloto',
  equipment_ids: ['catraca-01'],
  last_seen_at: iso(-120000),
  status: 'offline',
  details: { state: 'offline' }
}]);

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
    FUSION_OBSERVABILITY_NOTIFY_AUTO: 'true',
    FUSION_OBSERVABILITY_NOTIFY_INTERVAL_MS: '500',
    FUSION_OBSERVABILITY_NOTIFY_TEST_INTERVALS: 'true',
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

async function getJson(caminho, headers = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, { headers });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

try {
  await esperarServidor();

  const token = jwt.sign(
    { sub: 'usr_obs_agendador', email: 'obs-agendador@example.local', perfil: 'Administrador', permissoes: ['*'], tenantId: 'academia-piloto' },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const authHeaders = { authorization: `Bearer ${token}` };

  await esperarAte('evento e notificacao do agendador', async () => {
    const eventos = await lerJson('observabilidade_eventos');
    const notificacoes = await lerJson('notificacoes');
    return eventos.length >= 1 && notificacoes.length >= 1 ? { eventos, notificacoes } : null;
  });

  const eventos = await lerJson('observabilidade_eventos');
  const notificacoes = await lerJson('notificacoes');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].codigo, 'ACCESS_AGENT_OFFLINE');
  assert.equal(eventos[0].nivel, 'critico');
  assert.equal(notificacoes.length, 1);
  assert.equal(notificacoes[0].tipo, 'observabilidade');
  assert.equal(notificacoes[0].prioridade, 'alta');

  const status = await getJson('/api/sistema/observabilidade/notificador', authHeaders);
  assert.equal(status.resposta.status, 200, JSON.stringify(status.json));
  assert.equal(status.json.modulo, 'observabilidade-notificador');
  assert.equal(status.json.ativo, true);
  assert.equal(status.json.intervaloMs, 500);
  assert.equal(status.json.ultimoResultado.eventosRegistrados >= 1, true);

  console.log(JSON.stringify({
    ok: true,
    endpoint: '/api/sistema/observabilidade/notificador',
    intervaloMs: status.json.intervaloMs,
    eventos: eventos.length,
    notificacoes: notificacoes.length
  }, null, 2));
} finally {
  processo.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => processo.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  await fs.rm(temporario, { recursive: true, force: true });
}
