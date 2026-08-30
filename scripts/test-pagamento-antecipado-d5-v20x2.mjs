import assert from "node:assert/strict";
import { mensalidadeProgramadaNaJanelaPagamento } from "../modules/pagamentos-online/pagamentos-online.service.mjs";

const hoje = "2026-08-29";
assert.equal(mensalidadeProgramadaNaJanelaPagamento({ status: "programada", vencimento: "2026-09-03" }, hoje, 5), true);
assert.equal(mensalidadeProgramadaNaJanelaPagamento({ status: "prevista", vencimento: "2026-09-04" }, hoje, 5), false);
assert.equal(mensalidadeProgramadaNaJanelaPagamento({ status: "programada", vencimento: "2026-08-29" }, hoje, 5), true);
assert.equal(mensalidadeProgramadaNaJanelaPagamento({ status: "programada", vencimento: "2026-08-28" }, hoje, 5), false);
assert.equal(mensalidadeProgramadaNaJanelaPagamento({ status: "aberta", vencimento: "2026-09-01" }, hoje, 5), false);
console.log("PAGAMENTO_ANTECIPADO_D5_V20X2_OK");
