import assert from "node:assert/strict";
import fs from "node:fs";

const financeiro = fs.readFileSync(
  "modules/financeiro/financeiro.routes.mjs",
  "utf8"
);
const security = fs.readFileSync(
  "modules/security/api-security.middleware.mjs",
  "utf8"
);
const linkService = fs.readFileSync(
  "modules/financeiro/mensalidade-financeiro-link.service.mjs",
  "utf8"
);

const inicioGet = financeiro.indexOf('router.get("/", async (req, res) => {');
const inicioMaterializacao = financeiro.indexOf(
  'router.post("/mensalidades/:mensalidadeId/garantir-lancamento", async (req, res) => {',
  inicioGet
);

assert.ok(inicioGet >= 0, "GET /api/financeiro nao localizado");
assert.ok(
  inicioMaterializacao > inicioGet,
  "limite do GET /api/financeiro nao localizado"
);

const blocoGet = financeiro.slice(inicioGet, inicioMaterializacao);

assert.match(blocoGet, /listarTitulos\(req\.query\)/);
assert.doesNotMatch(blocoGet, /garantirLancamentoFinanceiroMensalidade/);
assert.doesNotMatch(blocoGet, /mensalidadeSolicitadaPelaTela/);
assert.doesNotMatch(blocoGet, /\breferer\b|\breferrer\b/);
assert.doesNotMatch(blocoGet, /salvarJsonDuravel|executarTransacaoJson/);

assert.match(
  financeiro,
  /router\.post\("\/mensalidades\/:mensalidadeId\/garantir-lancamento"/
);
assert.match(
  financeiro,
  /garantirLancamentoFinanceiroMensalidade\(\s*req\.params\.mensalidadeId\s*\)/
);

assert.equal(
  security.includes("garantir-lancamento$/.test(rota)"),
  true
);
assert.match(security, /FINANCIAL_IDEMPOTENCY_REQUIRED/);

assert.match(
  linkService,
  /operacaoId:\s*`vinculo-financeiro-\$\{id\}`/
);
assert.match(
  linkService,
  /const criado = !lancamento/
);

console.log(JSON.stringify({
  ok: true,
  modulo: "financeiro-get-puro",
  getSomenteLeitura: true,
  materializacaoViaPost: true,
  idempotencyKeyObrigatoria: true,
  vinculoDeterministico: true
}, null, 2));
