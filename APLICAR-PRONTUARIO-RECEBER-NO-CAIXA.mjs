import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const P = (...parts) => path.join(repo, ...parts);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = P("data", "backup-prontuario-receber-caixa", stamp);

function fail(message) {
  console.error("[ERRO] " + message);
  process.exit(1);
}
function read(rel) {
  const file = P(...rel.split("/"));
  if (!fs.existsSync(file)) fail(`Arquivo nao encontrado: ${rel}`);
  return fs.readFileSync(file, "utf8");
}
function write(rel, content) {
  const file = P(...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
function backup(rel) {
  const file = P(...rel.split("/"));
  if (!fs.existsSync(file)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, rel.replace(/[\\/]/g, "__")));
}
function replaceOnce(text, oldText, newText, label) {
  if (!text.includes(oldText)) fail(`Patch incompativel em: ${label}`);
  return text.replace(oldText, newText);
}
function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) fail(`Patch incompativel em: ${label}`);
  return text.replace(regex, replacement);
}
function run(cmd, args) {
  execFileSync(cmd, args, { cwd: repo, stdio: "inherit" });
}

console.log("============================================================");
console.log("FUSION ERP - PRONTUARIO RECEBER SOMENTE PELO CAIXA");
console.log("============================================================");

const prontuarioJs = "public/pages/alunos/prontuario.js";
const prontuarioHtml = "public/pages/alunos/prontuario.html";
const caixaJs = "public/pages/caixa/index.js";
const caixaHtml = "public/pages/caixa/index.html";

console.log("[1/7] Salvando backup...");
for (const rel of [prontuarioJs, prontuarioHtml, caixaJs, caixaHtml]) backup(rel);

console.log("[2/7] Removendo baixa direta do prontuario...");
let pjs = read(prontuarioJs);

pjs = pjs.replace(
  '>Receber</button>`;',
  '>Receber no caixa</button>`;'
);

const novaFuncao = `async function receberMensalidadeProntuario(id){
  let mensalidade = {};
  if (String(id || '').startsWith('financeiro:')) {
    const financeiroId = String(id).replace(/^financeiro:/, '');
    const lancamento = (prontuario?.financeiro || []).find(f => String(f.id) === String(financeiroId));
    mensalidade = lancamento ? { ...lancamento, origemRecebivel: 'financeiro' } : {};
  } else {
    mensalidade = id === '__contrato__'
      ? contratoInfoBase().recebivel
      : (prontuario?.mensalidades || []).find(m => String(m.id) === String(id));
  }

  if (!mensalidade || (!mensalidade.id && !mensalidade.contratoSemMensalidade)) {
    return alerta('Cobranca nao encontrada no prontuario.');
  }

  const valorPrevisto = valorMensalidadeReceber(mensalidade);
  if (valorPrevisto <= 0) return alerta('Nao ha valor em aberto para receber.');

  try {
    const receberFinanceiro = mensalidade.origemRecebivel === 'financeiro';

    // O prontuario NAO recebe dinheiro e NAO chama endpoint de baixa.
    // Quando o contrato ainda nao tem titulo, apenas garante a existencia
    // do titulo para que o fluxo oficial possa ser aberto no Caixa.
    if (!receberFinanceiro) {
      mensalidade = await garantirMensalidadeParaReceber(mensalidade);
    }

    if (!mensalidade?.id) throw new Error('Cobranca nao identificada para encaminhar ao caixa.');

    const params = new URLSearchParams({
      origem: 'prontuario',
      alunoId: String(prontuario?.aluno?.id || prontuario?.aluno?._id || alunoId || ''),
      aluno: nomeAluno(prontuario?.aluno),
      valor: String(valorMensalidadeReceber(mensalidade) || valorPrevisto),
      retorno: location.pathname + location.search
    });

    if (receberFinanceiro) params.set('financeiroId', String(mensalidade.id));
    else params.set('mensalidadeId', String(mensalidade.id));

    location.href = \`/pages/caixa/index.html?\${params.toString()}\`;
  } catch (erro) {
    alerta(erro.message || 'Nao foi possivel encaminhar esta cobranca ao caixa.');
  }
}

async function reqJson`;

pjs = replaceRegex(
  pjs,
  /async function receberMensalidadeProntuario\(id\)\{[\s\S]*?\n\}\n\nasync function reqJson/,
  novaFuncao,
  "receberMensalidadeProntuario"
);

write(prontuarioJs, pjs);

console.log("[3/7] Atualizando cache do prontuario...");
let phtml = read(prontuarioHtml);
phtml = phtml.replace(
  /src="\.\/prontuario\.js\?v=[^"]+"/,
  'src="./prontuario.js?v=20260813-receber-caixa-1"'
);
write(prontuarioHtml, phtml);

console.log("[4/7] Criando etapa obrigatoria na tela Caixa...");
let chtml = read(caixaHtml);

