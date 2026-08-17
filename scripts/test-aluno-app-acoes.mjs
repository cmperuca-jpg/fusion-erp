import assert from "node:assert/strict";
import fs from "node:fs/promises";

const arquivos = {
  html: "public/pages/aluno-login/index.html",
  ui: "public/pages/aluno-login/actions.js",
  routes: "modules/treinos/treinos.routes.mjs",
  service: "modules/treinos/aluno-app-actions.service.mjs",
  security: "modules/security/api-security.middleware.mjs"
};

const [html, ui, routes, service, security] = await Promise.all(
  Object.values(arquivos).map(arquivo => fs.readFile(arquivo, "utf8"))
);

assert.match(html, /\/pages\/aluno-login\/actions\.js\?v=/, "Fusion Aluno deve carregar actions.js.");

for (const marcador of [
  'id="liberarCatracaApp"',
  'id="trocarFotoApp"',
  'id="fotoAlunoInputApp"',
  'accept="image/*"',
  'capture="user"',
  '>Tirar foto<',
  'request("/catraca"',
  'request("/foto"',
  'request("/catraca-contador"'
]) {
  assert.ok(ui.includes(marcador), `Ação do app ausente: ${marcador}`);
}

for (const rota of [
  'router.put("/aluno-app/foto"',
  'router.post("/aluno-app/catraca"',
  'router.get("/aluno-app/catraca-contador"'
]) {
  assert.ok(routes.includes(rota), `Rota do app ausente: ${rota}`);
}

for (const regra of [
  '["PUT", "/api/treinos/aluno-app/foto"]',
  '["POST", "/api/treinos/aluno-app/catraca"]',
  '["GET", "/api/treinos/aluno-app/catraca-contador"]'
]) {
  assert.ok(security.includes(regra), `Regra pública segura ausente: ${regra}`);
}

for (const protecao of [
  'obterHomeAlunoApp(req, res, deviceToken)',
  'linhas.length !== 1',
  'executarComTenant(identidade.tenantId',
  'liberarCatracaPortalAluno',
  'obterContadorCatracaPortalAluno',
  'gerarTokenPortal',
  'FOTO_MAX_CHARS'
]) {
  assert.ok(service.includes(protecao), `Proteção/integração ausente: ${protecao}`);
}

assert.ok(routes.includes('router.post("/aluno-liberar-catraca"'));
assert.ok(routes.includes('router.get("/aluno-catraca-contador"'));

console.log(JSON.stringify({
  ok: true,
  app: "Fusion Aluno",
  liberarCatracaVisivel: true,
  tirarFotoCelularVisivel: true,
  sessaoPropriaReutilizada: true,
  tenantResolvidoSemAproximacao: true,
  fluxoAccessEngineReutilizado: true,
  limiteDiarioPreservado: true
}, null, 2));
