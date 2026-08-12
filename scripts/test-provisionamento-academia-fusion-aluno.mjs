import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";

const raiz = process.cwd();
const script = path.join(raiz, "scripts", "provisionar-academia-fusion-aluno.mjs");

function executar(args, env = {}) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, [script, ...args], {
      cwd: raiz,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    filho.stdout.on("data", (p) => { stdout += p; });
    filho.stderr.on("data", (p) => { stderr += p; });
    filho.once("error", reject);
    filho.once("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

let r = await executar([
  "--tenant=academia-teste",
  "--nome=Academia Teste"
]);

assert.equal(r.code, 0, r.stderr);
let json = JSON.parse(r.stdout);
assert.equal(json.ok, true);
assert.equal(json.modo, "dry-run");
assert.equal(json.alteracoes, 0);
assert.equal(json.plano.slug, "academia-teste");

// --apply sem frase de confirmação precisa falhar ANTES de qualquer rede.
r = await executar([
  "--tenant=academia-teste",
  "--nome=Academia Teste",
  "--apply"
], {
  FUSION_APP_SUPABASE_URL: "http://127.0.0.1:1",
  FUSION_APP_SUPABASE_SECRET_KEY: "sb_secret_nao_deve_ser_usada"
});
assert.notEqual(r.code, 0);
assert.match(r.stderr, /Aplicação bloqueada/);

let recebido = null;
const servidor = http.createServer((req, res) => {
  let bruto = "";
  req.on("data", (p) => { bruto += p; });
  req.on("end", () => {
    recebido = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.parse(bruto || "{}")
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{
      academia_id: "11111111-1111-4111-8111-111111111111",
      erp_tenant_id: "academia-teste",
      academia_nome: "Academia Teste",
      academia_slug: "academia-teste",
      criado: true,
      vinculo_criado: true
    }]));
  });
});

await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
const porta = servidor.address().port;
const chave = "sb_secret_teste_local_nao_real";

try {
  r = await executar([
    "--tenant=academia-teste",
    "--nome=Academia Teste",
    "--timezone=America/Maceio",
    "--apply",
    "--confirmar=PROVISIONAR-ACADEMIA"
  ], {
    FUSION_APP_SUPABASE_URL: `http://127.0.0.1:${porta}`,
    FUSION_APP_SUPABASE_SECRET_KEY: chave,
    FUSION_APP_SUPABASE_SERVICE_ROLE_KEY: ""
  });

  assert.equal(r.code, 0, r.stderr);
  json = JSON.parse(r.stdout);
  assert.equal(json.ok, true);
  assert.equal(json.criado, true);
  assert.equal(json.vinculoCriado, true);

  assert.equal(recebido.method, "POST");
  assert.equal(
    recebido.url,
    "/rest/v1/rpc/fusion_provisionar_academia_backend"
  );
  assert.equal(recebido.headers.apikey, chave);
  assert.equal(recebido.headers.authorization, undefined);
  assert.deepEqual(recebido.body, {
    p_erp_tenant_id: "academia-teste",
    p_nome: "Academia Teste",
    p_slug: "academia-teste",
    p_timezone: "America/Maceio"
  });

  // Segredo não pode vazar para stdout/stderr.
  assert.equal(r.stdout.includes(chave), false);
  assert.equal(r.stderr.includes(chave), false);
} finally {
  await new Promise((resolve) => servidor.close(resolve));
}

console.log("Provisionamento Fusion Aluno OK: dry-run, confirmação e chamada service_role simulada.");
