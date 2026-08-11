import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-tenant-test-'));
process.chdir(tempDir);
await fs.mkdir(path.join(tempDir, 'data'), { recursive: true });
await fs.writeFile(
  path.join(tempDir, 'data', 'usuarios.json'),
  JSON.stringify([{ id: 'usr_dummy', email: 'dummy@example.local', perfil: 'Administrador', status: 'ativo' }]),
  'utf8'
);

process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'tenant-isolation-test-secret-with-32chars';
process.env.FUSION_DATABASE_PROVIDER = 'json';
process.env.FUSION_JSON_FALLBACK = 'true';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { apiSecurity } = await import('../modules/security/api-security.middleware.mjs');

function tokenPortalAluno({ alunoId = 'aluno-1', tenantId = 'academia-a' } = {}) {
  return jwt.sign(
    { sub: alunoId, tipo: 'aluno', perfil: 'Aluno', nome: 'Aluno Teste', tenantId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function req({ method = 'GET', path: reqPath = '/api/health', headers = {}, query = {}, body = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    method,
    path: reqPath,
    headers: normalizedHeaders,
    query,
    body,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' }
  };
}

async function invoke(request) {
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    once() { return this; }
  };
  let nextCalled = false;
  await apiSecurity(request, response, () => { nextCalled = true; });
  return { nextCalled, status: response.statusCode, body: response.body, headers: response.headers, request };
}

let result = await invoke(req({ path: '/api/planos' }));
assert.equal(result.nextCalled, false);
assert.equal(result.status, 400);
assert.equal(result.body?.codigo, 'FUSION_TENANT_REQUIRED');

result = await invoke(req({ path: '/api/planos', headers: { 'x-fusion-tenant': 'Academia A' } }));
assert.equal(result.nextCalled, true);
assert.equal(result.headers['x-fusion-tenant'], 'academia-a');

const alunoToken = tokenPortalAluno();
result = await invoke(req({
  path: '/api/treinos',
  headers: { authorization: `Bearer ${alunoToken}`, 'x-fusion-tenant': 'academia-b' },
  query: { alunoId: 'aluno-1' }
}));
assert.equal(result.nextCalled, false);
assert.equal(result.status, 403);
assert.match(result.body?.mensagem || '', /outra empresa/i);

result = await invoke(req({
  path: '/api/treinos',
  headers: { authorization: `Bearer ${alunoToken}`, 'x-fusion-tenant': 'academia-a' },
  query: { alunoId: 'aluno-1' }
}));
assert.equal(result.nextCalled, true);
assert.equal(result.headers['x-fusion-tenant'], 'academia-a');

result = await invoke(req({ path: '/api/alunos' }));
assert.equal(result.nextCalled, false);
assert.equal(result.status, 401);

result = await invoke(req({
  path: '/api/treinos',
  headers: { authorization: `Bearer ${alunoToken}` },
  query: { alunoId: 'aluno-2' }
}));
assert.equal(result.nextCalled, false);
assert.equal(result.status, 403);

const serverSource = await fs.readFile(path.join(root, 'server.mjs'), 'utf8');
assert.match(serverSource, /app\.use\("\/uploads", protegerUploads, express\.static/);
assert.match(serverSource, /uploadExtensionsPermitidas = new Set\(\["\.jpg", "\.jpeg", "\.png", "\.gif", "\.webp", "\.pdf"\]\)/);
assert.match(serverSource, /dotfiles: "deny"/);
assert.match(serverSource, /index: false/);
assert.match(serverSource, /Cache-Control", "private, no-store"/);

process.chdir(root);
await fs.rm(tempDir, { recursive: true, force: true });
console.log('Multiempresa tenant isolation checks OK');
