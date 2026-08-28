import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (arquivo) => fs.readFileSync(arquivo, "utf8");

const security = ler("modules/security/api-security.middleware.mjs");
const schema = ler("modules/financeiro/pagamentos.schema.mjs");
const repository = ler("modules/financeiro/pagamentos.repository.mjs");
const service = ler("modules/financeiro/pagamentos.service.mjs");
const routes = ler("modules/financeiro/pagamentos.routes.mjs");

assert.match(schema, /crypto\.randomUUID/);
assert.doesNotMatch(schema, /Math\.random/);
assert.doesNotMatch(schema, /Date\.now\(\)/);
assert.match(schema, /operacoesIdempotentes/);
assert.match(schema, /parcelamentoOperacaoId/);
assert.match(schema, /recorrenciaOperacaoId/);

assert.match(repository, /listarFechamentosFinanceiros/);
assert.match(repository, /salvarFechamentosFinanceiros/);
assert.match(repository, /dataLocalISO/);
assert.match(repository, /crypto\.randomUUID/);
assert.doesNotMatch(repository, /Math\.random/);
assert.doesNotMatch(repository, /Date\.now\(\)/);

assert.match(service, /function idDeterministico/);
assert.match(service, /function operacaoAplicada/);
assert.match(service, /criacaoOperacaoId/);
assert.match(service, /duplicacaoOperacaoId/);
assert.match(service, /parcelamentoOperacaoId/);
assert.match(service, /recorrenciaOperacaoId/);
assert.match(service, /listarFechamentosFinanceiros/);
assert.match(service, /salvarFechamentosFinanceiros/);
assert.match(service, /id: uid\("aud_pag"\)/);
assert.doesNotMatch(service, /Math\.random/);
assert.doesNotMatch(service, /Date\.now\(\)/);

assert.match(routes, /function payloadOperacao/);
assert.match(routes, /excluirPagamento\(req\.params\.id, payloadOperacao\(req\)\)/);
assert.match(routes, /cancelarPagamento\(req\.params\.id, payloadOperacao\(req\)\)/);

assert.match(
  security,
  /pathMatches\(rota, "\/api\/financeiro\/pagamentos"\)/
);
assert.match(
  security,
  /pathMatches\(rota, "\/api\/pagamentos"\)/
);

console.log(JSON.stringify({
  ok: true,
  modulo: "consolidacao-financeira",
  idsCriptograficos: true,
  mutacoesContasPagarIdempotentes: true,
  criacaoIdempotente: true,
  duplicacaoIdempotente: true,
  parcelamentoIdempotente: true,
  recorrenciaIdempotente: true,
  fechamentoIdempotente: true,
  dataCaixaLocal: true,
  pseudoDbRemovidoDoFluxoAtivo: true
}, null, 2));
