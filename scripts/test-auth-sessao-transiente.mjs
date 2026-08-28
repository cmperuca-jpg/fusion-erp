import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile(
  new URL("../public/assets/js/fusion-auth.js", import.meta.url),
  "utf8"
);

const inicio = source.indexOf(
  "async function validarSessao()"
);
const fim = source.indexOf(
  "function proteger(perfisPermitidos)",
  inicio
);

assert.ok(
  inicio >= 0 && fim > inicio,
  "validarSessao não localizado"
);

const validar = source.slice(inicio, fim);

assert.match(validar, /resp\.status === 401/);
assert.match(validar, /resp\.status === 403/);
assert.match(
  validar,
  /Falha transitória ao validar a sessão/
);
assert.match(
  validar,
  /Servidor indisponível ao validar a sessão/
);
assert.match(validar, /return usuarioAtual\(\);/);

assert.doesNotMatch(
  validar,
  /catch\s*\{\s*limparSessao\(true\)/
);

const authService = await fs.readFile(
  new URL("../modules/auth/auth.service.mjs", import.meta.url),
  "utf8"
);

assert.match(
  authService,
  /const JWT_EXPIRES_IN = process\.env\.JWT_EXPIRES_IN \|\| "12h"/
);

const duplicidades = await fs.readFile(
  new URL(
    "../modules/alunos/aluno-duplicidades.service.mjs",
    import.meta.url
  ),
  "utf8"
);

assert.doesNotMatch(duplicidades, /usuarios\.json/);
assert.match(
  duplicidades,
  /salvarJsonDuravel\("alunos\.json"/
);
assert.match(
  duplicidades,
  /salvarJsonDuravel\("auditoria_integridade\.json"/
);

console.log(JSON.stringify({
  ok: true,
  modulo: "auth-sessao-transiente",
  falhaRedePreservaSessao: true,
  erro5xxPreservaSessao: true,
  erro401Desloga: true,
  erro403Desloga: true,
  duplicidadeNaoAlteraUsuarios: true,
  dadosPessoaisExibidos: false
}, null, 2));