if (!chtml.includes('id="recebimentoPendente"')) {
  const hero = `    <section class="hero">
      <div>
        <h2>Caixa</h2>
        <p>Abertura, fechamento, entradas, saídas, sangrias e suprimentos.</p>
      </div>
      <div class="top-actions">
        <button type="button" id="btnAbrir">Abrir Caixa</button>
        <button type="button" id="btnFechar" class="danger">Fechar Caixa</button>
        <button type="button" id="btnNovoMovimento">Novo Movimento</button>
      </div>
    </section>`;

  const heroComRecebimento = `${hero}

    <section id="recebimentoPendente" class="painel" hidden style="border:2px solid #0f766e;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;">
        <div>
          <h2 style="margin:0 0 6px;">Recebimento aguardando no Caixa</h2>
          <p id="recebimentoPendenteTexto" style="margin:0;">Carregando cobrança...</p>
          <small id="recebimentoPendenteStatus">Confirme que o caixa está aberto para continuar.</small>
        </div>
        <div class="acoes" style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" id="btnCancelarRecebimentoPendente" class="sec">Voltar ao prontuário</button>
          <button type="button" id="btnContinuarRecebimentoPendente">Continuar recebimento</button>
        </div>
      </div>
    </section>`;

  chtml = replaceOnce(chtml, hero, heroComRecebimento, "painel recebimento pendente");
}

chtml = chtml.replace(
  /src="\.\/index\.js\?v=[^"]+"/,
  'src="./index.js?v=20260813-receber-caixa-1"'
);
write(caixaHtml, chtml);

console.log("[5/7] Fazendo o Caixa controlar a continuacao...");
let cjs = read(caixaJs);

if (!cjs.includes("const recebimentoPendente = (() =>")) {
  cjs = replaceOnce(
    cjs,
    `const estado = {
  caixa: null,
  totais: null,
  movimentos: []
};`,
    `const estado = {
  caixa: null,
  totais: null,
  movimentos: []
};

const recebimentoPendente = (() => {
  const params = new URLSearchParams(location.search);
  const financeiroId = params.get('financeiroId') || '';
  const mensalidadeId = params.get('mensalidadeId') || '';
  if (!financeiroId && !mensalidadeId) return null;

  return {
    financeiroId,
    mensalidadeId,
    alunoId: params.get('alunoId') || '',
    aluno: params.get('aluno') || 'Aluno',
    valor: numero(params.get('valor') || 0),
    retorno: params.get('retorno') || ''
  };
})();`,
    "contexto recebimento caixa"
  );
}

if (!cjs.includes("function renderRecebimentoPendente()")) {
  cjs = replaceOnce(
    cjs,
    `function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}`,
    `function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function retornoSeguro() {
  if (!recebimentoPendente?.retorno) return '/pages/alunos/index.html';
  try {
    const alvo = new URL(recebimentoPendente.retorno, location.origin);
    if (alvo.origin !== location.origin) return '/pages/alunos/index.html';
    if (!alvo.pathname.startsWith('/')) return '/pages/alunos/index.html';
    return alvo.pathname + alvo.search;
  } catch {
    return '/pages/alunos/index.html';
  }
}

function renderRecebimentoPendente() {
  const painel = $('#recebimentoPendente');
  if (!painel) return;

  if (!recebimentoPendente) {
    painel.hidden = true;
    return;
  }

  painel.hidden = false;
  const aberto = Boolean(estado.caixa && estado.caixa.status === 'aberto');
  const texto = $('#recebimentoPendenteTexto');
  const status = $('#recebimentoPendenteStatus');
  const continuar = $('#btnContinuarRecebimentoPendente');

  if (texto) {
    texto.textContent =
      \`\${recebimentoPendente.aluno} · \${moeda(recebimentoPendente.valor)} · cobrança aguardando confirmação\`;
  }

  if (status) {
    status.textContent = aberto
      ? 'Caixa aberto. Continue para escolher a forma de pagamento e confirmar a baixa.'
      : 'Caixa fechado. Abra o caixa antes de continuar este recebimento.';
  }

  if (continuar) {
    continuar.disabled = !aberto;
    continuar.setAttribute('aria-disabled', aberto ? 'false' : 'true');
    continuar.textContent = aberto ? 'Continuar recebimento' : 'Abra o caixa para continuar';
  }
}`,
    "render recebimento pendente"
  );
}

if (!cjs.includes("renderRecebimentoPendente();")) {
  cjs = replaceOnce(
    cjs,
    `  if (btnNovoMovimento) {
    btnNovoMovimento.disabled = !aberto;
    btnNovoMovimento.setAttribute('aria-disabled', !aberto ? 'true' : 'false');
  }
}`,
    `  if (btnNovoMovimento) {
    btnNovoMovimento.disabled = !aberto;
    btnNovoMovimento.setAttribute('aria-disabled', !aberto ? 'true' : 'false');
  }

  renderRecebimentoPendente();
}`,
    "renderCaixa chama recebimento pendente"
  );
}

