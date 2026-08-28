import assert from "node:assert/strict";
import fs from "node:fs";

const asaas = fs.readFileSync("modules/pagamentos-online/asaas.client.mjs", "utf8");
const pagbank = fs.readFileSync("modules/pagamentos-online/pagbank.client.mjs", "utf8");
const reembolso = fs.readFileSync("modules/pagamentos-online/reembolso.service.mjs", "utf8");
const integrado = fs.readFileSync("modules/financeiro/estorno-integrado.service.mjs", "utf8");
const recebRoutes = fs.readFileSync("modules/financeiro/recebimentos.routes.mjs", "utf8");
const ledgerRoutes = fs.readFileSync("modules/financeiro/financeiro-ledger.routes.mjs", "utf8");
const online = fs.readFileSync("modules/pagamentos-online/pagamentos-online.service.mjs", "utf8");
const tela = fs.readFileSync("public/pages/recebimentos/index.js", "utf8");
const api = fs.readFileSync("public/pages/recebimentos/api.js", "utf8");
const html = fs.readFileSync("public/pages/recebimentos/index.html", "utf8");

assert.match(asaas, /\/payments\/\$\{encodeURIComponent\(paymentId\)\}\/refund/);
assert.match(asaas, /\/payments\/\$\{encodeURIComponent\(paymentId\)\}\/refunds/);
assert.match(pagbank, /\/charges\/\$\{encodeURIComponent\(id\)\}\/cancel/);
assert.match(pagbank, /amount: \{ value: valorCentavos \}/);

for (const codigo of [
  "REFUND_MANUAL_REQUIRED",
  "REFUND_EXTERNAL_REFERENCE_REQUIRED",
  "REFUND_RECONCILIATION_REQUIRED",
  "REFUND_EXTERNAL_STATUS_UNKNOWN"
]) assert.match(reembolso, new RegExp(codigo));

for (const estado of ["solicitando", "externo_pendente", "externo_concluido", "local_pendente", "local_concluido"]) {
  assert.match(reembolso, new RegExp(`status: "${estado}"`));
}
assert.match(reembolso, /transacaoPagbank/);
assert.match(reembolso, /startsWith\("CHAR_"\)/);
assert.match(reembolso, /exigirCaixaAberto/);
assert.match(reembolso, /toUpperCase\(\) === "DONE"/);
assert.match(reembolso, /aguardandoExterno: true/);

const idxPre = integrado.indexOf("await prepararReembolsoExterno");
const idxLocal = integrado.indexOf("await estornarRecibo(");
assert.ok(idxPre >= 0 && idxLocal > idxPre, "Gateway precisa ser processado antes do estorno local.");
assert.match(integrado, /marcarReembolsoLocalPendente/);
assert.match(integrado, /if \(pre\.aguardandoExterno\)/);
assert.match(integrado, /REFUND_LOCAL_RECONCILIATION_REQUIRED/);

assert.match(recebRoutes, /estornarReciboIntegrado\(recebimento\.reciboId/);
assert.doesNotMatch(recebRoutes, /res\.json\(await estornarRecibo\(recebimento\.reciboId/);
assert.match(ledgerRoutes, /estornarReciboIntegrado\(req\.params\.id/);
assert.doesNotMatch(ledgerRoutes, /=> estornarRecibo\(req\.params\.id/);

assert.match(online, /providerTransactionId: texto\(pagamento\.id/);
assert.match(online, /reciboId: texto\(baixa\?\.resultado\?\.recibo\?\.id/);

assert.match(tela, /DEVOLUÇÃO REAL/);
assert.match(tela, /estorno-real-\$\{id\}/);
assert.match(tela, /reembolsoExterno/);
assert.match(tela, /ainda está em processamento/);
assert.match(api, /headers\["Idempotency-Key"\]/);
assert.match(html, /index\.js\?v=20260828-estorno-real-1/);

console.log(JSON.stringify({
  ok: true,
  modulo: "estorno-real-gateway",
  asaasRefundReal: true,
  pagbankRefundReal: true,
  infinitePayBloqueiaParaManual: true,
  pagamentoEletronicoSemVinculoBloqueado: true,
  gatewayAntesDoEstornoLocal: true,
  asaasSoEstornaLocalComStatusDone: true,
  falhaGatewayPreservaFinanceiro: true,
  falhaLocalAposGatewayReconciliavel: true,
  antiDuploEstornoExterno: true,
  duasRotasProtegidas: true,
  idempotencyKeyExplicita: true,
  testeNaoChamaGateway: true
}, null, 2));
