// PROFESSOR PONTO / BANCO DE HORAS / REMUNERACAO 20260826
import { randomUUID } from "node:crypto";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { buscarProfessorPorId } from "../professores/professores.repository.mjs";

const CFG = "professor_ponto_config.json";
const AJU = "professor_ponto_ajustes.json";
const AUL = "professor_horas_aula.json";
const TZ = "America/Maceio";
const DIAS = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];

const texto = (v="") => String(v ?? "").trim();
const norm = (v="") => texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const inteiro = (v,d=0) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : d;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const dataOk = (v="") => /^\d{4}-\d{2}-\d{2}$/.test(texto(v)) ? texto(v) : "";
const horaOk = (v="") => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(texto(v).slice(0,5)) ? texto(v).slice(0,5) : "";

function localPartes(d=new Date()){
  const f=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const o={}; for(const p of f.formatToParts(d)) if(p.type!=="literal") o[p.type]=p.value;
  return {data:`${o.year}-${o.month}-${o.day}`,hora:`${o.hour}:${o.minute}:${o.second}`};
}
const hoje = () => localPartes().data;
const mesAtual = () => hoje().slice(0,7);
const mesOk = (v="") => /^\d{4}-\d{2}$/.test(texto(v)) ? texto(v) : mesAtual();