if (!cjs.includes("btnContinuarRecebimentoPendente")) {
  fail("HTML do recebimento pendente nao foi reconhecido no JS.");
}

if (!cjs.includes("location.href = `/pages/financeiro/index.html?${params.toString()}`;")) {
  cjs = replaceOnce(
    cjs,
    `$('#btnFiltrar').addEventListener('click', carregar);`,
    `$('#btnContinuarRecebimentoPendente')?.addEventListener('click', () => {
  if (!recebimentoPendente) return;
  const aberto = Boolean(estado.caixa && estado.caixa.status === 'aberto');
  if (!aberto) {
    alert('Abra o caixa antes de continuar o recebimento.');
    return;
  }

  const params = new URLSearchParams({ origem: 'caixa' });
  if (recebimentoPendente.financeiroId) params.set('financeiroId', recebimentoPendente.financeiroId);
  if (recebimentoPendente.mensalidadeId) params.set('mensalidadeId', recebimentoPendente.mensalidadeId);
  if (recebimentoPendente.alunoId) params.set('alunoId', recebimentoPendente.alunoId);
  params.set('retorno', retornoSeguro());

  location.href = \`/pages/financeiro/index.html?\${params.toString()}\`;
});

$('#btnCancelarRecebimentoPendente')?.addEventListener('click', () => {
  location.href = retornoSeguro();
});

$('#btnFiltrar').addEventListener('click', carregar);`,
    "eventos recebimento pendente"
  );
}

write(caixaJs, cjs);

console.log("[6/7] Instalando testes...");
const test = `import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [prontuario, prontuarioHtml, caixa, caixaHtml, financeiro] = await Promise.all([
  fs.readFile(new URL("../public/pages/alunos/prontuario.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/alunos/prontuario.html", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/caixa/index.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/caixa/index.html", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/financeiro/financeiro.js", import.meta.url), "utf8")
]);

const match = prontuario.match(/async function receberMensalidadeProntuario\\(id\\)\\{[\\s\\S]*?\\n\\}\\n\\nasync function reqJson/);
assert.ok(match, "funcao receberMensalidadeProntuario nao localizada");
const bloco = match[0];

assert.doesNotMatch(bloco, /Forma de pagamento/);
assert.doesNotMatch(bloco, /\\/baixar/);
assert.doesNotMatch(bloco, /Confirmar recebimento/);
assert.match(bloco, /\\/pages\\/caixa\\/index\\.html/);
assert.match(prontuario, /Receber no caixa/);
assert.match(prontuarioHtml, /20260813-receber-caixa-1/);

assert.match(caixaHtml, /id="recebimentoPendente"/);
assert.match(caixa, /Caixa fechado\\. Abra o caixa antes de continuar/);
assert.match(caixa, /continuar\\.disabled = !aberto/);
assert.match(caixa, /\\/pages\\/financeiro\\/index\\.html/);

assert.match(financeiro, /params\\.get\\("mensalidadeId"\\)/);
assert.match(financeiro, /params\\.get\\("financeiroId"\\)/);

console.log(JSON.stringify({
  ok: true,
  prontuarioRecebeDireto: false,
  prontuarioVaiAoCaixa: true,
  caixaFechadoBloqueiaContinuacao: true,
  caixaAbertoLiberaContinuacao: true,
  financeiroAbreTituloSelecionado: true
}, null, 2));
`;

write("scripts/test-prontuario-receber-no-caixa.mjs", test);

for (const rel of [
  prontuarioJs,
  caixaJs,
  "scripts/test-prontuario-receber-no-caixa.mjs"
]) {
  run(process.execPath, ["--check", P(...rel.split("/"))]);
}
run(process.execPath, ["scripts/test-prontuario-receber-no-caixa.mjs"]);

console.log("[7/7] Commit/push...");
const tracked = [
  prontuarioJs,
  prontuarioHtml,
  caixaJs,
  caixaHtml,
  "scripts/test-prontuario-receber-no-caixa.mjs"
];

run("git", ["add", "--", ...tracked]);
run("git", ["diff", "--cached", "--check"]);

const changed = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: repo,
  encoding: "utf8"
}).trim();

if (changed) {
  run("git", ["commit", "-m", "fix: envia recebimento do prontuario ao caixa"]);
  try {
    run("git", ["push"]);
    console.log("[OK] Codigo enviado ao GitHub.");
  } catch {
    console.log("[AVISO] Commit criado, mas git push falhou.");
  }
} else {
  console.log("[OK] Correcao ja estava aplicada.");
}

console.log("");
console.log("============================================================");
console.log("PRONTUARIO_RECEBER_NO_CAIXA_OK");
console.log("Prontuario nao baixa cobranca.");
console.log("Caixa fechado impede continuar.");
console.log("Caixa aberto encaminha ao Financeiro para confirmar.");
console.log("============================================================");
