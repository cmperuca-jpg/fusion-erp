import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const P = (...parts) => path.join(repo, ...parts);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = P("data", "backup-financeiro-fluxo-unico-v2", stamp);

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
console.log("FUSION ERP - FLUXO UNICO FINANCEIRO / CAIXA V2");
console.log("============================================================");

const files = {
  recebService: "modules/financeiro/recebimentos.service.mjs",
  financeiroService: "modules/financeiro/financeiro.service.mjs",
  financeiroUi: "public/pages/financeiro/financeiro.js",
  recebUi: "public/pages/recebimentos/index.js",
  recebHtml: "public/pages/recebimentos/index.html"
};

console.log("[1/8] Salvando backup...");
for (const rel of Object.values(files)) backup(rel);

console.log("[2/8] Tornando caixa obrigatorio no motor de recebimentos...");
let recebService = read(files.recebService);

const autoCaixaRecebimento = `  let caixa = caixaAberto(dados);

  if (!caixa) {
    const novoCaixa = {
      id: gerarId('cx'),
      dataAbertura: hojeISO(),
      valorAbertura: 0,
      responsavel: 'Administrador',
      observacaoAbertura: 'Caixa aberto automaticamente pela baixa de recebimento.',
      status: 'aberto',
      abertoEm: agoraISO(),
      fechadoEm: '',
      valorFechamentoInformado: null,
      diferenca: null,
      observacaoFechamento: ''
    };
    dados.caixas.push(novoCaixa);
    caixa = novoCaixa;
  }`;

const caixaObrigatorioRecebimento = `  const caixa = caixaAberto(dados);

  if (!caixa) {
    const erro = new Error('Abra o caixa antes de confirmar qualquer recebimento.');
    erro.status = 409;
    erro.code = 'CAIXA_FECHADO';
    throw erro;
  }`;

if (recebService.includes(autoCaixaRecebimento)) {
  recebService = recebService.replace(autoCaixaRecebimento, caixaObrigatorioRecebimento);
} else if (!recebService.includes("erro.code = 'CAIXA_FECHADO'")) {
  fail("Nao encontrei a abertura automatica de caixa no motor de recebimentos.");
}

const createStatusOld = `  const statusInicial = statusRecebimento(dados.status || 'aberto');
  const valorRecebidoInicial = statusInicial === 'recebido' ? valorLiquido : numero(dados.valorRecebido, 0);`;

const createStatusNew = `  const statusSolicitado = statusRecebimento(dados.status || 'aberto');
  if (statusSolicitado !== 'aberto') {
    const erro = new Error('Novo titulo deve ser criado em aberto. Para receber, use Baixar e passe pelo caixa.');
    erro.status = 409;
    erro.code = 'RECEBIMENTO_DEVE_PASSAR_PELO_CAIXA';
    throw erro;
  }
  const statusInicial = 'aberto';
  const valorRecebidoInicial = 0;`;

if (recebService.includes(createStatusOld)) {
  recebService = recebService.replace(createStatusOld, createStatusNew);
} else if (!recebService.includes("RECEBIMENTO_DEVE_PASSAR_PELO_CAIXA")) {
  fail("Nao encontrei o status inicial de criarRecebimento.");
}

if (!recebService.includes("const statusSolicitadoAtualizacao = dados.status")) {
  const updateAnchor = `  if (recebimentos[idx].status === 'recebido') {
    const erro = new Error('Recebimento confirmado não pode ser editado. Estorne antes.');
    erro.status = 400;
    throw erro;
  }

  const valorBruto =`;
  const updateReplacement = `  if (recebimentos[idx].status === 'recebido') {
    const erro = new Error('Recebimento confirmado não pode ser editado. Estorne antes.');
    erro.status = 400;
    throw erro;
  }

  const statusSolicitadoAtualizacao = dados.status !== undefined
    ? statusRecebimento(dados.status)
    : recebimentos[idx].status;

  if (
    ['recebido', 'parcial'].includes(statusSolicitadoAtualizacao) &&
    statusSolicitadoAtualizacao !== recebimentos[idx].status
  ) {
    const erro = new Error('Status de pagamento nao pode ser alterado manualmente. Use Baixar e passe pelo caixa.');
    erro.status = 409;
    erro.code = 'STATUS_PAGAMENTO_SOMENTE_PELO_CAIXA';
    throw erro;
  }

  const valorBruto =`;
  recebService = replaceOnce(recebService, updateAnchor, updateReplacement, "protecao update recebimento");

  recebService = replaceOnce(
    recebService,
    `    status: statusRecebimento(dados.status || recebimentos[idx].status),`,
    `    status: statusSolicitadoAtualizacao,`,
    "status update recebimento"
  );
}

