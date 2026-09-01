import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (arquivo) => fs.readFileSync(arquivo, "utf8");

const durable = ler("modules/core/persistence/durable-json.mjs");
const reconciliacao = ler("modules/financeiro/financeiro-reconciliacao.service.mjs");
const script = ler("scripts/reconciliar-financeiro-caixa.mjs");
const pacote = JSON.parse(ler("package.json"));

const inicioLeitura = durable.indexOf("export async function lerJsonDuravel");
const fimLeitura = durable.indexOf("export function salvarJsonDuravel", inicioLeitura);
assert.ok(inicioLeitura >= 0 && fimLeitura > inicioLeitura, "lerJsonDuravel nao localizado");
const blocoLeitura = durable.slice(inicioLeitura, fimLeitura);

assert.match(blocoLeitura, /normalizarMensalidades/);
assert.doesNotMatch(blocoLeitura, /await\s+salvarColecao\s*\(/);
assert.match(blocoLeitura, /Leitura deve ser semanticamente pura/);

assert.match(reconciliacao, /verificarPersistenciaTransacional\(\)/);
assert.match(reconciliacao, /status\.provider === "json"/);
assert.doesNotMatch(reconciliacao, /Reconciliação financeira exige Supabase/);
assert.doesNotMatch(reconciliacao, /exigirSupabase/);

assert.doesNotMatch(script, /FUSION_DATABASE_PROVIDER\s*=\s*["']supabase["']/);
assert.doesNotMatch(script, /exigirSupabase/);
assert.match(script, /permitirJson:\s*permitirJsonLocal/);

assert.equal(
  pacote.scripts["reconciliar:financeiro:simular"],
  "node scripts/reconciliar-financeiro-caixa.mjs"
);
assert.equal(
  pacote.scripts["reconciliar:financeiro"],
  "node scripts/reconciliar-financeiro-caixa.mjs --apply"
);
assert.equal(
  pacote.scripts["test:financeiro:persistencia"],
  "node scripts/test-financeiro-persistencia-segura.mjs"
);

console.log(JSON.stringify({
  ok: true,
  modulo: "financeiro-persistencia-segura",
  leituraMensalidadesSemWriteImplicito: true,
  reconciliacaoUsaProviderAtivo: true,
  jsonLocalExigeOptIn: true
}, null, 2));
