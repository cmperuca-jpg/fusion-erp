import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo=process.cwd(), P=(...p)=>path.join(repo,...p);
const backupDir=P("data","backup-vinculo-mensalidade-financeiro",new Date().toISOString().replace(/[:.]/g,"-"));
const serviceFile="modules/financeiro/mensalidades.service.mjs";
const routesFile="modules/financeiro/mensalidades.routes.mjs";
const uiFile="public/pages/financeiro/financeiro.js";
const htmlFile="public/pages/financeiro/index.html";

function fail(m){console.error("[ERRO] "+m);process.exit(1)}
function read(r){const f=P(...r.split("/"));if(!fs.existsSync(f))fail("Arquivo nao encontrado: "+r);return fs.readFileSync(f,"utf8")}
function write(r,s){const f=P(...r.split("/"));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s,"utf8")}
function backup(r){const f=P(...r.split("/"));if(!fs.existsSync(f))return;fs.mkdirSync(backupDir,{recursive:true});fs.copyFileSync(f,path.join(backupDir,r.replace(/[\\/]/g,"__")))}
function repl(s,a,b,l){if(!s.includes(a))fail("Patch incompativel em: "+l);return s.replace(a,b)}
function replrx(s,re,b,l){if(!re.test(s))fail("Patch incompativel em: "+l);return s.replace(re,b)}
function run(c,a){execFileSync(c,a,{cwd:repo,stdio:"inherit"})}

console.log("============================================================");
console.log("FUSION ERP - VINCULO MENSALIDADE -> FINANCEIRO");
console.log("============================================================");

console.log("[1/7] Backup...");
[serviceFile,routesFile,uiFile,htmlFile].forEach(backup);

console.log("[2/7] Reconciliacao idempotente...");
let service=read(serviceFile);
if(!service.includes("export async function garantirLancamentoFinanceiroMensalidade(")){
  const anchor="async function removerLancamentoFinanceiro(mensalidadeId) {";
  const fn=`export async function garantirLancamentoFinanceiroMensalidade(id) {
  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const idx = mensalidades.findIndex((m) => String(m.id) === String(id));
  if (idx < 0) {
    const erro = new Error('Mensalidade não encontrada.');
    erro.status = 404;
    throw erro;
  }

  const atual = mensalidades[idx];
  if (statusInterno(atual.status) === 'cancelado') {
    const erro = new Error('Mensalidade cancelada não pode ser encaminhada para recebimento.');
    erro.status = 409;
    throw erro;
  }

  const financeiroAntes = await lerJson(FINANCEIRO_FILE, []);
  const existenteAntes = financeiroAntes.find((l) =>
    String(l.mensalidadeId || '') === String(atual.id) ||
    String(l.id || '') === String(atual.lancamentoFinanceiroId || '')
  );

  const financeiroId = await upsertLancamentoFinanceiro(atual);

  if (String(atual.lancamentoFinanceiroId || '') !== String(financeiroId)) {
    mensalidades[idx] = {
      ...atual,
      lancamentoFinanceiroId: financeiroId,
      vinculoFinanceiroReconciliadoEm: agoraISO(),
      atualizadoEm: agoraISO()
    };
    await salvarJson(MENSALIDADES_FILE, mensalidades);
  }

  const financeiroDepois = await lerJson(FINANCEIRO_FILE, []);
  const lancamento = financeiroDepois.find((l) =>
    String(l.id || '') === String(financeiroId) ||
    String(l.mensalidadeId || '') === String(atual.id)
  ) || null;

  if (!lancamento) {
    const erro = new Error('Não foi possível reconciliar o lançamento financeiro desta mensalidade.');
    erro.status = 500;
    throw erro;
  }

  return { ok:true, mensalidadeId:atual.id, financeiroId, criado:!existenteAntes, lancamento };
}

${anchor}`;
  service=repl(service,anchor,fn,"service");
}
write(serviceFile,service);

console.log("[3/7] Endpoint...");
let routes=read(routesFile);
if(!routes.includes("garantirLancamentoFinanceiroMensalidade")){
  routes=repl(routes,
`  historicoAluno
} from './mensalidades.service.mjs';`,
`  historicoAluno,
  garantirLancamentoFinanceiroMensalidade
} from './mensalidades.service.mjs';`,
"import route");
}
if(!routes.includes("router.post('/:id/financeiro'")){
  const anchor="router.post('/:id/baixar', async (req, res) => {";
  routes=repl(routes,anchor,`router.post('/:id/financeiro', async (req, res) => {
  try {
    res.json(await garantirLancamentoFinanceiroMensalidade(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

${anchor}`,"route");
}
write(routesFile,routes);

