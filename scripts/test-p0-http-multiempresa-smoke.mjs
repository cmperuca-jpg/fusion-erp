import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-http-tenant-smoke-'));
const dataDir = path.join(temporario, 'data');
const tenantBDir = path.join(dataDir, 'tenants', 'academia-b');
const jwtSecret = 'tenant-http-smoke-secret-with-32-chars';

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

async function escrever(base, nome, valor) {
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(path.join(base, `${nome}.json`), JSON.stringify(valor, null, 2), 'utf8');
}

function usuario(id, email) {
  return { id, nome: id, email, perfil: 'Administrador', status: 'ativo', permissoes: ['*'] };
}

async function popularTenant(base, sufixo) {
  await escrever(base, 'usuarios', [usuario(`usr-${sufixo}`, `admin-${sufixo}@example.local`)]);
  await escrever(base, 'alunos', [{
    id: `alu-${sufixo}`,
    nome: `Aluno ${sufixo.toUpperCase()}`,
    cpf: sufixo === 'a' ? '12345678901' : '10987654321',
    numeroMatricula: `MAT-${sufixo.toUpperCase()}`,
    matriculaId: `mat-${sufixo}`,
    status: 'Ativo',
    ativo: true
  }]);
  await escrever(base, 'planos', [{
    id: `pla-${sufixo}`,
    nome: `Plano ${sufixo.toUpperCase()}`,
    valorMensal: sufixo === 'a' ? 100 : 120,
    status: 'ativo'
  }]);
  await escrever(base, 'matriculas', [{
    id: `mat-${sufixo}`,
    alunoId: `alu-${sufixo}`,
    numero: `MAT-${sufixo.toUpperCase()}`,
    planoId: `pla-${sufixo}`,
    status: 'Ativa'
  }]);
  await escrever(base, 'financeiro', [{
    id: `fin-${sufixo}`,
    tipo: 'receber',
    alunoId: `alu-${sufixo}`,
    matriculaId: `mat-${sufixo}`,
    descricao: `Mensalidade ${sufixo.toUpperCase()}`,
    valor: sufixo === 'a' ? 100 : 120,
    status: 'Aberto'
  }]);
  await escrever(base, 'caixa', {
    caixas: [{
      id: `cx-${sufixo}`,
      status: 'aberto',
      dataAbertura: '2026-08-11',
      valorAbertura: 0
    }],
    movimentos: []
  });
  await escrever(base, 'recibos', []);
  await escrever(base, 'recebimentos', []);
  await escrever(base, 'access_dispositivos', [{
    id: `catraca-${sufixo}`,
    nome: `Catraca ${sufixo.toUpperCase()}`,
    fabricante: 'Henry',
    modelo: '7X',
    driver: 'henry7x',
    ip: sufixo === 'a' ? '10.0.0.236' : '10.0.0.237',
    porta: '3000',
    status: 'ativo'
  }]);
}

await fs.mkdir(dataDir, { recursive: true });
await popularTenant(dataDir, 'a');
await popularTenant(tenantBDir, 'b');

const porta = await portaLivre();
const env = {
  ...process.env,
  PORT: String(porta),
  NODE_ENV: 'development',
  JWT_SECRET: jwtSecret,
  FUSION_TENANT_ID: 'academia-a',
  FUSION_DATABASE_PROVIDER: 'json',
  FUSION_JSON_FALLBACK: 'true',
  FUSION_SYNC_DATA_ON_LOCAL: 'false',
  FUSION_REQUIRE_SUPABASE_DATA: 'false',
  FUSION_BACKUP_AUTO_ON_LOCAL: 'false',
  SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  ACCESS_AGENT_ID: 'academia-a-agent-01',
  ACCESS_AGENT_TENANT_ID: 'academia-a',
  ACCESS_EQUIPMENT_ID: 'catraca-a',
  ACCESS_EQUIPMENT_IDS: 'catraca-a',
  ACCESS_AGENT_TOKEN: 'token-agente-smoke-http',
  ACCESS_AGENT_MAX_CLOCK_SKEW_MS: '300000'
};

