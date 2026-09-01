import assert from "node:assert/strict";
import fs from "node:fs";

const js = fs.readFileSync("public/pages/dashboard/index.js", "utf8");
const html = fs.readFileSync("public/pages/dashboard/index.html", "utf8");

assert.match(js, /DASHBOARD_FINANCEIRO_CORTE_OFICIAL\s*=\s*['"]2026-09-01['"]/);
assert.match(js, /DASHBOARD_TIMEZONE_OPERACIONAL\s*=\s*['"]America\/Maceio['"]/);
assert.match(js, /function dashboardDataLocalISO/);
assert.match(js, /timeZone:\s*DASHBOARD_TIMEZONE_OPERACIONAL/);
assert.doesNotMatch(js, /inicio=2000-01-01/);

const inicioCarregamento = js.indexOf("(async function carregarDashboard()");
const fimCarregamento = js.indexOf("})();", inicioCarregamento);
assert.ok(inicioCarregamento >= 0 && fimCarregamento > inicioCarregamento, "carregarDashboard nao localizado");
const bloco = js.slice(inicioCarregamento, fimCarregamento);
assert.doesNotMatch(bloco, /toISOString\(\)\.slice\(0,\s*10\)/);
assert.match(bloco, /fimMesAnterior\s*>=\s*DASHBOARD_FINANCEIRO_CORTE_OFICIAL/);
assert.match(bloco, /inicio=\$\{DASHBOARD_FINANCEIRO_CORTE_OFICIAL\}&fim=\$\{fimMesAnterior\}/);
assert.match(bloco, /const acumuladoAnterior/);
assert.match(bloco, /const acumuladoOficial/);
assert.doesNotMatch(bloco, /const disponivelAgora/);
assert.doesNotMatch(bloco, /const fechamentoAnterior/);

assert.match(html, />Acumulado oficial<\/div>/);
assert.match(html, />Acumulado até mês anterior<\/div>/);
assert.doesNotMatch(html, />Disponível agora<\/div>/);
assert.doesNotMatch(html, />Fechamento mês anterior<\/div>/);
assert.match(html, /index\.js\?v=20260901-financeiro-corte-oficial-v2/);

console.log(JSON.stringify({
  ok: true,
  modulo: "dashboard-corte-financeiro-v2",
  corteOficial: "2026-09-01",
  timezone: "America/Maceio",
  historicoAnteriorAoCorteExcluido: true,
  saldoAberturaNaoInventado: true,
  disponivelRenomeadoParaAcumulado: true
}, null, 2));
