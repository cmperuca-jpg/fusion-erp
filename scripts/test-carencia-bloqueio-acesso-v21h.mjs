import assert from "node:assert/strict";
import {
  diasAtrasoAcesso,
  mensalidadeBloqueiaAcesso
} from "../modules/access-engine/access-engine.service.mjs";

assert.equal(diasAtrasoAcesso("2026-08-28", "2026-08-31"), 3);
assert.equal(diasAtrasoAcesso("2026-08-26", "2026-08-31"), 5);
assert.equal(diasAtrasoAcesso("2026-08-25", "2026-08-31"), 6);

const aberta = (vencimento) => ({
  id: `m-${vencimento}`,
  status: "aberto",
  statusPagamento: "aberto",
  vencimento
});

assert.equal(
  mensalidadeBloqueiaAcesso(aberta("2026-08-28"), 5, "2026-08-31"),
  false,
  "3 dias de atraso deve permanecer dentro da carência de 5 dias"
);
assert.equal(
  mensalidadeBloqueiaAcesso(aberta("2026-08-26"), 5, "2026-08-31"),
  false,
  "5 dias de atraso ainda está dentro da carência de 5 dias"
);
assert.equal(
  mensalidadeBloqueiaAcesso(aberta("2026-08-25"), 5, "2026-08-31"),
  true,
  "bloqueio começa no 6º dia de atraso quando a carência é 5"
);
assert.equal(
  mensalidadeBloqueiaAcesso(
    { ...aberta("2026-08-01"), status:"pago", statusPagamento:"pago" },
    5,
    "2026-08-31"
  ),
  false
);
assert.equal(
  mensalidadeBloqueiaAcesso(
    { status:"vencida", vencimento:"2026-08-28" },
    5,
    "2026-08-31"
  ),
  false
);
assert.equal(
  mensalidadeBloqueiaAcesso(
    { status:"vencida" },
    5,
    "2026-08-31"
  ),
  true,
  "status vencido sem data mantém comportamento conservador anterior"
);
assert.equal(
  mensalidadeBloqueiaAcesso(aberta("2026-08-30"), -5, "2026-08-31"),
  true,
  "carência negativa é normalizada para zero"
);

console.log(JSON.stringify({
  ok:true,
  modulo:"carencia-bloqueio-acesso-v21h",
  atraso3ComCarencia5Liberado:true,
  atraso5ComCarencia5Liberado:true,
  atraso6ComCarencia5Bloqueado:true,
  pagoNaoBloqueia:true,
  statusVencidaRespeitaData:true,
  semDataMantemFailClosed:true
}, null, 2));