const processo = spawn(process.execPath, [path.join(raiz, 'server.mjs')], {
  cwd: temporario,
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let saida = '';
let encerrado = null;
processo.stdout.on('data', parte => { saida += parte; });
processo.stderr.on('data', parte => { saida += parte; });
processo.once('exit', (code, signal) => { encerrado = { code, signal }; });

function token(tenantId, sub) {
  return jwt.sign(
    {
      sub,
      email: `${sub}@example.local`,
      perfil: 'Administrador',
      permissoes: ['*'],
      tenantId
    },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

const tokenA = token('academia-a', 'usr-a');
const tokenB = token('academia-b', 'usr-b');

function authHeaders(tokenJwt, extra = {}) {
  return {
    authorization: `Bearer ${tokenJwt}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function esperarServidor() {
  for (let i = 0; i < 200; i += 1) {
    if (encerrado) {
      throw new Error(`Servidor encerrou antes do smoke: ${JSON.stringify(encerrado)}.\n${saida}`);
    }
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (resposta.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor nao respondeu.\n${saida}`);
}

async function chamar(caminho, { tokenJwt, headers = {}, method = 'GET', body } = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method,
    headers: tokenJwt ? authHeaders(tokenJwt, headers) : headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch {}
  return { resposta, json, texto };
}

try {
  await esperarServidor();

  let r = await chamar('/api/alunos');
  assert.equal(r.resposta.status, 401);

  r = await chamar('/api/alunos', { tokenJwt: tokenA });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.resposta.headers.get('x-fusion-tenant'), 'academia-a');
  assert.deepEqual(r.json.map(item => item.id), ['alu-a']);

  r = await chamar('/api/alunos', { tokenJwt: tokenB });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.resposta.headers.get('x-fusion-tenant'), 'academia-b');
  assert.deepEqual(r.json.map(item => item.id), ['alu-b']);

  r = await chamar('/api/alunos', {
    tokenJwt: tokenA,
    headers: { 'x-fusion-tenant': 'academia-b' }
  });
  assert.equal(r.resposta.status, 403);

  r = await chamar('/api/matriculas', { tokenJwt: tokenA });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual((r.json.dados || r.json.matriculas || r.json).map(item => item.id), ['mat-a']);

  r = await chamar('/api/matriculas', { tokenJwt: tokenB });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual((r.json.dados || r.json.matriculas || r.json).map(item => item.id), ['mat-b']);

  r = await chamar('/api/financeiro', { tokenJwt: tokenA });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual(r.json.lancamentos.map(item => item.id), ['fin-a']);

  r = await chamar('/api/financeiro', { tokenJwt: tokenB });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual(r.json.lancamentos.map(item => item.id), ['fin-b']);

  r = await chamar('/api/caixa/atual', { tokenJwt: tokenA });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.json.caixa.id, 'cx-a');

  r = await chamar('/api/caixa/atual', { tokenJwt: tokenB });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.equal(r.json.caixa.id, 'cx-b');

  r = await chamar('/api/access-engine/dashboard', { tokenJwt: tokenA });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual(r.json.dispositivos.map(item => item.id), ['catraca-a']);

  // Hardening atual: apenas academia-a possui Access Agent físico vinculado.
  // Mesmo havendo um cadastro Henry antigo/fixture no tenant B, ele não deve
  // ser exposto no dashboard nem reutilizado por engano.
  r = await chamar('/api/access-engine/dashboard', { tokenJwt: tokenB });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual(r.json.dispositivos.map(item => item.id), []);
  assert.equal(r.json.resumo?.dispositivos, 0);
  assert.equal(r.json.resumo?.online, 0);
  assert.equal(r.json.resumo?.cadastrosIgnorados >= 1, true);

  r = await chamar('/api/access-engine/liberar-remoto', {
    tokenJwt: tokenA,
    method: 'POST',
    body: {
      alunoId: 'alu-a',
      alunoNome: 'Aluno A',
      dispositivoId: 'catraca-a'
    }
  });
  assert.equal(r.resposta.status, 202, r.texto);
  assert.equal(r.json.catraca.command.tenantId, 'academia-a');
  assert.equal(r.json.catraca.command.equipmentId, 'catraca-a');

  r = await chamar('/api/access-engine/liberar-remoto', {
    tokenJwt: tokenB,
    method: 'POST',
    body: {
      alunoId: 'alu-b',
      alunoNome: 'Aluno B',
      dispositivoId: 'catraca-b'
    }
  });
  assert.equal(r.resposta.status, 403);

  r = await chamar('/api/planos');
  assert.equal(r.resposta.status, 400);

  r = await chamar('/api/planos', {
    headers: { 'x-fusion-tenant': 'academia-b' }
  });
  assert.equal(r.resposta.status, 200, r.texto);
  assert.deepEqual(r.json.dados.map(item => item.id), ['pla-b']);

  r = await chamar('/uploads/shell.exe');
  assert.equal(r.resposta.status, 404);
  assert.equal(r.resposta.headers.get('cache-control'), 'private, no-store');

  console.log(JSON.stringify({
    ok: true,
    porta,
    alunos: {
      academiaA: 'alu-a',
      academiaB: 'alu-b'
    },
    accessEngine: {
      academiaA: ['catraca-a'],
      academiaB: [],
      academiaBSemAgentFisico: true
    },
    uploadsProtegidos: true
  }, null, 2));
} finally {
  processo.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => processo.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  await fs.rm(temporario, { recursive: true, force: true });
}