write(files.recebService, recebService);

console.log("[3/8] Proibindo abertura automatica de caixa tambem em saidas...");
let financeiroService = read(files.financeiroService);

const autoCaixaPagamento = `  let aberto = caixa.caixas.find((item) => String(item.status || "").toLowerCase() === "aberto");
  if (!aberto) {
    aberto = {
      id: \`cx_\${Date.now()}_\${Math.random().toString(16).slice(2, 8)}\`,
      dataAbertura: hojeISO(),
      valorAbertura: 0,
      responsavel: "Administrador",
      observacaoAbertura: "Caixa aberto automaticamente pelo financeiro.",
      status: "aberto",
      abertoEm: new Date().toISOString(),
      fechadoEm: "",
      valorFechamentoInformado: null,
      diferenca: null,
      observacaoFechamento: ""
    };
    caixa.caixas.push(aberto);
  }`;

const caixaObrigatorioPagamento = `  const aberto = caixa.caixas.find((item) => String(item.status || "").toLowerCase() === "aberto");
  if (!aberto) {
    const erro = new Error("Abra o caixa antes de registrar qualquer pagamento.");
    erro.status = 409;
    erro.code = "CAIXA_FECHADO";
    throw erro;
  }`;

if (financeiroService.includes(autoCaixaPagamento)) {
  financeiroService = financeiroService.replace(autoCaixaPagamento, caixaObrigatorioPagamento);
} else if (financeiroService.includes('observacaoAbertura: "Caixa aberto automaticamente pelo financeiro."')) {
  fail("Abertura automatica do financeiro mudou de formato.");
}

// Nenhum cliente pode optar por voltar ao fluxo antigo de RECEBER.
financeiroService = financeiroService.replace(
  `if (String(atual.tipo || '').toLowerCase() === 'receber' && dados.fluxoRecebimentoUnico !== false && !dados._viaRecebimentos) {`,
  `if (String(atual.tipo || '').toLowerCase() === 'receber' && !dados._viaRecebimentos) {`
);

write(files.financeiroService, financeiroService);

console.log("[4/8] Corrigindo a tela realmente carregada do Financeiro...");
let financeiroUi = read(files.financeiroUi);

const caixaCheckOld = `async function verificarCaixaAbertoAntesDaBaixa() {
  try {
    const resp = await fetch("/api/caixa/atual", { cache: "no-store" });
    if (!resp.ok) return { ok: true };
    const json = await resp.json().catch(() => ({}));
    if (json.aberto === false) {
      return {
        ok: false,
        mensagem: "Não existe caixa aberto. Abra o caixa antes de confirmar um recebimento."
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}`;

const caixaCheckNew = `async function verificarCaixaAbertoAntesDaBaixa() {
  try {
    const resp = await fetch("/api/caixa/atual", { cache: "no-store" });
    if (!resp.ok) {
      return {
        ok: false,
        mensagem: "Não foi possível confirmar o caixa. Atualize a tela do Caixa antes de receber."
      };
    }
    const json = await resp.json().catch(() => ({}));
    if (json.aberto !== true) {
      return {
        ok: false,
        mensagem: "Não existe caixa aberto. Abra o caixa antes de confirmar um recebimento."
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      mensagem: "Não foi possível confirmar o caixa. O recebimento foi bloqueado por segurança."
    };
  }
}`;

if (financeiroUi.includes(caixaCheckOld)) {
  financeiroUi = financeiroUi.replace(caixaCheckOld, caixaCheckNew);
} else if (!financeiroUi.includes("O recebimento foi bloqueado por segurança.")) {
  fail("Nao encontrei verificarCaixaAbertoAntesDaBaixa em financeiro.js.");
}

