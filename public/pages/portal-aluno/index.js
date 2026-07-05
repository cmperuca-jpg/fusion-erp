const API = '/api/portal-aluno/acessar';
let dadosPortal = null;
let autoTimer = null;
let alunoCompletoAvaliacoesCarregado = false;
let alunoCompletoAvaliacoesCarregando = false;
let abaMobileInicialAplicada = false;
const $ = s => document.querySelector(s);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-';}
function data(v){const s=String(v||'').slice(0,10);return s?s.split('-').reverse().join('/'):'-';}
function statusClass(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function mostrar(msg){const el=$('#alerta');el.textContent=msg;el.classList.remove('hidden');}
function esconderMsg(){ $('#alerta').classList.add('hidden'); }
function vazio(msg){return `<p class="muted">${esc(msg)}</p>`;}
function num(v){return Number(v||0).toLocaleString('pt-BR');}
function pct(v){return Math.max(0, Math.min(100, Number(v)||0));}

async function acessar(ev){
  ev.preventDefault(); esconderMsg();
  const payload={cpf:$('#cpf').value,telefone:$('#telefone').value};
  try{
    const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const json=await resp.json().catch(()=>({}));
    if(!resp.ok||json.ok===false)throw new Error(json.mensagem||`Erro HTTP ${resp.status}`);
    dadosPortal=json; sessionStorage.setItem('fusion_portal_aluno',JSON.stringify(json)); render(); iniciarAtualizacaoAutomatica();
  }catch(e){mostrar(e.message||'Erro ao acessar.');}
}

async function atualizarDashboard(){
  if(!dadosPortal?.aluno?.id) return;
  try{
    const resp = await fetch(`/api/portal-aluno/alunos/${encodeURIComponent(dadosPortal.aluno.id)}/dashboard`, {cache:'no-store'});
    const json = await resp.json().catch(()=>({}));
    if(resp.ok && json.ok){ dadosPortal = json; sessionStorage.setItem('fusion_portal_aluno', JSON.stringify(json)); render(); }
  }catch{}
}
function iniciarAtualizacaoAutomatica(){ clearInterval(autoTimer); autoTimer=setInterval(atualizarDashboard,30000); }

function render(){
  const d=dadosPortal;if(!d)return;
  $('#telaLogin').classList.add('hidden');$('#telaPortal').classList.remove('hidden');
  $('#nomeAluno').textContent=d.aluno.nome;
  $('#infoAluno').textContent=[d.aluno.plano,d.aluno.professorNome?`Professor: ${d.aluno.professorNome}`:''].filter(Boolean).join(' · ');
  $('#statusAluno').textContent=d.aluno.status||'ativo';
  $('#ultimaAtualizacao').textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  $('#kpiTreinos').textContent=d.resumo.treinos||0;
  $('#kpiExecucoes').textContent=d.resumo.execucoes||0;
  $('#kpiFrequencia').textContent=d.resumo.frequenciaMes?.presentes||0;
  $('#kpiStreak').textContent=`${d.resumo.streak?.atual||0} dias`;
  $('#kpiAberto').textContent=d.resumo.financeiroAberto||0;
  $('#kpiVencimento').textContent=data(d.resumo.proximoVencimento);
  $('#kpiVolume').textContent=`${num(d.resumo.volumeTotal||0)} kg`;
  $('#resumoInicio').innerHTML=`<div class="item"><strong>Plano</strong><small>${esc(d.aluno.plano||'-')}</small></div><div class="item"><strong>Professor responsável</strong><small>${esc(d.aluno.professorNome||'-')}</small></div><div class="item"><strong>Frequência no mês</strong><small>${d.resumo.frequenciaMes?.presentes||0} presença(s)</small></div><div class="item"><strong>Sequência atual</strong><small>${d.resumo.streak?.atual||0} dia(s)</small></div>`;
  renderTreinoAgora(); renderProgressao(); renderHistoricoVolumes(); renderTreinos(); renderEvolucao(); renderIAProgressao(); renderMetas(); renderAgenda(); renderAvaliacoes(); renderPagamentos(); renderPerfil();
  aplicarAbaInicialMobile();
}

function isMobileAluno(){ return window.matchMedia && window.matchMedia('(max-width: 800px)').matches; }
function ativarAbaAluno(tab){
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.id===`tab-${tab}`));
  if(tab==='treinos') carregarTreinosV3Aluno();
  window.scrollTo({top:0,behavior:'smooth'});
}
function aplicarAbaInicialMobile(){
  if(abaMobileInicialAplicada || !isMobileAluno()) return;
  abaMobileInicialAplicada = true;
  ativarAbaAluno('treinos');
}

