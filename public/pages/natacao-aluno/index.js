(function(){
  const API_NATACAO = '/api/natacao';
  const API_ALUNOS = '/api/alunos';
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  let alunoId = params.get('alunoId') || localStorage.getItem('fusion_natacao_aluno_id') || '';
  let aluno = null;
  let dados = { recordes: [], evolucao: [], historico: [] };
  let rankings = [];

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  async function json(resp){try{return await resp.json();}catch{return {};}}
  function fmt(ms){const total=Math.max(0,Math.floor(Number(ms)||0));const min=Math.floor(total/60000);const sec=Math.floor((total%60000)/1000);const mil=total%1000;return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(mil).padStart(3,'0')}`;}
  function data(v){try{return new Date(v||Date.now()).toLocaleDateString('pt-BR');}catch{return '-';}}
  function toast(msg){const el=$('#studentToast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1800);}
  function chaveProva(r={}){return [r.distancia||'Livre', r.estilo||'Livre', r.piscina||''].join(' · ');}

  async function carregarAlunoBasico(){
    aluno = null;
    if(!alunoId) return;
    try{
      const resp = await fetch(`${API_ALUNOS}/${encodeURIComponent(alunoId)}`, {cache:'no-store'});
      const js = await json(resp);
      if(resp.ok) aluno = js.aluno || js.dados || js;
    }catch{}
  }

  async function carregarDados(){
    alunoId = ($('#alunoId')?.value || alunoId || '').trim();
    if(!alunoId){ toast('Informe o ID do aluno.'); return; }
    localStorage.setItem('fusion_natacao_aluno_id', alunoId);
    const btn=$('#btnAtualizar'); const old=btn?.textContent || 'Atualizar'; if(btn){btn.disabled=true;btn.textContent='Carregando...';}
    try{
      await carregarAlunoBasico();
      const [histResp, rankingResp] = await Promise.all([
        fetch(`${API_NATACAO}/alunos/${encodeURIComponent(alunoId)}`, {cache:'no-store'}),
        fetch(`${API_NATACAO}/ranking`, {cache:'no-store'})
      ]);
      const hist = await json(histResp);
      const rank = await json(rankingResp);
      if(!histResp.ok || hist.ok===false) throw new Error(hist.mensagem || hist.erro || `HTTP ${histResp.status}`);
      dados = { recordes: hist.recordes || [], evolucao: hist.evolucao || [], historico: hist.historico || [] };
      rankings = rank.rankings || [];
      renderTudo();
      toast('Histórico atualizado.');
    }catch(e){
      toast(`Erro: ${e.message}`);
      renderTudo();
    }finally{if(btn){btn.disabled=false;btn.textContent=old;}}
  }

  function renderResumo(){
    const nome = aluno?.nome || aluno?.aluno || aluno?.name || (alunoId ? `Aluno ${alunoId}` : 'Aluno');
    $('#alunoResumo').textContent = alunoId ? `${nome} · Histórico de natação` : 'Informe o aluno para consultar recordes, evolução e histórico.';
    $('#alunoId').value = alunoId || '';
    $('#kpiRecordes').textContent = dados.recordes.length;
    $('#kpiProvas').textContent = dados.historico.length;
    const melhorEvo = Math.max(0, ...dados.evolucao.map(e=>Number(e.evolucaoPercentual||0)));
    $('#kpiEvolucao').textContent = `${melhorEvo.toFixed(1)}%`;
    const ultimo = dados.historico[0];
    $('#kpiUltimoTempo').textContent = ultimo ? (ultimo.tempo || fmt(ultimo.tempoMs)) : '-';
  }

  function renderRecordes(){
    const dist = $('#filtroDistancia')?.value || '';
    const lista = dados.recordes.filter(r=>!dist || String(r.distancia)===dist)
      .sort((a,b)=>String(a.distancia).localeCompare(String(b.distancia),'pt-BR') || Number(a.tempoMs)-Number(b.tempoMs));
    const box=$('#listaRecordes');
    if(!lista.length){box.innerHTML='<div class="empty">Nenhum recorde pessoal encontrado.</div>';return;}
    box.innerHTML = lista.map(r=>`<article class="record-item">
      <div><strong>${esc(r.distancia||'Livre')} · ${esc(r.estilo||'Livre')}</strong><span>Piscina ${esc(r.piscina||'-')}</span></div>
      <b>${esc(r.tempo || fmt(r.tempoMs))}</b>
      <small>Melhor parcial: ${esc(r.melhorParcial || (r.melhorParcialMs?fmt(r.melhorParcialMs):'-'))}</small>
    </article>`).join('');
  }

  function posicaoAluno(grupo){
    const item = (grupo.ranking||[]).find(r=>String(r.alunoId)===String(alunoId));
    if(!item) return null;
    return { ...item, prova: `${grupo.distancia} · ${grupo.estilo}`, piscina: grupo.piscina, recordeAcademia: grupo.recordeAcademia };
  }

  function renderRanking(){
    const posicoes = rankings.map(posicaoAluno).filter(Boolean).sort((a,b)=>a.posicao-b.posicao || Number(a.tempoMs)-Number(b.tempoMs)).slice(0,12);
    const box=$('#rankingAluno');
    if(!posicoes.length){box.innerHTML='<div class="empty">Ranking indisponível para este aluno.</div>';return;}
    box.innerHTML = posicoes.map(p=>`<article class="rank-item ${p.posicao===1?'gold':''}">
      <span>${p.posicao}º</span>
      <div><strong>${esc(p.prova)}</strong><small>Piscina ${esc(p.piscina||'-')} · Recorde academia: ${esc(p.recordeAcademia?.tempo || fmt(p.recordeAcademia?.tempoMs))}</small></div>
      <b>${esc(p.tempo || fmt(p.tempoMs))}</b>
    </article>`).join('');
  }

  function renderFiltroEvolucao(){
    const sel=$('#filtroEvolucao'); if(!sel)return;
    const atual=sel.value;
    sel.innerHTML = dados.evolucao.length
      ? dados.evolucao.map((e,i)=>`<option value="${i}">${esc(chaveProva(e))}</option>`).join('')
      : '<option value="">Sem evolução</option>';
    if(atual) sel.value=atual;
  }

  function desenharGrafico(evo){
    const canvas=$('#graficoEvolucao'); if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const w=canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#dbe3ef'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){const y=30+i*((h-60)/4);ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(w-24,y);ctx.stroke();}
    const pontos=(evo?.historico||[]).map(x=>({x:x.data,y:Number(x.tempoMs||0),label:x.tempo||fmt(x.tempoMs)}));
    if(pontos.length<2){
      ctx.fillStyle='#64748b'; ctx.font='16px Arial'; ctx.fillText('Dados insuficientes para gráfico.',40,70); return;
    }
    const min=Math.min(...pontos.map(p=>p.y)); const max=Math.max(...pontos.map(p=>p.y)); const range=Math.max(1,max-min);
    const px=(i)=>40+i*((w-70)/(pontos.length-1));
    const py=(v)=>30+((v-min)/range)*(h-70);
    ctx.strokeStyle='#0ea5e9'; ctx.lineWidth=4; ctx.beginPath();
    pontos.forEach((p,i)=>{const x=px(i), y=py(p.y); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);}); ctx.stroke();
    pontos.forEach((p,i)=>{const x=px(i), y=py(p.y); ctx.fillStyle='#0369a1'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#0f172a'; ctx.font='12px Arial'; ctx.fillText(p.label,x-22,y-10);});
  }

  function renderEvolucao(){
    renderFiltroEvolucao();
    const idx=Number($('#filtroEvolucao')?.value || 0);
    const evo=dados.evolucao[idx];
    desenharGrafico(evo);
    const box=$('#evolucaoResumo');
    if(!evo){box.innerHTML='<div class="empty">Sem histórico de evolução.</div>';return;}
    box.innerHTML = `<div><span>Prova</span><strong>${esc(chaveProva(evo))}</strong></div>
      <div><span>Primeiro tempo</span><strong>${esc(evo.primeiroTempo || fmt(evo.primeiroTempoMs))}</strong></div>
      <div><span>Melhor tempo</span><strong>${esc(evo.melhorTempo || fmt(evo.melhorTempoMs))}</strong></div>
      <div><span>Evolução</span><strong>${Number(evo.evolucaoPercentual||0).toFixed(2)}%</strong></div>`;
  }

  function renderHistorico(){
    const box=$('#historicoAluno');
    if(!dados.historico.length){box.innerHTML='<div class="empty">Nenhuma sessão encontrada.</div>';return;}
    box.innerHTML = dados.historico.map(h=>`<article class="history-item">
      <div><strong>${esc(h.distancia||'Livre')} · ${esc(h.estilo||'Livre')}</strong><span>${esc(data(h.criadoEm))} · Piscina ${esc(h.piscina||'-')}</span></div>
      <b>${esc(h.tempo || fmt(h.tempoMs))}</b>
      <small>${(h.parciais||[]).length} parcial(is) · Professor: ${esc(h.professor||'-')}</small>
    </article>`).join('');
  }

  function renderTudo(){renderResumo();renderRecordes();renderRanking();renderEvolucao();renderHistorico();}

  function bind(){
    $('#btnCarregarAluno')?.addEventListener('click',carregarDados);
    $('#btnAtualizar')?.addEventListener('click',carregarDados);
    $('#btnVoltar')?.addEventListener('click',()=>{location.href='/pages/portal-aluno/';});
    $('#filtroDistancia')?.addEventListener('change',renderRecordes);
    $('#filtroEvolucao')?.addEventListener('change',renderEvolucao);
    $('#alunoId')?.addEventListener('keydown',ev=>{if(ev.key==='Enter')carregarDados();});
  }

  function init(){bind(); renderTudo(); if(alunoId) carregarDados();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