const integridadeNew = `async function consultarIntegridade() {
  const resp = await fetch(\`\${API_LEDGER}/integridade\`, { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) return alert(json.erro || "Falha na verificação.");

  const rel = json.relatorio || json.dados || json;
  const falhas = rel.falhas || [];
  const hoje = hojeISO();

  const contasReceberAbertas = lancamentos.filter((item) => {
    const tipo = normalizarTexto(item.tipo);
    const st = normalizarTexto(item.status);
    if (tipo !== "receber") return false;
    if (["cancelado", "cancelada", "programado", "programada"].includes(st)) return false;
    return !lancamentoPago(item) && saldoLancamento(item) > 0;
  });

  const vencidos = contasReceberAbertas.filter((item) =>
    String(item.vencimento || "").slice(0, 10) < hoje
  );
  const venceHoje = contasReceberAbertas.filter((item) =>
    String(item.vencimento || "").slice(0, 10) === hoje
  );

  const textoIntegridade = rel.ok
    ? "Base tecnicamente íntegra"
    : "Atenção técnica necessária";

  abrirConsultaFinanceira(
    "Integridade técnica financeira",
    \`<p><strong>\${textoIntegridade}</strong> — \${falhas.length} inconsistência(s) estrutural(is).</p>
     <p><strong>Pendências financeiras são outra informação:</strong>
       \${contasReceberAbertas.length} título(s) em aberto,
       \${vencidos.length} vencido(s) e
       \${venceHoje.length} vencendo hoje.
     </p>
     <p style="font-size:13px;color:#64748b">
       “Base íntegra” significa que os vínculos técnicos estão consistentes; não significa que todos os alunos pagaram.
     </p>
     <table><thead><tr><th>Nível</th><th>Código</th><th>Registro</th></tr></thead><tbody>
       \${falhas.map((f) => \`<tr><td>\${escapeHtml(f.nivel)}</td><td>\${escapeHtml(f.codigo)}</td><td>\${escapeHtml(f.registroId || "-")}</td></tr>\`).join("") ||
         '<tr><td colspan="3">Nenhuma inconsistência técnica encontrada.</td></tr>'}
     </tbody></table>\`
  );
}`;

if (!financeiroUi.includes("Pendências financeiras são outra informação:")) {
  financeiroUi = replaceRegex(
    financeiroUi,
    /async function consultarIntegridade\(\) \{[\s\S]*?\n\}\n\nfunction abrirBaixaPorUrlSeExistir/,
    integridadeNew + "\n\nfunction abrirBaixaPorUrlSeExistir",
    "consultarIntegridade"
  );
}

write(files.financeiroUi, financeiroUi);

console.log("[5/8] Removendo baixa em lote da tela de Recebimentos...");
let recebHtml = read(files.recebHtml);

// Botao Exportar selecionados dependia da seleção em lote.
recebHtml = recebHtml.replace(/\s*<button id="btnExportarSelecionados"[\s\S]*?<\/button>/, "");

// Remove barra de lote.
recebHtml = recebHtml.replace(
  /\s*<section class="panel bulk-bar" id="barraLote">[\s\S]*?<\/section>/,
  ""
);

// Remove checkbox de seleção geral.
recebHtml = recebHtml.replace(
  /\s*<th class="check"><input id="chkTodos"[^>]*><\/th>/,
  ""
);

// Remove modal de baixa em lote.
recebHtml = recebHtml.replace(
  /\s*<dialog id="modalLote">[\s\S]*?<\/dialog>/,
  ""
);

// Novo recebimento sempre nasce em aberto.
recebHtml = recebHtml.replace(
  /<div class="field"><label for="novoStatus">Status<\/label><select id="novoStatus">[\s\S]*?<\/select><\/div>/,
  `<div class="field"><label>Status</label><strong>Aberto</strong>
    <input id="novoStatus" type="hidden" value="aberto">
    <small>Para receber, use Baixar. O pagamento será confirmado individualmente pelo Financeiro com caixa aberto.</small>
  </div>`
);

// Explica 23 x 22 e adiciona "vence hoje".
recebHtml = recebHtml.replace(
  `<article class="card"><span>Abertos</span><strong id="kpiAbertos">0</strong></article>`,
  `<article class="card"><span>Em aberto (total)</span><strong id="kpiAbertos">0</strong></article>`
);
recebHtml = recebHtml.replace(
  `<article class="card danger"><span>Vencidos</span><strong id="kpiVencidos">0</strong></article>`,
  `<article class="card"><span>Vence hoje</span><strong id="kpiHoje">0</strong></article>
      <article class="card danger"><span>Vencidos (atrasados)</span><strong id="kpiVencidos">0</strong></article>`
);

recebHtml = recebHtml.replace(/colspan="11"/g, 'colspan="10"');
recebHtml = recebHtml.replace(
  /src="\.\/index\.js\?v=[^"]+"/,
  'src="./index.js?v=20260813-fluxo-caixa-v2"'
);

