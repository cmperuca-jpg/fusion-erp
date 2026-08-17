import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-saas-billing-'));
const dataDir = path.join(temporario, 'data');
const jwtSecret = 'saas-billing-manual-test-secret-32chars';
const tenantId = 'academia-billing';

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

await escrever('usuarios', [
  {
    id: 'usr_admin_billing',
    nome: 'Admin Billing',
    email: 'admin-billing@example.local',
    perfil: 'Administrador',
    status: 'ativo',
    permissoes: ['*']
  },
  {
    id: 'usr_recepcao_billing',
    nome: 'Recepcao Billing',
    email: 'recepcao-billing@example.local',
    perfil: 'Recepcao',
    status: 'ativo',
    permissoes: ['alunos']
  }
]);

const porta = await portaLivre();
const processo = spawn(process.execPath, [path.join(raiz, 'server.mjs')], {
  cwd: temporario,
  env: {
    ...process.env,
    PORT: String(porta),
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    FUSION_TENANT_ID: tenantId,
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

function token(sub) {
  return jwt.sign({ sub, tenantId }, jwtSecret, { expiresIn: '1h' });
}

async function getJson(caminho, headers = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, { headers });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

async function postJson(caminho, headers = {}, body = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

try {
  await esperarServidor();

  let resultado = await getJson('/api/saas/billing/fusion');
  assert.equal(resultado.resposta.status, 401);

  resultado = await getJson('/api/saas/planos');
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.deepEqual(resultado.json.planos.map(plano => plano.codigo), [
    'free',
    'mensal-sem-fidelidade',
    'anual'
  ]);

  const recepcaoHeaders = { authorization: `Bearer ${token('usr_recepcao_billing')}` };
  resultado = await getJson('/api/saas/billing/fusion', recepcaoHeaders);
  assert.equal(resultado.resposta.status, 403, JSON.stringify(resultado.json));

  const adminHeaders = { authorization: `Bearer ${token('usr_admin_billing')}` };
  resultado = await getJson('/api/saas/billing/fusion/planos', adminHeaders);
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.equal(resultado.json.planos.length, 3);

  resultado = await postJson('/api/saas/billing/fusion/contratacao', adminHeaders, {
    planoCodigo: 'fusion-pro',
    planoNome: 'Fusion Pro',
    valorMensal: 299.9,
    contratadoEm: '2026-08-12',
    trialAte: '2026-08-26'
  });
  assert.equal(resultado.resposta.status, 201, JSON.stringify(resultado.json));
  assert.equal(resultado.json.assinatura.status, 'trial');
  assert.equal(resultado.json.assinatura.proximaCobrancaEm, '2026-08-26');

  resultado = await postJson('/api/saas/billing/fusion/pagamentos', adminHeaders, {
    valor: 299.9,
    forma: 'pix',
    referencia: 'PIX-TESTE-001',
    recebidoEm: '2026-08-26',
    coberturaAte: '2026-09-26'
  });
  assert.equal(resultado.resposta.status, 201, JSON.stringify(resultado.json));
  assert.equal(resultado.json.assinatura.status, 'ativa');
  assert.equal(resultado.json.assinatura.pagoAte, '2026-09-26');
  assert.equal(resultado.json.pagamentos.length, 1);

  resultado = await postJson('/api/saas/billing/fusion/renovar', adminHeaders, {
    inicioEm: '2026-09-26',
    renovadoAte: '2026-10-26',
    motivo: 'Renovacao manual validada'
  });
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.equal(resultado.json.assinatura.status, 'ativa');
  assert.equal(resultado.json.assinatura.pagoAte, '2026-10-26');

  resultado = await postJson('/api/saas/billing/fusion/inadimplencia', adminHeaders, {
    data: '2026-10-27',
    motivo: 'Pagamento nao identificado'
  });
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.equal(resultado.json.assinatura.status, 'inadimplente');
  assert.equal(resultado.json.assinatura.inadimplenteDesde, '2026-10-27');

  resultado = await postJson('/api/saas/billing/fusion/suspender', adminHeaders, {
    data: '2026-11-03',
    motivo: 'Inadimplencia superior ao prazo manual'
  });
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.equal(resultado.json.assinatura.status, 'suspensa');
  assert.equal(resultado.json.assinatura.suspensoEm, '2026-11-03');

  resultado = await postJson('/api/saas/billing/fusion/reativar', adminHeaders, {
    data: '2026-11-04',
    motivo: 'Pagamento confirmado pelo financeiro'
  });
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.equal(resultado.json.assinatura.status, 'ativa');
  assert.equal(resultado.json.assinatura.inadimplenteDesde, '');
  assert.equal(resultado.json.assinatura.suspensoEm, '');

  resultado = await getJson('/api/saas/billing/fusion', adminHeaders);
  assert.equal(resultado.resposta.status, 200, JSON.stringify(resultado.json));
  assert.equal(resultado.json.pagamentos.length, 1);
  assert.equal(resultado.json.eventos.length, 6);

  const arquivo = JSON.parse(await fs.readFile(path.join(dataDir, 'fusion_billing.json'), 'utf8'));
  const tipos = arquivo.eventos.map(evento => evento.tipo);
  assert.deepEqual(tipos, [
    'assinatura_reativada',
    'assinatura_suspensa',
    'inadimplencia_marcada',
    'assinatura_renovada',
    'pagamento_registrado',
    'contratacao_formalizada'
  ]);

  console.log(JSON.stringify({
    ok: true,
    endpoint: '/api/saas/billing/fusion',
    tenantId,
    statusFinal: arquivo.assinatura.status,
    pagamentos: arquivo.pagamentos.length,
    eventos: arquivo.eventos.length
  }, null, 2));
} finally {
  processo.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => processo.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  await fs.rm(temporario, { recursive: true, force: true });
}
