import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  checkoutAbertoCompativelComValor,
  montarCheckoutMensalidadeOnline,
  validarItensInfinitePay
} from "../modules/pagamentos-online/pagamentos-online.valor.service.mjs";

const composicao = montarCheckoutMensalidadeOnline({
  descricaoPrincipal: "Mensalidade 2026-08 - ALUNO TESTE",
  saldoPrincipal: 65,
  multa: 0.33,
  juros: 6.18
});

assert.equal(composicao.valor, 71.51);
assert.equal(composicao.totalCentavos, 7151);
assert.equal(composicao.itens.length, 3);

assert.deepEqual(
  composicao.itens.map((item) => item.price),
  [6500, 33, 618]
);

assert.deepEqual(
  composicao.itens.map((item) => item.description),
  [
    "Mensalidade 2026-08 - ALUNO TESTE",
    "Multa por atraso",
    "Juros por atraso"
  ]
);

assert.equal(
  checkoutAbertoCompativelComValor(
    { valor: 65 },
    71.51
  ),
  false
);

assert.equal(
  checkoutAbertoCompativelComValor(
    { valor: 71.51 },
    71.51
  ),
  true
);

const itensInfinitePay = validarItensInfinitePay({
  itens: composicao.itens,
  valor: composicao.valor,
  descricaoPadrao: "Mensalidade"
});

assert.equal(
  itensInfinitePay.reduce(
    (total, item) =>
      total + item.quantity * item.price,
    0
  ),
  7151
);

assert.throws(
  () =>
    validarItensInfinitePay({
      itens: [{
        quantity: 1,
        price: 6500,
        description: "Mensalidade"
      }],
      valor: 71.51
    }),
  (erro) =>
    erro?.code ===
    "PAYMENT_CHECKOUT_ITEMS_VALUE_MISMATCH"
);

const source = await fs.readFile(
  new URL(
    "../modules/pagamentos-online/pagamentos-online.service.mjs",
    import.meta.url
  ),
  "utf8"
);

assert.match(
  source,
  /calcularEncargosAtrasoTitulo/
);

assert.match(
  source,
  /multa:\s*encargos\.multaPendente/
);

assert.match(
  source,
  /juros:\s*encargos\.jurosPendente/
);

assert.match(
  source,
  /itens:\s*composicaoCheckout\.itens/
);

assert.match(
  source,
  /filtro\.valor !== undefined/
);

assert.doesNotMatch(
  source,
  /const aberta = pagamentoAbertoExistente\(pagamentos,[\s\S]{0,300}if \(aberta\) return respostaCheckout\(aberta\);[\s\S]{0,300}const vinculo = await garantirLancamentoFinanceiroMensalidade/
);

console.log(JSON.stringify({
  ok: true,
  modulo: "infinitepay-encargos-checkout",
  mensalidade65Multa033Juros618Total7151: true,
  infinitePayRecebeTresItens: true,
  linkAntigo65NaoEhReutilizado: true,
  link7151PodeSerReutilizado: true,
  divergenciaDeItensBloqueada: true,
  semChamadaExternaNoTeste: true,
  dadosPessoaisExibidos: false
}, null, 2));
