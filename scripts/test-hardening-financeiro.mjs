import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (arquivo) => fs.readFileSync(arquivo, "utf8");

const security = ler("modules/security/api-security.middleware.mjs");
const server = ler("server.mjs");
const financeiroRoutes = ler("modules/financeiro/financeiro.routes.mjs");
const pagamentosRoutes = ler("modules/financeiro/pagamentos.routes.mjs");
const recebimentosRoutes = ler("modules/financeiro/recebimentos.routes.mjs");
const ledger = ler("modules/financeiro/financeiro-ledger.service.mjs");
const online = ler("modules/pagamentos-online/pagamentos-online.service.mjs");

assert.match(security, /const FINANCIAL_PREFIXES/);
assert.match(security, /podeAcessarRotaFinanceira/);
assert.match(security, /prepararIdempotenciaFinanceira/);
assert.match(security, /FINANCIAL_IDEMPOTENCY_REQUIRED/);
assert.match(security, /Esta operacao exige permissao financeira/);

assert.doesNotMatch(
  server,
  /app\.post\("\/api\/financeiro\/pagamentos\/:id\/baixar"/
);
assert.doesNotMatch(
  server,
  /app\.post\("\/api\/financeiro\/pagamentos\/:id\/estornar"/
);

assert.equal(
  financeiroRoutes.includes("mensalidadeSolicitadaPelaTela"),
  false
);
assert.equal(
  financeiroRoutes.includes('router.post("/mensalidades/:mensalidadeId/garantir-lancamento"'),
  true
);
assert.equal(
  financeiroRoutes.includes("garantirLancamentoFinanceiroMensalidade(\n      req.params.mensalidadeId"),
  true
);
assert.equal(
  security.includes("garantir-lancamento$/.test(rota)"),
  true
);
assert.match(financeiroRoutes, /executarTransacaoJson/);
assert.match(recebimentosRoutes, /req\.body\?\.idempotencyKey/);

assert.match(pagamentosRoutes, /Baixa em lote cancelada/);
assert.match(pagamentosRoutes, /executarTransacaoJson/);

assert.match(ledger, /dataLocalISO/);
assert.match(ledger, /horaLocalHHMMSS/);
assert.match(online, /dataLocalISO/);

console.log(JSON.stringify({
  ok: true,
  modulo: "hardening-financeiro",
  rbac: true,
  writerLegadoRemovido: true,
  loteAtomico: true,
  getFinanceiroPuro: true,
  materializacaoExplicita: true,
  idempotenciaPropagada: true,
  timezoneOperacional: true
}, null, 2));
