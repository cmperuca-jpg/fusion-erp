import assert from "node:assert/strict";
import {
  adicionarMesesBilling,
  avaliarAcessoBilling,
  calcularTransicoesBilling
} from "../modules/saas/billing-policy.mjs";
import {
  listarPlanosFusion,
  resolverPlanoFusion
} from "../modules/saas/billing.service.mjs";

const planosFusion = listarPlanosFusion();
assert.deepEqual(planosFusion.map(plano => plano.codigo), ["free", "mensal-sem-fidelidade", "anual"]);
assert.equal(resolverPlanoFusion("mensal").codigo, "mensal-sem-fidelidade");
assert.equal(resolverPlanoFusion("fusion-pro").codigo, "mensal-sem-fidelidade");
assert.equal(resolverPlanoFusion("trial").codigo, "free");

assert.equal(adicionarMesesBilling("2026-01-31", 1), "2026-02-28");
assert.equal(adicionarMesesBilling("2028-01-31", 1), "2028-02-29");
assert.equal(adicionarMesesBilling("2026-12-31", 1), "2027-01-31");

const assinatura = {
  id: "sub-qa",
  status: "ativa",
  proximaCobrancaEm: "2026-09-26",
  pagoAte: "2026-09-26",
  inadimplenteDesde: "",
  suspensoEm: ""
};

let r = calcularTransicoesBilling(assinatura, { dataReferencia: "2026-09-26", diasTolerancia: 7 });
assert.equal(r.transicoes.length, 0);
assert.equal(r.acesso.permitido, true);

r = calcularTransicoesBilling(assinatura, { dataReferencia: "2026-09-27", diasTolerancia: 7 });
assert.deepEqual(r.transicoes.map(t => t.para), ["inadimplente"]);
assert.equal(r.inadimplenteDesde, "2026-09-27");
assert.equal(r.suspenderEm, "2026-10-04");
assert.equal(r.acesso.permitido, true);

r = calcularTransicoesBilling(assinatura, { dataReferencia: "2026-10-04", diasTolerancia: 7 });
assert.deepEqual(r.transicoes.map(t => t.para), ["inadimplente", "suspensa"]);
assert.equal(r.acesso.permitido, false);

const inadimplente = { ...assinatura, status: "inadimplente", inadimplenteDesde: "2026-09-27" };
r = calcularTransicoesBilling(inadimplente, { dataReferencia: "2026-10-03", diasTolerancia: 7 });
assert.equal(r.transicoes.length, 0);
r = calcularTransicoesBilling(inadimplente, { dataReferencia: "2026-10-04", diasTolerancia: 7 });
assert.deepEqual(r.transicoes.map(t => t.para), ["suspensa"]);

assert.equal(avaliarAcessoBilling({ ...assinatura, status: "suspensa" }).permitido, false);
assert.equal(avaliarAcessoBilling({ ...assinatura, status: "cancelada" }).permitido, false);
assert.equal(avaliarAcessoBilling({ ...assinatura, status: "inadimplente" }).permitido, true);
assert.equal(avaliarAcessoBilling(null).permitido, true);

console.log(JSON.stringify({
  ok: true,
  vencimento: "2026-09-26",
  inadimplenteDesde: "2026-09-27",
  toleranciaDias: 7,
  suspenderEm: "2026-10-04",
  idempotenciaPolitica: true,
  acessoSuspensaBloqueado: true,
  dia31Clamped: true,
  planosFusion: planosFusion.map(plano => plano.codigo)
}, null, 2));
