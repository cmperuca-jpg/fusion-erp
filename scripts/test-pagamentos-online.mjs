import assert from "node:assert/strict";
import fs from "node:fs/promises";

const arquivos = {
  packageJson: "package.json",
  server: "server.mjs",
  security: "modules/security/api-security.middleware.mjs",
  routes: "modules/pagamentos-online/pagamentos-online.routes.mjs",
  service: "modules/pagamentos-online/pagamentos-online.service.mjs",
  config: "modules/pagamentos-online/pagamentos-online.config.mjs",
  asaas: "modules/pagamentos-online/asaas.client.mjs",
  pagbank: "modules/pagamentos-online/pagbank.client.mjs",
  treinosRoutes: "modules/treinos/treinos.routes.mjs",
  alunoActions: "modules/treinos/aluno-app-actions.service.mjs",
  configuracoesHtml: "public/pages/configuracoes/index.html",
  pagamentosConfigHtml: "public/pages/configuracoes/pagamentos-online.html",
  pagamentosConfigJs: "public/pages/configuracoes/pagamentos-online.js",
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
assert.match(conteudo.server, /capturarRawBodyPagbank/);
assert.match(conteudo.server, /verify: capturarRawBodyPagbank/);

assert.match(conteudo.security, /\["POST", "\/api\/pagamentos-online\/webhooks\/asaas"\]/);
assert.match(conteudo.security, /\["POST", "\/api\/pagamentos-online\/webhooks\/pagbank"\]/);
assert.match(conteudo.security, /\["POST", "\/api\/treinos\/aluno-app\/pagamentos"\]/);
assert.match(conteudo.security, /\["GET", "\/api\/treinos\/aluno-app\/pagamentos", "prefix"\]/);

assert.match(conteudo.routes, /router\.post\("\/fusion\/contratacao"/);
assert.match(conteudo.routes, /router\.post\("\/webhooks\/asaas"/);
assert.match(conteudo.routes, /receberWebhookAsaas/);
assert.match(conteudo.routes, /router\.post\("\/webhooks\/pagbank"/);
assert.match(conteudo.routes, /receberWebhookPagbank/);
assert.match(conteudo.routes, /rawBody: req\.rawBody/);
assert.match(conteudo.routes, /router\.get\("\/configuracao"/);
assert.match(conteudo.routes, /router\.put\("\/configuracao"/);
assert.match(conteudo.routes, /salvarConfiguracaoPagamentos/);

assert.match(conteudo.asaas, /"access_token": cfg\.apiKey/);
assert.doesNotMatch(conteudo.asaas, /Authorization/i);
assert.match(conteudo.asaas, /https:\/\/api-sandbox\.asaas\.com\/v3/);
assert.match(conteudo.asaas, /https:\/\/api\.asaas\.com\/v3/);
assert.match(conteudo.asaas, /externalReference/);

assert.match(conteudo.pagbank, /Authorization": `Bearer \$\{cfg\.token\}`/);
assert.match(conteudo.pagbank, /https:\/\/sandbox\.api\.pagseguro\.com/);
assert.match(conteudo.pagbank, /https:\/\/api\.pagseguro\.com/);
assert.match(conteudo.pagbank, /\/checkouts/);
assert.match(conteudo.pagbank, /rel\)\.toUpperCase\(\) === "PAY"/);

assert.match(conteudo.config, /pagamentos_online_config\.json/);
assert.match(conteudo.config, /obterConfiguracaoPagamentosRuntime/);
assert.match(conteudo.config, /obterConfiguracaoPagamentosPublica/);
assert.match(conteudo.config, /salvarConfiguracaoPagamentos/);
assert.match(conteudo.config, /tokenConfigurado/);
assert.match(conteudo.config, /webhookTokenConfigurado/);
assert.match(conteudo.config, /mascararSegredo/);
assert.match(conteudo.config, /createCipheriv\("aes-256-gcm"/);
assert.doesNotMatch(conteudo.pagamentosConfigJs, /tokenResumo\s*=|webhookTokenResumo\s*=/);
assert.match(conteudo.configuracoesHtml, /pagamentos-online\.html/);
assert.match(conteudo.pagamentosConfigHtml, /formPagamentosOnline/);
assert.match(conteudo.pagamentosConfigHtml, /Token da API/);
assert.match(conteudo.pagamentosConfigHtml, /autocomplete="new-password"/);
assert.doesNotMatch(conteudo.pagamentosConfigHtml, /SEU_TOKEN/);
assert.match(conteudo.pagamentosConfigJs, /\/api\/pagamentos-online\/configuracao/);

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
  "pagamentoQuitadoAsaas",
  "FUSION_PAYMENTS_PROVIDER",
  "obterConfiguracaoPagamentosRuntime",
  "criarCheckoutPagbank",
  "payment_notification_urls",
  "notification_urls",
  "PAGBANK_WEBHOOK_TOKEN_NOT_CONFIGURED",
  "x-authenticity-token",
  "createHash(\"sha256\")",
  "payment_methods",
  "PAID",
  "formaPagamentoPagbank"
]) {
  assert.ok(conteudo.service.includes(marcador), `Marcador obrigatório ausente no serviço: ${marcador}`);
}

assert.match(conteudo.treinosRoutes, /router\.post\("\/aluno-app\/pagamentos"/);
assert.match(conteudo.treinosRoutes, /router\.get\("\/aluno-app\/pagamentos\/:id"/);
assert.match(conteudo.treinosRoutes, /iniciarPagamentoAlunoApp/);
assert.match(conteudo.treinosRoutes, /consultarPagamentoAlunoApp/);
assert.match(conteudo.alunoActions, /export async function identidadeAlunoApp/);

assert.match(conteudo.alunoHtml, /id="pagarMensalidadeAluno"/);
assert.match(conteudo.alunoJs, /request\("\/pagamentos"/);
assert.match(conteudo.alunoJs, /fusion_aluno_pagamento_pendente_v1/);
assert.match(conteudo.alunoJs, /Verificar pagamento/);
assert.match(conteudo.alunoJs, /gateway confirmar/);
assert.match(conteudo.alunoJs, /X-Fusion-Device-Token/);
assert.match(conteudo.alunoJs, /window\.open/);
assert.match(conteudo.alunoCss, /\.section-action/);

console.log(JSON.stringify({
  ok: true,
  modulo: "pagamentos-online",
  gateways: ["asaas", "pagbank"],
  baixaAutomatica: true,
  appAluno: true,
  webhookProtegido: true
}, null, 2));
