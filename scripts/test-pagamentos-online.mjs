import assert from "node:assert/strict";
import fs from "node:fs/promises";

const arquivos = {
  packageJson: "package.json",
  server: "server.mjs",
  security: "modules/security/api-security.middleware.mjs",
  routes: "modules/pagamentos-online/pagamentos-online.routes.mjs",
  service: "modules/pagamentos-online/pagamentos-online.service.mjs",
  asaas: "modules/pagamentos-online/asaas.client.mjs",
  treinosRoutes: "modules/treinos/treinos.routes.mjs",
  alunoActions: "modules/treinos/aluno-app-actions.service.mjs",
  alunoHtml: "public/pages/aluno-login/index.html",
  alunoJs: "public/pages/aluno-login/index.js",
  alunoCss: "public/pages/aluno-login/style.css"
};

const conteudo = Object.fromEntries(
  await Promise.all(
    Object.entries(arquivos).map(async ([chave, arquivo]) => [chave, await fs.readFile(arquivo, "utf8")])
  )
);

assert.match(conteudo.packageJson, /"test:pagamentos-online"/);
assert.match(conteudo.server, /pagamentosOnlineRoutes/);
assert.match(conteudo.server, /app\.use\("\/api\/pagamentos-online", pagamentosOnlineRoutes\)/);

assert.match(conteudo.security, /\["POST", "\/api\/pagamentos-online\/webhooks\/asaas"\]/);
assert.match(conteudo.security, /\["POST", "\/api\/treinos\/aluno-app\/pagamentos"\]/);

assert.match(conteudo.routes, /router\.post\("\/fusion\/contratacao"/);
assert.match(conteudo.routes, /router\.post\("\/webhooks\/asaas"/);
assert.match(conteudo.routes, /receberWebhookAsaas/);

assert.match(conteudo.asaas, /"access_token": cfg\.apiKey/);
assert.doesNotMatch(conteudo.asaas, /Authorization/i);
assert.match(conteudo.asaas, /https:\/\/api-sandbox\.asaas\.com\/v3/);
assert.match(conteudo.asaas, /https:\/\/api\.asaas\.com\/v3/);
assert.match(conteudo.asaas, /externalReference/);

for (const marcador of [
  "garantirLancamentoFinanceiroMensalidade",
  "receberTitulos",
  "programarProximaCobrancaAposPagamento",
  "garantirCaixaParaOnline",
  "fecharCaixaOnlineSeCriado",
  "registrarPagamentoFusion",
  "atualizarTenantPagoFusion",
  "asaas-access-token",
  "FUSION_ASAAS_WEBHOOK_TOKEN",
  "externalReference({ escopo",
  "pagamentoQuitadoAsaas"
]) {
  assert.ok(conteudo.service.includes(marcador), `Marcador obrigatório ausente no serviço: ${marcador}`);
}

assert.match(conteudo.treinosRoutes, /router\.post\("\/aluno-app\/pagamentos"/);
assert.match(conteudo.treinosRoutes, /iniciarPagamentoAlunoApp/);
assert.match(conteudo.alunoActions, /export async function identidadeAlunoApp/);

assert.match(conteudo.alunoHtml, /id="pagarMensalidadeAluno"/);
assert.match(conteudo.alunoJs, /request\("\/pagamentos"/);
assert.match(conteudo.alunoJs, /X-Fusion-Device-Token/);
assert.match(conteudo.alunoJs, /window\.open/);
assert.match(conteudo.alunoCss, /\.section-action/);

console.log(JSON.stringify({
  ok: true,
  modulo: "pagamentos-online",
  gateway: "asaas",
  baixaAutomatica: true,
  appAluno: true,
  webhookProtegido: true
}, null, 2));
