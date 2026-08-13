import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SUPABASE_URL = 'https://lsxogdipdagouqddgymd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzeG9nZGlwZGFnb3VxZGRneW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzc4MjMsImV4cCI6MjA5ODc1MzgyM30.y0D4ynOw_A9ugPQK8KduHgkPknsuWzNAJ6KqfzAliDk';

const norm = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const bool = value => value === true || ['1','true','sim','yes','on'].includes(norm(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function safeJson(value, fallback = {}) { try { return JSON.parse(String(value || '')); } catch { return fallback; } }
function paidStatus(value) { return ['pago','paga','recebido','recebida','baixado','baixada','quitado','quitada','liquidado','liquidada','cancelado','cancelada','isento','isenta','estornado','estornada'].includes(norm(value)); }
function blockedStatus(value) { return ['bloqueado','bloqueada','cancelado','cancelada','inativo','inativa','suspenso','suspensa'].includes(norm(value)); }
function activeStatus(value) { return ['ativo','ativa','ok','liberado','liberada','adimplente'].includes(norm(value)); }
function normalizeRole(profile, collection = '') {
  const p = norm(profile);
  if (collection === 'alunos' || p === 'aluno') return 'aluno';
  if (collection === 'professores') return 'professor';
  if (['administrador','admin'].includes(p)) return 'admin';
  if (['professor','responsavel_tecnico','instrutor'].includes(p)) return 'professor';
  if (['recepcao','recepcionista'].includes(p)) return 'recepcao';
  if (['gerente','gestor'].includes(p)) return 'gerente';
  return p || 'desconhecido';
}
function localDate(timeZone = 'America/Maceio', date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function dateOnly(value) { const s=String(value||'').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''; }
function latestBy(rows) {
  return [...rows].sort((a,b) => String(b.atualizadoEm||b.criadoEm||b.dataMatricula||'').localeCompare(String(a.atualizadoEm||a.criadoEm||a.dataMatricula||'')))[0] || null;
}
const randomId = () => `edge_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

async function rpc(name, body, timeoutMs = 12000) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method:'POST',
    headers:{ apikey:SUPABASE_ANON_KEY, authorization:`Bearer ${SUPABASE_ANON_KEY}`, 'content-type':'application/json' },
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(timeoutMs)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.hint || data?.details || `HTTP ${response.status}`);
  return data;
}

function readHenryResponse(socket, timeoutMs = 3000) {
  return new Promise((resolve,reject) => {
    const chunks=[]; let quiet=null; let done=false;
    const finish=(error=null)=>{
      if(done)return; done=true; clearTimeout(deadline); if(quiet)clearTimeout(quiet);
      socket.off('data',onData); socket.off('close',onClose);
      if(error)reject(error); else resolve(Buffer.concat(chunks).toString('hex').toUpperCase());
    };
    const onData=chunk=>{ chunks.push(Buffer.from(chunk)); if(quiet)clearTimeout(quiet); quiet=setTimeout(()=>finish(),140); };
    const onClose=()=>chunks.length?finish():finish(new Error('Conexao Henry encerrada sem resposta'));
    const deadline=setTimeout(()=>finish(chunks.length?null:new Error('Timeout aguardando resposta Henry')),timeoutMs);
    socket.on('data',onData); socket.once('close',onClose);
  });
}
async function releaseHenry(host, port) {
  const socket=net.createConnection({host,port:Number(port)}); socket.setNoDelay(true);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Timeout conectando na Henry')),3500);
    socket.once('connect',()=>{clearTimeout(timer);resolve();});
    socket.once('error',e=>{clearTimeout(timer);reject(e);});
  });
  try {
    socket.write(Buffer.from('FE8A7100010100050000','hex'));
    const r1=await readHenryResponse(socket);
    if(r1!=='018A7100010000FB') throw new Error(`Henry nao confirmou etapa 1 (${r1||'sem resposta'})`);
    await sleep(350);
    socket.write(Buffer.from('FE8671000201000A030506','hex'));
    const r2=await readHenryResponse(socket);
    if(r2!=='01867100020000F4') throw new Error(`Henry nao confirmou etapa 2 (${r2||'sem resposta'})`);
    return true;
  } finally { socket.destroy(); }
}

export class FusionLocalAccessEngine {
  constructor({tenantId,agentId,token,equipmentId,host,port}) {
    this.tenantId=tenantId; this.agentId=agentId; this.token=token; this.equipmentId=equipmentId;
    this.host=host||process.env.ACCESS_HOST||process.env.HENRY7X_HOST||'10.0.0.236';
    this.port=Number(port||process.env.ACCESS_PORT||process.env.HENRY7X_PORT||3000);
    this.timeZone='America/Maceio'; this.syncing=false; this.pushing=false; this.releasing=false; this.timer=null; this.started=false;
    const base=path.resolve(process.cwd(),'data','fusion-access-local'); fs.mkdirSync(base,{recursive:true});
    this.dbPath=path.join(base,`${tenantId.replace(/[^a-z0-9_.-]/gi,'_')}.sqlite`);
    this.db=new DatabaseSync(this.dbPath);
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS raw_records(collection TEXT NOT NULL,record_id TEXT NOT NULL,updated_at TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(collection,record_id));
      CREATE TABLE IF NOT EXISTS persons(person_id TEXT PRIMARY KEY,person_type TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0,explicit_blocked INTEGER NOT NULL DEFAULT 0,access_allowed INTEGER NOT NULL DEFAULT 0,access_reason TEXT NOT NULL DEFAULT '',membership_id TEXT,daily_limit INTEGER,source_updated_at TEXT,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_access(person_id TEXT NOT NULL,local_date TEXT NOT NULL,server_count INTEGER NOT NULL DEFAULT 0,local_count INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(person_id,local_date));
      CREATE TABLE IF NOT EXISTS events(event_id TEXT PRIMARY KEY,person_id TEXT,person_type TEXT,role TEXT,membership_id TEXT,direction TEXT NOT NULL,authorized INTEGER NOT NULL,physical_confirmed INTEGER NOT NULL,reason TEXT NOT NULL,far INTEGER,occurred_at TEXT NOT NULL,local_date TEXT NOT NULL,offline INTEGER NOT NULL DEFAULT 0,synced INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL DEFAULT '{}');
      CREATE INDEX IF NOT EXISTS events_unsynced_idx ON events(synced,occurred_at);
      CREATE TABLE IF NOT EXISTS sync_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    `);
  }
  state(key,fallback=''){ return this.db.prepare('SELECT value FROM sync_state WHERE key=?').get(key)?.value ?? fallback; }
  setState(key,value){ this.db.prepare('INSERT INTO sync_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(value??'')); }
  ready(){ return this.state('initial_sync_complete')==='1'; }
  getPerson(id){ return this.db.prepare('SELECT * FROM persons WHERE person_id=?').get(String(id||''))||null; }
  counts(id,d=localDate(this.timeZone)){ const r=this.db.prepare('SELECT server_count,local_count FROM daily_access WHERE person_id=? AND local_date=?').get(id,d); return {server:Number(r?.server_count||0),local:Number(r?.local_count||0),total:Number(r?.server_count||0)+Number(r?.local_count||0)}; }
  start(){ if(this.started)return; this.started=true; void this.syncNow(true); this.timer=setInterval(()=>{void this.syncNow(false);void this.pushPending();},1000); }
  stop(){ if(this.timer)clearInterval(this.timer); try{this.db.close();}catch{} }
  async syncNow(forceFull=false){
    if(this.syncing)return false; this.syncing=true;
    try{
      const cursor=this.state('cursor')||null; const full=forceFull||!cursor||!this.ready();
      const data=await rpc('fusion_edge_pull',{p_tenant_id:this.tenantId,p_agent_id:this.agentId,p_token:this.token,p_since:full?null:cursor,p_full:full});
      this.timeZone=data.timezone||this.timeZone;
      const records=Array.isArray(data.records)?data.records:[];
      if(full)this.db.exec('DELETE FROM raw_records;');
      const upsert=this.db.prepare('INSERT INTO raw_records(collection,record_id,updated_at,payload) VALUES(?,?,?,?) ON CONFLICT(collection,record_id) DO UPDATE SET updated_at=excluded.updated_at,payload=excluded.payload');
      this.db.exec('BEGIN IMMEDIATE');
      try{
        for(const rec of records){ if(rec?.collection&&rec?.recordId)upsert.run(rec.collection,rec.recordId,rec.updatedAt||new Date().toISOString(),JSON.stringify(rec.payload||{})); }
        if(data.cursor)this.setState('cursor',data.cursor); this.setState('last_sync_at',new Date().toISOString()); if(full)this.setState('initial_sync_complete','1'); this.db.exec('COMMIT');
      }catch(e){this.db.exec('ROLLBACK');throw e;}
      if(records.length||full)this.rebuildPeopleAndServerCounts();
      this.setState('last_sync_error',''); this.setState('last_online_at',new Date().toISOString());
      return true;
    }catch(error){ this.setState('last_sync_error',String(error.message||error).slice(0,300)); return false; }
    finally{this.syncing=false;}
  }
  allRecords(collection){ return this.db.prepare('SELECT record_id,updated_at,payload FROM raw_records WHERE collection=?').all(collection).map(r=>({recordId:r.record_id,updatedAt:r.updated_at,...safeJson(r.payload,{})})); }
  rebuildPeopleAndServerCounts(){
    const alunos=this.allRecords('alunos'),matriculas=this.allRecords('matriculas'),mensalidades=this.allRecords('mensalidades'),financeiro=this.allRecords('financeiro'),usuarios=this.allRecords('usuarios'),professores=this.allRecords('professores'),logs=this.allRecords('access_logs');
    const today=localDate(this.timeZone),people=[];
    for(const aluno of alunos){
      const personId=String(aluno.id||aluno.recordId||''); if(!personId)continue;
      const linked=String(aluno.matriculaId||'');
      const candidates=matriculas.filter(m=>(linked&&String(m.id||'')===linked)||String(m.alunoId||'')===personId);
      const matricula=(linked&&candidates.find(m=>String(m.id||'')===linked))||latestBy(candidates);
      let allowed=true,reason='Acesso local liberado';
      const alunoBlocked=bool(aluno.bloqueado)||bool(aluno.bloqueioCheckin)||blockedStatus(aluno.status)||blockedStatus(aluno.situacao);
      const matriculaBlocked=bool(matricula?.bloqueada)||bool(matricula?.bloqueioCheckin)||blockedStatus(matricula?.status);
      if(alunoBlocked||matriculaBlocked){allowed=false;reason=aluno.motivoBloqueio||matricula?.motivoBloqueio||'Aluno ou matricula bloqueada';}
      else if(!matricula||!activeStatus(matricula.status||aluno.statusMatricula||aluno.matriculaStatus||aluno.status)){allowed=false;reason='Matricula pendente, cancelada ou inativa';}
      else if(aluno.ativo===false&&!(activeStatus(aluno.status)&&activeStatus(matricula.status))){allowed=false;reason='Aluno inativo';}
      if(allowed){
        const pending=financeiro.some(f=>{const same=String(f.alunoId||'')===personId||(matricula?.id&&String(f.matriculaId||'')===String(matricula.id));const requires=bool(f.ativarMatriculaAoReceber)||norm(f.origem).includes('reativacao');return same&&requires&&!paidStatus(f.status||f.situacao);});
        if(pending){allowed=false;reason='Pagamento de ativacao ou reativacao pendente';}
      }
      if(allowed){
        const overdue=mensalidades.some(m=>{const same=String(m.alunoId||'')===personId||(matricula?.id&&String(m.matriculaId||'')===String(matricula.id));if(!same||paidStatus(m.statusPagamento||m.pagamento||m.status||m.situacao||m.estado))return false;if(['vencida','vencido','atrasada','atrasado','em atraso','inadimplente'].includes(norm(m.status||m.situacao||m.estado)))return true;const due=dateOnly(m.vencimento);return Boolean(due&&due<today);});
        if(overdue){allowed=false;reason='Pagamento em atraso';}
      }
      people.push({personId,personType:'aluno',role:'aluno',active:allowed||!alunoBlocked,explicitBlocked:alunoBlocked||matriculaBlocked,accessAllowed:allowed,accessReason:reason,membershipId:matricula?.id||linked||null,dailyLimit:3,sourceUpdatedAt:aluno.updatedAt||matricula?.updatedAt||''});
    }
    for(const [collection,rows] of [['usuarios',usuarios],['professores',professores]]){
      for(const p of rows){
        const personId=String(p.id||p.recordId||''); if(!personId)continue;
        const role=normalizeRole(p.perfil,collection); if(!['admin','professor','recepcao','gerente'].includes(role))continue;
        const explicitBlocked=bool(p.bloqueado)||bool(p.bloqueioCheckin)||blockedStatus(p.status);
        const active=p.ativo!==false&&(activeStatus(p.status||'ativo')||!p.status);
        people.push({personId,personType:collection==='professores'?'professor':'usuario',role,active,explicitBlocked,accessAllowed:active&&!explicitBlocked,accessReason:explicitBlocked?(p.motivoBloqueio||'Acesso bloqueado explicitamente'):active?'Acesso local liberado':'Perfil inativo',membershipId:null,dailyLimit:null,sourceUpdatedAt:p.updatedAt||''});
      }
    }
    const up=this.db.prepare('INSERT INTO persons(person_id,person_type,role,active,explicit_blocked,access_allowed,access_reason,membership_id,daily_limit,source_updated_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.exec('DELETE FROM persons;'); const now=new Date().toISOString();
      for(const p of people)up.run(p.personId,p.personType,p.role,p.active?1:0,p.explicitBlocked?1:0,p.accessAllowed?1:0,p.accessReason,p.membershipId,p.dailyLimit,p.sourceUpdatedAt,now);
      const serverCounts=new Map();
      for(const log of logs){if(!bool(log.autorizado)||norm(log.origem)!=='biometria-fs80'||String(log.direcao||'entrada')==='saida')continue;const when=new Date(log.criadoEm||log.updatedAt||0);if(Number.isNaN(when.getTime())||localDate(this.timeZone,when)!==today)continue;const id=String(log.alunoId||'');if(id)serverCounts.set(id,(serverCounts.get(id)||0)+1);}
      const upc=this.db.prepare('INSERT INTO daily_access(person_id,local_date,server_count,local_count,updated_at) VALUES(?,?,?,0,?) ON CONFLICT(person_id,local_date) DO UPDATE SET server_count=excluded.server_count,updated_at=excluded.updated_at');
      for(const [id,count] of serverCounts)upc.run(id,today,count,now);
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  insertEvent({person,authorized,physicalConfirmed,reason,far,offline}){
    const eventId=randomId(),occurredAt=new Date().toISOString(),d=localDate(this.timeZone);
    this.db.prepare("INSERT INTO events(event_id,person_id,person_type,role,membership_id,direction,authorized,physical_confirmed,reason,far,occurred_at,local_date,offline,synced,payload) VALUES(?,?,?,?,?,'entrada',?,?,?,?,?,?,?,0,'{}')").run(eventId,person?.person_id||null,person?.person_type||null,person?.role||null,person?.membership_id||null,authorized?1:0,physicalConfirmed?1:0,String(reason||''),Number.isFinite(Number(far))?Number(far):null,occurredAt,d,offline?1:0);
    return eventId;
  }
  incrementLocalCount(id,d){this.db.prepare('INSERT INTO daily_access(person_id,local_date,server_count,local_count,updated_at) VALUES(?,?,0,1,?) ON CONFLICT(person_id,local_date) DO UPDATE SET local_count=local_count+1,updated_at=excluded.updated_at').run(id,d,new Date().toISOString());}
  async handleIdentified(personId,far){
    if(!this.ready())return {handled:false,reason:'Banco local ainda sincronizando'};
    const person=this.getPerson(personId); if(!person)return {handled:false,reason:'Pessoa ainda nao existe no snapshot local'};
    const d=localDate(this.timeZone),offline=Boolean(this.state('last_sync_error'));
    if(!person.access_allowed||person.explicit_blocked){const reason=person.access_reason||'Acesso bloqueado';this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();return {handled:true,autorizado:false,motivo:reason,modo:'local'};}
    if(person.role==='aluno'){const count=this.counts(personId,d);if(count.total>=3){const reason='Limite de 3 acessos biometricos no dia atingido';this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();return {handled:true,autorizado:false,motivo:reason,modo:'local',acessosHoje:count.total};}}
    if(this.releasing)return {handled:true,autorizado:false,motivo:'Catraca processando acesso anterior',modo:'local'};
    this.releasing=true;
    try{
      await releaseHenry(this.host,this.port);
      if(person.role==='aluno')this.incrementLocalCount(personId,d);
      const count=person.role==='aluno'?this.counts(personId,d).total:null;
      const eventId=this.insertEvent({person,authorized:true,physicalConfirmed:true,reason:'Acesso local autorizado',far,offline});
      void this.pushPending();
      return {handled:true,autorizado:true,motivo:'Acesso local autorizado',modo:'local',eventId,acessosHoje:count};
    }catch(error){
      const reason=`Regra liberou, mas Henry nao confirmou: ${String(error.message||error).slice(0,160)}`;
      this.insertEvent({person,authorized:false,physicalConfirmed:false,reason,far,offline});void this.pushPending();
      return {handled:true,autorizado:false,motivo:reason,modo:'local'};
    }finally{this.releasing=false;}
  }
  async pushPending(){
    if(this.pushing)return false;
    const rows=this.db.prepare('SELECT * FROM events WHERE synced=0 ORDER BY occurred_at LIMIT 100').all(); if(!rows.length)return true;
    this.pushing=true;
    try{
      const events=rows.map(r=>({id:r.event_id,personId:r.person_id,personType:r.person_type,role:r.role,membershipId:r.membership_id,direction:r.direction,authorized:Boolean(r.authorized),physicalConfirmed:Boolean(r.physical_confirmed),reason:r.reason,far:r.far,occurredAt:r.occurred_at,localDate:r.local_date,offline:Boolean(r.offline)}));
      const data=await rpc('fusion_edge_push_events',{p_tenant_id:this.tenantId,p_agent_id:this.agentId,p_token:this.token,p_equipment_id:this.equipmentId,p_events:events});
      const accepted=new Set(Array.isArray(data.accepted)?data.accepted:[]),mark=this.db.prepare('UPDATE events SET synced=1 WHERE event_id=?');
      this.db.exec('BEGIN IMMEDIATE');try{for(const id of accepted)mark.run(id);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
      this.setState('last_event_sync_at',new Date().toISOString());return true;
    }catch(error){this.setState('last_event_sync_error',String(error.message||error).slice(0,300));return false;}
    finally{this.pushing=false;}
  }
  status(){
    return {ready:this.ready(),people:Number(this.db.prepare('SELECT count(*) AS c FROM persons').get()?.c||0),pendingEvents:Number(this.db.prepare('SELECT count(*) AS c FROM events WHERE synced=0').get()?.c||0),lastSyncAt:this.state('last_sync_at')||null,lastSyncError:this.state('last_sync_error')||null,db:path.basename(this.dbPath),dailyStudentLimit:3,unlimitedRoles:['admin','professor','recepcao','gerente'],templatesInDatabase:false};
  }
}
export function createLocalAccessEngine(config){const engine=new FusionLocalAccessEngine(config);engine.start();return engine;}
