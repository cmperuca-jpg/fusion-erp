import fs from 'node:fs/promises';
import path from 'node:path';

const DATA = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA, 'fidelidade_90_dias.json');
const CHECKINS = path.join(DATA, 'checkins.json');
const ALUNOS = path.join(DATA, 'alunos.json');
const META = 90;
const DESCONTO = 40;

async function ler(file, padrao = []) { try { return JSON.parse(await fs.readFile(file, 'utf8')) || padrao; } catch { return padrao; } }
async function salvar(file, dados) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(dados, null, 2), 'utf8'); }
function agora() { return new Date().toISOString(); }
function id(prefixo) { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
function liberado(c = {}) { return String(c.status || '').toLowerCase() === 'liberado' && c.alunoId; }
function minutos(c = {}) {
  if (!c.horaEntrada || !c.horaSaida) return 0;
  const [eh, em] = String(c.horaEntrada).split(':').map(Number); const [sh, sm] = String(c.horaSaida).split(':').map(Number);
  if (![eh,em,sh,sm].every(Number.isFinite)) return 0;
  let m = sh*60+sm-(eh*60+em); if (m < 0) m += 1440; return Math.max(0,m);
}
function nomePublico(nome='Aluno') { const p=String(nome).trim().split(/\s+/).filter(Boolean); return p.length<2?p[0]||'Aluno':`${p[0]} ${p[p.length-1][0]}.`; }

async function sincronizar() {
  const [checkins, alunos, base] = await Promise.all([ler(CHECKINS, []), ler(ALUNOS, []), ler(FILE, { alunos:{}, premios:[] })]);
  base.alunos ||= {}; base.premios ||= [];
  const porAluno = new Map();
  for (const c of checkins.filter(liberado)) {
    const aid=String(c.alunoId); const data=String(c.data || c.criadoEm || '').slice(0,10); if(!data) continue;
    if(!porAluno.has(aid)) porAluno.set(aid,new Map());
    const dias=porAluno.get(aid); const atual=dias.get(data); if(!atual || minutos(c)>minutos(atual)) dias.set(data,c);
  }
  for (const [alunoId,diasMap] of porAluno) {
    const dias=[...diasMap.keys()].sort();
    const aluno=alunos.find(a=>String(a.id||a._id)===alunoId)||{};
    const estado=base.alunos[alunoId] || { alunoId, ciclo:1, diasProcessados:[], presencasCiclo:0, premiosGerados:0 };
    const processados=new Set(estado.diasProcessados||[]);
    for (const data of dias) {
      if(processados.has(data)) continue;
      processados.add(data); estado.presencasCiclo=(estado.presencasCiclo||0)+1;
      if(estado.presencasCiclo>=META){
        base.premios.push({ id:id('premio'), alunoId, alunoNome:aluno.nome||aluno.alunoNome||'Aluno', ciclo:estado.ciclo||1, percentual:DESCONTO, status:'pendente', concluidoEm:`${data}T12:00:00.000Z`, mensalidadeId:'', aplicadoEm:'' });
        estado.presencasCiclo=0; estado.ciclo=(estado.ciclo||1)+1; estado.premiosGerados=(estado.premiosGerados||0)+1;
      }
    }
    estado.diasProcessados=[...processados].sort(); estado.totalPresencas=dias.length;
    estado.tempoTotalMinutos=[...diasMap.values()].reduce((s,c)=>s+minutos(c),0);
    estado.ultimaPresenca=dias.at(-1)||''; estado.alunoNome=aluno.nome||aluno.alunoNome||estado.alunoNome||'Aluno'; estado.atualizadoEm=agora();
    base.alunos[alunoId]=estado;
  }
  base.atualizadoEm=agora(); await salvar(FILE,base); return base;
}

export async function obterProgresso(alunoId){
  const base=await sincronizar(); const e=base.alunos[String(alunoId)]||{alunoId:String(alunoId),presencasCiclo:0,totalPresencas:0,tempoTotalMinutos:0,ciclo:1};
  const premios=base.premios.filter(p=>String(p.alunoId)===String(alunoId)).sort((a,b)=>String(b.concluidoEm).localeCompare(String(a.concluidoEm)));
  return { ok:true, meta:META, descontoPercentual:DESCONTO, progresso:{...e,faltam:Math.max(0,META-(e.presencasCiclo||0)),percentualConclusao:Math.min(100,Math.round(((e.presencasCiclo||0)/META)*100))}, premios };
}
export async function listarPremiadosMes(competencia=new Date().toISOString().slice(0,7)){
  const base=await sincronizar(); return base.premios.filter(p=>String(p.concluidoEm).slice(0,7)===competencia).map(p=>({nome:nomePublico(p.alunoNome),concluidoEm:p.concluidoEm,percentual:p.percentual,status:p.status}));
}
export async function aplicarPremioNaMensalidade({alunoId,valor,mensalidadeId=''}){
  const base=await sincronizar(); const premio=base.premios.find(p=>String(p.alunoId)===String(alunoId)&&p.status==='pendente');
  const original=Number(valor)||0; if(!premio) return {valor:original,valorOriginal:original,desconto:0,premio:null};
  const desconto=Number((original*(premio.percentual/100)).toFixed(2)); const final=Number(Math.max(0,original-desconto).toFixed(2));
  premio.status='aplicado'; premio.mensalidadeId=mensalidadeId; premio.aplicadoEm=agora(); premio.valorOriginal=original; premio.valorDesconto=desconto; premio.valorFinal=final;
  await salvar(FILE,base); return {valor:final,valorOriginal:original,desconto,premio};
}
export async function vincularMensalidadePremio(premioId,mensalidadeId){ const base=await ler(FILE,{alunos:{},premios:[]}); const p=base.premios?.find(x=>x.id===premioId); if(p){p.mensalidadeId=mensalidadeId; await salvar(FILE,base);} }
