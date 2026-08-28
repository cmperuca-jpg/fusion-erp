import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [routes, ficha, js, alunoApp] = await Promise.all([
  readFile(new URL("../modules/alunos/alunos.routes.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/alunos/prontuario.html", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/alunos/prontuario-ficha-unica.js", import.meta.url), "utf8"),
  readFile(new URL("../public/pages/aluno-login/index.js", import.meta.url), "utf8")
]);

assert.match(routes, /router\.get\("\/:id\/app-link"/);
assert.match(routes, /https:\/\/www\.fusionsistema\.com\.br\/pages\/aluno-login\/index\.html\?academia=/);
assert.match(routes, /https:\/\/wa\.me\//);
assert.match(ficha, /Enviar link pelo WhatsApp/);
assert.doesNotMatch(ficha, /Gerar código do App/);
assert.match(ficha, /O aluno entra com CPF e senha/);
assert.match(js, /\/app-link/);
assert.doesNotMatch(js, /\/app-ativacao/);
assert.match(js, /Preparando WhatsApp/);
assert.match(js, /Enviar link pelo WhatsApp/);
assert.match(js, /Acesso criado/);
assert.match(js, /Primeiro acesso/);
assert.match(alunoApp, /if \(tenant && !deviceToken\(\)\)/);
assert.match(alunoApp, /show\("loginScreen"\)/);
assert.match(alunoApp, /body: JSON\.stringify\(tenantAtual\(\) \? \{ tenant: tenantAtual\(\), cpf, senha \}/);

console.log(JSON.stringify({
  ok: true,
  modulo: "app-aluno-link-whatsapp",
  geradorCodigoRemovidoDaFicha: true,
  whatsappUsaLinkTenant: true,
  endpointSomenteLeitura: true,
  loginCpfSenhaPreservado: true
}, null, 2));
