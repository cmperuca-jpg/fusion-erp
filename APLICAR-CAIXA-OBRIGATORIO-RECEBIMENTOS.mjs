import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const P = (...p) => path.join(repo, ...p);
const backupDir = P("data","backup-caixa-obrigatorio",new Date().toISOString().replace(/[:.]/g,"-"));

function fail(m){ console.error("[ERRO] "+m); process.exit(1); }
function read(rel){ const f=P(...rel.split("/")); if(!fs.existsSync(f)) fail("Arquivo nao encontrado: "+rel); return fs.readFileSync(f,"utf8"); }
function write(rel,s){ const f=P(...rel.split("/")); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,s,"utf8"); }
function backup(rel){ const f=P(...rel.split("/")); if(!fs.existsSync(f)) return; fs.mkdirSync(backupDir,{recursive:true}); fs.copyFileSync(f,path.join(backupDir,rel.replace(/[\\/]/g,"__"))); }
function replaceOnce(s,a,b,label){ if(!s.includes(a)) fail("Patch incompativel em: "+label); return s.replace(a,b); }
function run(c,a){ execFileSync(c,a,{cwd:repo,stdio:"inherit"}); }

console.log("============================================================");
console.log("FUSION ERP - CAIXA OBRIGATORIO PARA TODO RECEBIMENTO");
console.log("============================================================");

const serviceFile="modules/financeiro/recebimentos.service.mjs";
const uiFile="public/pages/financeiro/index.js";

console.log("[1/6] Backup...");
backup(serviceFile); backup(uiFile);

console.log("[2/6] Removendo abertura automatica de caixa...");
let service=read(serviceFile);
const oldBlock=`  let caixa = caixaAberto(dados);

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
const newBlock=`  const caixa = caixaAberto(dados);

  if (!caixa) {
    const erro = new Error('Abra o caixa antes de confirmar qualquer recebimento.');
    erro.status = 400;
    erro.code = 'CAIXA_FECHADO';
    throw erro;
  }`;
if(!service.includes("erro.code = 'CAIXA_FECHADO'")){
  service=replaceOnce(service,oldBlock,newBlock,"recebimentos.service.mjs");
}
write(serviceFile,service);

console.log("[3/6] Validacao visual no Financeiro...");
let ui=read(uiFile);
const oldUi=`  try {
    // O motor financeiro abre o caixa oficial automaticamente quando necessário.
    const dadosCartao = calcularDadosCartao();`;
const newUi=`  try {
    const situacaoCaixa = await verificarCaixaAbertoAntesDaBaixa();
    if (!situacaoCaixa.ok) {
      throw new Error(situacaoCaixa.mensagem || "Abra o caixa antes de confirmar um recebimento.");
    }

    // O caixa deve ter sido aberto explicitamente pelo operador.
    const dadosCartao = calcularDadosCartao();`;
if(!ui.includes("const situacaoCaixa = await verificarCaixaAbertoAntesDaBaixa();")){
  ui=replaceOnce(ui,oldUi,newUi,"public/pages/financeiro/index.js");
}
write(uiFile,ui);

console.log("[4/6] Teste...");
const test=`import assert from "node:assert/strict";
import fs from "node:fs/promises";
const service=await fs.readFile(new URL("../modules/financeiro/recebimentos.service.mjs",import.meta.url),"utf8");
const ui=await fs.readFile(new URL("../public/pages/financeiro/index.js",import.meta.url),"utf8");
const men=await fs.readFile(new URL("../modules/mensalidades/mensalidades.service.mjs",import.meta.url),"utf8");
assert.doesNotMatch(service,/Caixa aberto automaticamente pela baixa de recebimento/);
assert.match(service,/CAIXA_FECHADO/);
assert.match(service,/Abra o caixa antes de confirmar qualquer recebimento/);
assert.match(ui,/const situacaoCaixa = await verificarCaixaAbertoAntesDaBaixa/);
assert.match(men,/Abra o caixa antes de baixar mensalidade/);
console.log(JSON.stringify({ok:true,aberturaAutomaticaCaixa:false,financeiroSemCaixa:"bloqueado",mensalidadesSemCaixa:"bloqueado"},null,2));
`;
write("scripts/test-caixa-obrigatorio-recebimentos.mjs",test);

console.log("[5/6] Validando...");
for(const rel of [serviceFile,uiFile,"scripts/test-caixa-obrigatorio-recebimentos.mjs"]){
  run(process.execPath,["--check",P(...rel.split("/"))]);
}
run(process.execPath,["scripts/test-caixa-obrigatorio-recebimentos.mjs"]);

console.log("[6/6] Commit/push...");
const tracked=[serviceFile,uiFile,"scripts/test-caixa-obrigatorio-recebimentos.mjs"];
run("git",["add","--",...tracked]);
run("git",["diff","--cached","--check"]);
const changed=execFileSync("git",["diff","--cached","--name-only"],{cwd:repo,encoding:"utf8"}).trim();
if(changed){
  run("git",["commit","-m","fix: exige caixa aberto para todo recebimento"]);
  try{ run("git",["push"]); console.log("[OK] Codigo enviado ao GitHub."); }
  catch{ console.log("[AVISO] Commit criado, mas git push falhou."); }
}else{
  console.log("[OK] Correcao ja aplicada.");
}

console.log("");
console.log("============================================================");
console.log("CAIXA_OBRIGATORIO_RECEBIMENTOS_OK");
console.log("Nenhum recebimento abre caixa automaticamente.");
console.log("============================================================");