function renderTreinoAgora(){
  const op=dadosPortal.operacional||{}; const box=$('#treinoAgora'); if(!box) return;
  const ch=op.checkinHoje; const t=op.treinoAtivo;
  if(!ch && !t){ box.innerHTML=vazio('Nenhum check-in ou treino em execução hoje.'); return; }
  if(!t){ box.innerHTML=`<div class="item"><strong>Check-in realizado</strong><small>Status: ${esc(ch.status)} · Entrada: ${esc(ch.entrada||'-')}</small></div><p>O treino ainda não foi iniciado.</p>`; return; }
  const r=t.resumo||{}; const atual=t.exercicioAtual||{}; const prox=t.proximoExercicio||{};
  box.innerHTML=`<div class="exec-head"><div><strong>${esc(atual.nome||'Exercício atual')}</strong><small>${esc(t.status||'Em andamento')}</small></div><b>${r.percentual||0}%</b></div><div class="progress"><i style="width:${pct(r.percentual)}%"></i></div><div class="mini-grid"><div><span>Concluídos</span><b>${r.concluidos||0}/${r.total||0}</b></div><div><span>Carga</span><b>${esc(atual.cargaRealizada||atual.cargaPrevista||'-')} kg</b></div><div><span>Repetições</span><b>${esc(atual.repeticoesRealizadas||atual.repeticoes||'-')}</b></div><div><span>Descanso</span><b>${esc(atual.descanso||'-')}</b></div><div><span>Volume</span><b>${num(t.volume||0)} kg</b></div><div><span>Próximo</span><b>${esc(prox.nome||'-')}</b></div></div>`;
}

function renderProgressao(){
  const box=$('#progressaoAluno'); if(!box) return;
  const t=dadosPortal.operacional?.treinoAtivo; const p=t?.progressaoAtual; const prs=dadosPortal.operacional?.prs||[];
  if(p){ box.innerHTML=`<div class="mini-grid"><div><span>Melhor carga</span><b>${num(p.melhorCarga)} kg</b></div><div><span>Melhor volume</span><b>${num(p.melhorVolume)} kg</b></div><div><span>Última carga</span><b>${num(p.ultima?.carga||0)} kg</b></div></div>`; return; }
  box.innerHTML=prs.length?prs.slice(0,3).map(x=>`<div class="item compact"><strong>${esc(x.exercicio)}</strong><small>PR: ${num(x.carga)} kg · Volume: ${num(x.volume)} kg</small></div>`).join(''):vazio('Ainda não há histórico suficiente para progressão.');
}

function renderHistoricoVolumes(){
  const lista=dadosPortal.operacional?.historicoVolumes||[]; const box=$('#historicoVolumes'); if(!box) return;
  box.innerHTML=lista.length?lista.slice(-6).reverse().map(x=>`<div class="item compact"><strong>${data(x.data)}</strong><small>Volume: ${num(x.volume)} kg · ${esc(x.status||'-')}</small></div>`).join(''):vazio('Nenhuma execução registrada.');
}

function renderTreinos(){
  carregarTreinosV3Aluno();
}

function carregarTreinosV3Aluno(){
  const frame = $('#treinosV3Frame');
  if(!frame || !dadosPortal?.aluno?.id) return;
  const alunoId = encodeURIComponent(dadosPortal.aluno.id);
  const url = `/pages/treinos-v3-aluno/?embed=1&alunoId=${alunoId}`;
  if(frame.dataset.src !== url){
    frame.dataset.src = url;
    frame.src = url;
  }
  ajustarFrameTreinosV3();
}

function ajustarFrameTreinosV3(altura){
  const frame = $('#treinosV3Frame');
  if(!frame) return;

  // Mobile First: no celular o iframe precisa manter a altura da tela visível.
  // Se ele receber a altura total do conteúdo, o modal interno fica centralizado
  // no iframe inteiro e o aluno precisa rolar muito até encontrá-lo.
  if(isMobileAluno()){
    const hMobile = Math.max(520, window.innerHeight - 130);
    frame.style.height = hMobile + 'px';
    frame.style.minHeight = hMobile + 'px';
    return;
  }

  const desconto = 120;
  const minBase = Math.max(760, window.innerHeight - desconto);
  const h = Math.max(minBase, Number(altura || 0));
  frame.style.height = h + 'px';
  frame.style.minHeight = minBase + 'px';
}

window.addEventListener('message', function(ev){
  const data = ev && ev.data ? ev.data : {};
  if(data && data.tipo === 'fusion-treinos-v3-resize'){
    ajustarFrameTreinosV3(data.altura);
  }
});

window.addEventListener('resize', function(){
  ajustarFrameTreinosV3();
});

