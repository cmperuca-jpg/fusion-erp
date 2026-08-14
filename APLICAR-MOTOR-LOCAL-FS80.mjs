import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo=process.cwd(), P=(...x)=>path.join(repo,...x);
const backup=P('data','backup-motor-local-fs80',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});
const fail=m=>{console.error('[ERRO] '+m);process.exit(1);};
const read=r=>fs.readFileSync(P(...r.split('/')),'utf8');
const write=(r,c)=>{const f=P(...r.split('/'));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c,'utf8');};
const rep=(t,a,b,l)=>{if(!t.includes(a))fail('Patch incompatível: '+l);return t.replace(a,b);};
const save=r=>{const f=P(...r.split('/'));if(!fs.existsSync(f))fail('Arquivo nao encontrado: '+r);fs.copyFileSync(f,path.join(backup,r.replace(/[\\/]/g,'__')));};

console.log('============================================================');
console.log('FUSION ERP - MOTOR LOCAL OFFLINE FS80 V1');
console.log('============================================================');
console.log('[1/8] Validando Node SQLite...');
try{execFileSync(process.execPath,['-e',"import('node:sqlite').then(()=>process.exit(0)).catch(()=>process.exit(2))"],{stdio:'ignore'});}
catch{fail('Esta versao do Node nao possui node:sqlite. Nenhuma alteracao foi aplicada.');}
console.log('[OK] node:sqlite disponivel.');

for(const f of ['modules/access-bridge/access-bridge.repository.mjs','modules/access-bridge/access-bridge.routes.mjs','scripts/fusion-biometria-sidecar.mjs','scripts/biometria/FusionBiometriaFs80.cs'])save(f);

console.log('[2/8] Instalando motor local...');
fs.copyFileSync(P('_patch','scripts','fusion-access-local-engine.mjs'),P('scripts','fusion-access-local-engine.mjs'));

console.log('[3/8] Ligando credencial Edge ao Agent autenticado...');
let repository=read('modules/access-bridge/access-bridge.repository.mjs');
if(!repository.includes('export async function saveEdgeDeviceCredential')){
repository+=`

export async function saveEdgeDeviceCredential({ agentId, tenantId, equipmentId, secretHash } = {}) {
  const safeHash=String(secretHash||'').trim().toLowerCase();
  if(!agentId||!tenantId||!/^[a-f0-9]{64}$/.test(safeHash)) return null;
  const supabase=await supabaseClient();
  if(!supabase) return null;
  const {data:existing,error:readError}=await supabase.from('fusion_edge_devices')
    .select('device_id,name,timezone,details,created_at').eq('tenant_id',tenantId).eq('agent_id',agentId).maybeSingle();
  if(readError) throw readError;
  const row={
    tenant_id:tenantId,agent_id:agentId,
    device_id:existing?.device_id||\`\${agentId}-edge\`,
    name:existing?.name||'Fusion Edge',
    secret_hash:safeHash,timezone:existing?.timezone||'America/Maceio',
    status:'active',last_seen_at:isoDate(),updated_at:isoDate(),
    details:{...(existing?.details&&typeof existing.details==='object'?existing.details:{}),equipmentId:equipmentId||undefined,source:'fusion-access-agent',biometricOffline:true}
  };
  if(existing?.created_at) row.created_at=existing.created_at;
  const {data,error}=await supabase.from('fusion_edge_devices').upsert(row,{onConflict:'tenant_id,agent_id'}).select().maybeSingle();
  if(error) throw error;
  return data;
}
`;
write('modules/access-bridge/access-bridge.repository.mjs',repository);
}

