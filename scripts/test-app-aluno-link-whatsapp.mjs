import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [routes, ficha, fichaJs, appHtml, appJs, service, server] = await Promise.all([
  readFile(new URL("../modules/alunos/alunos.routes.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/alunos/prontuario.html", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/alunos/prontuario-ficha-unica.js", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/aluno-login/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/aluno-login/index.js", import.meta.url), "utf8"),
  readFile(new URL("../modules/treinos/aluno-app.service.mjs", import.meta.url), "utf8"),
  readFile(new URL("../server.mjs", import.meta.url), "utf8")
]);

assert.match(routes, /router\.post\("\/:id\/app-link"/);
assert.match(routes, /validadeMinutos:\s*1440/);
assert.match(routes, /\/apps\/aluno` \+\s*`\?acesso=/);
assert.match(routes, /https:\/\/wa\.me\//);
assert.match(routes, /No primeiro acesso, crie sua senha/);

assert.match(ficha, /Enviar link pelo WhatsApp/);
assert.doesNotMatch(ficha, /Gerar código do App/);
assert.match(ficha, /20260828-app-link-sem-dispositivo-1/);
assert.match(fichaJs, /method:"POST"/);
assert.match(fichaJs, /\/app-link/);
assert.doesNotMatch(fichaJs, /\/app-ativacao/);

assert.match(server, /app\.get\("\/:tenant\/apps\/aluno"/);
assert.match(server, /params\.set\("acesso", acesso\)/);
assert.match(server, /\/pages\/aluno-login\/index\.html\?\$\{params\.toString\(\)\}/);

assert.doesNotMatch(appHtml, /Código recebido no WhatsApp/);
assert.doesNotMatch(appHtml, /Ativar aplicativo/);
assert.doesNotMatch(appHtml, /Gerar meu código/);
assert.match(appHtml, /Abra o link da sua academia/);
assert.match(appHtml, /qualquer celular/);
assert.match(appHtml, /20260828-sem-dispositivo-1/);

const statusStart = service.indexOf("export async function statusAplicativoAlunosERP");
const statusEnd = service.indexOf("export async function gerarAtivacaoAlunoAutoatendimentoERP", statusStart);
const statusBlock = service.slice(statusStart, statusEnd);
assert.match(statusBlock, /select=legacy_id,usuario_id/);
assert.doesNotMatch(statusBlock, /app_dispositivos/);

const firstStart = service.indexOf("export async function primeiroAcessoAlunoApp");
const firstEnd = service.indexOf("export async function ativarAlunoAppPorLink", firstStart);
const firstBlock = service.slice(firstStart, firstEnd);
assert.match(firstBlock, /if \(tenantBruto\)/);
assert.match(firstBlock, /erp_tenant_id: tenant/);
assert.match(firstBlock, /access_code: codigoAcesso/);
assert.match(firstBlock, /Compatibilidade temporária com instalações antigas/);

const bootStart = appJs.indexOf("async function boot()");
const bootEnd = appJs.indexOf('$("codigo")?.addEventListener', bootStart);
const bootBlock = appJs.slice(bootStart, bootEnd);
assert.match(bootBlock, /if \(tenant\)/);
assert.match(bootBlock, /localStorage\.removeItem\(KEYS\.deviceToken\)/);
assert.doesNotMatch(bootBlock, /decidirAposStatus/);
assert.match(bootBlock, /acessoLinkAtual\(\)/);

const criarStart = appJs.indexOf("async function criarSenha()");
const criarEnd = appJs.indexOf("async function entrar()", criarStart);
const criarBlock = appJs.slice(criarStart, criarEnd);
assert.match(criarBlock, /tenant\s*\?\s*\{ tenant, access_code: acesso, cpf, senha, confirmar_senha: confirmar \}/);
assert.match(criarBlock, /INVALID_FIRST_ACCESS_LINK/);
assert.match(appJs, /Primeiro acesso: peça à academia para enviar seu link pelo WhatsApp/);

console.log(JSON.stringify({
  ok: true,
  modulo: "app-aluno-link-whatsapp",
  whatsappComTokenInvisivel: true,
  primeiroAcessoSemDeviceToken: true,
  loginMultidispositivoPreservado: true,
  codigoRemovidoDaInterface: true,
  statusBaseadoEmConta: true,
  urlAmigavelPorAcademia: true
}, null, 2));