write(files.recebHtml, recebHtml);

let recebUi = read(files.recebUi);

// Nao importa mais o comando de baixa direta.
recebUi = recebUi.replace(
  `import { listarRecebimentos, criarRecebimento, baixarRecebimento, estornarRecebimento, cancelarRecebimento, obterBaseAtiva, diagnosticarRecebimentos } from "./api.js";`,
  `import { listarRecebimentos, criarRecebimento, estornarRecebimento, cancelarRecebimento, obterBaseAtiva, diagnosticarRecebimentos } from "./api.js";`
);

// Barra de lote deixa de fazer parte do fluxo.
recebUi = replaceRegex(
  recebUi,
  /function atualizarBarraLote\(\)\{[\s\S]*?\}\nfunction valorSort/,
  `function atualizarBarraLote(){ /* baixa em lote removida: recebimentos sao individuais */ }
function valorSort`,
  "atualizarBarraLote"
);

// Remove checkbox da linha e ajusta colspan.
recebUi = recebUi.replace(/colspan=\\"11\\"/g, 'colspan=\\"10\\"');
recebUi = recebUi.replace(
  '`<tr class="${classe}"><td class="check"><input type="checkbox" data-select="${esc(id)}" ${sel?"checked":""}></td><td>',
  '`<tr class="${classe}"><td>'
);

// Contagem de vence hoje.
const resumoOld = `function atualizarResumo(){const r=estado.registros;$("#kpiTotal").textContent=r.length;$("#kpiAbertos").textContent=r.filter(x=>statusItem(x)==="aberto"&&estaEmAberto(x)).length;$("#kpiRecebidos").textContent=r.filter(x=>statusItem(x)==="recebido").length;$("#kpiParciais").textContent=r.filter(x=>statusItem(x)==="parcial").length;$("#kpiVencidos").textContent=r.filter(estaVencido).length;$("#kpiPrevisaoCaixa30").textContent=moeda(previsaoCaixa30Dias(r));$("#kpiValorLiquido").textContent=moeda(r.reduce((a,x)=>a+valorRecebido(x),0));$("#kpiValorAberto").textContent=moeda(r.reduce((a,x)=>estaEmAberto(x)?a+saldoItem(x):a,0))}`;

const resumoNew = `function atualizarResumo(){const r=estado.registros;$("#kpiTotal").textContent=r.length;$("#kpiAbertos").textContent=r.filter(x=>statusItem(x)==="aberto"&&estaEmAberto(x)).length;$("#kpiRecebidos").textContent=r.filter(x=>statusItem(x)==="recebido").length;$("#kpiParciais").textContent=r.filter(x=>statusItem(x)==="parcial").length;$("#kpiVencidos").textContent=r.filter(estaVencido).length;if($("#kpiHoje"))$("#kpiHoje").textContent=r.filter(venceHoje).length;$("#kpiPrevisaoCaixa30").textContent=moeda(previsaoCaixa30Dias(r));$("#kpiValorLiquido").textContent=moeda(r.reduce((a,x)=>a+valorRecebido(x),0));$("#kpiValorAberto").textContent=moeda(r.reduce((a,x)=>estaEmAberto(x)?a+saldoItem(x):a,0))}`;

if (recebUi.includes(resumoOld)) {
  recebUi = recebUi.replace(resumoOld, resumoNew);
} else if (!recebUi.includes('$("#kpiHoje")')) {
  fail("Nao encontrei atualizarResumo na tela de Recebimentos.");
}

// Novo titulo jamais nasce recebido/parcial.
recebUi = recebUi.replace(
  `const status=$("#novoStatus").value,forma=$("#novoForma").value;try{await criarRecebimento({tipo:"receber",cliente,aluno:cliente,descricao,documento:$("#novoDocumento").value.trim(),vencimento,dataVencimento:vencimento,valor,valorBruto:valor,valorRecebido:status==="recebido"?valor:0,valorLiquido:status==="recebido"?valor:0,valorRestante:status==="recebido"?0:valor,formaPagamento:forma,forma,status,observacao:$("#novoObs").value.trim()});`,
  `const status="aberto",forma=$("#novoForma").value;try{await criarRecebimento({tipo:"receber",cliente,aluno:cliente,descricao,documento:$("#novoDocumento").value.trim(),vencimento,dataVencimento:vencimento,valor,valorBruto:valor,valorRecebido:0,valorLiquido:0,valorRestante:valor,formaPagamento:forma,forma,status,observacao:$("#novoObs").value.trim()});`
);