let routes=read('modules/access-bridge/access-bridge.routes.mjs');
if(!routes.includes("import crypto from 'node:crypto';"))routes="import crypto from 'node:crypto';\n"+routes;
if(!routes.includes("saveEdgeDeviceCredential } from './access-bridge.repository.mjs'")){
  const a="import { executarComTenant } from '../core/persistence/tenant-context.mjs';";
  routes=rep(routes,a,a+"\nimport { saveEdgeDeviceCredential } from './access-bridge.repository.mjs';",'import Edge');
}
if(!routes.includes('async function syncEdgeCredential')){
  const a=`function agentEquipmentDetails(agent = {}) {
  const equipmentIds = Array.isArray(agent.equipmentIds) ? agent.equipmentIds.filter(Boolean) : [];
  const equipmentId = agent.equipmentId || (equipmentIds.length === 1 ? equipmentIds[0] : '');
  return {
    equipmentId: equipmentId || undefined,
    equipmentIds: equipmentIds.length ? equipmentIds : (equipmentId ? [equipmentId] : undefined)
  };
}`;
  routes=rep(routes,a,a+`

async function syncEdgeCredential(req,agent){
  const rawToken=String(req.get('x-agent-token')||'');
  if(!rawToken||!agent?.tenantId||!agent?.agentId)return;
  await saveEdgeDeviceCredential({
    agentId:agent.agentId,tenantId:agent.tenantId,
    equipmentId:agent.equipmentId||agent.equipmentIds?.[0]||'',
    secretHash:crypto.createHash('sha256').update(rawToken).digest('hex')
  });
}`,'helper edge');
}
if(!routes.includes("await syncEdgeCredential(req, agent);\n  await saveHeartbeat")){
routes=rep(routes,`router.post('/agent/heartbeat', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await saveHeartbeat`,`router.post('/agent/heartbeat', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  await saveHeartbeat`,'heartbeat edge');
}
if(!routes.includes("await syncEdgeCredential(req, agent);\n  const consumer")){
routes=rep(routes,`router.get('/agent/next', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  const consumer`,`router.get('/agent/next', wrap(async (req, res) => {
  const agent = await validateAgent(req);
  await syncEdgeCredential(req, agent);
  const consumer`,'poll edge');
}
write('modules/access-bridge/access-bridge.routes.mjs',routes);

