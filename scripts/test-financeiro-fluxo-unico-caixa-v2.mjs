import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [recebService, financeiroService, financeiroUi, recebUi, recebHtml] = await Promise.all([
  fs.readFile(new URL("../modules/financeiro/recebimentos.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../modules/financeiro/financeiro.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/financeiro/financeiro.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/recebimentos/index.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/recebimentos/index.html", import.meta.url), "utf8")
]);

assert.doesNotMatch(recebService, /Caixa aberto automaticamente pela baixa de recebimento/);
assert.match(recebService, /CAIXA_FECHADO/);
assert.match(recebService, /RECEBIMENTO_DEVE_PASSAR_PELO_CAIXA/);
assert.match(recebService, /STATUS_PAGAMENTO_SOMENTE_PELO_CAIXA/);

assert.doesNotMatch(financeiroService, /Caixa aberto automaticamente pelo financeiro/);
assert.doesNotMatch(financeiroService, /fluxoRecebimentoUnico !== false/);

assert.match(financeiroUi, /O recebimento foi bloqueado por segurança/);
assert.match(financeiroUi, /Pendências financeiras são outra informação/);
assert.match(financeiroUi, /Nenhuma inconsistência técnica encontrada/);

assert.doesNotMatch(recebHtml, /btnBaixaLote/);
assert.doesNotMatch(recebHtml, /modalLote/);
assert.doesNotMatch(recebHtml, /chkTodos/);
assert.match(recebHtml, /Em aberto \(total\)/);
assert.match(recebHtml, /Vencidos \(atrasados\)/);
assert.match(recebHtml, /id="kpiHoje"/);

assert.doesNotMatch(recebUi, /baixarRecebimento/);
assert.match(recebUi, /Baixa em lote desativada/);
assert.match(recebUi, /const status="aberto"/);

console.log(JSON.stringify({
  ok: true,
  baixaEmLote: false,
  recebimentoIndividual: true,
  caixaObrigatorio: true,
  caixaFailClosed: true,
  novoRecebimentoDiretoComoPago: false,
  integridadeTecnicaSeparadaDePendencias: true,
  kpis: {
    emAbertoTotal: true,
    vencidosAtrasados: true,
    venceHoje: true
  }
}, null, 2));
