import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const porta = 3199;
const processo = spawn(process.execPath, ["server.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(porta),
    NODE_ENV: "development",
    FUSION_DATABASE_PROVIDER: "json",
    FUSION_JSON_FALLBACK: "true",
    FUSION_SYNC_DATA_ON_LOCAL: "false",
    FUSION_REQUIRE_SUPABASE_DATA: "false"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let saida = "";
processo.stdout.on("data", (parte) => { saida += parte; });
processo.stderr.on("data", (parte) => { saida += parte; });

async function esperarServidor() {
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/financeiro/ledger/integridade`);
      if (resposta.ok) return resposta;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor local não respondeu.\n${saida}`);
}

try {
  const integridadeResp = await esperarServidor();
  const integridade = await integridadeResp.json();
  assert.equal(integridade.ok, true, JSON.stringify(integridade.falhas));
  const pagina = await fetch(`http://127.0.0.1:${porta}/pages/financeiro/`);
  assert.equal(pagina.status, 200);
  const html = await pagina.text();
  assert.match(html, /Verificar integridade/);
  const configuracao = await fetch(`http://127.0.0.1:${porta}/api/financeiro/ledger/configuracao`);
  assert.equal(configuracao.status, 200);
  console.log(JSON.stringify({ ok: true, porta, paginaFinanceiro: pagina.status, integridade: integridade.contagens }, null, 2));
} finally {
  processo.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => processo.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
}