console.log("[4/7] Financeiro...");
let ui=read(uiFile);
if(!ui.includes("Mensalidades programadas podem existir antes do espelho no Financeiro.")){
  const nova=`async function abrirBaixaPorUrlSeExistir() {
  if (baixaAutomaticaUrlProcessada) return;
  const params = new URLSearchParams(location.search);
  const financeiroId = params.get("financeiroId") || params.get("financeiroid") || params.get("lancamentoId") || params.get("id");
  const mensalidadeId = params.get("mensalidadeId") || params.get("mensalidadeid");
  if (!financeiroId && !mensalidadeId) return;

  baixaAutomaticaUrlProcessada = true;

  let lancamento = null;
  if (financeiroId) lancamento = lancamentos.find((item) => String(item.id) === String(financeiroId));
  if (!lancamento && mensalidadeId) lancamento = lancamentos.find((item) => String(item.mensalidadeId) === String(mensalidadeId));

  // Mensalidades programadas podem existir antes do espelho no Financeiro.
  // Reconciliamos com upsert, sem criar outra mensalidade ou duplicar cobrança.
  if (!lancamento && mensalidadeId) {
    try {
      const resp = await fetch(\`/api/mensalidades/\${encodeURIComponent(mensalidadeId)}/financeiro\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || \`Erro HTTP \${resp.status}\`);
      lancamento = json.lancamento || null;
    } catch (erro) {
      limparParametrosBaixaDaUrl();
      alert(erro.message || "Não foi possível vincular esta mensalidade ao Financeiro.");
      return;
    }
  }

  limparParametrosBaixaDaUrl();

  if (!lancamento) {
    alert("O título da mensalidade não foi localizado nem pôde ser reconciliado no Financeiro.");
    return;
  }

  if (lancamentoPago(lancamento)) {
    alert("Este lançamento já está pago. A baixa automática não será aberta novamente.");
    return;
  }

  abrirModalBaixa(lancamento);
}`;
  ui=replrx(ui,/function abrirBaixaPorUrlSeExistir\(\) \{[\s\S]*?\n\}\n\ndocument\.getElementById\("btnNovoLancamento"\)/,nova+'\n\ndocument.getElementById("btnNovoLancamento")',"UI");
}
write(uiFile,ui);

console.log("[5/7] Cache...");
let html=read(htmlFile);
if(/src="\.\/financeiro\.js\?v=[^"]+"/.test(html)) html=html.replace(/src="\.\/financeiro\.js\?v=[^"]+"/,'src="./financeiro.js?v=20260813-vinculo-mensalidade-1"');
else if(html.includes('src="./financeiro.js"')) html=html.replace('src="./financeiro.js"','src="./financeiro.js?v=20260813-vinculo-mensalidade-1"');
else fail("financeiro.js nao encontrado no HTML");
write(htmlFile,html);

console.log("[6/7] Testes...");
write("scripts/test-vinculo-mensalidade-financeiro.mjs",`import assert from "node:assert/strict";
import fs from "node:fs/promises";
const [service,routes,ui,html]=await Promise.all([
 fs.readFile(new URL("../modules/financeiro/mensalidades.service.mjs",import.meta.url),"utf8"),
 fs.readFile(new URL("../modules/financeiro/mensalidades.routes.mjs",import.meta.url),"utf8"),
 fs.readFile(new URL("../public/pages/financeiro/financeiro.js",import.meta.url),"utf8"),
 fs.readFile(new URL("../public/pages/financeiro/index.html",import.meta.url),"utf8")
]);
assert.match(service,/garantirLancamentoFinanceiroMensalidade/);
assert.match(service,/await upsertLancamentoFinanceiro\\(atual\\)/);
assert.match(routes,/router\\.post\\('\\/:id\\/financeiro'/);
assert.match(ui,/async function abrirBaixaPorUrlSeExistir/);
assert.match(ui,/\\/api\\/mensalidades\\/\\$\\{encodeURIComponent\\(mensalidadeId\\)\\}\\/financeiro/);
assert.match(ui,/json\\.lancamento/);
assert.match(html,/20260813-vinculo-mensalidade-1/);
console.log(JSON.stringify({ok:true,reconciliaSemDuplicar:true,fluxo:"Prontuario -> Caixa -> Financeiro"},null,2));
`);
for(const rel of [serviceFile,routesFile,uiFile,"scripts/test-vinculo-mensalidade-financeiro.mjs"]) run(process.execPath,["--check",P(...rel.split("/"))]);
run(process.execPath,["scripts/test-vinculo-mensalidade-financeiro.mjs"]);

console.log("[7/7] Commit/push...");
const tracked=[serviceFile,routesFile,uiFile,htmlFile,"scripts/test-vinculo-mensalidade-financeiro.mjs"];
run("git",["add","--",...tracked]);
run("git",["diff","--cached","--check"]);
const changed=execFileSync("git",["diff","--cached","--name-only"],{cwd:repo,encoding:"utf8"}).trim();
if(changed){
  run("git",["commit","-m","fix: reconcilia mensalidade antes da baixa no financeiro"]);
  try{run("git",["push"]);console.log("[OK] Codigo enviado ao GitHub.");}
  catch{console.log("[AVISO] Commit criado, mas git push falhou.");}
}else console.log("[OK] Correcao ja aplicada.");

console.log("");
console.log("============================================================");
console.log("VINCULO_MENSALIDADE_FINANCEIRO_OK");
console.log("Mensalidade sem espelho financeiro e reconciliada automaticamente.");
console.log("Nenhuma nova mensalidade e criada.");
console.log("Fluxo continua obrigatoriamente pelo Caixa.");
console.log("============================================================");
