import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const LOGS = path.join(ROOT, "logs");

const files = {
  alunos: path.join(DATA, "alunos.json"),
  matriculas: path.join(DATA, "matriculas.json"),
  mensalidades: path.join(DATA, "mensalidades.json"),
  financeiro: path.join(DATA, "financeiro.json"),
  recebimentos: path.join(DATA, "recebimentos.json"),
  checkins: path.join(DATA, "checkins.json")
};

function norm(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function num(v){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?Number(n.toFixed(2)):0;}
function hoje(){return new Date().toISOString().slice(0,10);}
function addMes(d){const x=new Date(`${d||hoje()}T12:00:00`);x.setMonth(x.getMonth()+1);return x.toISOString().slice(0,10);}
function pago(i={}){return ["pago","recebido","quitado","baixado"].includes(norm(i.status));}
function entrada(i={}){const a=norm([i.origem,i.categoria,i.descricao,i.recorrencia].join(" "));return i.ativarMatriculaAoReceber||a.includes("matricula_inicial_unificada")||a.includes("entrada matricula")||a.includes("matricula + mensalidade")||a.includes("matricula e mensalidade");}
async function read(f,d=[]){try{if(!fssync.existsSync(f))return d;const t=await fs.readFile(f,"utf8");return t.trim()?JSON.parse(t):d;}catch{return d;}}
async function write(f,d){await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(d,null,2),"utf8");}
function id(p){return `${p}_${Date.now()}_${Math.floor(Math.random()*999999)}`;}