function barra(label, valor, max, extra=''){
  const p = max ? Math.round((Number(valor||0)/max)*100) : 0;
  return `<div class="bar-item"><div><strong>${esc(label)}</strong><span>${extra || num(valor)}</span></div><div class="bar"><i style="width:${pct(p)}%"></i></div></div>`;
}

function renderEvolucao(){
  const op=dadosPortal.operacional||{}; const vols=op.historicoVolumes||[]; const cargas=op.evolucaoCargas||[]; const prs=op.prs||[]; const er=op.evolucaoResumo||{};
  const maxVol=Math.max(1,...vols.map(v=>Number(v.volume)||0));
  $('#graficoVolumes').innerHTML=vols.length?vols.map(v=>barra(data(v.data),v.volume,maxVol,`${num(v.volume)} kg`)).join(''):vazio('Sem volumes registrados.');
  $('#graficoCargas').innerHTML=cargas.length?cargas.map(c=>`<div class="chart-card"><strong>${esc(c.exercicio)}</strong>${(c.pontos||[]).map(p=>barra(data(p.data),p.carga,Math.max(1,c.melhorCarga),`${num(p.carga)} kg`)).join('')}</div>`).join(''):vazio('Sem histórico de cargas.');
  $('#listaPR').innerHTML=prs.length?prs.map(p=>`<div class="item"><strong>${esc(p.exercicio)}</strong><small>Carga: ${num(p.carga)} kg · Melhor volume: ${num(p.volume)} kg</small></div>`).join(''):vazio('Nenhum PR registrado.');
  $('#resumoEvolucao').innerHTML=`<div class="mini-grid"><div><span>Execuções 30d</span><b>${er.execucoes30||0}</b></div><div><span>Volume 30d</span><b>${num(er.volume30||0)} kg</b></div><div><span>Execuções 90d</span><b>${er.execucoes90||0}</b></div><div><span>Volume 90d</span><b>${num(er.volume90||0)} kg</b></div><div><span>Variação</span><b>${num(er.variacaoVolume||0)}%</b></div></div>`;
}


function renderIAProgressao(){
  const ia = dadosPortal.operacional?.iaProgressao || dadosPortal.iaProgressao || null;
  if(!ia){
    ['#iaResumo','#iaAluno','#iaProfessor','#iaExercicios'].forEach(s=>{ const el=$(s); if(el) el.innerHTML=vazio('IA ainda sem dados suficientes.'); });
    return;
  }
  const r = ia.resumo || {};
  const resumo = $('#iaResumo');
  if(resumo) resumo.innerHTML = `<div class="mini-grid"><div><span>Índice geral</span><b>${num(r.score||0)}/100</b></div><div><span>Classificação</span><b>${esc(r.classificacao||'-')}</b></div><div><span>Avaliados</span><b>${r.avaliados||0}</b></div><div><span>Evoluindo</span><b>${r.evoluindo||0}</b></div><div><span>Estáveis</span><b>${r.estaveis||0}</b></div><div><span>Regressão</span><b>${r.regressao||0}</b></div></div>`;
  const aluno = $('#iaAluno');
  if(aluno) aluno.innerHTML = (ia.aluno||[]).length ? (ia.aluno||[]).map(x=>`<div class="ia-note aluno"><strong>${esc(x)}</strong></div>`).join('') : vazio('Sem recomendação para o aluno.');
  const prof = $('#iaProfessor');
  if(prof) prof.innerHTML = (ia.professor||[]).length ? (ia.professor||[]).map(x=>`<div class="ia-note professor"><strong>${esc(x)}</strong></div>`).join('') : vazio('Sem alerta específico para o professor.');
  const exs = ia.exercicios || [];
  const box = $('#iaExercicios');
  if(box) box.innerHTML = exs.length ? exs.map(e=>`<div class="ia-ex"><div><strong>${esc(e.exercicio)}</strong><small>${esc(e.tendencia)} · risco ${esc(e.risco)} · índice ${num(e.indice)}/100</small></div><div class="mini-grid"><div><span>Carga atual</span><b>${num(e.ultimaCarga)} kg</b></div><div><span>Sugestão</span><b>${num(e.recomendacao?.cargaSugerida)} kg</b></div><div><span>Ação</span><b>${esc(e.recomendacao?.acao||'-')}</b></div><div><span>Reps sugeridas</span><b>${num(e.recomendacao?.repeticoesSugeridas||0)}</b></div></div><small>${e.estagnado?'Estagnação detectada. ':''}Variação de volume: ${num(e.percentualVolume||0)}%</small></div>`).join('') : vazio('Sem exercícios avaliados pela IA.');
}

