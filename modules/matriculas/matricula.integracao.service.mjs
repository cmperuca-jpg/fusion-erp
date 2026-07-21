import { lerJsonDuravel, salvarJsonDuravel, salvarJsonMultiplosAtomico } from '../core/persistence/durable-json.mjs';
async function readJson(file, fallback){ return lerJsonDuravel(file, fallback); }
async function writeJson(file,data){ return salvarJsonDuravel(file, data); }
function dinheiro(v){ const n=Number(v||0); return Number.isFinite(n)?Number(n.toFixed(2)):0; }
function txt(v){ return String(v??'').trim(); }
function hojeISO(){ return new Date().toISOString().slice(0,10); }
function agoraISO(){ return new Date().toISOString(); }
function addMeses(dataISO, meses=1){ const d=new Date(`${dataISO||hojeISO()}T12:00:00`); d.setMonth(d.getMonth()+Number(meses||1)); return d.toISOString().slice(0,10); }
function proximoMesNoDia(dataISO, dia){
  const d=new Date(`${dataISO||hojeISO()}T12:00:00`);
  d.setDate(1); d.setMonth(d.getMonth()+1);
  d.setDate(Math.max(1,Math.min(28,Number(dia)||1)));
  return d.toISOString().slice(0,10);
}
function alunoNome(a){ return a?.nome || a?.name || a?.nomeCompleto || ''; }
function normalizar(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function tipoPlano(plano){ const n=normalizar(plano?.tipoPlano || plano?.tipo || 'Mensal'); if(n.includes('pre')) return 'Pré-pago'; if(n.includes('diar')) return 'Diarista'; if(n.includes('semes')) return 'Semestral'; if(n.includes('anual')) return 'Anual'; return 'Mensal'; }
function tipoAvulso(tipo){ const n=normalizar(tipo); return n.includes('pre') || n.includes('diar'); }
function mesesPlano(plano){ const t=tipoPlano(plano); if(t==='Semestral') return 6; if(t==='Anual') return 12; if(t==='Mensal') return 1; return 0; }
function planoGeraMensalidade(plano){ if(plano?.geraMensalidade !== undefined) return plano.geraMensalidade !== false && plano.geraMensalidade !== 'false'; return ['Mensal','Semestral','Anual'].includes(tipoPlano(plano)); }
function planoCobraMatricula(plano){ if(plano?.cobraMatricula !== undefined) return plano.cobraMatricula !== false && plano.cobraMatricula !== 'false'; return ['Mensal','Semestral','Anual'].includes(tipoPlano(plano)); }
function valorMatriculaPlano(plano){ return dinheiro(plano?.valorMatricula ?? plano?.valorBaseMatricula ?? plano?.taxaMatricula ?? 0); }
function normalizarListaTexto(valor){ const bruto=valor ?? []; const arr=Array.isArray(bruto)?bruto:String(bruto||'').split(','); return arr.map(v=>String(v||'').trim()).filter(Boolean); }
function normalizarIds(opcoes={}){ return [...new Set(normalizarListaTexto(opcoes.turmaIds ?? opcoes.turmasIds ?? opcoes.turmasSelecionadas ?? opcoes.turmas ?? opcoes.turmaId))]; }
function normalizarNomesTurmas(opcoes={}){ return [...new Set(normalizarListaTexto(opcoes.turmaNomes ?? opcoes.turmasNomes ?? opcoes.nomesTurmas ?? opcoes.turmaNome).map(normalizar).filter(Boolean))]; }
function idTurma(turma={}){ return txt(turma.id ?? turma.turmaId ?? turma.turma_id ?? turma.codigo ?? turma.cod ?? turma.value ?? turma.nome ?? turma.turma ?? ''); }
function nomeTurma(turma={}){ return txt(turma.nome || turma.turma || turma.descricao || turma.modalidade || idTurma(turma)); }
function valorTurmaPorTipo(turma,tipo){ return 0; }
function normalizarTurma(turma,tipo){ return { id: turma.id, turmaId: turma.id, nome: turma.nome || turma.turma || '', modalidade: turma.modalidade || '', professorId: turma.professorId || turma.professor_id || '', professor: turma.professor || '', diasSemana: turma.diasSemana || turma.dias_semana || '', horario: turma.horario || [turma.hora_inicio,turma.hora_fim].filter(Boolean).join(' às '), sala: turma.sala || turma.local || '', capacidade: Number(turma.capacidade||0), alunosMatriculados: Number(turma.alunosMatriculados||0), valor: valorTurmaPorTipo(turma,tipo), valorMensal: dinheiro(turma.valorMensal ?? turma.valor ?? 0), valorPrePago: dinheiro(turma.valorPrePago ?? turma.valorMensal ?? turma.valor ?? 0), valorDiarista: dinheiro(turma.valorDiarista ?? turma.valorAvulso ?? 0), tipoCobranca: tipo, status: turma.status || 'Ativa' }; }
function turmaAtiva(t){ return !['inativa','inativo','cancelada','cancelado','encerrada','encerrado'].includes(normalizar(t?.status||'Ativa')); }
function montarServicosLegado(base, plano, opcoes={}){ const tipo=opcoes.tipoCobranca || opcoes.tipoPlano || tipoPlano(plano); const ids=normalizarIds(opcoes); return ids.map(id=>{ const t=(base.turmas||[]).find(x=>String(x.id)===String(id)); if(!t){ const e=new Error(`Turma/serviço não encontrado: ${id}.`); e.status=404; throw e; } if(!turmaAtiva(t)){ const e=new Error(`Turma/serviço inativo: ${t.nome||id}.`); e.status=400; throw e; } return normalizarTurma(t,tipo); }); }
function normalizarTurmaOperacional(turma,tipo){
  const id=idTurma(turma);
  return {
    id,
    turmaId:id,
    nome:nomeTurma(turma),
    modalidade:turma.modalidade || '',
    professorId:turma.professorId || turma.professor_id || '',
    professor:turma.professor || '',
    diasSemana:turma.diasSemana || turma.dias_semana || '',
    horario:turma.horario || [turma.hora_inicio,turma.hora_fim].filter(Boolean).join(' as '),
    sala:turma.sala || turma.local || '',
    capacidade:Number(turma.capacidade||0),
    alunosMatriculados:Number(turma.alunosMatriculados||0),
    valor:valorTurmaPorTipo(turma,tipo),
    valorMensal:dinheiro(turma.valorMensal ?? turma.valor ?? 0),
    valorPrePago:dinheiro(turma.valorPrePago ?? turma.valorMensal ?? turma.valor ?? 0),
    valorDiarista:dinheiro(turma.valorDiarista ?? turma.valorAvulso ?? 0),
    tipoCobranca:tipo,
    status:turma.status || 'Ativa'
  };
}
function buscarTurma(base, id, nomes=[]){
  const alvo=txt(id);
  const alvoNorm=normalizar(alvo);
  return (base.turmas||[]).find(t=>{
    const ids=[t.id,t.turmaId,t.turma_id,t.codigo,t.cod,t.value].map(txt).filter(Boolean);
    if(ids.some(v=>v===alvo || normalizar(v)===alvoNorm)) return true;
    const nomesTurma=[t.nome,t.turma,t.descricao,t.modalidade].map(normalizar).filter(Boolean);
    return nomes.length>0 && nomesTurma.some(n=>nomes.includes(n));
  });
}
function criarTurmaOperacional(id,nome,tipo){
  const rotulo=txt(nome || id || 'Turma operacional');
  return normalizarTurmaOperacional({ id:txt(id || rotulo), nome:rotulo, status:'Ativa' }, tipo);
}
function montarServicos(base, plano, opcoes={}){
  const tipo=opcoes.tipoCobranca || opcoes.tipoPlano || tipoPlano(plano);
  const ids=normalizarIds(opcoes);
  const nomes=normalizarNomesTurmas(opcoes);
  return ids.map((id,idx)=>{
    const t=buscarTurma(base,id,nomes);
    if(!t) return criarTurmaOperacional(id, nomes[idx] || id, tipo);
    if(!turmaAtiva(t)){
      const e=new Error(`Turma/servico inativo: ${nomeTurma(t)||id}.`);
      e.status=400;
      throw e;
    }
    return normalizarTurmaOperacional(t,tipo);
  });
}
function resumoServicos(servicos=[]){ const s=Array.isArray(servicos)?servicos:[]; return { turmaIds:s.map(x=>x.id), turma:s.map(x=>x.nome).filter(Boolean).join(', '), modalidade:[...new Set(s.map(x=>x.modalidade).filter(Boolean))].join(', '), professor:[...new Set(s.map(x=>x.professor).filter(Boolean))].join(', '), horario:s.map(x=>[x.nome,x.diasSemana,x.horario].filter(Boolean).join(' - ')).join(' | '), sala:[...new Set(s.map(x=>x.sala).filter(Boolean))].join(', '), valorServicos:0 }; }
function numeroMatricula(matriculas,dataISO){ const ym=String(dataISO||hojeISO()).slice(0,7).replace('-',''); const prefix=`MAT-${ym}-`; const nums=(matriculas||[]).map(m=>String(m.numero||'')).filter(n=>n.startsWith(prefix)).map(n=>Number(n.split('-').pop())).filter(Number.isFinite); return `${prefix}${String(nums.length?Math.max(...nums)+1:1).padStart(6,'0')}`; }
function matriculaAtivaDoAluno(matriculas, alunoId){ return (matriculas||[]).find(m=>String(m.alunoId)===String(alunoId)&&['Ativa','Pendente','Trancada'].includes(String(m.status||''))); }
function historico(m,acao,descricao,dados={},usuario='sistema'){ if(!Array.isArray(m.historico)) m.historico=[]; m.historico.push({ id:`hist_mat_${Date.now()}_${Math.floor(Math.random()*999999)}`, acao, descricao, usuario, dados, criadoEm:agoraISO() }); }
export async function carregarBaseMatricula(){ return { alunos:await readJson('alunos.json',[]), planos:await readJson('planos.json',[]), matriculas:await readJson('matriculas.json',[]), mensalidades:await readJson('mensalidades.json',[]), financeiro:await readJson('financeiro.json',[]), recebimentos:await readJson('recebimentos.json',[]), checkins:await readJson('checkins.json',[]), historicoPlanos:await readJson('alunos_historico_planos.json',[]), turmas:await readJson('turmas.json',[]) }; }
export async function salvarBaseMatricula(base){ return salvarJsonMultiplosAtomico({ 'alunos.json':base.alunos||[], 'matriculas.json':base.matriculas||[], 'mensalidades.json':base.mensalidades||[], 'financeiro.json':base.financeiro||[], 'recebimentos.json':base.recebimentos||[], 'checkins.json':base.checkins||[], 'alunos_historico_planos.json':base.historicoPlanos||[], 'turmas.json':base.turmas||[] }); }
function statusPagoMatricula(item = {}){
  const s = normalizar(item.status || item.situacao || '');
  if(['pago','paga','recebido','recebida','quitado','baixado'].includes(s)) return true;
  const pago = Number(String(item.valorPago ?? item.valor_pago ?? item.valorRecebido ?? item.valor_recebido ?? 0).replace(',','.'));
  if(Number.isFinite(pago) && pago > 0) return true;
  return Boolean(item.caixaId || item.movimentoCaixaId || item.dataPagamento || item.data_pagamento || item.dataRecebimento || item.pagamento);
}


function finalizarMatriculaCancelada(matricula, { motivo = '', usuario = 'sistema', statusAnterior = '', resumoLimpeza = null, haPagamento = false } = {}){
  const agora = agoraISO();

  matricula.status = 'Cancelada';
  matricula.canceladaEm = matricula.canceladaEm || agora;
  matricula.encerradaEm = matricula.encerradaEm || agora;
  matricula.dataFim = matricula.dataFim || hojeISO();
  matricula.renovacaoAutomatica = false;
  matricula.gerarMensalidadeAutomatica = false;
  matricula.bloqueada = true;
  matricula.bloqueioCheckin = true;
  matricula.motivoCancelamento = motivo || matricula.motivoCancelamento || 'Matrícula cancelada.';

  // A cobrança futura nunca deve continuar vinculada após cancelamento.
  matricula.mensalidadeProximaId = null;
  matricula.financeiroProximoId = null;
  matricula.proximoVencimento = '';

  // Se não houve pagamento real, a matrícula deixa de carregar qualquer obrigação financeira.
  if(!haPagamento){
    matricula.statusFinanceiroInicial = 'Cancelado';
    matricula.statusPagamento = 'Cancelado';
    matricula.mensalidadeInicialId = null;
    matricula.financeiroInicialId = null;
    matricula.recebimentoPromocionalId = null;
    matricula.valorTotalInicial = 0;
    matricula.valorRestante = 0;
    matricula.saldoRestante = 0;
  }

  matricula.atualizadoEm = agora;
  historico(
    matricula,
    'cancelamento_matricula_sem_pendencia',
    'Matrícula cancelada; pendências abertas foram canceladas e preservadas para auditoria.',
    { motivo, statusAnterior, resumoLimpeza, haPagamento },
    usuario
  );
}

function limparPendenciasMatricula(base, matricula, motivo = '', usuario = 'sistema'){
  const alunoId = String(matricula.alunoId || matricula.aluno_id || '');
  const matriculaId = String(matricula.id || '');
  const idsMensalidades = new Set([matricula.mensalidadeInicialId, matricula.mensalidadeProximaId].filter(Boolean).map(String));
  const idsFinanceiro = new Set([matricula.financeiroInicialId, matricula.financeiroProximoId].filter(Boolean).map(String));
  const resumo = { mensalidadesCanceladas:0, financeiroCancelado:0, checkinsBloqueados:0 };

  for(const m of base.mensalidades || []){
    if(String(m.matriculaId || m.matricula_id || '') === matriculaId || idsMensalidades.has(String(m.id || ''))){
      if(m.id) idsMensalidades.add(String(m.id));
      if(m.lancamentoFinanceiroId) idsFinanceiro.add(String(m.lancamentoFinanceiroId));
      if(m.financeiroInicialId) idsFinanceiro.add(String(m.financeiroInicialId));
    }
  }
  for(const f of base.financeiro || []){
    if(String(f.matriculaId || f.matricula_id || '') === matriculaId || idsFinanceiro.has(String(f.id || '')) || idsMensalidades.has(String(f.mensalidadeId || f.mensalidade_id || ''))){
      if(f.id) idsFinanceiro.add(String(f.id));
      if(f.mensalidadeId) idsMensalidades.add(String(f.mensalidadeId));
      if(f.mensalidade_id) idsMensalidades.add(String(f.mensalidade_id));
    }
  }

  base.mensalidades = (base.mensalidades || []).map(m => {
    const pertence = String(m.matriculaId || m.matricula_id || '') === matriculaId || idsMensalidades.has(String(m.id || ''));
    if(!pertence || statusPagoMatricula(m)) return m;
    resumo.mensalidadesCanceladas += 1;
    return { ...m, status:'cancelado', canceladoEm:agoraISO(), motivoCancelamento:motivo || 'Cancelamento da matrícula', atualizadoEm:agoraISO() };
  });
  base.financeiro = (base.financeiro || []).map(f => {
    const pertence = String(f.matriculaId || f.matricula_id || '') === matriculaId || idsFinanceiro.has(String(f.id || '')) || idsMensalidades.has(String(f.mensalidadeId || f.mensalidade_id || ''));
    if(!pertence || statusPagoMatricula(f)) return f;
    resumo.financeiroCancelado += 1;
    return { ...f, status:'cancelado', canceladoEm:agoraISO(), motivoCancelamento:motivo || 'Cancelamento da matrícula', atualizadoEm:agoraISO() };
  });
  base.checkins = (base.checkins || []).map(c => {
    const pertence = String(c.matriculaId || c.matricula_id || '') === matriculaId || String(c.alunoId || '') === alunoId;
    if(!pertence) return c;
    resumo.checkinsBloqueados += 1;
    return { ...c, status:'Bloqueado', bloqueado:true, motivoBloqueio:motivo || 'Cancelamento da matrícula', atualizadoEm:agoraISO() };
  });
  if(!Array.isArray(base.historicoPlanos)) base.historicoPlanos = [];
  base.historicoPlanos.push({ id:`hist_cancelamento_mat_${Date.now()}_${Math.floor(Math.random()*999999)}`, alunoId, matriculaId, matricula:matricula.numero || matriculaId, acao:'cancelamento_logico_pendencias_matricula', motivo, resumo, usuario, criadoEm:agoraISO() });
  return resumo;
}

function resumirMatricula(m, completo=false){ const servicos=Array.isArray(m.servicos)?m.servicos:(Array.isArray(m.turmas)?m.turmas:[]); const r=resumoServicos(servicos); const out={ id:m.id, numero:m.numero, alunoId:m.alunoId, aluno:m.aluno, cpf:m.cpf||'', planoId:m.planoId, plano:m.plano, tipoPlano:m.tipoPlano || m.tipoCobranca || 'Mensal', tipoCobranca:m.tipoCobranca || m.tipoPlano || 'Mensal', status:m.status, dataMatricula:m.dataMatricula||'', vencimentoInicial:m.vencimentoInicial||'', proximoVencimento:m.proximoVencimento||'', diaVencimento:m.diaVencimento||'', dataInicio:m.dataInicio||'', dataFim:m.dataFim||'', valorMatricula:dinheiro(m.valorMatricula), valorServicos:dinheiro(m.valorServicos ?? r.valorServicos), valorMensal:dinheiro(m.valorMensalTotal ?? m.valorMensal), valorMensalTotal:dinheiro(m.valorMensalTotal ?? m.valorMensal), valorTotalInicial:dinheiro(m.valorTotalInicial), taxaMatricula:dinheiro(m.taxaMatricula), descontoMatricula:dinheiro(m.descontoMatricula), resumoValoresEntrada:m.resumoValoresEntrada||'', itensFinanceirosIniciais:Array.isArray(m.itensFinanceirosIniciais)?m.itensFinanceirosIniciais:[], turmaId:m.turmaId||r.turmaIds[0]||'', turmaIds:Array.isArray(m.turmaIds)?m.turmaIds:r.turmaIds, turma:m.turma||r.turma, turmas:servicos, servicos, modalidade:m.modalidade||r.modalidade, professor:m.professor||r.professor, horario:m.horario||r.horario, sala:m.sala||r.sala, formaPagamento:m.formaPagamento||'', mensalidadeInicialId:m.mensalidadeInicialId||null, financeiroInicialId:m.financeiroInicialId||null, recebimentoInicialId:m.recebimentoInicialId||null, mensalidadeProximaId:m.mensalidadeProximaId||null, financeiroProximoId:m.financeiroProximoId||null, criadoEm:m.criadoEm, atualizadoEm:m.atualizadoEm } ; if(completo){ out.historico=Array.isArray(m.historico)?m.historico:[]; out.auditoria=Array.isArray(m.auditoria)?m.auditoria:[]; } return out; }
export async function listarMatriculas(filtros={}){ const base=await carregarBaseMatricula(); const termo=String(filtros.q||filtros.busca||'').toLowerCase(); const status=String(filtros.status||''); const alunoId=String(filtros.alunoId||filtros.aluno_id||''); let dados=base.matriculas||[]; if(status) dados=dados.filter(m=>String(m.status)===status); if(alunoId) dados=dados.filter(m=>String(m.alunoId)===alunoId); if(termo) dados=dados.filter(m=>[m.numero,m.aluno,m.plano,m.turma,m.status].join(' ').toLowerCase().includes(termo)); return { ok:true, success:true, total:dados.length, dados:dados.map(m=>resumirMatricula(m)).sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))) }; }
function mensalidadeFuturaMatricula(base,m){
  const matriculaId=String(m.id || '');
  const idProxima=String(m.mensalidadeProximaId || '');
  const futuras=(base.mensalidades||[]).filter(x=>{
    const mesmaMatricula=String(x.matriculaId || x.matricula_id || '')===matriculaId;
    const idConfere=idProxima && String(x.id || '')===idProxima;
    const recorrente=normalizar(x.origem || '').includes('recorrencia') || normalizar(x.recorrencia || '').includes('mensal');
    return idConfere || (mesmaMatricula && recorrente);
  });
  return futuras.filter(x=>!statusPagoMatricula(x)).sort((a,b)=>String(a.vencimento||'').localeCompare(String(b.vencimento||'')))[0] || futuras[0] || null;
}
export async function obterMatricula(id){
  const base=await carregarBaseMatricula();
  const m=(base.matriculas||[]).find(x=>String(x.id)===String(id)||String(x.numero)===String(id));
  if(!m){ const e=new Error('Matrícula não encontrada.'); e.status=404; throw e; }
  const dados=resumirMatricula(m,true);
  const mensalidadeProxima=mensalidadeFuturaMatricula(base,m);
  const financeiroProximo=(base.financeiro||[]).find(f=>
    String(f.id || '')===String(m.financeiroProximoId || '') ||
    (mensalidadeProxima && String(f.mensalidadeId || f.mensalidade_id || '')===String(mensalidadeProxima.id || ''))
  ) || null;
  dados.mensalidadeProxima=mensalidadeProxima;
  dados.financeiroProximo=financeiroProximo;
  dados.mensalidadeProximaId=mensalidadeProxima?.id || m.mensalidadeProximaId || null;
  dados.financeiroProximoId=financeiroProximo?.id || m.financeiroProximoId || null;
  return { ok:true, success:true, dados };
}
export async function integrarMatriculaAluno(alunoId, planoId, opcoes={}){
  const base=await carregarBaseMatricula();
  if(!Array.isArray(base.recebimentos)) base.recebimentos=[];
  const aluno=base.alunos.find(a=>String(a.id)===String(alunoId));
  if(!aluno){ const e=new Error('Aluno não encontrado.'); e.status=404; throw e; }
  const plano=base.planos.find(p=>String(p.id)===String(planoId));
  if(!plano){ const e=new Error('Plano não encontrado.'); e.status=404; throw e; }

  const existente=matriculaAtivaDoAluno(base.matriculas,aluno.id);
  if(existente && opcoes.permitirTroca!==true){
    return { ok:true, success:true, duplicada:true, aluno, plano, matricula:resumirMatricula(existente), mensagem:'Aluno ja possui matricula ativa ou pendente. Receba a cobranca inicial ou altere a turma.' };
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
  const diaVencimento=Math.max(1,Math.min(28,Number(opcoes.diaVencimento)||Number(String(dataMatricula).slice(8,10))||1));
  const vencimentoInicial=opcoes.vencimento || dataMatricula;
  const proximoVencimento=opcoes.diaVencimento ? proximoMesNoDia(dataMatricula,diaVencimento) : addMeses(vencimentoInicial, 1);
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
  const valorMensalTotal=dinheiro(Math.max(0, valorPlanoBase));
  const diaMatricula=Number(String(dataMatricula).slice(8,10))||diaVencimento;
  const diferencaDias=opcoes.ajustarPrimeiraMensalidade===true ? diaVencimento-diaMatricula : 0;
  const ajusteProporcional=dinheiro(valorMensalTotal*(diferencaDias/30));
  const valorPrimeiraMensalidade=dinheiro(Math.max(0,valorMensalTotal+ajusteProporcional));
  const valorEntradaUnica=dinheiro(Math.max(0, valorMatricula + valorPrimeiraMensalidade - desconto));
  const geraMensalidade = opcoes.gerarMensalidade !== false && planoGeraMensalidade(plano);
  const nome=alunoNome(aluno);
  const origem = tipoAvulso(tipo) ? `venda_${normalizar(tipo).replace('-','_')}` : 'matricula_plano';
  const itensEntrada = [
    { descricao:'Taxa de matricula', valor:valorMatricula },
    { descricao:'Plano mensal', valor:valorMensalTotal },
    ...(ajusteProporcional ? [{ descricao:`Ajuste proporcional de ${Math.abs(diferencaDias)} dia(s)`, valor:ajusteProporcional }] : []),
    { descricao:'Desconto inicial', valor:dinheiro(-desconto) }
  ];
  const resumoValoresEntrada = `Taxa de matricula ${valorMatricula.toFixed(2)} + plano mensal ${valorMensalTotal.toFixed(2)} + ajuste proporcional ${ajusteProporcional.toFixed(2)} - desconto ${desconto.toFixed(2)} = total ${valorEntradaUnica.toFixed(2)}`;

  let mensalidadeInicial=null;
  let financeiroInicial=null;
  let recebimentoInicial=null;
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
    taxaMatricula:valorMatricula,
    valorPlano:valorPlanoBase,
    valorServicos,
    valorMensal:valorMensalTotal,
    valorMensalTotal,
    valorPrimeiraMensalidade,
    ajusteProporcional,
    diaVencimento,
    descontoMatricula:desconto,
    valorTotalInicial:valorEntradaUnica,
    itensFinanceirosIniciais:itensEntrada,
    resumoValoresEntrada,
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
    formaPagamento:opcoes.formaPagamento||'',
    observacao:opcoes.observacao||'',
    criadoEm:agoraISO(),
    atualizadoEm:agoraISO(),
    historico:[],
    auditoria:[]
  };

  if(valorEntradaUnica > 0 || geraMensalidade || tipoAvulso(tipo)){
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
      taxaMatricula:valorMatricula,
      valorPlano:valorPlanoBase,
      valorServicos,
      valor:valorPrimeiraMensalidade,
      total:valorEntradaUnica,
      valorOriginal:valorEntradaUnica,
      valorTotalInicial:valorEntradaUnica,
      valorPago:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRecebido:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRestante:valorEntradaUnica > 0 ? valorEntradaUnica : 0,
      servicos,
      itens:itensEntrada,
      resumoValores:resumoValoresEntrada,
      formaPagamento:opcoes.formaPagamento||'',
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
      taxaMatricula:valorMatricula,
      valorPlano:valorPlanoBase,
      valorMensal:valorPrimeiraMensalidade,
      valorMensalNormal:valorMensalTotal,
      ajusteProporcional,
      diaVencimento,
      valorServicos,
      valorPago:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRecebido:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRestante:valorEntradaUnica > 0 ? valorEntradaUnica : 0,
      servicos,
      itens:itensEntrada,
      resumoValores:resumoValoresEntrada,
      vencimento:vencimentoInicial,
      formaPagamento:opcoes.formaPagamento||'',
      status:valorEntradaUnica > 0 ? 'Aberto' : 'Pago',
      origem:'matricula_inicial_unificada',
      ativarMatriculaAoReceber:true,
      criadoEm:agoraISO(),
      atualizadoEm:agoraISO()
    };
    mensalidadeInicial.lancamentoFinanceiroId=financeiroInicial.id;
    mensalidadeInicial.financeiroInicialId=financeiroInicial.id;
    base.financeiro.push(financeiroInicial);

    recebimentoInicial={
      id:`rec_${Date.now()}_${Math.floor(Math.random()*999999)}`,
      descricao:`Entrada matricula + mensalidade - ${nome || aluno.id}`,
      categoria:'Matricula e mensalidade',
      pessoa:nome,
      cliente:nome,
      aluno:nome,
      alunoId:aluno.id,
      matriculaId:matricula.id,
      referencia:matricula.numero,
      mensalidadeId:mensalidadeInicial.id,
      lancamentoFinanceiroId:financeiroInicial.id,
      planoId:plano.id || '',
      plano:plano.nome || 'SEM PLANO',
      vencimento:vencimentoInicial,
      valor:valorEntradaUnica,
      valorBruto:valorEntradaUnica,
      total:valorEntradaUnica,
      valorDevido:valorEntradaUnica,
      valorMatricula,
      taxaMatricula:valorMatricula,
      valorPlano:valorPlanoBase,
      valorMensal:valorPrimeiraMensalidade,
      valorMensalNormal:valorMensalTotal,
      ajusteProporcional,
      diaVencimento,
      valorServicos,
      descontoMatricula:desconto,
      valorRecebido:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorPago:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorLiquido:valorEntradaUnica > 0 ? 0 : valorEntradaUnica,
      valorRestante:valorEntradaUnica > 0 ? valorEntradaUnica : 0,
      saldo:valorEntradaUnica > 0 ? valorEntradaUnica : 0,
      formaPagamento:opcoes.formaPagamento||'',
      forma:opcoes.formaPagamento||'',
      status:valorEntradaUnica > 0 ? 'aberto' : 'recebido',
      origem:'matricula_inicial_unificada',
      recorrencia:'entrada_unica',
      ativarMatriculaAoReceber:true,
      itens:itensEntrada,
      resumoValores:resumoValoresEntrada,
      observacao:opcoes.observacao||'',
      criadoEm:agoraISO(),
      atualizadoEm:agoraISO()
    };
    mensalidadeInicial.recebimentoId=recebimentoInicial.id;
    financeiroInicial.recebimentoId=recebimentoInicial.id;
    base.recebimentos.push(recebimentoInicial);

    // A próxima mensalidade é uma PREVISÃO da matrícula, não uma dívida.
    // O motor de cobrança a emitirá somente no dia do vencimento programado.
    // Nunca criar aqui registros abertos em mensalidades/financeiro.
    if(false && tipo==='Mensal' && plano?.id && valorMensalTotal > 0){
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
        diaVencimento,
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
  matricula.recebimentoInicialId=recebimentoInicial?.id||null;
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
        diaVencimento,
    valorMensalTotal,
    proximoVencimento,
    mensalidadeProximaId:matricula.mensalidadeProximaId,
    financeiroProximoId:matricula.financeiroProximoId,
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

  for(const t of base.turmas){ t.alunosMatriculados=(base.matriculas||[]).filter(m=>['Ativa','Pendente','Trancada'].includes(String(m.status||'')) && Array.isArray(m.turmaIds) && m.turmaIds.some(id=>String(id)===String(idTurma(t)))).length; }

  await salvarBaseMatricula(base);
  return { ok:true, success:true, aluno, plano, matricula:resumirMatricula(matricula), mensalidadeGerada:mensalidadeInicial, mensalidadeProxima, financeiroInicial, recebimentoInicial, financeiroProximo, mensagem:'Matrícula pendente criada. Receba a entrada única para ativar o aluno.' };
}

export async function trocarPlanoAluno(alunoId, novoPlanoId, opcoes={}){ return integrarMatriculaAluno(alunoId, novoPlanoId, {...opcoes, permitirTroca:true}); }
export async function alterarStatusMatricula(id,status,motivo='',usuario='sistema'){
  const base=await carregarBaseMatricula();
  const idx=base.matriculas.findIndex(x=>String(x.id)===String(id)||String(x.numero)===String(id));
  if(idx < 0){ const e=new Error('Matrícula não encontrada.'); e.status=404; throw e; }
  const m=base.matriculas[idx];
  const ant=m.status;
  const stNorm=normalizar(status);
  let resumoLimpeza=null;
  if(['cancelada','cancelado','encerrada','encerrado','inativa','inativo'].includes(stNorm)){
    resumoLimpeza = limparPendenciasMatricula(base, m, motivo, usuario);
    const haPagamento = (base.financeiro||[]).some(f=>String(f.matriculaId||f.matricula_id||'')===String(m.id)&&statusPagoMatricula(f)) ||
      (base.mensalidades||[]).some(me=>String(me.matriculaId||me.matricula_id||'')===String(m.id)&&statusPagoMatricula(me));
    finalizarMatriculaCancelada(m, {
      motivo,
      usuario,
      statusAnterior: ant,
      resumoLimpeza,
      haPagamento
    });
  } else {
    m.status=status;
    m.atualizadoEm=agoraISO();
    historico(m,'alterar_status',`Status alterado de ${ant} para ${status}.`,{motivo,statusAnterior:ant,statusAtual:status},usuario);
  }
  const aluno=base.alunos.find(a=>String(a.id)===String(m.alunoId));
  if(aluno){
    if(['cancelada','cancelado','encerrada','encerrado','inativa','inativo'].includes(stNorm)){
      aluno.statusMatricula = 'Cancelada';
      aluno.matriculaStatus = 'Cancelada';
      aluno.statusPagamento = 'Cancelado';
      aluno.bloqueioCheckin = true;
      aluno.renovacaoAutomatica = false;
      aluno.proximoVencimento = '';
      aluno.mensalidadeProximaId = null;
      aluno.financeiroProximoId = null;
    } else {
      aluno.statusMatricula = status;
      aluno.matriculaStatus = status;
    }
    aluno.atualizadoEm=agoraISO();
  }
  await salvarBaseMatricula(base);
  return { ok:true, success:true, dados:resumirMatricula(m,true), removida:false, resumoLimpeza, mensagem:'Status da matrícula atualizado; pendências abertas foram canceladas e preservadas para auditoria.' };
}
export async function atualizarTurmasMatricula(id, opcoes={}, usuario='sistema'){
  const base=await carregarBaseMatricula();
  const m=base.matriculas.find(x=>String(x.id)===String(id)||String(x.numero)===String(id));
  if(!m){ const e=new Error('Matricula nao encontrada.'); e.status=404; throw e; }
  const plano=base.planos.find(p=>String(p.id)===String(m.planoId || opcoes.planoId || '')) || {};
  const turmas=montarServicos(base, plano, { ...opcoes, tipoCobranca:m.tipoCobranca || m.tipoPlano || tipoPlano(plano) });
  const r=resumoServicos(turmas);
  Object.assign(m,{
    turmaId:r.turmaIds[0]||'',
    turmaIds:r.turmaIds,
    turma:r.turma,
    turmas,
    servicos:turmas,
    modalidade:r.modalidade,
    professor:r.professor,
    horario:r.horario,
    sala:r.sala,
    valorServicos:0,
    atualizadoEm:agoraISO()
  });
  const aluno=base.alunos.find(a=>String(a.id)===String(m.alunoId));
  if(aluno){
    Object.assign(aluno,{
      turmaId:m.turmaId,
      turma:m.turma,
      turmaIds:m.turmaIds,
      turmas,
      servicosContratados:turmas,
      professor:m.professor,
      horario:m.horario,
      valorServicos:0,
      atualizadoEm:agoraISO()
    });
  }
  const chk=(base.checkins||[]).find(c=>String(c.matriculaId||'')===String(m.id)&&c.tipo==='vinculo_matricula');
  if(chk) Object.assign(chk,{ turmaIds:m.turmaIds, turmas, servicos:turmas, atualizadoEm:agoraISO() });
  for(const t of base.turmas){ t.alunosMatriculados=(base.matriculas||[]).filter(mat=>['Ativa','Pendente','Trancada'].includes(String(mat.status||'')) && Array.isArray(mat.turmaIds) && mat.turmaIds.some(tid=>String(tid)===String(idTurma(t)))).length; }
  historico(m,'atualizar_turmas','Turmas da matricula atualizadas sem alterar financeiro.',{ turmaIds:m.turmaIds },usuario);
  await salvarBaseMatricula(base);
  return { ok:true, success:true, dados:resumirMatricula(m,true), mensagem:'Turmas atualizadas. O financeiro nao foi alterado.' };
}

export async function removerTurmasMatricula(id, usuario='sistema'){ const base=await carregarBaseMatricula(); const m=base.matriculas.find(x=>String(x.id)===String(id)||String(x.numero)===String(id)); if(!m){ const e=new Error('Matricula nao encontrada.'); e.status=404; throw e; } m.servicos=[]; m.turmas=[]; m.turmaIds=[]; m.turmaId=''; m.turma=''; m.modalidade=''; m.professor=''; m.horario=''; m.sala=''; m.valorServicos=0; m.atualizadoEm=agoraISO(); const aluno=base.alunos.find(a=>String(a.id)===String(m.alunoId)); if(aluno){ Object.assign(aluno,{ turmaId:'', turma:'', turmaIds:[], turmas:[], servicosContratados:[], professor:'', horario:'', valorServicos:0, atualizadoEm:agoraISO() }); } for(const t of base.turmas){ t.alunosMatriculados=(base.matriculas||[]).filter(mat=>['Ativa','Pendente','Trancada'].includes(String(mat.status||'')) && Array.isArray(mat.turmaIds) && mat.turmaIds.some(tid=>String(tid)===String(idTurma(t)))).length; } historico(m,'remover_turmas','Aluno removido de todas as turmas sem alterar financeiro.',{},usuario); await salvarBaseMatricula(base); return { ok:true, success:true, dados:resumirMatricula(m,true), mensagem:'Aluno removido de todas as turmas. O financeiro foi mantido.' }; }
