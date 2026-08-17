import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import { classificarExcecaoEnforcementBilling } from "../modules/security/billing-enforcement.middleware.mjs";

assert.equal(classificarExcecaoEnforcementBilling({
  ativo: true,
  tenantId: "academia-piloto",
  caminho: "/api/alunos"
}).motivo, "tenant_protegido");

assert.equal(classificarExcecaoEnforcementBilling({
  ativo: true,
  tenantId: "academia-cliente",
  caminho: "/api/saas/billing/fusion"
}).motivo, "rota_regularizacao");

assert.equal(classificarExcecaoEnforcementBilling({
  ativo: true,
  tenantId: "academia-cliente",
  caminho: "/api/pagamentos-online/fusion/contratacao"
}).motivo, "rota_regularizacao");

assert.equal(classificarExcecaoEnforcementBilling({
  ativo: true,
  tenantId: "academia-cliente",
  caminho: "/api/alunos",
  usuario: { supportAccess: true }
}).motivo, "suporte_autorizado");

assert.equal(classificarExcecaoEnforcementBilling({
  ativo: false,
  tenantId: "academia-cliente",
  caminho: "/api/alunos"
}).motivo, "enforcement_desligado");

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-billing-enforcement-"));
const dataDir = path.join(temporario, "data");
const jwtSecret = "billing-enforcement-test-secret-32chars";
const tenantId = "academia-enforcement";

async function portaLivre() {
  return await new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", () => {
      const porta = servidor.address().port;
      servidor.close(() => resolve(porta));
    });
  });
}

async function escrever(nome, valor) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, `${nome}.json`), JSON.stringify(valor, null, 2), "utf8");
}

await escrever("usuarios", [{
  id: "usr_admin_enforcement",
  nome: "Admin Enforcement",
  email: "admin-enforcement@example.local",
  perfil: "Administrador",
  status: "ativo",
  permissoes: ["*"]
}]);
await escrever("alunos", []);

const porta = await portaLivre();
const processo = spawn(process.execPath, [path.join(raiz, "server.mjs")], {
  cwd: temporario,
  env: {
    ...process.env,
    PORT: String(porta),
    NODE_ENV: "development",
    JWT_SECRET: jwtSecret,
    FUSION_TENANT_ID: tenantId,
    FUSION_DATABASE_PROVIDER: "json",
    FUSION_JSON_FALLBACK: "true",
    FUSION_SYNC_DATA_ON_LOCAL: "false",
    FUSION_REQUIRE_SUPABASE_DATA: "false",
    FUSION_BACKUP_AUTO_ON_LOCAL: "false",
    FUSION_BILLING_AUTO: "false",
    FUSION_BILLING_ENFORCE: "true",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let saida = "";
let encerrado = null;
processo.stdout.on("data", p => { saida += p; });
processo.stderr.on("data", p => { saida += p; });
processo.once("exit", (code, signal) => { encerrado = { code, signal }; });

async function esperarServidor() {
  for (let i = 0; i < 200; i += 1) {
    if (encerrado) throw new Error(`Servidor encerrou antes do teste: ${JSON.stringify(encerrado)}.\n${saida}`);
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor nao respondeu.\n${saida}`);
}

const token = jwt.sign({ sub: "usr_admin_enforcement", tenantId }, jwtSecret, { expiresIn: "1h" });
const authHeaders = { authorization: `Bearer ${token}` };

async function get(caminho, headers = authHeaders) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, { headers });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

async function post(caminho, body = {}, headers = authHeaders) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const json = await resposta.json().catch(() => null);
  return { resposta, json };
}

try {
  await esperarServidor();

  let r = await post("/api/saas/billing/fusion/contratacao", {
    planoCodigo: "fusion-pro",
    planoNome: "Fusion Pro",
    valorMensal: 299.9,
    contratadoEm: "2026-08-26",
    trialDias: 0,
    status: "ativa",
    pagoAte: "2026-09-26",
    proximaCobrancaEm: "2026-09-26"
  });
  assert.equal(r.resposta.status, 201, JSON.stringify(r.json));

  r = await post("/api/saas/billing/fusion/processar", {
    dataReferencia: "2026-10-04",
    diasTolerancia: 7
  });
  assert.equal(r.resposta.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.assinatura.status, "suspensa");

  r = await get("/api/alunos");
  assert.equal(r.resposta.status, 402, JSON.stringify(r.json));
  assert.equal(r.json.codigo, "FUSION_BILLING_SUSPENDED");
  assert.equal(r.json.billing.tenantId, tenantId);
  assert.equal(r.json.billing.status, "suspensa");

  r = await get("/api/planos", { "x-fusion-tenant": tenantId });
  assert.equal(r.resposta.status, 402, JSON.stringify(r.json));

  r = await get("/api/saas/billing/fusion");
  assert.equal(r.resposta.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.assinatura.status, "suspensa");

  r = await post("/api/saas/billing/fusion/pagamentos", {
    valor: 299.9,
    forma: "pix",
    referencia: "PIX-ENFORCEMENT-001",
    recebidoEm: "2026-10-04",
    coberturaAte: "2026-11-26"
  });
  assert.equal(r.resposta.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.assinatura.status, "ativa");

  r = await get("/api/alunos");
  assert.equal(r.resposta.status, 200, JSON.stringify(r.json));

  console.log(JSON.stringify({
    ok: true,
    tenantId,
    bloqueioHttp: 402,
    codigo: "FUSION_BILLING_SUSPENDED",
    billingRegularizacaoAcessivel: true,
    pagamentoReativa: true,
    acessoAposPagamento: true,
    academiaPilotoProtegida: true,
    suporteBypass: true,
    enforcementDesligadoPorPadrao: true
  }, null, 2));
} finally {
  processo.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => processo.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  await fs.rm(temporario, { recursive: true, force: true });
}