console.log('[4/8] Ligando FS80 ao motor local com fallback online...');
let side=read('scripts/fusion-biometria-sidecar.mjs');
if(!side.includes("fusion-access-local-engine.mjs"))side=rep(side,"import { spawn } from 'node:child_process';","import { spawn } from 'node:child_process';\nimport { createLocalAccessEngine } from './fusion-access-local-engine.mjs';",'import local');
if(!side.includes('const localAccessEngine = createLocalAccessEngine')){
  const a="if (!enabled) fail('FUSION_BIOMETRIA_ENABLED esta desativada. Nenhum monitor foi iniciado.', 3);";
  side=rep(side,a,a+`

const localAccessEngine=createLocalAccessEngine({
  tenantId,agentId,token,equipmentId,
  host:process.env.ACCESS_HOST||process.env.HENRY7X_HOST||'10.0.0.236',
  port:Number(process.env.ACCESS_PORT||process.env.HENRY7X_PORT||3000)
});`,'init local');
}
if(side.includes('async function sendIdentified(evt) {')&&!side.includes('async function sendIdentifiedOnline(evt'))side=side.replace('async function sendIdentified(evt) {','async function sendIdentifiedOnline(evt, skipCooldown = false) {');
if(side.includes("async function sendIdentifiedOnline(evt, skipCooldown = false) {")){
  side=side.replace("if (!alunoId || requestInFlight || adminCommandInFlight || inCooldown(alunoId)) return;","if (!alunoId || requestInFlight || adminCommandInFlight || (!skipCooldown && inCooldown(alunoId))) return;");
}
if(!side.includes("event: 'local-access-result'")){
  const a='function processLine(line) {';
  side=rep(side,a,`async function sendIdentified(evt){
  const alunoId=String(evt?.alunoId||'').trim().slice(0,160);
  if(!alunoId||requestInFlight||adminCommandInFlight||inCooldown(alunoId))return;
  if(String(evt?.tenantId||'').trim().toLowerCase()!==tenantId){
    console.error('[BIOMETRIA] Evento rejeitado: tenant do monitor diverge do tenant do Agent.');return;
  }
  requestInFlight=true;
  try{
    const local=await localAccessEngine.handleIdentified(alunoId,evt?.farNumerico??null);
    if(local?.handled){
      console.log(JSON.stringify({event:'local-access-result',tenantId,aluno:maskId(alunoId),autorizado:local.autorizado===true,motivo:local.motivo||'',modo:'local',acessosHoje:local.acessosHoje??null,templateEnviadoAoServidor:false}));
      if(once)stop(local.autorizado?0:4);
      return;
    }
  }catch(error){console.error(\`[BIOMETRIA] motor local falhou; usando fallback online: \${error.message}\`);}
  finally{requestInFlight=false;}
  await sendIdentifiedOnline(evt, true);
}

${a}`,'wrapper local');
}
const oldStatus=`result = { ok: true, conectado: Boolean(monitor) || biometricMode === 'cadastro', monitorAtivo: Boolean(monitor), monitorSaudavel: monitorHealthy, modo: biometricMode, cadastroEmAndamento: biometricMode === 'cadastro', modoExclusivo: modoCadastroExclusivo, sensor: 'Futronic FS80', tenantId, templateExposto: false };`;
if(side.includes(oldStatus))side=side.replace(oldStatus,oldStatus.replace('templateExposto: false','templateExposto: false, motorLocal: localAccessEngine.status()'));
if(!side.includes('localAccessEngine.stop();'))side=rep(side,'  try { monitor?.kill(); } catch {}\n  setTimeout(() => process.exit(code), 50);','  try { monitor?.kill(); } catch {}\n  try { localAccessEngine.stop(); } catch {}\n  setTimeout(() => process.exit(code), 50);','stop local');
write('scripts/fusion-biometria-sidecar.mjs',side);

console.log('[5/8] Protegendo templates DPAPI contra perda...');
let cs=read('scripts/biometria/FusionBiometriaFs80.cs');
if(!cs.includes('AtomicWriteTemplate')){
  const a=`    private static string FileFor(string tenantId, string alunoId)
    {
        using (var sha = SHA256.Create())
        {
            string name = Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(alunoId))) + ".dpapi";
            return Path.Combine(StoreDirForTenant(tenantId), name);
        }
    }`;
  cs=rep(cs,a,a+`

    private static string BackupDirForTenant(string tenantId)
    {
        return Path.Combine(BaseStoreDir, "backups", "tenants", TenantHash(tenantId));
    }

    private static void AtomicWriteTemplate(string tenantId, string alunoId, byte[] protectedBytes)
    {
        string target=FileFor(tenantId,alunoId);
        Directory.CreateDirectory(Path.GetDirectoryName(target));
        string temp=target+".tmp-"+Guid.NewGuid().ToString("N");
        try
        {
            using(var stream=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None,4096,FileOptions.WriteThrough))
            {
                stream.Write(protectedBytes,0,protectedBytes.Length);
                stream.Flush(true);
            }
            if(File.Exists(target))
            {
                string backupDir=BackupDirForTenant(tenantId);Directory.CreateDirectory(backupDir);
                string backup=Path.Combine(backupDir,Path.GetFileName(target)+"."+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")+".bak");
                File.Replace(temp,target,backup,true);
            }
            else File.Move(temp,target);
        }
        finally { if(File.Exists(temp))File.Delete(temp); }
    }

    private static void ArchiveDeletedTemplate(string tenantId,string source)
    {
        string dir=Path.Combine(BaseStoreDir,"deleted-backups","tenants",TenantHash(tenantId));Directory.CreateDirectory(dir);
        string dst=Path.Combine(dir,Path.GetFileName(source)+"."+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")+"."+Guid.NewGuid().ToString("N").Substring(0,8)+".bak");
        File.Move(source,dst);
    }`,'template helpers');
  cs=rep(cs,'                File.WriteAllBytes(FileFor(tenantId, alunoId), protectedBytes);','                AtomicWriteTemplate(tenantId, alunoId, protectedBytes);','atomic write');
  cs=rep(cs,'        bool removido = File.Exists(file);\n        if (removido) File.Delete(file);','        bool removido = File.Exists(file);\n        if (removido) ArchiveDeletedTemplate(tenantId, file);','safe delete');
}
write('scripts/biometria/FusionBiometriaFs80.cs',cs);

