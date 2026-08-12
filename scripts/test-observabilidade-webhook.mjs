import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-observabilidade-webhook-"));
const cwdAnterior = process.cwd();
const envNomes = [
  "NODE_ENV",
  "FUSION_DATABASE_PROVIDER",
  "FUSION_JSON_FALLBACK",
  "FUSION_TENANT_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FUSION_OBSERVABILITY_WEBHOOK_URL",
  "FUSION_OBSERVABILITY_WEBHOOK_TOKEN",
  "FUSION_OBSERVABILITY_WEBHOOK_TIMEOUT_MS"
];
const envAnterior = Object.fromEntries(envNomes.map(nome => [nome, process.env[nome]]));

function restaurarEnv() {
  for (const [nome, valor] of Object.entries(envAnterior)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
}

await fs.mkdir(path.join(temp, "data"), { recursive: true });

let modo = "ok";
const recebidos = [];
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const parte of req) raw += parte;
  recebidos.push({
    method: req.method,
    headers: req.headers,
    body: raw ? JSON.parse(raw) : null
  });

  if (modo === "falha") {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const porta = server.address().port;
const segredo = "segredo-webhook-nao-deve-aparecer-no-body";

try {
  process.chdir(temp);
  process.env.NODE_ENV = "development";
  process.env.FUSION_DATABASE_PROVIDER = "json";
  process.env.FUSION_JSON_FALLBACK = "true";
  process.env.FUSION_TENANT_ID = "academia-webhook-qa";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.FUSION_OBSERVABILITY_WEBHOOK_URL = `http://127.0.0.1:${porta}/alertas`;
  process.env.FUSION_OBSERVABILITY_WEBHOOK_TOKEN = segredo;
  process.env.FUSION_OBSERVABILITY_WEBHOOK_TIMEOUT_MS = "1500";

  const moduloUrl = pathToFileURL(
    path.join(raiz, "modules", "notificacoes", "notificacoes.service.mjs")
  );
  moduloUrl.searchParams.set("webhook_test", String(Date.now()));
  const { criarNotificacao } = await import(moduloUrl.href);

  const dados = {
    eventoId: "observabilidade:academia-webhook-qa:ACCESS_AGENT_OFFLINE:2026-08-12",
    tipo: "observabilidade",
    prioridade: "alta",
    titulo: "CRITICO: ACCESS AGENT OFFLINE",
    mensagem: "Nenhum agente de catraca esta online.",
    referenciaId: "obs-access-agent-offline",
    destinatarios: ["admin", "gerente"]
  };

  const primeira = await criarNotificacao(dados);
  const segunda = await criarNotificacao(dados);

  assert.equal(primeira.id, segunda.id, "Evento repetido deve reutilizar a mesma notificacao.");
  assert.equal(recebidos.length, 1, "Webhook deve sair apenas na primeira criacao do evento.");
  assert.equal(recebidos[0].method, "POST");
  assert.equal(recebidos[0].headers.authorization, `Bearer ${segredo}`);
  assert.equal(recebidos[0].body.sistema, "Fusion ERP");
  assert.equal(recebidos[0].body.tipo, "observabilidade");
  assert.equal(recebidos[0].body.tenantId, "academia-webhook-qa");
  assert.equal(recebidos[0].body.eventoId, dados.eventoId);
  assert.equal(JSON.stringify(recebidos[0].body).includes(segredo), false, "Segredo nao pode vazar no payload.");

  modo = "falha";
  const erroOriginal = console.error;
  const erros = [];
  console.error = (...args) => erros.push(args.join(" "));
  try {
    const segundaNotificacao = await criarNotificacao({
      ...dados,
      eventoId: "observabilidade:academia-webhook-qa:BILLING_JOB_FAILURE:2026-08-12",
      titulo: "ALTO: BILLING JOB FAILURE"
    });
    assert.ok(segundaNotificacao.id, "Falha do webhook nao pode impedir a notificacao interna.");
  } finally {
    console.error = erroOriginal;
  }

  assert.equal(recebidos.length, 2, "Segundo evento novo deve tentar entrega externa.");
  assert.equal(erros.length, 1, "Falha externa deve ser registrada sem derrubar o Fusion.");
  assert.equal(erros[0].includes(segredo), false, "Log de falha nao pode expor o token.");

  const persistidas = JSON.parse(
    await fs.readFile(path.join(temp, "data", "notificacoes.json"), "utf8")
  );
  assert.equal(persistidas.length, 2, "As duas notificacoes internas devem persistir.");

  console.log(JSON.stringify({
    ok: true,
    webhook: "configuravel",
    deduplicacao: true,
    bearerSemVazamento: true,
    falhaExternaFailSafe: true,
    notificacoesPersistidas: persistidas.length,
    chamadasWebhook: recebidos.length
  }, null, 2));
} finally {
  process.chdir(cwdAnterior);
  restaurarEnv();
  await new Promise(resolve => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
}