// Mesmo que alguem invoque as funcoes pelo console, lote fica bloqueado.
recebUi = replaceRegex(
  recebUi,
  /function abrirLote\(\)\{[\s\S]*?\}\nasync function confirmarLote\(\)\{[\s\S]*?\}\nasync function confirmarEstorno/,
  `function abrirLote(){alert("Baixa em lote desativada. Receba cada titulo individualmente pelo Financeiro e pelo Caixa.");}
async function confirmarLote(){throw new Error("Baixa em lote desativada.");}
async function confirmarEstorno`,
  "desativar baixa lote"
);

write(files.recebUi, recebUi);

console.log("[6/8] Criando teste de seguranca...");
const test = `import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [recebService, financeiroService, financeiroUi, recebUi, recebHtml] = await Promise.all([
  fs.readFile(new URL("../modules/financeiro/recebimentos.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../modules/financeiro/financeiro.service.mjs", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/financeiro/financeiro.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/recebimentos/index.js", import.meta.url), "utf8"),
  fs.readFile(new URL("../public/pages/recebimentos/index.html", import.meta.url), "utf8")
]);

assert.doesNotMatch(recebService, /Caixa aberto automaticamente pela baixa de recebimento/);
assert.match(recebService, /CAIXA_FECHADO/);
assert.match(recebService, /RECEBIMENTO_DEVE_PASSAR_PELO_CAIXA/);
assert.match(recebService, /STATUS_PAGAMENTO_SOMENTE_PELO_CAIXA/);

assert.doesNotMatch(financeiroService, /Caixa aberto automaticamente pelo financeiro/);
assert.doesNotMatch(financeiroService, /fluxoRecebimentoUnico !== false/);

assert.match(financeiroUi, /O recebimento foi bloqueado por segurança/);
assert.match(financeiroUi, /Pendências financeiras são outra informação/);
assert.match(financeiroUi, /Nenhuma inconsistência técnica encontrada/);

assert.doesNotMatch(recebHtml, /btnBaixaLote/);
assert.doesNotMatch(recebHtml, /modalLote/);
assert.doesNotMatch(recebHtml, /chkTodos/);
assert.match(recebHtml, /Em aberto \\(total\\)/);
assert.match(recebHtml, /Vencidos \\(atrasados\\)/);
assert.match(recebHtml, /id="kpiHoje"/);

assert.doesNotMatch(recebUi, /baixarRecebimento/);
assert.match(recebUi, /Baixa em lote desativada/);
assert.match(recebUi, /const status="aberto"/);

console.log(JSON.stringify({
  ok: true,
  baixaEmLote: false,
  recebimentoIndividual: true,
  caixaObrigatorio: true,
  caixaFailClosed: true,
  novoRecebimentoDiretoComoPago: false,
  integridadeTecnicaSeparadaDePendencias: true,
  kpis: {
    emAbertoTotal: true,
    vencidosAtrasados: true,
    venceHoje: true
  }
}, null, 2));
`;
write("scripts/test-financeiro-fluxo-unico-caixa-v2.mjs", test);

console.log("[7/8] Validando sintaxe e politica...");
for (const rel of [
  files.recebService,
  files.financeiroService,
  files.financeiroUi,
  files.recebUi,
  "scripts/test-financeiro-fluxo-unico-caixa-v2.mjs"
]) {
  run(process.execPath, ["--check", P(...rel.split("/"))]);
}
run(process.execPath, ["scripts/test-financeiro-fluxo-unico-caixa-v2.mjs"]);

console.log("[8/8] Commit/push...");
const tracked = [
  files.recebService,
  files.financeiroService,
  files.financeiroUi,
  files.recebUi,
  files.recebHtml,
  "scripts/test-financeiro-fluxo-unico-caixa-v2.mjs"
];

run("git", ["add", "--", ...tracked]);
run("git", ["diff", "--cached", "--check"]);

const changed = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: repo,
  encoding: "utf8"
}).trim();

if (changed) {
  run("git", ["commit", "-m", "fix: unifica recebimentos no caixa"]);
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
console.log("FINANCEIRO_FLUXO_UNICO_CAIXA_V2_OK");
console.log("Baixa em lote removida.");
console.log("Todo recebimento exige caixa aberto.");
console.log("Novo titulo nasce em aberto.");
console.log("Integridade tecnica nao confunde com pendencias financeiras.");
console.log("============================================================");