console.log('[6/8] Validando e compilando...');
for(const f of ['modules/access-bridge/access-bridge.repository.mjs','modules/access-bridge/access-bridge.routes.mjs','scripts/fusion-access-local-engine.mjs','scripts/fusion-biometria-sidecar.mjs'])execFileSync(process.execPath,['--check',P(...f.split('/'))],{stdio:'inherit'});
execFileSync('cmd.exe',['/d','/c','scripts\\biometria\\COMPILAR-BIOMETRIA-FS80.bat'],{cwd:repo,stdio:'inherit'});

console.log('[7/8] Criando commit e enviando...');
const tracked=['modules/access-bridge/access-bridge.repository.mjs','modules/access-bridge/access-bridge.routes.mjs','scripts/fusion-access-local-engine.mjs','scripts/fusion-biometria-sidecar.mjs','scripts/biometria/FusionBiometriaFs80.cs'];
execFileSync('git',['add','--',...tracked],{cwd:repo,stdio:'inherit'});
execFileSync('git',['diff','--cached','--check'],{cwd:repo,stdio:'inherit'});
const names=execFileSync('git',['diff','--cached','--name-only'],{cwd:repo,encoding:'utf8'}).trim();
if(names){
  execFileSync('git',['commit','-m','feat: adiciona motor local offline para biometria'],{cwd:repo,stdio:'inherit'});
  try{execFileSync('git',['push'],{cwd:repo,stdio:'inherit'});console.log('[OK] Codigo enviado ao GitHub.');}
  catch{console.log('[AVISO] Commit local criado, mas git push falhou.');}
}else console.log('[OK] Nenhuma nova alteracao para commit.');

console.log('[8/8] Reiniciando somente biometria...');
try{execFileSync('schtasks.exe',['/End','/TN','Fusion Biometria FS80'],{stdio:'ignore'});}catch{}
try{
  const csv=execFileSync('wmic.exe',['process','where',"Name='node.exe'",'get','ProcessId,CommandLine','/format:csv'],{encoding:'utf8',windowsHide:true});
  for(const line of csv.split(/\r?\n/)){if(!line.includes('fusion-biometria-sidecar.mjs'))continue;const pid=line.split(',').at(-1)?.trim();if(/^\d+$/.test(pid||''))try{execFileSync('taskkill.exe',['/PID',pid,'/F'],{stdio:'ignore'});}catch{}}
}catch{}
try{execFileSync('schtasks.exe',['/Run','/TN','Fusion Biometria FS80'],{stdio:'inherit'});console.log('[OK] Biometria reiniciada.');}catch{console.log('[AVISO] Tarefa biometrica nao iniciou automaticamente.');}

console.log('');
console.log('============================================================');
console.log('MOTOR_LOCAL_FS80_V1_INSTALADO');
console.log('SQLite: data\\fusion-access-local\\academia-piloto.sqlite');
console.log('ALUNO: maximo 3 liberacoes biometricas/dia.');
console.log('ADMIN/PROFESSOR/RECEPCAO/GERENTE: sem limite diario.');
console.log('BLOQUEIO EXPLICITO: sempre prevalece.');
console.log('TEMPLATES: DPAPI fora do SQLite + backup atomico.');
console.log('FALLBACK ONLINE: ativo ate primeiro snapshot local.');
console.log('============================================================');
