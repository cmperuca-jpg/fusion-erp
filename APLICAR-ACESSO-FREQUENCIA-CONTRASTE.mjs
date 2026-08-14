import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo=process.cwd(), P=(...p)=>path.join(repo,...p);
const backupDir=P("data","backup-acesso-frequencia-contraste",new Date().toISOString().replace(/[:.]/g,"-"));

function fail(m){console.error("[ERRO] "+m);process.exit(1)}
function read(r){const f=P(...r.split("/"));if(!fs.existsSync(f))fail("Arquivo nao encontrado: "+r);return fs.readFileSync(f,"utf8")}
function write(r,s){const f=P(...r.split("/"));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s,"utf8")}
function backup(r){const f=P(...r.split("/"));if(!fs.existsSync(f))return;fs.mkdirSync(backupDir,{recursive:true});fs.copyFileSync(f,path.join(backupDir,r.replace(/[\\/]/g,"__")))}
function repl(s,a,b,l){if(!s.includes(a))fail("Patch incompativel em: "+l);return s.replace(a,b)}
function run(c,a){execFileSync(c,a,{cwd:repo,stdio:"inherit"})}
function stopBio(){
  try{execFileSync("schtasks.exe",["/End","/TN","Fusion Biometria FS80"],{stdio:"ignore"})}catch{}
  try{execFileSync("powershell.exe",["-NoProfile","-Command","Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*fusion-biometria-sidecar.mjs*') -or $_.Name -eq 'FusionBiometriaFs80.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],{stdio:"ignore",windowsHide:true})}catch{}
}

console.log("============================================================");
console.log("FUSION ERP - ACESSO + FREQUENCIA + CONTRASTE");
console.log("============================================================");

const engineFile="scripts/fusion-access-local-engine.mjs";
const appServiceFile="modules/treinos/aluno-app-actions.service.mjs";
const actionsFile="public/pages/aluno-login/actions.js";
const alunoHtmlFile="public/pages/aluno-login/index.html";
const contrastFile="public/pages/alunos/prontuario-contraste-v2.css";
const prontuarioHtmlFile="public/pages/alunos/prontuario.html";

console.log("[1/8] Parando somente biometria...");
stopBio();

console.log("[2/8] Backup...");
[engineFile,appServiceFile,actionsFile,alunoHtmlFile,contrastFile,prontuarioHtmlFile].forEach(backup);

console.log("[3/8] Instalando regra compartilhada de releitura...");
fs.copyFileSync(P("biometric-access-dedupe.mjs"),P("modules","treinos","biometric-access-dedupe.mjs"));

console.log("[4/8] Impedindo releitura rapida no motor local...");
let engine=read(engineFile);

if(!engine.includes("biometric-access-dedupe.mjs")){
  engine=repl(
    engine,
    "import { DatabaseSync } from 'node:sqlite';",
    "import { DatabaseSync } from 'node:sqlite';\nimport { deduplicarEventosBiometricos, resolverJanelaReleituraBiometricaMs } from '../modules/treinos/biometric-access-dedupe.mjs';",
    "import motor local"
  );
}

if(!engine.includes("this.reReadCooldownMs=")){
  engine=repl(
    engine,
    "this.timeZone='America/Maceio'; this.syncing=false; this.pushing=false; this.releasing=false; this.timer=null; this.started=false;",
    "this.timeZone='America/Maceio'; this.reReadCooldownMs=resolverJanelaReleituraBiometricaMs(process.env.FUSION_BIOMETRIA_RELEITURA_MS || 12000); this.syncing=false; this.pushing=false; this.releasing=false; this.timer=null; this.started=false;",
    "cooldown motor local"
  );
}

if(!engine.includes("rebuildLocalCountsFromEvents(){")){
  const old=`  counts(id,d=localDate(this.timeZone)){ const r=this.db.prepare('SELECT server_count,local_count FROM daily_access WHERE person_id=? AND local_date=?').get(id,d); return {server:Number(r?.server_count||0),local:Number(r?.local_count||0),total:Number(r?.server_count||0)+Number(r?.local_count||0)}; }
  start(){ if(this.started)return; this.started=true; void this.syncNow(true); this.timer=setInterval(()=>{void this.syncNow(false);void this.pushPending();},1000); }`;
  const neu=`  counts(id,d=localDate(this.timeZone)){ const r=this.db.prepare('SELECT server_count,local_count FROM daily_access WHERE person_id=? AND local_date=?').get(id,d); return {server:Number(r?.server_count||0),local:Number(r?.local_count||0),total:Number(r?.server_count||0)+Number(r?.local_count||0)}; }
  rebuildLocalCountsFromEvents(){
    const rows=this.db.prepare("SELECT person_id,local_date,occurred_at,payload FROM events WHERE authorized=1 AND physical_confirmed=1 AND direction='entrada' AND person_id IS NOT NULL ORDER BY occurred_at").all();
    const aceitos=deduplicarEventosBiometricos(rows,{janelaMs:this.reReadCooldownMs});
    const counts=new Map();
    for(const row of aceitos){const key=\`\${row.person_id}|\${row.local_date}\`;counts.set(key,(counts.get(key)||0)+1);}
    const now=new Date().toISOString();
    const up=this.db.prepare('INSERT INTO daily_access(person_id,local_date,server_count,local_count,updated_at) VALUES(?,?,0,?,?) ON CONFLICT(person_id,local_date) DO UPDATE SET local_count=excluded.local_count,updated_at=excluded.updated_at');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('UPDATE daily_access SET local_count=0,updated_at=?').run(now);
      for(const [key,count] of counts){const pos=key.lastIndexOf('|');up.run(key.slice(0,pos),key.slice(pos+1),count,now);}
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  recentSuccessfulAccess(id,d){return this.db.prepare("SELECT occurred_at FROM events WHERE person_id=? AND local_date=? AND authorized=1 AND physical_confirmed=1 AND direction='entrada' ORDER BY occurred_at DESC LIMIT 1").get(id,d)||null;}
  start(){ if(this.started)return; this.rebuildLocalCountsFromEvents(); this.started=true; void this.syncNow(true); this.timer=setInterval(()=>{void this.syncNow(false);void this.pushPending();},1000); }`;
  engine=repl(engine,old,neu,"rebuild local counts");
}

if(!engine.includes("Releitura biometrica ignorada")){
  const old=`    if(!person.access_allowed||person.explicit_blocked){const reason=person.access_reason||'Acesso bloqueado';this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();return {handled:true,autorizado:false,motivo:reason,modo:'local'};}
    if(person.role==='aluno'){const count=this.counts(personId,d);if(count.total>=3){const reason='Limite de 3 acessos biometricos no dia atingido';this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();return {handled:true,autorizado:false,motivo:reason,modo:'local',acessosHoje:count.total};}}`;
  const neu=`    if(!person.access_allowed||person.explicit_blocked){const reason=person.access_reason||'Acesso bloqueado';this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();return {handled:true,autorizado:false,motivo:reason,modo:'local'};}
    if(person.role==='aluno'){
      const recent=this.recentSuccessfulAccess(personId,d),recentMs=recent?.occurred_at?new Date(recent.occurred_at).getTime():NaN,delta=Date.now()-recentMs;
      if(Number.isFinite(recentMs)&&delta>=0&&delta<this.reReadCooldownMs){const count=this.counts(personId,d);return {handled:true,autorizado:false,motivo:'Releitura biometrica ignorada; aguarde alguns segundos.',modo:'local',releituraIgnorada:true,acessosHoje:count.total};}
      const count=this.counts(personId,d);if(count.total>=3){const reason='Limite de 3 acessos biometricos no dia atingido';this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();return {handled:true,autorizado:false,motivo:reason,modo:'local',acessosHoje:count.total};}
    }`;
  engine=repl(engine,old,neu,"bloqueio releitura");
}
write(engineFile,engine);

console.log("[5/8] Corrigindo Frequencia do Fusion Aluno...");
let appService=read(appServiceFile);
if(!appService.includes('from "./biometric-access-dedupe.mjs"')){
  appService=repl(
    appService,
    'import { resumirFrequenciaRegistros } from "./aluno-app-frequencia.mjs";',
    'import { resumirFrequenciaRegistros } from "./aluno-app-frequencia.mjs";\nimport { deduplicarEventosBiometricos } from "./biometric-access-dedupe.mjs";',
    "import dedupe app"
  );
}
appService=appService.replace(
  '.select("event_id,equipment_id,occurred_at,source")',
  '.select("event_id,equipment_id,occurred_at,source,payload")'
);
if(!appService.includes("const eventosValidos = deduplicarEventosBiometricos")){
  appService=repl(
    appService,
    `  return (Array.isArray(data) ? data : []).map((row = {}) => ({`,
    `  const eventosValidos = deduplicarEventosBiometricos(Array.isArray(data) ? data : []);

  return eventosValidos.map((row = {}) => ({`,
    "dedupe frequencia"
  );
}
write(appServiceFile,appService);

console.log("[6/8] Atualizando contador/frequencia ao voltar para a aba...");
let actions=read(actionsFile);
if(!actions.includes("function atualizarAoRetornarParaApp()")){
  const anchor=`  function observarHome() {`;
  const fn=`  let ultimaAtualizacaoRetorno = 0;

  function atualizarAoRetornarParaApp() {
    if (document.visibilityState === "hidden") return;
    const home = $("homeScreen");
    if (!home || home.classList.contains("hidden")) return;

    const agora = Date.now();
    if (agora - ultimaAtualizacaoRetorno < 800) return;
    ultimaAtualizacaoRetorno = agora;

    atualizarContador();
    atualizarFrequencia();
  }

  function instalarAtualizacaoAoRetornar() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") atualizarAoRetornarParaApp();
    });
    window.addEventListener("focus", atualizarAoRetornarParaApp);
  }

${anchor}`;
  actions=repl(actions,anchor,fn,"refresh ao retornar");
  actions=repl(
    actions,
    `    observarHome();
  }`,
    `    observarHome();
    instalarAtualizacaoAoRetornar();
  }`,
    "instalar refresh"
  );
}
write(actionsFile,actions);

let alunoHtml=read(alunoHtmlFile);
alunoHtml=alunoHtml.replace(
  /\/pages\/aluno-login\/actions\.js\?v=[^"]+/,
  "/pages/aluno-login/actions.js?v=20260813-4"
);
write(alunoHtmlFile,alunoHtml);

console.log("[7/8] Corrigindo contraste do prontuario...");
let contrast=read(contrastFile);
if(!contrast.includes("CONTRASTE DOS CHIPS DO CABECALHO")){
  contrast += `

/* CONTRASTE DOS CHIPS DO CABECALHO
   O seletor anterior do header aplicava texto claro a todo <span>, inclusive chips. */
.prontuario-page .prontuario-header .chip{
  background:#e8f4f6!important;
  color:#123943!important;
  border:1px solid #87b6bf!important;
  opacity:1!important;
  text-shadow:none!important;
}
.prontuario-page .prontuario-header .chip.ok{
  background:#dcfce7!important;
  color:#166534!important;
  border-color:#86d9a5!important;
}
.prontuario-page .prontuario-header .chip.warn{
  background:#fef3c7!important;
  color:#854d0e!important;
  border-color:#e7bd55!important;
}
.prontuario-page .prontuario-header .chip.bad{
  background:#fee2e2!important;
  color:#991b1b!important;
  border-color:#f2a6a6!important;
}
`;
}
write(contrastFile,contrast);

let prontuarioHtml=read(prontuarioHtmlFile);
prontuarioHtml=prontuarioHtml.replace(
  /prontuario-contraste-v2\.css\?v=[^"]+/,
  "prontuario-contraste-v2.css?v=20260813-3"
);
write(prontuarioHtmlFile,prontuarioHtml);

console.log("[8/8] Testando, commit/push e rearmando biometria...");
fs.copyFileSync(P("test-biometria-frequencia-contraste.mjs"),P("scripts","test-biometria-frequencia-contraste.mjs"));

for(const rel of [
  "modules/treinos/biometric-access-dedupe.mjs",
  engineFile,
  appServiceFile,
  actionsFile,
  "scripts/test-biometria-frequencia-contraste.mjs"
]){
  run(process.execPath,["--check",P(...rel.split("/"))]);
}
run(process.execPath,["scripts/test-biometria-frequencia-contraste.mjs"]);

const tracked=[
  "modules/treinos/biometric-access-dedupe.mjs",
  engineFile,
  appServiceFile,
  actionsFile,
  alunoHtmlFile,
  contrastFile,
  prontuarioHtmlFile,
  "scripts/test-biometria-frequencia-contraste.mjs"
];
run("git",["add","--",...tracked]);
run("git",["diff","--cached","--check"]);

const changed=execFileSync("git",["diff","--cached","--name-only"],{cwd:repo,encoding:"utf8"}).trim();
if(changed){
  run("git",["commit","-m","fix: deduplica biometria e corrige contraste do prontuario"]);
  try{run("git",["push"]);console.log("[OK] Codigo enviado ao GitHub.");}
  catch{console.log("[AVISO] Commit criado, mas git push falhou.");}
}else console.log("[OK] Correcao ja aplicada.");

try{
  execFileSync("schtasks.exe",["/Run","/TN","Fusion Biometria FS80"],{stdio:"inherit"});
  console.log("[OK] Biometria rearmada; contagem local foi reconstruida.");
}catch{
  console.log("[AVISO] Nao foi possivel rearmar automaticamente a biometria.");
}

console.log("");
console.log("============================================================");
console.log("ACESSO_FREQUENCIA_CONTRASTE_OK");
console.log("Releitura em menos de 12s nao consome novo acesso.");
console.log("Fusion Aluno atualiza contador e frequencia ao voltar para a aba.");
console.log("Sem polling continuo.");
console.log("Chips/botoes do prontuario com contraste corrigido.");
console.log("============================================================");
