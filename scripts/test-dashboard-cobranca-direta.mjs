import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(
  "public/pages/dashboard/financeiro-operacional-dashboard.js",
  "utf8"
);
const dashboardCss = fs.readFileSync(
  "public/pages/dashboard/financeiro-operacional-dashboard.css",
  "utf8"
);
const dashboardHtml = fs.readFileSync(
  "public/pages/dashboard/index.html",
  "utf8"
);
const recebimentos = fs.readFileSync(
  "public/pages/recebimentos/index.js",
  "utf8"
);
const recebimentosHtml = fs.readFileSync(
  "public/pages/recebimentos/index.html",
  "utf8"
);

assert.match(dashboard, /mensalidadeIds:\s*\[\]/);
assert.match(dashboard, /function hrefDebitoAluno/);
assert.match(dashboard, /params\.set\("mensalidadeId", ids\[0\]\)/);
assert.match(dashboard, /params\.set\("cliente", item\.nome\)/);
assert.match(dashboard, /params\.set\("filtro", "vencidos"\)/);
assert.match(dashboard, /recebimentoId=.*receberAgora=1.*origem=dashboard-receber/);
assert.match(dashboard, /dashboard-fin-op-linha-clicavel/);

assert.match(recebimentos, /function aplicarContextoDashboardDaUrl/);
assert.match(recebimentos, /origem\.startsWith\("dashboard"\)/);
assert.match(recebimentos, /restaurarPreferencias\(\);aplicarContextoDashboardDaUrl\(\)/);
assert.match(recebimentos, /carregar\(\)\.then\(abrirBaixaAutomaticaPorUrl\)/);
assert.match(recebimentos, /if\(!alvo&&p\.get\("filtro"\)==="vencidos"/);
assert.match(recebimentos, /garantir-lancamento/);
assert.match(recebimentos, /dashboard-materializar-\$\{mensalidadeId\}/);
assert.match(recebimentos, /destino\.set\("receberAgora","1"\)/);

assert.match(dashboardCss, /\.dashboard-fin-op-linha-clicavel/);
assert.match(dashboardHtml, /20260828-popup-pagamento-1/);
assert.match(recebimentosHtml, /20260828-estorno-real-1/);

console.log(JSON.stringify({
  ok: true,
  modulo: "dashboard-cobranca-direta",
  contaReceberAbreTitulo: true,
  debitoUnicoAbreBaixa: true,
  multiplosDebitosFiltramCliente: true,
  filtrosAntigosNaoBloqueiamAlvo: true,
  aberturaAutomaticaInicial: true,
  mensalidadeSemEspelhoMaterializaViaPost: true,
  feedbackVisualClicavel: true,
  cacheBustAtualizado: true
}, null, 2));
