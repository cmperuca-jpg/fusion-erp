(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const EMBED = params.get('embed') === '1';
  const API_ALUNOS = '/api/alunos';
  const API_NATACAO = '/api/natacao';
  let contexto = null;
  let alunos = [];
  let selecionados = [];
  let raias = [];
  let raf = null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function idAluno(a={}){return String(a.id||a._id||a.alunoId||a.aluno_id||'');}
  function nomeAluno(a={}){return a.nome||a.alunoNome||a.name||a.aluno||'Aluno';}
  function idProf(){return params.get('professorId') || contexto?.professorId || contexto?.professor?.id || '';}
  function nomeProf(){return contexto?.professorNome || contexto?.professor?.nome || 'Professor';}
  function fmt(ms){const total=Math.max(0,Math.floor(ms));const min=Math.floor(total/60000);const sec=Math.floor((total%60000)/1000);const mil=total%1000;return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(mil).padStart(3,'0')}`;}
  async function json(resp){try{return await resp.json();}catch{return {};}}
  function extrair(payload){return Array.isArray(payload)?payload:(payload?.alunos||payload?.dados||payload?.data||payload?.itens||[]);} 
  function toast(msg){const el=$('#natToast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1800);}

  function lerContexto(){
    try{contexto=JSON.parse(localStorage.getItem('fusion_natacao_professor_contexto')||'null');}catch{}
    contexto=contexto||{};
  }
  async function carregarAlunos(){
    lerContexto();
    if(Array.isArray(contexto.alunos) && contexto.alunos.length) alunos = contexto.alunos;
    else{
      try{const resp=await fetch(API_ALUNOS,{cache:'no-store'}); alunos=extrair(await json(resp));}catch{alunos=[];}
    }
    renderAlunos();
  }
  function renderAlunos(){
    const q=norm($('#buscaAlunoNatacao')?.value||'');
    const lista=alunos.filter(a=>!q || norm(nomeAluno(a)+' '+(a.telefone||a.whatsapp||'')).includes(q));
    $('#listaAlunosNatacao').innerHTML=lista.length?lista.map(a=>{
      const id=idAluno(a); const active=selecionados.includes(id);
      return `<button type="button" class="nat-student ${active?'active':''}" data-id="${esc(id)}"><strong>${esc(nomeAluno(a))}</strong><small>${esc(a.plano||a.modalidade||a.telefone||a.whatsapp||'-')}</small></button>`;
    }).join(''):'<div class="history-item">Nenhum aluno encontrado.</div>';
    $$('#listaAlunosNatacao .nat-student').forEach(btn=>btn.onclick=()=>toggleAluno(btn.dataset.id));
    atualizarInfo();
  }
  function toggleAluno(id){
    if(selecionados.includes(id)) selecionados=selecionados.filter(x=>x!==id);
    else{
      if(selecionados.length>=10){toast('Limite de 10 alunos no mesmo painel.');return;}
      selecionados.push(id);
    }
    renderAlunos();
  }
  function atualizarInfo(){
    $('#selecionadosInfo').textContent=`${selecionados.length} de 10 selecionados`;
    $('#btnPreparar').disabled=selecionados.length===0;
  }
  function prepararRaias(){
    raias=selecionados.map((id,i)=>({id:cryptoId(),aluno:alunos.find(a=>idAluno(a)===id)||{id,nome:'Aluno'},raia:i+1,status:'pronto',inicio:0,fim:0,decorrido:0,parciais:[],ultimaParcialMs:0}));
    renderRaias();
    $('#btnIniciarTodos').disabled=!raias.length;
    $('#btnPararTodos').disabled=!raias.length;
    toast('Raias preparadas.');
  }
  function cryptoId(){return `nat_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;}
  function estadoRaia(r){if(r.status==='correndo') return performance.now()-r.inicio+r.decorrido; if(r.status==='finalizado') return r.decorrido; return r.decorrido||0;}
  function iniciarRaia(idx){const r=raias[idx]; if(!r||r.status==='finalizado'||r.status==='correndo')return; r.status='correndo'; r.inicio=performance.now(); r.ultimaParcialMs=r.decorrido||0; loop(); renderRaias();}
  function voltaRaia(idx){const r=raias[idx]; if(!r||r.status!=='correndo')return; const agora=estadoRaia(r); const parcial=agora-(r.ultimaParcialMs||0); r.ultimaParcialMs=agora; r.parciais.push({volta:r.parciais.length+1,tempoMs:Math.round(parcial),totalMs:Math.round(agora),criadoEm:new Date().toISOString()}); renderRaias();}
  function finalizarRaia(idx){const r=raias[idx]; if(!r||r.status==='finalizado')return; if(r.status==='correndo') r.decorrido=estadoRaia(r); r.status='finalizado'; r.fim=Date.now(); renderRaias();}
  function iniciarTodos(){
    let n=3; const el=$('#beepStatus'); el.textContent='3';
    const t=setInterval(()=>{n--; if(n>0) el.textContent=String(n); else{clearInterval(t); el.textContent='BEEP'; raias.forEach((_,i)=>iniciarRaia(i)); setTimeout(()=>el.textContent='Cronometrando',800);}},700);
  }
  function finalizarTodos(){raias.forEach((_,i)=>finalizarRaia(i));}
  function melhorParcial(r){return r.parciais.length?Math.min(...r.parciais.map(p=>p.tempoMs)):0;}
  function mediaParcial(r){return r.parciais.length?Math.round(r.parciais.reduce((a,p)=>a+p.tempoMs,0)/r.parciais.length):0;}
  function renderRaias(){
    const box=$('#painelRaias');
    if(!raias.length){box.innerHTML='';return;}
    box.innerHTML=raias.map((r,i)=>{
      const tempo=estadoRaia(r); const aluno=r.aluno;
      return `<article class="nat-lane ${r.status==='correndo'?'running':''} ${r.status==='finalizado'?'finished':''}" data-index="${i}">
        <div class="lane-head"><div><strong>${esc(nomeAluno(aluno))}</strong><small>${esc($('#distancia').value)} · ${esc($('#estilo').value)} · ${esc(r.status)}</small></div><span class="lane-num">Raia ${r.raia}</span></div>
        <div class="lane-clock" id="laneClock${i}">${fmt(tempo)}</div>
        <div class="lane-actions"><button type="button" data-act="start" data-i="${i}" ${r.status!=='pronto'?'disabled':''}>Iniciar</button><button type="button" data-act="lap" data-i="${i}" ${r.status!=='correndo'?'disabled':''}>Volta</button><button type="button" class="danger" data-act="finish" data-i="${i}" ${r.status==='finalizado'?'disabled':''}>Finalizar</button></div>
        <div class="lane-summary"><div><span>Voltas</span><b>${r.parciais.length}</b></div><div><span>Melhor parcial</span><b>${melhorParcial(r)?fmt(melhorParcial(r)):'-'}</b></div><div><span>Média</span><b>${mediaParcial(r)?fmt(mediaParcial(r)):'-'}</b></div></div>
        <div class="splits">${r.parciais.slice().reverse().map(p=>`<div class="split-row"><span>Volta ${p.volta}</span><b>${fmt(p.tempoMs)}</b><small>${fmt(p.totalMs)}</small></div>`).join('')||'<div class="split-row"><span>Sem parciais</span><b>-</b></div>'}</div>
      </article>`;
    }).join('');
    $$('[data-act]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.i); if(btn.dataset.act==='start')iniciarRaia(i); if(btn.dataset.act==='lap')voltaRaia(i); if(btn.dataset.act==='finish')finalizarRaia(i);});
  }
  function loop(){
    cancelAnimationFrame(raf);
    function tick(){
      let ativo=false;
      raias.forEach((r,i)=>{if(r.status==='correndo'){ativo=true; const el=$(`#laneClock${i}`); if(el) el.textContent=fmt(estadoRaia(r));}});
      if(ativo) raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);
  }
  function montarSessao(){
    return {professorId:idProf(),professor:nomeProf(),distancia:$('#distancia').value,estilo:$('#estilo').value,piscina:$('#piscina').value,observacao:$('#observacao').value,status:'Finalizada',criadoEm:new Date().toISOString(),resultados:raias.map(r=>({alunoId:idAluno(r.aluno),aluno:nomeAluno(r.aluno),raia:r.raia,status:r.status,tempoMs:Math.round(estadoRaia(r)),tempo:fmt(estadoRaia(r)),parciais:r.parciais,melhorParcialMs:melhorParcial(r),mediaParcialMs:mediaParcial(r)}))};
  }
  async function salvarSessao(){
    if(!raias.length){toast('Prepare as raias antes de salvar.');return;}
    raias.forEach((r,i)=>{if(r.status!=='finalizado') finalizarRaia(i);});
    const payload=montarSessao();
    const btn=$('#btnSalvarSessao'); const old=btn.textContent; btn.disabled=true; btn.textContent='Salvando...';
    try{const resp=await fetch(`${API_NATACAO}/sessoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const js=await json(resp); if(!resp.ok||js.ok===false) throw new Error(js.mensagem||js.erro||`HTTP ${resp.status}`); toast('Resultados salvos.'); carregarHistorico(); if(window.parent&&window.parent!==window) window.parent.postMessage({tipo:'fusion_natacao_salva'}, location.origin);}catch(e){alert(`Erro ao salvar natação: ${e.message}`);}finally{btn.disabled=false;btn.textContent=old;}
  }

  function renderPainelTecnico(dados){
    const resumo = dados?.resumo || {};
    const set=(id,v)=>{const el=$(id); if(el) el.textContent=v;};
    set('#kpiSessoes', resumo.sessoes || 0);
    set('#kpiProvas', resumo.provas || 0);
    set('#kpiRecordes', resumo.recordes || 0);
    set('#kpiAtletas', resumo.atletas || resumo.alunosComEvolucao || 0);
    set('#kpiEvolucaoMedia', `${Number(resumo.evolucaoMedia || 0).toFixed(1)}%`);
    const box=$('#evolucaoTurma');
    if(box){
      const lista=(dados.evolucao || []).slice().sort((a,b)=>Number(b.evolucaoPercentual||0)-Number(a.evolucaoPercentual||0)).slice(0,12);
      box.innerHTML=lista.length?lista.map(e=>`<div class="evolution-row"><strong>${esc(e.aluno||'-')}</strong><span>${esc(e.distancia||'-')} · ${esc(e.estilo||'-')} · Piscina ${esc(e.piscina||'-')}</span><b>${Number(e.evolucaoPercentual||0).toFixed(2)}%</b><small>${esc(e.primeiroTempo||'-')} → ${esc(e.melhorTempo||'-')}</small></div>`).join(''):'<div class="history-item">Sem evolução suficiente.</div>';
    }
  }

  async function carregarPainelTecnico(){
    try{
      const resp=await fetch(`${API_NATACAO}/tecnico`,{cache:'no-store'});
      const js=await json(resp);
      if(!resp.ok || js.ok===false) throw new Error(js.mensagem||js.erro||`HTTP ${resp.status}`);
      renderPainelTecnico(js.tecnico || {});
    }catch(e){
      const box=$('#evolucaoTurma'); if(box) box.innerHTML=`<div class="history-item">Painel técnico indisponível: ${esc(e.message)}</div>`;
    }
  }

  async function compararSelecionados(){
    const ids=selecionados.slice(0,4);
    const box=$('#comparadorNatacao'); if(!box) return;
    if(ids.length<2){box.innerHTML='<div class="history-item">Selecione de 2 a 4 alunos para comparar.</div>';return;}
    const qs=new URLSearchParams({alunoIds:ids.join(','), distancia:$('#distancia').value, estilo:$('#estilo').value, piscina:$('#piscina').value});
    box.innerHTML='<div class="history-item">Comparando atletas...</div>';
    try{
      const resp=await fetch(`${API_NATACAO}/comparar?${qs.toString()}`,{cache:'no-store'});
      const js=await json(resp);
      if(!resp.ok || js.ok===false) throw new Error(js.mensagem||js.erro||`HTTP ${resp.status}`);
      const lista=js.comparacao || [];
      box.innerHTML=lista.length?lista.map((a,i)=>`<article class="compare-item ${i===0?'best':''}"><span>${i+1}º</span><div><strong>${esc(a.aluno||'-')}</strong><small>${esc(a.distancia||'-')} · ${esc(a.estilo||'-')} · ${esc(a.tentativas||0)} tentativa(s)</small></div><b>${esc(a.melhorTempo||'-')}</b><em>${Number(a.evolucaoPercentual||0).toFixed(2)}%</em></article>`).join(''):'<div class="history-item">Sem dados para comparar nesta prova.</div>';
    }catch(e){box.innerHTML=`<div class="history-item">Erro no comparador: ${esc(e.message)}</div>`;}
  }

  async function carregarHistorico(){
    const box=$('#historicoNatacao'); if(!box)return;
    try{const resp=await fetch(`${API_NATACAO}/sessoes?limit=20`,{cache:'no-store'}); const js=await json(resp); const lista=js.sessoes||js.dados||[]; box.innerHTML=lista.length?lista.map(s=>`<div class="history-item"><strong>${esc(s.distancia)} · ${esc(s.estilo)} · ${esc(new Date(s.criadoEm||Date.now()).toLocaleString('pt-BR'))}</strong><small>${(s.resultados||[]).length} aluno(s) · Professor: ${esc(s.professor||'-')}</small></div>`).join(''):'<div class="history-item">Nenhum resultado salvo ainda.</div>';}catch{box.innerHTML='<div class="history-item">Histórico indisponível.</div>';}
  }
  function novaSessao(){selecionados=[]; raias=[]; renderAlunos(); renderRaias(); $('#beepStatus').textContent='Pronto'; $('#btnIniciarTodos').disabled=true; $('#btnPararTodos').disabled=true;}
  function bind(){
    $('#buscaAlunoNatacao')?.addEventListener('input',renderAlunos);
    $('#btnPreparar')?.addEventListener('click',prepararRaias);
    $('#btnIniciarTodos')?.addEventListener('click',iniciarTodos);
    $('#btnPararTodos')?.addEventListener('click',finalizarTodos);
    $('#btnSalvarSessao')?.addEventListener('click',salvarSessao);
    $('#btnNovaSessao')?.addEventListener('click',novaSessao);
    $('#btnAtualizarHistorico')?.addEventListener('click',carregarHistorico);
    $('#btnAtualizarTecnico')?.addEventListener('click',carregarPainelTecnico);
    $('#btnCompararSelecionados')?.addEventListener('click',compararSelecionados);
    $('#btnRecalcularRecordes')?.addEventListener('click',recalcularRecordes);
    $('#filtroRecordeDistancia')?.addEventListener('change',carregarRecordes);
    $('#filtroRecordeEstilo')?.addEventListener('change',carregarRecordes);
    $('#btnPainel')?.addEventListener('click',()=>{if(EMBED&&window.parent!==window) window.parent.postMessage({tipo:'fusion_natacao_voltar_painel'}, location.origin); else location.href='/pages/dashboard/index.html';});
  }
  window.addEventListener('message',ev=>{if(ev.origin!==location.origin)return; if(ev.data?.tipo==='fusion_natacao_contexto'){contexto=ev.data.contexto; try{localStorage.setItem('fusion_natacao_professor_contexto',JSON.stringify(contexto));}catch{} alunos=contexto.alunos||alunos; renderAlunos();}});
  async function init(){bind(); $('#btnPreparar').disabled=true; await carregarAlunos(); await carregarHistorico();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
