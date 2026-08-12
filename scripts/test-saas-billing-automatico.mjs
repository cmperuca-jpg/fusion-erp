import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-saas-billing-auto-'));
const dataDir = path.join(temporario, 'data');
const jwtSecret = 'saas-billing-auto-test-secret-32chars';
const tenantId = 'academia-billing-auto';

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
  id: 'usr_admin_billing_auto', nome: 'Admin Billing Auto', email: 'admin-auto@example.local',
  perfil: 'Administrador', status: 'ativo', permissoes: ['*']
}]);

const porta = await portaLivre();
const processo = spawn(process.execPath, [path.join(raiz, 'server.mjs')], {
  cwd: temporario,
  env: {
    ...process.env,
    PORT: String(porta), NODE_ENV: 'development', JWT_SECRET: jwtSecret,
    FUSION_TENANT_ID: tenantId, FUSION_DATABASE_PROVIDER: 'json', FUSION_JSON_FALLBACK: 'true',
    FUSION_SYNC_DATA_ON_LOCAL: 'false', FUSION_REQUIRE_SUPABASE_DATA: 'false',
    FUSION_BACKUP_AUTO_ON_LOCAL: 'false', FUSION_BILLING_AUTO: 'false',
    SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let saida = '';
let encerrado = null;
processo.stdout.on('data', p => { saida += p; });
processo.stderr.on('data', p => { saida += p; });
processo.once('exit', (code, signal) => { encerrado = { code, signal }; });

async function esperarServidor() {
  for (let i = 0; i < 200; i += 1) {
    if (encerrado) throw new Error(`Servidor encerrou antes do teste: ${JSON.stringify(encerrado)}.\n${saida}`);
    try { const r = await fetch(`http://127.0.0.1:${porta}/api/health`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Servidor nao respondeu.\n${saida}`);
}

const token = jwt.sign({ sub: 'usr_admin_billing_auto', tenantId }, jwtSecret, { expiresIn: '1h' });
const headers = { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function post(caminho, body) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}
async function get(caminho) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, { headers });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

try {
  await esperarServidor();

  let r = await post('/api/saas/billing/fusion/contratacao', {
    planoCodigo: 'fusion-pro', planoNome: 'Fusion Pro', valorMensal: 299.9,
    contratadoEm: '2026-08-26', trialDias: 0, status: 'ativa',
    pagoAte: '2026-09-26', proximaCobrancaEm: '2026-09-26'
  });
  assert.equal(r.resposta.status, 201, JSON.stringify(r.json));

  r = await post('/api/saas/billing/fusion/processar', { dataReferencia: '2026-09-26', diasTolerancia: 7 });
  assert.equal(r.resposta.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.alterado, false);
  assert.equal(r.json.assinatura.status, 'ativa');

  r = await post('/api/saas/billing/fusion/processar', { dataReferencia: '2026-09-27', diasTolerancia: 7 });
  assert.equal(r.json.assinatura.status, 'inadimplente', JSON.stringify(r.json));
  assert.equal(r.json.transicoes.length, 1);
  assert.equal(r.json.transicoes[0].tipoEvento, 'inadimplencia_automatica');
  const eventosAposInadimplencia = r.json.eventos.length;

  r = await post('/api/saas/billing/fusion/processar', { dataReferencia: '2026-09-27', diasTolerancia: 7 });
  assert.equal(r.json.alterado, false);
  const estado1 = await get('/api/saas/billing/fusion');
  assert.equal(estado1.json.eventos.length, eventosAposInadimplencia, 'Processamento repetido nao pode duplicar evento.');
  assert.equal(estado1.json.politica.acesso.permitido, true);

  r = await post('/api/saas/billing/fusion/processar', { dataReferencia: '2026-10-03', diasTolerancia: 7 });
  assert.equal(r.json.assinatura.status, 'inadimplente');
  assert.equal(r.json.alterado, false);

  r = await post('/api/saas/billing/fusion/processar', { dataReferencia: '2026-10-04', diasTolerancia: 7 });
  assert.equal(r.json.assinatura.status, 'suspensa', JSON.stringify(r.json));
  assert.equal(r.json.transicoes.length, 1);
  assert.equal(r.json.transicoes[0].tipoEvento, 'assinatura_suspensa_automaticamente');
  assert.equal(r.json.politica.acesso.permitido, false);
  const eventosAposSuspensao = r.json.eventos.length;

  r = await post('/api/saas/billing/fusion/processar', { dataReferencia: '2026-10-04', diasTolerancia: 7 });
  assert.equal(r.json.alterado, false);
  const estado2 = await get('/api/saas/billing/fusion');
  assert.equal(estado2.json.eventos.length, eventosAposSuspensao);

  r = await post('/api/saas/billing/fusion/pagamentos', {
    valor: 299.9, forma: 'pix', referencia: 'PIX-AUTO-001',
    recebidoEm: '2026-10-04', coberturaAte: '2026-11-26'
  });
  assert.equal(r.resposta.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.assinatura.status, 'ativa');
  assert.equal(r.json.assinatura.inadimplenteDesde, '');
  assert.equal(r.json.assinatura.suspensoEm, '');
  assert.equal(r.json.politica.acesso.permitido, true);
  assert.equal(r.json.pagamento.coberturaAte, '2026-11-26');

  const ag = await get('/api/saas/billing/fusion/agendador');
  assert.equal(ag.resposta.status, 200, JSON.stringify(ag.json));
  assert.equal(ag.json.ativo, false, 'Agendador deve ficar desligado por padrao no teste.');

  console.log(JSON.stringify({
    ok: true, tenantId, fluxo: ['ativa', 'inadimplente', 'suspensa', 'ativa'],
    toleranciaDias: 7, idempotente: true, pagamentoReativa: true,
    agendadorDesligadoPorPadrao: true
  }, null, 2));
} finally {
  processo.kill('SIGTERM');
  await Promise.race([new Promise(resolve => processo.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
  await fs.rm(temporario, { recursive: true, force: true });
}