function renderMetas(){
  const op=dadosPortal.operacional||{}; const metas=op.metas||[]; const conquistas=op.conquistas||[]; const avisos=op.avisos||[];
  $('#listaMetas').innerHTML=metas.length?metas.map(m=>`<div class="goal"><div><strong>${esc(m.nome)}</strong><small>${num(m.atual)} de ${num(m.meta)} ${esc(m.unidade)}</small></div><div class="progress"><i style="width:${pct(m.percentual)}%"></i></div><b>${m.percentual}%</b></div>`).join(''):vazio('Nenhuma meta configurada.');
  $('#listaConquistas').innerHTML=conquistas.length?conquistas.map(c=>`<div class="badge-win"><b>🏆 ${esc(c.nome)}</b><small>${esc(c.descricao)}</small></div>`).join(''):vazio('Conquistas serão exibidas conforme o aluno evoluir.');
  $('#listaAvisos').innerHTML=avisos.length?avisos.map(a=>`<div class="item"><strong>${esc(a.titulo)}</strong><small>${data(a.data)} · ${esc(a.professor||'Professor')}</small><small>${esc(a.mensagem)}</small></div>`).join(''):vazio('Nenhum aviso no momento.');
}

function renderAgenda(){
  const lista=dadosPortal.operacional?.agenda||[];
  $('#listaAgenda').innerHTML=lista.length?lista.map(a=>`<div class="item agenda"><strong>${data(a.data)} — ${esc(a.titulo)}</strong><small>${esc(a.tipo)} · ${esc(a.status||'')}</small></div>`).join(''):vazio('Nenhum próximo treino agendado.');
}