async function main(){
  await fs.mkdir(LOGS,{recursive:true});
  const alunos=await read(files.alunos,[]);
  const matriculas=await read(files.matriculas,[]);
  const mensalidades=await read(files.mensalidades,[]);
  const financeiro=await read(files.financeiro,[]);
  const recebimentos=await read(files.recebimentos,[]);
  const checkins=await read(files.checkins,[]);
  const alteracoes=[];

  for(const m of matriculas){
    const aluno=alunos.find(a=>String(a.id)===String(m.alunoId));
    const nome=m.aluno||aluno?.nome||"";
    const data=m.dataMatricula||m.dataInicio||hoje();
    const venc=m.vencimentoInicial||data;
    const prox=m.proximoVencimento||addMes(venc);

    const taxa=num(m.valorMatricula ?? m.taxaMatricula);
    const plano=num(m.valorPlano ?? m.valorMensal ?? m.valorMensalTotal);
    const serv=num(m.valorServicos);
    const desc=num(m.descontoMatricula);
    const mensal=num(plano+serv);
    const entradaValor=num(taxa+mensal-desc);

    if(!(entradaValor>=0)) continue;

    let men=mensalidades.find(x=>String(x.id)===String(m.mensalidadeInicialId)) ||
      mensalidades.find(x=>String(x.matriculaId)===String(m.id)&&entrada(x));

    if(!men){
      men={id:id("men_ini"),criadoEm:new Date().toISOString()};
      mensalidades.push(men);
      alteracoes.push({tipo:"mensalidade_inicial_criada",matriculaId:m.id});
    }

    const jaPago=pago(men) || financeiro.some(f=>String(f.id)===String(men.lancamentoFinanceiroId)&&pago(f));
    Object.assign(men,{
      alunoId:m.alunoId, aluno:nome, alunoNome:nome, matriculaId:m.id, numeroMatricula:m.numero,
      planoId:m.planoId, plano:m.plano, tipoPlano:m.tipoPlano||"Mensal",
      competencia:data.slice(0,7), vencimento:venc,
      descricao:`Entrada matrícula + mensalidade - ${nome}`,
      categoria:"Matrículas",
      valorMatricula:taxa, valorPlano:plano, valorServicos:serv, descontoMatricula:desc,
      valor:mensal, valorOriginal:entradaValor, total:entradaValor, valorTotalInicial:entradaValor,
      valorPago:jaPago?num(men.valorPago||entradaValor):0,
      valorRecebido:jaPago?num(men.valorRecebido||men.valorPago||entradaValor):0,
      valorRestante:jaPago?0:entradaValor,
      status:jaPago?"pago":(entradaValor>0?"aberto":"pago"),
      origem:"matricula_inicial_unificada",
      recorrencia:"entrada_unica",
      ativarMatriculaAoReceber:true,
      atualizadoEm:new Date().toISOString()
    });

    let fin=financeiro.find(f=>String(f.id)===String(men.lancamentoFinanceiroId||"")) ||
      financeiro.find(f=>String(f.mensalidadeId)===String(men.id)) ||
      financeiro.find(f=>String(f.matriculaId)===String(m.id)&&entrada(f));

    if(!fin){
      fin={id:id("fin_ini"),criadoEm:new Date().toISOString()};
      financeiro.push(fin);
      alteracoes.push({tipo:"financeiro_inicial_criado",matriculaId:m.id});
    }

    const finPago=pago(fin)||jaPago||entradaValor===0;
    Object.assign(fin,{
      tipo:"receber",
      descricao:`Entrada matrícula + mensalidade - ${nome}`,
      categoria:"Matrículas",
      centroCusto:"Academia",
      alunoId:m.alunoId, aluno:nome, pessoa:nome, alunoFornecedor:nome,
      matriculaId:m.id, numeroMatricula:m.numero, planoId:m.planoId, plano:m.plano,
      mensalidadeId:men.id,
      valor:entradaValor, valorBruto:entradaValor, total:entradaValor,
      valorMatricula:taxa, valorPlano:plano, valorServicos:serv, descontoMatricula:desc,
      vencimento:venc,
      origem:"matricula_inicial_unificada",
      ativarMatriculaAoReceber:true,
      status:finPago?"Pago":"Aberto",
      valorPago:finPago?num(fin.valorPago||men.valorPago||entradaValor):0,
      valorRecebido:finPago?num(fin.valorRecebido||fin.valorPago||men.valorRecebido||entradaValor):0,
      valorRestante:finPago?0:entradaValor,
      atualizadoEm:new Date().toISOString()
    });
    men.lancamentoFinanceiroId=fin.id;
    men.financeiroInicialId=fin.id;

    m.mensalidadeInicialId=men.id;
    m.financeiroInicialId=fin.id;
    m.valorMatricula=taxa;
    m.valorPlano=plano;
    m.valorMensal=mensal;
    m.valorMensalTotal=mensal;
    m.valorTotalInicial=entradaValor;
    m.vencimentoInicial=venc;
    m.proximoVencimento=prox;
    m.status=finPago?"Ativa":"Pendente";
    m.statusPagamento=finPago?"Pago":"Pendente";
    m.atualizadoEm=new Date().toISOString();

    if(aluno){
      aluno.status=finPago?"ativo":"pre-matriculado";
      aluno.statusMatricula=m.status;
      aluno.valorMatricula=taxa;
      aluno.valorPlano=plano;
      aluno.valorMensal=mensal;
      aluno.valorMensalTotal=mensal;
      aluno.atualizadoEm=new Date().toISOString();
    }

    let vinc=checkins.find(c=>String(c.alunoId)===String(m.alunoId)&&c.tipo==="vinculo_matricula");
    if(!vinc){vinc={id:id("chk_vinc"),tipo:"vinculo_matricula",alunoId:m.alunoId,aluno:nome,criadoEm:new Date().toISOString()};checkins.push(vinc);}
    Object.assign(vinc,{matriculaId:m.id,numeroMatricula:m.numero,planoId:m.planoId,plano:m.plano,status:finPago?"Ativo":"Bloqueado",atualizadoEm:new Date().toISOString()});

    alteracoes.push({tipo:"matricula_normalizada",matriculaId:m.id,status:m.status,totalInicial:entradaValor});
  }

  const chaves=new Set();
  for(const r of recebimentos){if(r.id)chaves.add(String(r.id));if(r.lancamentoFinanceiroId)chaves.add(String(r.lancamentoFinanceiroId));}
  for(const f of financeiro){
    if(norm(f.tipo)!=="receber")continue;
    const rid=f.recebimentoId||`rec_${f.id}`;
    if(chaves.has(String(f.id))||chaves.has(String(rid)))continue;
    recebimentos.push({
      id:rid, descricao:f.descricao, categoria:f.categoria||"Recebimentos", centroCusto:f.centroCusto||"Academia",
      pessoa:f.pessoa||f.aluno||f.alunoFornecedor||"", cliente:f.pessoa||f.aluno||f.alunoFornecedor||"", aluno:f.aluno||f.pessoa||"",
      alunoId:f.alunoId||"", matriculaId:f.matriculaId||"", mensalidadeId:f.mensalidadeId||"",
      formaPagamento:f.formaPagamento||"", valorBruto:num(f.valor), valorLiquido:num(f.valorLiquido||f.valorRecebido),
      valorRecebido:num(f.valorRecebido||f.valorPago), valorRestante:num(f.valorRestante??Math.max(0,num(f.valor)-num(f.valorRecebido||f.valorPago))),
      vencimento:f.vencimento||hoje(), dataRecebimento:f.dataPagamento||f.pagamento||"",
      status:pago(f)?"recebido":"aberto", lancamentoFinanceiroId:f.id, origem:f.origem||"financeiro",
      ativarMatriculaAoReceber:Boolean(f.ativarMatriculaAoReceber), criadoEm:f.criadoEm||new Date().toISOString(), atualizadoEm:new Date().toISOString(),
      sincronizadoDoFinanceiro:true
    });
  }

  await write(files.alunos,alunos);
  await write(files.matriculas,matriculas);
  await write(files.mensalidades,mensalidades);
  await write(files.financeiro,financeiro);
  await write(files.recebimentos,recebimentos);
  await write(files.checkins,checkins);

  const rel={ok:true,versao:"2.6.1-F2",data:new Date().toISOString(),alteracoes};
  await write(path.join(LOGS,"consolidacao-comercial-261f2.json"),rel);

  console.log("Fusion ERP 2.6.1-F2 — Consolidação Comercial");
  console.log(`Alterações: ${alteracoes.length}`);
  console.log("Relatório: logs/consolidacao-comercial-261f2.json");
}
main().catch(e=>{console.error("Falha:",e.message);process.exit(1);});
