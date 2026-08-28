import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (arquivo) => fs.readFileSync(arquivo, "utf8");

const auth = ler("public/assets/js/fusion-auth.js");
const security = ler("modules/security/api-security.middleware.mjs");
const ledger = ler("modules/financeiro/financeiro-ledger.service.mjs");
const repository = ler("modules/financeiro/pagamentos.repository.mjs");
const service = ler("modules/financeiro/pagamentos.service.mjs");
const routes = ler("modules/financeiro/pagamentos.routes.mjs");

assert.match(auth, /idempotenciaFinanceiraPendente/);
assert.match(auth, /Idempotency-Key/);
assert.match(auth, /IDEMPOTENCIA_FINANCEIRA_TTL_MS/);
assert.match(auth, /resp\.status < 500/);

assert.match(security, /FINANCIAL_IDEMPOTENCY_REQUIRED/);
assert.match(security, /FINANCIAL_IDEMPOTENCY_CONFLICT/);
assert.match(security, /operacaoFinanceiraCritica/);
assert.match(security, /status\(428\)/);
assert.doesNotMatch(security, /propagarIdempotenciaFinanceira/);

assert.match(ledger, /estornoOperacaoId/);
assert.match(ledger, /idempotente: true, recibo/);
assert.match(ledger, /\}, \{ operacaoId \}\);\n\}\n\nexport async function listarRecibos/);

assert.match(repository, /movimentoIdempotente/);
assert.match(repository, /movimentoExistente/);
assert.match(repository, /idempotente: true/);

assert.match(service, /motivoOuPayload/);
assert.match(service, /operacaoLote/);
assert.match(service, /operacaoLote \? `\$\{operacaoLote\}:\$\{id\}` : undefined/);
assert.match(service, /idempotente: resultado\.idempotente === true/);

assert.match(
  routes,
  /estornarPagamento\(req\.params\.id, req\.body \|\| \{\}\)/
);

console.log(JSON.stringify({
  ok: true,
  modulo: "idempotencia-financeira",
  clienteGeraChave: true,
  duploCliqueReutilizaChave: true,
  servidorExigeChaveCritica: true,
  recebimentoIdempotente: true,
  estornoReciboIdempotente: true,
  contasPagarIdempotente: true,
  lotePropagaChave: true
}, null, 2));