function valorNum(v){
  const n = Number(String(v ?? '').replace(/\./g,'').replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0] || 0);
  return Number.isFinite(n) ? n : 0;
}
function campoAv(av={}, nomes=[]){
  for(const nome of nomes){
    const v = av[nome];
    if(v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}
function dataAvaliacao(av={}){ return normalizarDataISO(campoAv(av,['data','dataAvaliacao','criado_em','criadoEm'])); }
function normalizarDataISO(v){
  const txt = String(v || '').trim();
  if(!txt) return '';
  if(/^\d{4}-\d{2}-\d{2}/.test(txt)) return txt.slice(0,10);
  const br = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(br){
    const d = br[1].padStart(2,'0'), m = br[2].padStart(2,'0'), y = br[3];
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(txt);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0,10);
}
function campoAluno(nomes=[]){
  const fontes = [dadosPortal?.alunoCompleto, dadosPortal?.aluno, dadosPortal?.dadosAluno, dadosPortal?.perfil, dadosPortal?.cadastro];
  for(const fonte of fontes){
    if(!fonte) continue;
    for(const nome of nomes){
      const v = fonte[nome];
      if(v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  return '';
}
function dataNascimentoAluno(av={}){
  return normalizarDataISO(campoAv(av,['dataNascimento','data_nascimento','nascimento','nascimentoAluno','dataNascimentoAluno','alunoDataNascimento']) || campoAluno(['dataNascimento','data_nascimento','nascimento','dtNascimento','dt_nascimento','dataNasc','data_nasc']));
}
function calcularIdadePorNascimento(nascimento){
  const iso = normalizarDataISO(nascimento);
  if(!iso) return '';
  const [ano, mes, dia] = iso.split('-').map(Number);
  if(!ano || !mes || !dia) return '';
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const m = (hoje.getMonth()+1) - mes;
  if(m < 0 || (m === 0 && hoje.getDate() < dia)) idade--;
  return idade > 0 && idade < 120 ? idade : '';
}
function idadeAluno(av={}){
  const direta = valorNum(campoAv(av,['idade','idadeAluno']) || campoAluno(['idade']));
  if(direta > 0) return Math.round(direta);
  return calcularIdadePorNascimento(dataNascimentoAluno(av));
}
function somarDiasISO(dataIso, dias=45){
  const iso = normalizarDataISO(dataIso);
  if(!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0,10);
}
async function carregarAlunoCompletoParaAvaliacao(){
  if(alunoCompletoAvaliacoesCarregado || alunoCompletoAvaliacoesCarregando || !dadosPortal?.aluno?.id) return;
  alunoCompletoAvaliacoesCarregando = true;
  try{
    let encontrado = null;
    try{
      const r = await fetch(`/api/alunos/${encodeURIComponent(dadosPortal.aluno.id)}`, {cache:'no-store'});
      const j = await r.json().catch(()=>({}));
      if(r.ok) encontrado = j.aluno || j.dados || j.data || j;
    }catch{}
    if(!encontrado || !dataNascimentoAluno(encontrado)){
      const r = await fetch('/api/alunos', {cache:'no-store'});
      const j = await r.json().catch(()=>({}));
      const lista = Array.isArray(j) ? j : (j.alunos || j.dados || j.data || []);
      encontrado = lista.find(a => String(a.id || a._id || a.alunoId || a.aluno_id) === String(dadosPortal.aluno.id)) || encontrado;
    }
    if(encontrado && typeof encontrado === 'object'){
      dadosPortal.alunoCompleto = encontrado;
      dadosPortal.aluno = {...encontrado, ...dadosPortal.aluno};
      sessionStorage.setItem('fusion_portal_aluno', JSON.stringify(dadosPortal));
    }
  }catch{}
  alunoCompletoAvaliacoesCarregado = true;
  alunoCompletoAvaliacoesCarregando = false;
  renderAvaliacoes();
}
function classificarImcValor(imc){
  const n = valorNum(imc);
  if(!n) return '-';
  if(n < 18.5) return 'Baixo peso';
  if(n < 25) return 'Normal';
  if(n < 30) return 'Sobrepeso';
  if(n < 35) return 'Obesidade I';
  if(n < 40) return 'Obesidade II';
  return 'Obesidade III';
}
function classificarRcq(av={}){
  const rcq = valorNum(campoAv(av,['rcq']));
  if(!rcq) return '-';
  const sexo = String(campoAv(av,['sexo','risco_sexo']) || dadosPortal?.aluno?.sexo || '').toLowerCase();
  const feminino = sexo.includes('fem') || sexo === '1';
  if(feminino){
    if(rcq < .80) return 'Risco baixo';
    if(rcq < .86) return 'Risco moderado';
    return 'Risco aumentado';
  }
  if(rcq < .90) return 'Risco baixo';
  if(rcq < 1) return 'Risco moderado';
  return 'Risco aumentado';
}
function deltaAtualAnterior(atual, anterior){
  const a = valorNum(atual), b = valorNum(anterior);
  if(!a || !b) return {texto:'-', classe:'neutro'};
  const d = a - b;
  if(Math.abs(d) < 0.01) return {texto:'0', classe:'neutro'};
  return {texto:`${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}`, classe:d > 0 ? 'subiu' : 'desceu'};
}
function diagnosticoAvaliacao(av={}, anterior=null){
  const imc = valorNum(av.imc);
  const gordura = valorNum(campoAv(av,['percentual_gordura','gordura','percentualGordura']));
  const rcq = valorNum(av.rcq);
  const massaMagra = valorNum(campoAv(av,['massa_magra','massaMagra']));
  const pontos = [];
  const atencao = [];
  const sugestoes = [];

  if(Array.isArray(av.diagnostico_pontos) && av.diagnostico_pontos.length) pontos.push(...av.diagnostico_pontos);
  if(Array.isArray(av.diagnostico_atencao) && av.diagnostico_atencao.length) atencao.push(...av.diagnostico_atencao);
  if(Array.isArray(av.diagnostico_conduta) && av.diagnostico_conduta.length) sugestoes.push(...av.diagnostico_conduta);
  if(imc){
    const c = classificarImcValor(imc);
    if(c === 'Normal') pontos.push('IMC dentro da faixa considerada adequada.');
    else atencao.push(`IMC classificado como ${c.toLowerCase()}.`);
  }
  if(gordura){
    if(gordura <= 22) pontos.push('Percentual de gordura em faixa controlada para acompanhamento físico.');
    else atencao.push('Percentual de gordura merece atenção e acompanhamento na próxima reavaliação.');
  }
  if(rcq){
    const c = classificarRcq(av);
    if(c === 'Risco baixo') pontos.push('Relação cintura/quadril em risco baixo.');
    else atencao.push(`RCQ com ${c.toLowerCase()}.`);
  }
  if(massaMagra) pontos.push('Massa magra registrada para comparação nas próximas avaliações.');

  if(anterior){
    const dpeso = deltaAtualAnterior(av.peso, anterior.peso);
    const dgord = deltaAtualAnterior(campoAv(av,['percentual_gordura','gordura']), campoAv(anterior,['percentual_gordura','gordura']));
    if(dpeso.texto !== '-') sugestoes.push(`Peso variou ${dpeso.texto} kg desde a avaliação anterior.`);
    if(dgord.texto !== '-') sugestoes.push(`Gordura corporal variou ${dgord.texto} ponto(s).`);
  }
  if(!pontos.length) pontos.push('Dados principais registrados para acompanhamento da evolução.');
  if(!atencao.length) atencao.push('Nenhum alerta crítico automático com os dados preenchidos.');
  sugestoes.push('Mantenha a consistência no treino e realize nova avaliação no prazo definido pelo professor.');
  sugestoes.push('Use o relatório para comparar evolução de composição corporal, perímetros e condicionamento.');

  const resumo = atencao.some(x => x.toLowerCase().includes('risco aumentado') || x.toLowerCase().includes('obesidade')) ? 'Acompanhamento prioritário' : 'Evolução em acompanhamento';
  return {resumo, pontos, atencao, sugestoes};
}
function fotoAvaliacao(av={}, campo, rotulo){
  const src = av[campo] || av[`${campo}_base64`] || '';
  return `<div class="aval-foto"><div>${src ? `<img src="${esc(src)}" alt="${esc(rotulo)}">` : `<span>${esc(rotulo)}</span>`}</div><strong>${esc(rotulo)}</strong></div>`;
}
function linhaComparativo(label, atual, anterior, sufixo=''){
  const d = deltaAtualAnterior(atual, anterior);
  return `<div class="aval-comp-row"><span>${esc(label)}</span><b>${esc(atual || '-')} ${sufixo}</b><em class="${d.classe}">${esc(d.texto)}${d.texto !== '-' ? ' ' + sufixo : ''}</em></div>`;
}
function perimetrosRelatorio(av={}, anterior={}){
  const itens = [
    ['Pescoço','pescoco'],['Ombro','ombro'],['Tórax','torax_relaxado'],['Cintura','cintura'],['Abdômen','abdomen'],['Quadril','quadril'],
    ['Braço D','braco_relaxado_direito'],['Braço E','braco_relaxado_esquerdo'],['Coxa D','coxa_proximal_direita'],['Coxa E','coxa_proximal_esquerda'],['Panturrilha D','panturrilha_direita'],['Panturrilha E','panturrilha_esquerda']
  ];
  return itens.map(([label,key])=>{
    const atual = campoAv(av,[key]);
    if(!atual) return '';
    const d = deltaAtualAnterior(atual, campoAv(anterior,[key]));
    return `<div class="aval-medida"><span>${esc(label)}</span><strong>${esc(atual)} cm</strong><em class="${d.classe}">${esc(d.texto)}${d.texto !== '-' ? ' cm' : ''}</em></div>`;
  }).join('') || vazio('Sem perímetros preenchidos nesta avaliação.');
}

function linhaInfoAvaliacao(label, valor){
  return `<div class="aval-info-row"><span>${esc(label)}</span><strong>${esc(valor || '-')}</strong></div>`;
}
function medidaInfoAvaliacao(label, valor, sufixo=''){
  if(valor === undefined || valor === null || String(valor).trim() === '') return '';
  return `<div class="aval-medida"><span>${esc(label)}</span><strong>${esc(valor)} ${esc(sufixo)}</strong></div>`;
}

function renderAvaliacoes(){
  const box = $('#avaliacaoAlunoRelatorio') || $('#listaAvaliacoes');
  if(!box) return;
  const lista = (dadosPortal.avaliacoes||[]).slice().sort((a,b)=>String(dataAvaliacao(b)).localeCompare(String(dataAvaliacao(a))));
  if(!lista.length){ box.innerHTML = `<div class="card"><h3>Minhas avaliações</h3>${vazio('Nenhuma avaliação física disponível ainda.')}</div>`; return; }
  const atual = lista[0];
  const anterior = lista[1] || null;
  const diag = diagnosticoAvaliacao(atual, anterior);
  let idade = idadeAluno(atual);
  if(!idade && !alunoCompletoAvaliacoesCarregado) carregarAlunoCompletoParaAvaliacao();
  const nascimento = dataNascimentoAluno(atual);
  const proxima = normalizarDataISO(campoAv(atual,['proximaReavaliacao','proxima_reavaliacao','dataReavaliacao','data_reavaliacao'])) || somarDiasISO(dataAvaliacao(atual), 45);
  const gordura = campoAv(atual,['percentual_gordura','gordura','percentualGordura']);
  const massaMagra = campoAv(atual,['massa_magra','massaMagra']);
  const massaGorda = campoAv(atual,['massa_gorda','massaGorda']);
  const agua = campoAv(atual,['agua_corporal','aguaCorporal']);
  const professor = campoAv(atual,['professorNome','professor','avaliador']) || dadosPortal.aluno?.professorNome || '-';
  const historico = lista.map((av,idx)=>`<button type="button" onclick="selecionarAvaliacaoAluno(${idx})" class="aval-hist-btn ${idx===0?'active':''}"><strong>${esc(data(dataAvaliacao(av)))}</strong><span>${esc(av.objetivo||'Avaliação física')}</span></button>`).join('');

  box.innerHTML = `
    <div class="aval-report" id="avalReportPrint">
      <div class="aval-hero">
        <div>
          <span class="eyebrow">Relatório de avaliação física</span>
          <h2>${esc(dadosPortal.aluno?.nome || 'Aluno')}</h2>
          <p>Última avaliação: <b>${esc(data(dataAvaliacao(atual)))}</b> · Professor: <b>${esc(professor)}</b> · Próxima reavaliação: <b>${esc(data(proxima))}</b></p>
        </div>
        <div class="aval-hero-actions">
          <button type="button" onclick="imprimirAvaliacaoAluno()">Imprimir relatório premium</button>
        </div>
      </div>

      <div class="aval-kpi-grid">
        <div><span>Idade</span><strong>${esc(idade || '-')}</strong><small>${idade ? 'anos' : (alunoCompletoAvaliacoesCarregando ? 'calculando...' : 'sem nascimento')}</small></div>
        <div><span>Peso</span><strong>${esc(atual.peso || '-')}</strong><small>kg</small></div>
        <div><span>IMC</span><strong>${esc(atual.imc || '-')}</strong><small>${esc(atual.classificacao_imc || classificarImcValor(atual.imc))}</small></div>
        <div><span>Gordura</span><strong>${esc(gordura || '-')}</strong><small>%</small></div>
        <div><span>RCQ</span><strong>${esc(atual.rcq || '-')}</strong><small>${esc(classificarRcq(atual))}</small></div>
        <div><span>Próxima</span><strong>${esc(data(proxima))}</strong><small>reavaliação</small></div>
      </div>

      <div class="aval-diagnostico card destaque">
        <h3>Diagnóstico automático <small>IA Avaliação</small></h3>
        <h2>${esc(diag.resumo)}</h2>
        <div class="aval-diag-grid">
          <div><h4>Pontos positivos</h4>${diag.pontos.map(x=>`<p>✓ ${esc(x)}</p>`).join('')}</div>
          <div><h4>Pontos de atenção</h4>${diag.atencao.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>
          <div><h4>Sugestões</h4>${diag.sugestoes.map(x=>`<p>→ ${esc(x)}</p>`).join('')}</div>
        </div>
      </div>

      <div class="aval-grid-2">
        <div class="card"><h3>Comparativo com avaliação anterior</h3>
          ${anterior ? `
            ${linhaComparativo('Peso', atual.peso, anterior.peso, 'kg')}
            ${linhaComparativo('IMC', atual.imc, anterior.imc, '')}
            ${linhaComparativo('Gordura', gordura, campoAv(anterior,['percentual_gordura','gordura']), '%')}
            ${linhaComparativo('RCQ', atual.rcq, anterior.rcq, '')}
            ${linhaComparativo('Massa magra', massaMagra, campoAv(anterior,['massa_magra','massaMagra']), 'kg')}
          ` : vazio('Sem avaliação anterior para comparação.')}
        </div>
        <div class="card"><h3>Composição corporal</h3>
          <div class="mini-grid">
            <div><span>Peso</span><b>${esc(atual.peso||'-')} kg</b></div>
            <div><span>Massa magra</span><b>${esc(massaMagra||'-')} kg</b></div>
            <div><span>Massa gorda</span><b>${esc(massaGorda||'-')} kg</b></div>
            <div><span>Água corporal</span><b>${esc(agua||'-')}</b></div>
            <div><span>TMB</span><b>${esc(atual.tmb||'-')}</b></div>
            <div><span>Nascimento</span><b>${esc(data(nascimento)||'-')}</b></div>
            <div><span>Objetivo</span><b>${esc(atual.objetivo||'-')}</b></div>
          </div>
        </div>
      </div>

      <div class="card"><h3>Perímetros e evolução</h3><div class="aval-medidas-grid">${perimetrosRelatorio(atual, anterior||{})}</div></div>

      <div class="aval-grid-2">
        <div class="card"><h3>Fotos posturais</h3><div class="aval-fotos-grid">
          ${fotoAvaliacao(atual,'foto_frente_base64','Frente')}
          ${fotoAvaliacao(atual,'foto_costas_base64','Costas')}
          ${fotoAvaliacao(atual,'foto_lateral_direita_base64','Lateral direita')}
          ${fotoAvaliacao(atual,'foto_lateral_esquerda_base64','Lateral esquerda')}
        </div></div>
        <div class="card"><h3>Histórico de avaliações</h3><div class="aval-historico">${historico}</div></div>
      </div>


      <div class="aval-grid-2">
        <div class="card"><h3>Anamnese registrada</h3><div class="aval-info-list">
          ${linhaInfoAvaliacao('Objetivo', atual.objetivo)}
          ${linhaInfoAvaliacao('Pratica atividade física', atual.pratica_atividade)}
          ${linhaInfoAvaliacao('Medicamentos', atual.medicamentos)}
          ${linhaInfoAvaliacao('Cirurgias', atual.cirurgias)}
          ${linhaInfoAvaliacao('Doenças na família', atual.doencas_familia)}
        </div></div>
        <div class="card"><h3>Condicionamento e testes</h3><div class="aval-info-list">
          ${linhaInfoAvaliacao('VO₂ obtido', atual.vo2_obtido)}
          ${linhaInfoAvaliacao('VO₂ previsto', atual.vo2_previsto)}
          ${linhaInfoAvaliacao('Flexões de braço', atual.flexao_bracos)}
          ${linhaInfoAvaliacao('Abdominais', atual.abdominal_repeticoes)}
          ${linhaInfoAvaliacao('Banco de Wells', atual.banco_wells)}
        </div></div>
      </div>

      <div class="card"><h3>Dobras e bioimpedância</h3><div class="aval-medidas-grid">
        ${medidaInfoAvaliacao('Subescapular', atual.subescapular, 'mm')}
        ${medidaInfoAvaliacao('Bicipital', atual.bicipital, 'mm')}
        ${medidaInfoAvaliacao('Tricipital', atual.tricipital, 'mm')}
        ${medidaInfoAvaliacao('Axilar média', atual.axilar_media, 'mm')}
        ${medidaInfoAvaliacao('Supra-ilíaca', atual.supra_iliaca, 'mm')}
        ${medidaInfoAvaliacao('Abdominal', atual.dobra_abdominal, 'mm')}
        ${medidaInfoAvaliacao('Coxa', atual.dobra_coxa, 'mm')}
        ${medidaInfoAvaliacao('Panturrilha', atual.dobra_panturrilha, 'mm')}
      </div></div>

      <div class="card"><h3>Observações do professor</h3><p>${esc(atual.observacoes || 'Nenhuma observação registrada.')}</p></div>
    </div>`;
}
window.selecionarAvaliacaoAluno = function(idx){
  const lista = (dadosPortal.avaliacoes||[]).slice().sort((a,b)=>String(dataAvaliacao(b)).localeCompare(String(dataAvaliacao(a))));
  if(!lista[idx]) return;
  const escolhida = lista[idx];
  dadosPortal.avaliacoes = [escolhida, ...lista.filter((_,i)=>i!==idx)];
  renderAvaliacoes();
};
window.imprimirAvaliacaoAluno = function(){
  const el = document.getElementById('avalReportPrint');
  if(!el) return;
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => `<link rel="stylesheet" href="${l.href}">`).join('');
  const cssExtra = `body{font-family:Arial,sans-serif;background:#fff;color:#172033;padding:20px}.sidebar,.topbar,.nav,.sair,.aval-hero-actions{display:none!important}.card,.aval-hero,.aval-kpi-grid>div{box-shadow:none!important;break-inside:avoid}.aval-report{display:block!important}.aval-report>*{margin-bottom:12px}.aval-kpi-grid,.aval-diag-grid,.aval-grid-2,.aval-medidas-grid,.aval-fotos-grid{break-inside:avoid}.aval-foto>div{height:120px}@page{margin:12mm}`;
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Avaliação Física</title>${links}<style>${cssExtra}</style></head><body>${el.outerHTML}</body></html>`);
  win.document.close();
  setTimeout(()=>win.print(),500);
};
function renderPagamentos(){const lista=[...(dadosPortal.financeiro||[]),...(dadosPortal.mensalidades||[])];$('#listaPagamentos').innerHTML=lista.length?lista.map(p=>`<div class="item"><strong>${esc(p.descricao||p.competencia||'Cobrança')}</strong><small>Vencimento: ${data(p.vencimento)} · Valor: ${fmt(p.valor||p.total||p.valorBruto)} <span class="badge ${statusClass(p.status)}">${esc(p.status||'aberto')}</span></small></div>`).join(''):vazio('Nenhum pagamento encontrado.');}
function renderPerfil(){const a=dadosPortal.aluno;$('#dadosPerfil').innerHTML=`<div class="item"><strong>Nome</strong><small>${esc(a.nome)}</small></div><div class="item"><strong>Plano</strong><small>${esc(a.plano||'-')}</small></div><div class="item"><strong>Professor</strong><small>${esc(a.professorNome||'-')}</small></div><div class="item"><strong>Status</strong><small>${esc(a.status||'-')}</small></div>`;}

document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{ ativarAbaAluno(btn.dataset.tab); }));
$('#formAcesso').addEventListener('submit',acessar);
$('#btnSair').addEventListener('click',()=>{sessionStorage.removeItem('fusion_portal_aluno');location.reload();});
try{const salvo=JSON.parse(sessionStorage.getItem('fusion_portal_aluno')||'null');if(salvo&&salvo.ok){dadosPortal=salvo;render();iniciarAtualizacaoAutomatica();atualizarDashboard();}}catch{}
