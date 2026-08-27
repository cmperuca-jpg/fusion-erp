import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [prontuario, prontuarioHtml, caixa, caixaHtml, financeiro] = await Promise.all([
  fs.readFile(new URL("../public/pages/alunos/prontuario.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/alunos/prontuario.html", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/caixa/index.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/caixa/index.html", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/financeiro/financeiro.js", import.meta.url), "utf8")
]);

const match = prontuario.match(/async function receberMensalidadeProntuario\(id\)\{[\s\S]*?\n\}\n\nasync function reqJson/);
assert.ok(match, "funcao receberMensalidadeProntuario nao localizada");
const bloco = match[0];

assert.doesNotMatch(bloco, /Forma de pagamento/);
assert.doesNotMatch(bloco, /\/baixar/);
assert.doesNotMatch(bloco, /Confirmar recebimento/);
assert.match(bloco, /\/pages\/caixa\/index\.html/);
assert.match(prontuario, /Receber no caixa/);
assert.match(prontuarioHtml, /20260825-prontuario-cache-1/);

assert.match(caixaHtml, /id="recebimentoPendente"/);
assert.match(caixa, /Caixa fechado\. Abra o caixa antes de continuar/);
assert.match(caixa, /continuar\.disabled = !aberto/);
assert.match(caixa, /\/pages\/financeiro\/index\.html/);

assert.match(financeiro, /params\.get\("mensalidadeId"\)/);
assert.match(financeiro, /params\.get\("financeiroId"\)/);

console.log(JSON.stringify({
  ok: true,
  prontuarioRecebeDireto: false,
  prontuarioVaiAoCaixa: true,
  caixaFechadoBloqueiaContinuacao: true,
  caixaAbertoLiberaContinuacao: true,
  financeiroAbreTituloSelecionado: true
}, null, 2));
