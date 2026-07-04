import fs from 'fs/promises';
import path from 'path';
const DATA_DIR = path.resolve(process.cwd(), 'data');
async function ensureDir(){ await fs.mkdir(DATA_DIR,{recursive:true}); }
async function readJson(file, fallback){ await ensureDir(); const full=path.join(DATA_DIR,file); try{ const raw=await fs.readFile(full,'utf8'); return JSON.parse(raw||'null') ?? fallback; }catch(e){ if(e?.code==='ENOENT'){ await writeJson(file,fallback); return fallback;} throw e; } }
async function writeJson(file,data){ await ensureDir(); await fs.writeFile(path.join(DATA_DIR,file), JSON.stringify(data,null,2),'utf8'); }
function dinheiro(v){ const n=Number(v||0); return Number.isFinite(n)?Number(n.toFixed(2)):0; }
function txt(v){ return String(v??'').trim(); }
function hojeISO(){ return new Date().toISOString().slice(0,10); }
function agoraISO(){ return new Date().toISOString(); }
function addMeses(dataISO, meses=1){ const d=new Date(`${dataISO||hojeISO()}T12:00:00`); d.setMonth(d.getMonth()+Number(meses||1)); return d.toISOString().slice(0,10); }
function alunoNome(a){ return a?.nome || a?.name || a?.nomeCompleto || ''; }
function normalizar(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function tipoPlano(plano){ const n=normalizar(plano?.tipoPlano || plano?.tipo || 'Mensal'); if(n.includes('pre')) return 'Pré-pago'; if(n.includes('diar')) return 'Diarista'; if(n.includes('semes')) return 'Semestral'; if(n.includes('anual')) return 'Anual'; return 'Mensal'; }
function mesesPlano(plano){ const t=tipoPlano(plano); if(t==='Semestral') return 6; if(t==='Anual') return 12; if(t==='Mensal') return 1; return 0; }
function planoGeraMensalidade(plano){ if(plano?.geraMensalidade !== undefined) return plano.geraMensalidade !== false && plano.geraMensalidade !== 'false'; return ['Mensal','Semestral','Anual'].includes(tipoPlano(plano)); }
function planoCobraMatricula(plano){ if(plano?.cobraMatricula !== undefined) return plano.cobraMatricula !== false && plano.cobraMatricula !== 'false'; return ['Mensal','Semestral','Anual'].includes(tipoPlano(plano)); }
function valorMatriculaPlano(plano){ return dinheiro(plano?.valorMatricula ?? plano?.valorBaseMatricula ?? plano?.taxaMatricula ?? 0); }
function normalizarIds(opcoes={}){ const bruto=opcoes.turmaIds ?? opcoes.turmasIds ?? opcoes.turmasSelecionadas ?? opcoes.turmas ?? opcoes.turmaId ?? []; const arr=Array.isArray(bruto)?bruto:String(bruto||'').split(','); return [...new Set(arr.map(id=>String(id||'').trim()).filter(Boolean))]; }
function valorTurmaPorTipo(turma,tipo){ if(tipo==='Diarista') return dinheiro(turma.valorDiarista ?? turma.valorAvulso ?? turma.valorMensal ?? 0); if(tipo==='Pré-pago') return dinheiro(turma.valorPrePago ?? turma.valorMensal ?? 0); return dinheiro(turma.valorMensal ?? turma.valor ?? 0); }
function normalizarTurma(turma,tipo){ return { id: turma.id, turmaId: turma.id, nome: turma.nome || turma.turma || '', modalidade: turma.modalidade || '', professorId: turma.professorId || turma.professor_id || '', professor: turma.professor || '', diasSemana: turma.diasSemana || turma.dias_semana || '', horario: turma.horario || [turma.hora_inicio,turma.hora_fim].filter(Boolean).join(' às '), sala: turma.sala || turma.local || '', capacidade: Number(turma.capacidade||0), alunosMatriculados: Number(turma.alunosMatriculados||0), valor: valorTurmaPorTipo(turma,tipo), valorMensal: dinheiro(turma.valorMensal ?? turma.valor ?? 0), valorPrePago: dinheiro(turma.valorPrePago ?? turma.valorMensal ?? turma.valor ?? 0), valorDiarista: dinheiro(turma.valorDiarista ?? turma.valorAvulso ?? 0), tipoCobranca: tipo, status: turma.status || 'Ativa' }; }
function turmaAtiva(t){ return !['inativa','inativo','cancelada','cancelado','encerrada','encerrado'].includes(normalizar(t?.status||'Ativa')); }
function montarServicos(base, plano, opcoes={}){ const tipo=opcoes.tipoCobranca || opcoes.tipoPlano || tipoPlano(plano); const ids=normalizarIds(opcoes); return ids.map(id=>{ const t=(base.turmas||[]).find(x=>String(x.id)===String(id)); if(!t){ const e=new Error(`Turma/serviço não encontrado: ${id}.`); e.status=404; throw e; } if(!turmaAtiva(t)){ const e=new Error(`Turma/serviço inativo: ${t.nome||id}.`); e.status=400; throw e; } return normalizarTurma(t,tipo); }); }
function resumoServicos(servicos=[]){ const s=Array.isArray(servicos)?servicos:[]; return { turmaIds:s.map(x=>x.id), turma:s.map(x=>x.nome).filter(Boolean).join(', '), modalidade:[...new Set(s.map(x=>x.modalidade).filter(Boolean))].join(', '), professor:[...new Set(s.map(x=>x.professor).filter(Boolean))].join(', '), horario:s.map(x=>[x.nome,x.diasSemana,x.horario].filter(Boolean).join(' - ')).join(' | '), sala:[...new Set(s.map(x=>x.sala).filter(Boolean))].join(', '), valorServicos:dinheiro(s.reduce((t,x)=>t+dinheiro(x.valor),0)) }; }
function numeroMatricula(matriculas,dataISO){ const ym=String(dataISO||hojeISO()).slice(0,7).replace('-',''); const prefix=`MAT-${ym}-`; const nums=(matriculas||[]).map(m=>String(m.numero||'')).filter(n=>n.startsWith(prefix)).map(n=>Number(n.split('-').pop())).filter(Number.isFinite); return `${prefix}${String(nums.length?Math.max(...nums)+1:1).padStart(6,'0')}`; }
function matriculaAtivaDoAluno(matriculas, alunoId){ return (matriculas||[]).find(m=>String(m.alunoId)===String(alunoId)&&['Ativa','Pendente','Trancada'].includes(String(m.status||''))); }
function historico(m,acao,descricao,dados={},usuario='sistema'){ if(!Array.isArray(m.historico)) m.historico=[]; m.historico.push({ id:`hist_mat_${Date.now()}_${Math.floor(Math.random()*999999)}`, acao, descricao, usuario, dados, criadoEm:agoraISO() }); }
export async function carregarBaseMatricula(){ return { alunos:await readJson('alunos.json',[]), planos:await readJson('planos.json',[]), matriculas:await readJson('matriculas.json',[]), mensalidades:await readJson('mensalidades.json',[]), financeiro:await readJson('financeiro.json',[]), checkins:await readJson('checkins.json',[]), historicoPlanos:await readJson('alunos_historico_planos.json',[]), turmas:await readJson('turmas.json',[]) }; }
export async function salvarBaseMatricula(base){ await writeJson('alunos.json',base.alunos||[]); await writeJson('matriculas.json',base.matriculas||[]); await writeJson('mensalidades.json',base.mensalidades||[]); await writeJson('financeiro.json',base.financeiro||[]); await writeJson('checkins.json',base.checkins||[]); await writeJson('alunos_historico_planos.json',base.historicoPlanos||[]); await writeJson('turmas.json',base.turmas||[]); }
function resumirMatricula(m, completo=false){ const servicos=Array.isArray(m.servicos)?m.servicos:(Array.isArray(m.turmas)?m.turmas:[]); const r=resumoServicos(servicos); const out={ id:m.id, numero:m.numero, alunoId:m.alunoId, aluno:m.aluno, cpf:m.cpf||'', planoId:m.planoId, plano:m.plano, tipoPlano:m.tipoPlano || m.tipoCobranca || 'Mensal', tipoCobranca:m.tipoCobranca || m.tipoPlano || 'Mensal', status:m.status, dataMatricula:m.dataMatricula||'', vencimentoInicial:m.vencimentoInicial||'', dataInicio:m.dataInicio||'', dataFim:m.dataFim||'', valorMatricula:dinheiro(m.valorMatricula), valorServicos:dinheiro(m.valorServicos ?? r.valorServicos), valorMensal:dinheiro(m.valorMensalTotal ?? m.valorMensal), valorMensalTotal:dinheiro(m.valorMensalTotal ?? m.valorMensal), valorTotalInicial:dinheiro(m.valorTotalInicial), taxaMatricula:dinheiro(m.taxaMatricula), descontoMatricula:dinheiro(m.descontoMatricula), turmaId:m.turmaId||r.turmaIds[0]||'', turmaIds:Array.isArray(m.turmaIds)?m.turmaIds:r.turmaIds, turma:m.turma||r.turma, turmas:servicos, servicos, modalidade:m.modalidade||r.modalidade, professor:m.professor||r.professor, horario:m.horario||r.horario, sala:m.sala||r.sala, formaPagamento:m.formaPagamento||'', mensalidadeInicialId:m.mensalidadeInicialId||null, financeiroInicialId:m.financeiroInicialId||null, criadoEm:m.criadoEm, atualizadoEm:m.atualizadoEm } ; if(completo){ out.historico=Array.isArray(m.historico)?m.historico:[]; out.auditoria=Array.isArray(m.auditoria)?m.auditoria:[]; } return out; }
export async function listarMatriculas(filtros={}){ const base=await carregarBaseMatricula(); const termo=String(filtros.q||filtros.busca||'').toLowerCase(); const status=String(filtros.status||''); const alunoId=String(filtros.alunoId||filtros.aluno_id||''); let dados=base.matriculas||[]; if(status) dados=dados.filter(m=>String(m.status)===status); if(alunoId) dados=dados.filter(m=>String(m.alunoId)===alunoId); if(termo) dados=dados.filter(m=>[m.numero,m.aluno,m.plano,m.turma,m.status].join(' ').toLowerCase().includes(termo)); return { ok:true, success:true, total:dados.length, dados:dados.map(m=>resumirMatricula(m)).sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))) }; }
export async function obterMatricula(id){ const base=await carregarBaseMatricula(); const m=(base.matriculas||[]).find(x=>String(x.id)===String(id)||String(x.numero)===String(id)); if(!m){ const e=new Error('Matrícula não encontrada.'); e.status=404; throw e; } return { ok:true, success:true, dados:resumirMatricula(m,true) }; }
export async function integrarMatriculaAluno(alunoId, planoId, opcoes={}){
  const base=await carregarBaseMatricula();
  const aluno=base.alunos.find(a=>String(a.id)===String(alunoId));
  if(!aluno){ const e=new Error('Aluno não encontrado.'); e.status=404; throw e; }
  const plano=base.planos.find(p=>String(p.id)===String(planoId));
  if(!plano){ const e=new Error('Plano não encontrado.'); e.status=404; throw e; }

  const existente=matriculaAtivaDoAluno(base.matriculas,aluno.id);
  if(existente && opcoes.permitirTroca!==true){
    return { ok:true, success:true, duplicada:true, aluno, plano, matricula:resumirMatricula(existente), mensagem:'Aluno já possui matrícula ativa ou pendente. Receba a cobrança inicial ou altere os serviços.' };
  }
  if(existente && opcoes.permitirTroca===true){
    existente.status='Encerrada';
    existente.encerradaEm=agoraISO();
    existente.atualizadoEm=agoraISO();
    historico(existente,'encerramento_por_troca','Matrícula encerrada por alteração comercial.',{novoPlanoId:plano.id},opcoes.usuario);
  }

  const tipo=opcoes.tipoCobranca || opcoes.tipoPlano || tipoPlano(plano);
  const dataMatricula=opcoes.dataMatricula || hojeISO();
  const dataInicio=opcoes.dataInicio || dataMatricula;
  const vencimentoInicial=opcoes.vencimento || dataMatricula;
  const proximoVencimento=addMeses(vencimentoInicial, 1);
  const dataFim=opcoes.dataFim || (mesesPlano(plano)>0 ? addMeses(dataInicio, mesesPlano(plano)) : '');

  const servicos=montarServicos(base,plano,{...opcoes,tipoCobranca:tipo});
  const r=resumoServicos(servicos);

  const cobrarMatricula = opcoes.cobrarMatricula !== undefined
    ? opcoes.cobrarMatricula !== false && opcoes.cobrarMatricula !== 'false'
    : planoCobraMatricula(plano);

  const valorMatricula = cobrarMatricula
    ? dinheiro(opcoes.valorMatricula ?? opcoes.taxaMatricula ?? opcoes.valorTaxaMatricula ?? opcoes.valorEntradaMatricula ?? opcoes.valorBaseMatricula ?? valorMatriculaPlano(plano))
    : 0;

  const desconto=dinheiro(opcoes.descontoMatricula ?? 0);
  const valorServicos=r.valorServicos;
  const valorPlanoBase=dinheiro((plano?.id ? (plano.valorMensal ?? plano.valor ?? plano.mensalidade) : 0) ?? opcoes.valorPlano ?? opcoes.valorMensalPlano ?? opcoes.valorMensal ?? 0);
  const valorMensalTotal=dinheiro(Math.max(0, valorPlanoBase + valorServicos));
  const valorEntradaUnica=dinheiro(Math.max(0, valorMatricula + valorMensalTotal - desconto));
  const geraMensalidade = opcoes.gerarMensalidade !== false && planoGeraMensalidade(plano);
  const nome=alunoNome(aluno);
  const origem = ['Pré-pago','Diarista'].includes(tipo) ? `venda_${normalizar(tipo).replace('-','_')}` : 'matricula_servicos';

  let mensalidadeInicial=null;
  let financeiroInicial=null;
  let mensalidadeProxima=null;
  let financeiroProximo=null;

  const matricula={
    id:`mat_${Date.now()}_${Math.floor(Math.random()*999999)}`,
    numero:numeroMatricula(base.matriculas,dataMatricula),
    alunoId:aluno.id,
    aluno:nome,
    cpf:aluno.cpf||'',
    planoId:plano.id || '',
    plano:plano.nome || 'SEM PLANO',
    tipoPlano:tipo,
    tipoCobranca:tipo,
    cobraMatricula:cobrarMatricula,
    valorMatricula,
    valorPlano:valorPlanoBase,
    valorServicos,
    valorMensal:valorMensalTotal,
    valorMensalTotal,
    descontoMatricula:desconto,
    valorTotalInicial:valorEntradaUnica,
    status:valorEntradaUnica > 0 ? 'Pendente' : 'Ativa',
    statusFinanceiroInicial:valorEntradaUnica > 0 ? 'Pendente' : 'Pago',
    dataMatricula,
    vencimentoInicial,
    proximoVencimento,
    dataInicio,
    dataFim,
    turmaId:r.turmaIds[0]||'',
    turmaIds:r.turmaIds,
    turma:r.turma,
    turmas:servicos,
    servicos,
    modalidade:r.modalidade,
    professor:r.professor,
    horario:r.horario,
    sala:r.sala,
    formaPagamento:'',
    observacao:opcoes.observacao||'',
    criadoEm:agoraISO(),
    atualizadoEm:agoraISO(),
    historico:[],
    auditoria:[]
  };

  if(valorEntradaUnica > 0 || geraMensalidade || ['Pré-pago','Diarista'].includes(tipo)){
    mensalidadeInicial={
      id:`men_${Date.now()}_${Math.floor(Math.random()*999999)}`,
      alunoId:aluno.id,
      aluno:nome,
      matriculaId:matricula.id,
      planoId:plano.id || '',
      plano:plano.nome || 'SEM PLANO',
      tipoPlano:tipo,
      competencia:dataMatricula.slice(0,7),
      vencimento:vencimentoInicial,
      valorMatricula,
      valorPlano:valorPlanoBase,
      valorServicos,
      valor:valorMensalTotal,
      total:valorEntradaUnica,
      valorOriginal:valorEntradaUnica,
      valorTotalInicial:valorEntradaUnica,
      valorPago:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRecebido:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRestante:valorEntradaUnica > 0 ? valorEntradaUnica : 0,
      servicos,
      formaPagamento:'',
      status:valorEntradaUnica > 0 ? 'aberto' : 'pago',
      origem:'matricula_inicial_unificada',
      recorrencia:'entrada_unica',
      ativarMatriculaAoReceber:true,
      criadoEm:agoraISO(),
      atualizadoEm:agoraISO()
    };
    base.mensalidades.push(mensalidadeInicial);

    financeiroInicial={
      id:`fin_${Date.now()}_${Math.floor(Math.random()*999999)}`,
      tipo:'receber',
      descricao:`Entrada matrícula + mensalidade - ${nome || aluno.id}`,
      categoria:'Matrícula e mensalidade',
      alunoId:aluno.id,
      aluno:nome,
      pessoa:nome,
      alunoFornecedor:nome,
      matriculaId:matricula.id,
      planoId:plano.id || '',
      plano:plano.nome || 'SEM PLANO',
      mensalidadeId:mensalidadeInicial.id,
      valor:valorEntradaUnica,
      valorBruto:valorEntradaUnica,
      total:valorEntradaUnica,
      valorMatricula,
      valorPlano:valorPlanoBase,
      valorMensal:valorMensalTotal,
      valorServicos,
      valorPago:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRecebido:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRestante:valorEntradaUnica > 0 ? valorEntradaUnica : 0,
      servicos,
      vencimento:vencimentoInicial,
      formaPagamento:'',
      status:valorEntradaUnica > 0 ? 'Aberto' : 'Pago',
      origem:'matricula_inicial_unificada',
      ativarMatriculaAoReceber:true,
      criadoEm:agoraISO(),
      atualizadoEm:agoraISO()
    };
    mensalidadeInicial.lancamentoFinanceiroId=financeiroInicial.id;
    mensalidadeInicial.financeiroInicialId=financeiroInicial.id;
    base.financeiro.push(financeiroInicial);

    if(tipo==='Mensal' && plano?.id && valorMensalTotal > 0){
      mensalidadeProxima={
        id:`men_${Date.now()}_${Math.floor(Math.random()*999999)}`,
        alunoId:aluno.id,
        aluno:nome,
        matriculaId:matricula.id,
        planoId:plano.id || '',
        plano:plano.nome || 'SEM PLANO',
        tipoPlano:tipo,
        competencia:proximoVencimento.slice(0,7),
        vencimento:proximoVencimento,
        valorMatricula:0,
        valorPlano:valorPlanoBase,
        valorServicos,
        valor:valorMensalTotal,
        total:valorMensalTotal,
        servicos,
        formaPagamento:'',
        status:'Aberta',
        origem:'recorrencia_mensal',
        criadoEm:agoraISO(),
        atualizadoEm:agoraISO()
      };
      base.mensalidades.push(mensalidadeProxima);

      financeiroProximo={
        id:`fin_${Date.now()}_${Math.floor(Math.random()*999999)}`,
        tipo:'receber',
        descricao:`Mensalidade ${proximoVencimento.slice(0,7)} - ${nome || aluno.id}`,
        categoria:'Mensalidades',
        alunoId:aluno.id,
        aluno:nome,
        pessoa:nome,
        alunoFornecedor:nome,
        matriculaId:matricula.id,
        planoId:plano.id || '',
        plano:plano.nome || 'SEM PLANO',
        mensalidadeId:mensalidadeProxima.id,
        valor:valorMensalTotal,
        valorMatricula:0,
        valorPlano:valorPlanoBase,
        valorMensal:valorMensalTotal,
        valorServicos,
        valorPago:0,
        valorRecebido:0,
        valorRestante:valorMensalTotal,
        servicos,
        vencimento:proximoVencimento,
        formaPagamento:'',
        status:'Aberto',
        origem:'recorrencia_mensal',
        ativarMatriculaAoReceber:false,
        criadoEm:agoraISO(),
        atualizadoEm:agoraISO()
      };
      mensalidadeProxima.lancamentoFinanceiroId=financeiroProximo.id;
      mensalidadeProxima.financeiroInicialId=financeiroProximo.id;
      base.financeiro.push(financeiroProximo);
    }
  }

  matricula.mensalidadeInicialId=mensalidadeInicial?.id||null;
  matricula.mensalidadeProximaId=mensalidadeProxima?.id||null;
  matricula.financeiroInicialId=financeiroInicial?.id||null;
  matricula.financeiroProximoId=financeiroProximo?.id||null;

  historico(matricula,'matricula_pendente_pagamento','Matrícula criada como pendente. Ativação somente após pagamento da entrada única.',{plano,servicos,valorMatricula,valorPlanoBase,valorServicos,valorMensalTotal,valorEntradaUnica,proximoVencimento},opcoes.usuario);
  base.matriculas.push(matricula);

  Object.assign(aluno,{
    planoId:plano.id || '',
    plano:plano.nome || 'SEM PLANO',
    tipoPlano:tipo,
    valorMatricula,
    valorPlano:valorPlanoBase,
    valorServicos,
    valorMensal:valorMensalTotal,
    valorMensalTotal,
    statusMatricula:matricula.status,
    status:valorEntradaUnica > 0 ? 'pre-matriculado' : 'ativo',
    matriculaId:matricula.id,
    numeroMatricula:matricula.numero,
    turmaId:matricula.turmaId,
    turma:matricula.turma,
    turmaIds:matricula.turmaIds,
    turmas:servicos,
    servicosContratados:servicos,
    professor:matricula.professor,
    horario:matricula.horario,
    atualizadoEm:agoraISO()
  });

  base.historicoPlanos.push({ id:`hist_plano_${Date.now()}_${Math.floor(Math.random()*999999)}`, alunoId:aluno.id, aluno:nome, matriculaId:matricula.id, numeroMatricula:matricula.numero, planoId:plano.id || '', plano:plano.nome || 'SEM PLANO', tipoPlano:tipo, valorMatricula, valorPlano:valorPlanoBase, valorServicos, valorMensalTotal, valorTotalInicial:valorEntradaUnica, servicos, acao:'matricula_pendente_pagamento', criadoEm:agoraISO() });

  const chk=base.checkins.find(c=>String(c.alunoId)===String(aluno.id)&&c.tipo==='vinculo_matricula');
  const payloadChk={ tipo:'vinculo_matricula', alunoId:aluno.id, aluno:nome, matriculaId:matricula.id, numeroMatricula:matricula.numero, planoId:plano.id || '', plano:plano.nome || 'SEM PLANO', tipoPlano:tipo, turmaIds:matricula.turmaIds, turmas:servicos, servicos, status:'Bloqueado', atualizadoEm:agoraISO() };
  if(chk) Object.assign(chk,payloadChk); else base.checkins.push({ id:`chk_vinc_${Date.now()}_${Math.floor(Math.random()*999999)}`, ...payloadChk, criadoEm:agoraISO() });

  for(const t of base.turmas){ t.alunosMatriculados=(base.matriculas||[]).filter(m=>['Ativa','Pendente','Trancada'].includes(String(m.status||'')) && Array.isArray(m.turmaIds) && m.turmaIds.some(id=>String(id)===String(t.id))).length; }

  await salvarBaseMatricula(base);
  return { ok:true, success:true, aluno, plano, matricula:resumirMatricula(matricula), mensalidadeGerada:mensalidadeInicial, mensalidadeProxima, financeiroInicial, financeiroProximo, mensagem:'Matrícula pendente criada. Receba a entrada única para ativar o aluno.' };
}