function addDias(data,n){ const d=new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
const primeiroMes = (m) => `${m}-01`;
function primeiroProximoMes(m){ const [a,mm]=m.split("-").map(Number); return new Date(Date.UTC(a,mm,1)).toISOString().slice(0,10); }
const ultimoMes = (m) => addDias(primeiroProximoMes(m),-1);

function diaSemana(data){ return DIAS[new Date(`${data}T12:00:00-03:00`).getUTCDay()]; }
function minHora(h){ h=horaOk(h); if(!h)return null; const [a,b]=h.split(":").map(Number); return a*60+b; }
function duracao(inicio,fim){ const a=minHora(inicio),b=minHora(fim); if(a===null||b===null)return 0; return b>a?b-a:(1440-a)+b; }

function centavos(v){
  if(v===null||v===undefined||v==="")return 0;
  if(typeof v==="number")return Math.round(v*100);
  let s=texto(v).replace(/[R$\s]/g,"");
  if(s.includes(","))s=s.replace(/\./g,"").replace(",","."); else s=s.replace(/[^\d.-]/g,"");
  const n=Number(s); return Number.isFinite(n)?Math.round(n*100):0;
}
const jornadaVazia=()=>({segunda:[],terca:[],quarta:[],quinta:[],sexta:[],sabado:[],domingo:[]});
function segs(v){ return (Array.isArray(v)?v:[]).slice(0,2).map(x=>({inicio:horaOk(x?.inicio),fim:horaOk(x?.fim)})).filter(x=>x.inicio&&x.fim&&x.inicio!==x.fim); }
function jornada(v={}){ const o=jornadaVazia(); for(const d of DIAS)o[d]=segs(v?.[d]); return o; }
function cfgPadrao(p={}){ return {professorId:texto(p.id),controlePontoAtivo:false,inicioApuracao:hoje(),toleranciaMinutos:5,bancoInicialMinutos:0,jornada:jornadaVazia(),duracaoHoraAulaMinutos:60,valorHoraAulaCentavos:Math.max(0,centavos(p.valorHora)),atualizadoEm:"",atualizadoPor:""}; }
async function lista(nome){ const x=await lerJsonDuravel(nome,[]); return Array.isArray(x)?x:[]; }
async function professor(id){ const p=await buscarProfessorPorId(id); if(!p){const e=new Error("Professor não encontrado.");e.status=404;throw e;} return p; }
async function config(p){ const all=await lista(CFG); const x=all.find(i=>texto(i.professorId)===texto(p.id)); return x?{...cfgPadrao(p),...x,professorId:texto(p.id),jornada:jornada(x.jornada)}:cfgPadrao(p); }
const atorNome=(a={})=>texto(a.nome||a.name||a.email||a.id||"sistema");

function previsto(cfg,data){
  if(!cfg?.controlePontoAtivo)return {dia:diaSemana(data),segmentos:[],minutos:0,inicio:"",fim:""};
  const s=segs(cfg.jornada?.[diaSemana(data)]);
  return {dia:diaSemana(data),segmentos:s,minutos:s.reduce((n,x)=>n+duracao(x.inicio,x.fim),0),inicio:s[0]?.inicio||"",fim:s.at(-1)?.fim||""};
}
function instanteLocal(data,hora){
  if(!dataOk(data)||!horaOk(hora))return "";
  const d=new Date(`${data}T${horaOk(hora)}:00-03:00`); return Number.isNaN(d.getTime())?"":d.toISOString();
}
function fimPrevistoMs(cfg,data){
  const p=previsto(cfg,data); if(!p.fim)return null;
  let ms=Date.parse(instanteLocal(data,p.fim)); const ini=minHora(p.inicio),fim=minHora(p.fim);
  if(ini!==null&&fim!==null&&fim<=ini)ms+=86400000;
  return ms;
}

async function eventosCatraca(professorId,inicio,fim){
  let sb=null; try{sb=obterSupabaseAdmin();}catch{}
  if(!sb)return {disponivel:false,aviso:"Integração da catraca indisponível.",eventos:[]};
  const de=new Date(`${addDias(inicio,-1)}T00:00:00-03:00`).toISOString();
  const ate=new Date(`${addDias(fim,2)}T00:00:00-03:00`).toISOString();
  const rows=[];
  for(let pg=0;pg<50;pg++){
    const a=pg*1000,b=a+999;
    const {data,error}=await sb.from("fusion_edge_access_events")
      .select("event_id,student_id,direction,authorized,physical_confirmed,occurred_at,source,payload")
      .eq("tenant_id",tenantAtual()).eq("student_id",professorId).eq("authorized",true).eq("physical_confirmed",true)
      .gte("occurred_at",de).lt("occurred_at",ate).order("occurred_at",{ascending:true}).range(a,b);
    if(error)return {disponivel:false,aviso:`Falha ao consultar a catraca: ${texto(error.message).slice(0,200)}`,eventos:[]};
    const part=Array.isArray(data)?data:[]; rows.push(...part); if(part.length<1000)break;
  }
  const eventos=rows.filter(r=>{
    const p=r?.payload&&typeof r.payload==="object"&&!Array.isArray(r.payload)?r.payload:{};
    const t=norm(p.personType||p.person_type||p.pessoaTipo),role=norm(p.role||p.perfil);
    return (!t&&!role)||t==="professor"||role==="professor";
  }).map(r=>{
    const loc=localPartes(new Date(r.occurred_at));
    return {id:`edge:${r.event_id||randomUUID()}`,eventoId:texto(r.event_id),professorId,instante:r.occurred_at,data:loc.data,hora:loc.hora.slice(0,5),direcao:norm(r.direction).includes("saida")?"saida":"entrada",origem:"catraca",origemDetalhe:texto(r.source||"fusion-biometria-local"),fisico:true,imutavel:true,motivo:""};
  }).filter(e=>e.data>=inicio&&e.data<=fim);
  return {disponivel:true,aviso:"",eventos};
}

async function manuais(professorId,inicio,fim){
  return (await lista(AJU)).filter(x=>texto(x.professorId)===texto(professorId)&&x.tipo==="marcacao"&&x.cancelado!==true&&dataOk(x.data)>=inicio&&dataOk(x.data)<=fim)
    .map(x=>({id:texto(x.id),professorId:texto(x.professorId),instante:texto(x.instante)||instanteLocal(x.data,x.hora),data:dataOk(x.data),hora:horaOk(x.hora),direcao:norm(x.direcao).includes("saida")?"saida":"entrada",origem:"ajuste_manual",origemDetalhe:texto(x.criadoPor),fisico:false,imutavel:true,motivo:texto(x.motivo)}));
}
function ordena(v){ return [...v].sort((a,b)=>(Date.parse(a.instante)||0)-(Date.parse(b.instante)||0)||texto(a.id).localeCompare(texto(b.id))); }

function calculaDia(data,eventos,cfg,agora=new Date()){
  const marcas=[],an=[]; let dentro=false,aberta=null,saida=null,tr=0,fora=0,ev=0,sv=0;
  for(const e of ordena(eventos)){
    const ts=Date.parse(e.instante||instanteLocal(e.data,e.hora)); if(!Number.isFinite(ts))continue;
    let considerada=true,anomalia="";
    if(e.direcao==="entrada"){
      if(dentro){considerada=false;anomalia="Entrada consecutiva";an.push(`${e.hora} entrada consecutiva`);}
      else{ if(saida!==null&&ts>saida)fora+=Math.max(0,Math.round((ts-saida)/60000)); dentro=true;aberta=ts;ev++; }
    }else{
      if(!dentro||aberta===null){considerada=false;anomalia="Saída sem entrada aberta";an.push(`${e.hora} saída sem entrada`);}
      else{tr+=Math.max(0,Math.round((ts-aberta)/60000));dentro=false;aberta=null;saida=ts;sv++;}
    }
    marcas.push({...e,considerada,anomalia});
  }
  const hj=hoje(),now=agora.getTime(); let trp=tr,forap=fora;
  if(data===hj&&dentro&&aberta!==null&&now>aberta)trp+=Math.round((now-aberta)/60000);
  if(data===hj&&!dentro&&saida!==null&&ev>0&&now>saida){
    const fim=fimPrevistoMs(cfg,data),lim=Number.isFinite(fim)?Math.min(now,fim):now;
    if(lim>saida)forap+=Math.round((lim-saida)/60000);
  }
  const p=previsto(cfg,data), tol=clamp(inteiro(cfg?.toleranciaMinutos,0),0,60);
  let saldo=trp-p.minutos; if(Math.abs(saldo)<=tol)saldo=0;
  const first=marcas.find(m=>m.considerada&&m.direcao==="entrada");
  const outs=marcas.filter(m=>m.considerada&&m.direcao==="saida");
  const last=outs.at(-1);
  const tem=ev>0||sv>0, fechado=tem&&!dentro&&ev>0&&ev===sv;
  let status=p.minutos===0?"folga":"sem_marcacao"; if(dentro)status="dentro"; else if(tem)status=fechado?"fechado":"incompleto";
  return {data,diaSemana:p.dia,status,dentroAgora:data===hj?dentro:false,primeiraEntrada:first?.hora||"",ultimaSaida:last?.hora||"",trabalhadoMinutos:trp,foraMinutos:forap,previstoMinutos:p.minutos,saldoMinutos:saldo,computaBanco:cfg?.controlePontoAtivo===true&&data<hj&&p.minutos>0&&fechado,anomalias:an,marcas};
}

async function ajustesBanco(professorId){
  return (await lista(AJU)).filter(x=>texto(x.professorId)===texto(professorId)&&x.tipo==="banco"&&x.cancelado!==true)
    .map(x=>({id:texto(x.id),professorId:texto(x.professorId),data:dataOk(x.data),minutos:inteiro(x.minutos),motivo:texto(x.motivo),criadoEm:texto(x.criadoEm),criadoPor:texto(x.criadoPor)})).filter(x=>x.data);
}
async function aulasMes(professorId,mes){ return (await lista(AUL)).filter(x=>texto(x.professorId)===texto(professorId)&&dataOk(x.data).startsWith(mes)).sort((a,b)=>`${b.data}${b.criadoEm||""}`.localeCompare(`${a.data}${a.criadoEm||""}`)); }
function resumoAulas(v,dur=60){
  const at=v.filter(x=>x.status!=="cancelado"),ap=at.filter(x=>x.status==="aprovado"),pe=at.filter(x=>x.status==="pendente");
  const sum=(x,c)=>x.reduce((s,i)=>s+inteiro(i[c]),0),mins=sum(at,"minutos"),d=Math.max(1,inteiro(dur,60));
  return {minutos:mins,horasAulaEquivalentes:Number((mins/d).toFixed(2)),valorEstimadoCentavos:sum(at,"valorCentavos"),valorAprovadoCentavos:sum(ap,"valorCentavos"),valorPendenteCentavos:sum(pe,"valorCentavos"),quantidade:at.length,aprovadas:ap.length,pendentes:pe.length};
}

export async function obterPontoProfessor(professorId,filtros={}){
  const p=await professor(professorId),c=await config(p),mes=mesOk(filtros.mes),hj=hoje(),iniM=primeiroMes(mes),fimM=ultimoMes(mes);
  const iniAp=dataOk(c.inicioApuracao)||hj, ini=iniAp<iniM?iniAp:iniM, fim=fimM>hj?hj:fimM;
  let cat={disponivel:true,aviso:"",eventos:[]},man=[];
  if(fim>=ini)[cat,man]=await Promise.all([eventosCatraca(texto(p.id),ini,fim),manuais(texto(p.id),ini,fim)]);
  const todos=ordena([...cat.eventos,...man]),por=new Map();
  for(const e of todos){if(!por.has(e.data))por.set(e.data,[]);por.get(e.data).push(e);}
  const calc=new Map();
  if(fim>=ini)for(let d=ini;d<=fim;d=addDias(d,1))calc.set(d,calculaDia(d,por.get(d)||[],c));
  const aj=await ajustesBanco(texto(p.id)),cut=fimM<hj?fimM:addDias(hj,-1);
  const sd=[...calc.values()].filter(d=>d.data>=iniAp&&d.data<=cut&&d.computaBanco).reduce((s,d)=>s+d.saldoMinutos,0);
  const sa=aj.filter(x=>x.data>=iniAp&&x.data<=cut).reduce((s,x)=>s+x.minutos,0);
  const banco=inteiro(c.bancoInicialMinutos)+sd+sa;
  const limite=mes===hj.slice(0,7)?hj:(mes<hj.slice(0,7)?fimM:"");
  const dias=[]; if(limite)for(let d=iniM;d<=limite;d=addDias(d,1))dias.push(calc.get(d)||calculaDia(d,[],c));
  const hd=calc.get(hj)||calculaDia(hj,por.get(hj)||[],c);
  const itens=await aulasMes(texto(p.id),mes),ra=resumoAulas(itens,c.duracaoHoraAulaMinutos);
  return {ok:true,professor:{id:texto(p.id),nome:texto(p.nome||p.nomeCompleto),status:texto(p.status),perfil:texto(p.perfil||p.role)},mes,config:c,catraca:{disponivel:cat.disponivel,aviso:cat.aviso,eventosFisicosNoPeriodo:cat.eventos.length},hoje:hd,banco:{minutos:banco,inicialMinutos:inteiro(c.bancoInicialMinutos),saldoDiasMinutos:sd,ajustesMinutos:sa,ateData:cut},resumoMes:{trabalhadoMinutos:dias.reduce((s,d)=>s+d.trabalhadoMinutos,0),foraMinutos:dias.reduce((s,d)=>s+d.foraMinutos,0),previstoMinutos:dias.reduce((s,d)=>s+d.previstoMinutos,0),saldoComputadoMinutos:dias.filter(d=>d.computaBanco).reduce((s,d)=>s+d.saldoMinutos,0),diasComMarcacao:dias.filter(d=>d.marcas.length).length,diasIncompletos:dias.filter(d=>d.status==="incompleto").length},dias,marcacoes:todos.filter(e=>e.data.startsWith(mes)),ajustesBanco:aj.filter(x=>x.data.startsWith(mes)),horasAula:{...ra,itens}};
}

export async function salvarConfigPontoProfessor(professorId,payload={},ator={}){
  const p=await professor(professorId),all=await lista(CFG),id=texto(p.id),idx=all.findIndex(x=>texto(x.professorId)===id),ant=idx>=0?all[idx]:cfgPadrao(p);
  const novo={...cfgPadrao(p),...ant,professorId:id,controlePontoAtivo:payload.controlePontoAtivo===true,inicioApuracao:dataOk(payload.inicioApuracao)||dataOk(ant.inicioApuracao)||hoje(),toleranciaMinutos:clamp(inteiro(payload.toleranciaMinutos,ant.toleranciaMinutos??5),0,60),bancoInicialMinutos:clamp(inteiro(payload.bancoInicialMinutos,ant.bancoInicialMinutos??0),-600000,600000),jornada:jornada(payload.jornada??ant.jornada),duracaoHoraAulaMinutos:clamp(inteiro(payload.duracaoHoraAulaMinutos,ant.duracaoHoraAulaMinutos??60),15,240),valorHoraAulaCentavos:payload.valorHoraAulaCentavos!==undefined?Math.max(0,inteiro(payload.valorHoraAulaCentavos)):Math.max(0,centavos(payload.valorHoraAula??(ant.valorHoraAulaCentavos/100))),atualizadoEm:new Date().toISOString(),atualizadoPor:atorNome(ator)};
  if(idx>=0)all[idx]=novo;else all.push(novo);await salvarJsonDuravel(CFG,all);return {ok:true,config:novo};
}
export async function lancarMarcacaoManual(professorId,payload={},ator={}){
  await professor(professorId);const data=dataOk(payload.data),hora=horaOk(payload.hora),direcao=norm(payload.direcao).includes("saida")?"saida":"entrada",motivo=texto(payload.motivo);
  if(!data||!hora){const e=new Error("Informe data e hora válidas para a marcação.");e.status=400;throw e;} if(motivo.length<3){const e=new Error("Informe o motivo do ajuste manual.");e.status=400;throw e;}
  const all=await lista(AJU),item={id:`ptm_${randomUUID()}`,tipo:"marcacao",professorId:texto(professorId),data,hora,instante:instanteLocal(data,hora),direcao,motivo,origem:"ajuste_manual",cancelado:false,criadoEm:new Date().toISOString(),criadoPor:atorNome(ator),criadoPorId:texto(ator.id)};
  all.push(item);await salvarJsonDuravel(AJU,all);return {ok:true,marcacao:item};
}
export async function lancarAjusteBancoProfessor(professorId,payload={},ator={}){
  await professor(professorId);const data=dataOk(payload.data)||hoje(),minutos=inteiro(payload.minutos),motivo=texto(payload.motivo);
  if(!minutos){const e=new Error("Informe horas positivas ou negativas para o ajuste.");e.status=400;throw e;} if(motivo.length<3){const e=new Error("Informe o motivo do ajuste do banco de horas.");e.status=400;throw e;}
  const all=await lista(AJU),item={id:`ptb_${randomUUID()}`,tipo:"banco",professorId:texto(professorId),data,minutos,motivo,cancelado:false,criadoEm:new Date().toISOString(),criadoPor:atorNome(ator),criadoPorId:texto(ator.id)};
  all.push(item);await salvarJsonDuravel(AJU,all);return {ok:true,ajuste:item};
}
export async function lancarHoraAulaProfessor(professorId,payload={},ator={}){
  const p=await professor(professorId),c=await config(p),data=dataOk(payload.data)||hoje(),minutos=inteiro(payload.minutos),desc=texto(payload.descricao||"Hora-aula"),dur=clamp(inteiro(c.duracaoHoraAulaMinutos,60),15,240),vh=Math.max(0,inteiro(c.valorHoraAulaCentavos));
  if(minutos<=0){const e=new Error("Informe a quantidade de horas-aula.");e.status=400;throw e;} if(vh<=0){const e=new Error("Configure o valor da hora-aula antes de lançar.");e.status=400;throw e;}
  const now=new Date().toISOString(),item={id:`pha_${randomUUID()}`,professorId:texto(professorId),data,minutos,descricao:desc,duracaoHoraAulaMinutos:dur,valorHoraAulaCentavos:vh,valorCentavos:Math.round(vh*minutos/dur),status:"pendente",criadoEm:now,criadoPor:atorNome(ator),criadoPorId:texto(ator.id),aprovadoEm:"",aprovadoPor:"",atualizadoEm:now,historico:[{acao:"lancado",status:"pendente",em:now,por:atorNome(ator)}]};
  const all=await lista(AUL);all.push(item);await salvarJsonDuravel(AUL,all);return {ok:true,horaAula:item};
}
export async function atualizarHoraAulaProfessor(professorId,lancamentoId,payload={},ator={}){
  await professor(professorId);const st=norm(payload.status);if(!["pendente","aprovado","cancelado"].includes(st)){const e=new Error("Status de hora-aula inválido.");e.status=400;throw e;}
  const all=await lista(AUL),i=all.findIndex(x=>texto(x.id)===texto(lancamentoId)&&texto(x.professorId)===texto(professorId));if(i<0){const e=new Error("Lançamento de hora-aula não encontrado.");e.status=404;throw e;}
  const now=new Date().toISOString(),a=all[i];all[i]={...a,status:st,atualizadoEm:now,atualizadoPor:atorNome(ator),aprovadoEm:st==="aprovado"?now:(st==="pendente"?"":a.aprovadoEm||""),aprovadoPor:st==="aprovado"?atorNome(ator):(st==="pendente"?"":a.aprovadoPor||""),historico:[...(Array.isArray(a.historico)?a.historico:[]),{acao:"status",status:st,em:now,por:atorNome(ator),motivo:texto(payload.motivo)}]};
  await salvarJsonDuravel(AUL,all);return {ok:true,horaAula:all[i]};
}
