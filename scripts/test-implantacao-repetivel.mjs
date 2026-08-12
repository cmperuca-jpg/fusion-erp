import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-implantacao-repetivel-'));
const dataDir = path.join(temporario, 'data');
const uploadsDir = path.join(temporario, 'uploads');
const tenantPadrao = 'academia-piloto';
const tenantNovo = 'academia-segunda';

async function escreverJson(relativo, valor) {
  const destino = path.join(temporario, relativo);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, JSON.stringify(valor, null, 2), 'utf8');
}

async function lerJson(relativo) {
  return JSON.parse(await fs.readFile(path.join(temporario, relativo), 'utf8'));
}

async function existe(relativo) {
  try {
    await fs.access(path.join(temporario, relativo));
    return true;
  } catch {
    return false;
  }
}

async function prepararRaiz() {
  await escreverJson('data/usuarios.json', [{
    id: 'usr_raiz',
    nome: 'Usuario Raiz',
    email: 'raiz@example.local',
    perfil: 'Administrador',
    status: 'ativo',
    permissoes: ['*']
  }]);
  await escreverJson('data/alunos.json', [{
    id: 'aluno_raiz',
    nome: 'Aluno Raiz',
    status: 'ativo'
  }]);
  await escreverJson('data/planos.json', [{
    id: 'plano_raiz',
    nome: 'Plano Raiz',
    status: 'Ativo',
    valorMensal: 129
  }]);
  await fs.mkdir(path.join(dataDir, 'importacao'), { recursive: true });
  await fs.writeFile(path.join(dataDir, 'importacao', 'preservar.txt'), 'importacao-raiz', 'utf8');
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, 'preservar.txt'), 'upload-raiz', 'utf8');
  await escreverJson(`data/tenants/${tenantNovo}/fusion_billing.json`, [{
    id: 'billing_antigo',
    status: 'suspensa'
  }]);
}

async function executarReset() {
  const processo = spawn(process.execPath, [
    path.join(raiz, 'scripts', 'resetar-sistema-virgem.mjs'),
    `--tenant=${tenantNovo}`,
    '--confirmar=RESETAR-MODELO'
  ], {
    cwd: temporario,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      FUSION_TENANT_ID: tenantPadrao,
      FUSION_DATABASE_PROVIDER: 'json',
      FUSION_JSON_FALLBACK: 'true',
      FUSION_REQUIRE_SUPABASE_DATA: 'false',
      FUSION_SYNC_DATA_ON_LOCAL: 'false',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let saida = '';
  processo.stdout.on('data', parte => { saida += parte; });
  processo.stderr.on('data', parte => { saida += parte; });

  const resultado = await new Promise(resolve => {
    processo.once('exit', (code, signal) => resolve({ code, signal }));
  });

  assert.equal(resultado.code, 0, saida);
  assert.match(saida, new RegExp(`"tenantId":\\s*"${tenantNovo}"`), saida);
  return saida;
}

try {
  await prepararRaiz();
  await executarReset();
  await executarReset();

  const usuariosRaiz = await lerJson('data/usuarios.json');
  const alunosRaiz = await lerJson('data/alunos.json');
  assert.deepEqual(usuariosRaiz.map(item => item.id), ['usr_raiz']);
  assert.deepEqual(alunosRaiz.map(item => item.id), ['aluno_raiz']);

  const baseTenant = `data/tenants/${tenantNovo}`;
  const usuariosTenant = await lerJson(`${baseTenant}/usuarios.json`);
  const alunosTenant = await lerJson(`${baseTenant}/alunos.json`);
  const planosTenant = await lerJson(`${baseTenant}/planos.json`);
  const contratosTenant = await lerJson(`${baseTenant}/comercial/contratos.json`);
  const billingTenant = await lerJson(`${baseTenant}/fusion_billing.json`);

  assert.equal(usuariosTenant.some(item => item.id === 'usr_modelo_admin'), true);
  assert.equal(alunosTenant.length, 1);
  assert.equal(alunosTenant[0].id, 'aluno_modelo_001');
  assert.equal(planosTenant.some(item => item.id === 'plano_raiz'), true);
  assert.equal(planosTenant.some(item => item.id === 'plano_modelo_demonstracao'), true);
  assert.equal(contratosTenant.length, 1);
  assert.deepEqual(billingTenant, []);

  assert.equal(await existe('uploads/preservar.txt'), true);
  assert.equal(await existe('data/importacao/preservar.txt'), true);
  assert.equal(await existe(`${baseTenant}/CREDENCIAIS-INICIAIS-FUSION-ERP.txt`), true);

  const backups = await fs.readdir(path.join(temporario, 'backups', tenantNovo));
  assert.equal(backups.some(nome => nome.endsWith('.zip')), true);

  console.log(JSON.stringify({
    ok: true,
    tenantPadrao,
    tenantNovo,
    pastaTenant: baseTenant,
    usuariosTenant: usuariosTenant.length,
    backups: backups.length,
    raizPreservada: true
  }, null, 2));
} finally {
  await fs.rm(temporario, { recursive: true, force: true });
}