export async function trocarPlanoAluno(alunoId, novoPlanoId, opcoes={}){ return integrarMatriculaAluno(alunoId, novoPlanoId, {...opcoes, permitirTroca:true}); }
export async function alterarStatusMatricula(id,status,motivo='',usuario='sistema'){ const base=await carregarBaseMatricula(); const m=base.matriculas.find(x=>String(x.id)===String(id)||String(x.numero)===String(id)); if(!m){ const e=new Error('Matrícula não encontrada.'); e.status=404; throw e; } const ant=m.status; m.status=status; m.atualizadoEm=agoraISO(); historico(m,'alterar_status',`Status alterado de ${ant} para ${status}.`,{motivo,statusAnterior:ant,statusAtual:status},usuario); const aluno=base.alunos.find(a=>String(a.id)===String(m.alunoId)); if(aluno){ aluno.statusMatricula=status; aluno.atualizadoEm=agoraISO(); } await salvarBaseMatricula(base); return { ok:true, success:true, dados:resumirMatricula(m,true), mensagem:'Status da matrícula atualizado.' }; }
export async function removerTurmasMatricula(id, usuario='sistema'){ const base=await carregarBaseMatricula(); const m=base.matriculas.find(x=>String(x.id)===String(id)||String(x.numero)===String(id)); if(!m){ const e=new Error('Matrícula não encontrada.'); e.status=404; throw e; } m.servicos=[]; m.turmas=[]; m.turmaIds=[]; m.turmaId=''; m.turma=''; m.valorServicos=0; m.valorMensalTotal=dinheiro(m.valorMatricula||0); m.valorMensal=m.valorMensalTotal; m.atualizadoEm=agoraISO(); historico(m,'remover_turmas','Aluno removido de todas as turmas/serviços.',{},usuario); await salvarBaseMatricula(base); return { ok:true, success:true, dados:resumirMatricula(m,true), mensagem:'Aluno removido de todas as turmas, mantendo matrícula ativa.' }; }
