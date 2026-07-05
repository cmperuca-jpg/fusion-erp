(function(){
  const SESSION_KEY = 'fusion_portal_professor';
  const $ = s => document.querySelector(s);
  let portal = null;
  let professor = null;
  let alunos = [];
  let treinos = [];
  let avaliacoes = [];
  let treinoV3Carregado = false;
  let avaliacaoV3Carregada = false;
  let natacaoCarregada = false;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function data(v){const s=String(v||'').slice(0,10);return s?s.split('-').reverse().join('/'):'-';}
  function idProf(p={}){return String(p.id||p._id||p.professorId||p.professor_id||p.codigo||'');}
  function nomeProf(p={}){return p.nome||p.professor||p.professorNome||p.name||'Professor';}
  function idAluno(a={}){return String(a.id||a._id||a.alunoId||a.aluno_id||a.codigo||'');}
  function nomeAluno(a={}){return a.nome||a.alunoNome||a.aluno||a.name||'Aluno';}
  function statusClass(v){return norm(v||'ativo').replace(/\s+/g,'-');}
  function vazio(msg){return `<div class="empty">${esc(msg)}</div>`;}
  function mostrar(msg){const el=$('#alerta'); if(!el) return alert(msg); el.textContent=msg; el.classList.remove('hidden');}
  function esconder(){const el=$('#alerta'); if(el) el.classList.add('hidden');}

  function lerSessao(){
    try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY)||'null');}
    catch{return null;}
  }
  function salvarSessao(d){sessionStorage.setItem(SESSION_KEY,JSON.stringify(d));localStorage.setItem(SESSION_KEY,JSON.stringify(d));}
  function sair(){sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(SESSION_KEY);location.href='/pages/portal-professor/';}

  async function json(resp){try{return await resp.json();}catch{return {};}}
  async function carregar(){
    esconder();
    const salvo = lerSessao();
    if(!salvo || !salvo.professor || !idProf(salvo.professor)){ location.href='/pages/portal-professor/'; return; }
    professor = salvo.professor;
    try{
      const resp = await fetch(`/api/portal-professor/professores/${encodeURIComponent(idProf(professor))}`,{cache:'no-store'});
      const dados = await json(resp);
      if(resp.ok && dados.ok){ portal=dados; salvarSessao({...salvo, professor:dados.professor}); }
      else { portal=salvo; }
    }catch{ portal=salvo; }
    professor = portal.professor || professor;
    alunos = Array.isArray(portal.alunos) ? portal.alunos : [];
    treinos = Array.isArray(portal.treinos) ? portal.treinos : [];
    avaliacoes = Array.isArray(portal.avaliacoes) ? portal.avaliacoes : [];
    render();
  }

  function ultimaAvaliacao(alunoId){return avaliacoes.filter(a=>String(a.alunoId||a.aluno_id)===String(alunoId)).sort((a,b)=>String(b.data||b.criadoEm||b.criado_em||'').localeCompare(String(a.data||a.criadoEm||a.criado_em||'')))[0]||null;}
  function treinoAtivo(alunoId){return treinos.filter(t=>String(t.alunoId||t.aluno_id)===String(alunoId) && !['cancelado','inativo','arquivado','encerrado'].includes(norm(t.status||'ativo'))).sort((a,b)=>String(b.atualizadoEm||b.criadoEm||b.dataInicio||b.data_inicio||'').localeCompare(String(a.atualizadoEm||a.criadoEm||a.dataInicio||a.data_inicio||'')))[0]||null;}

  function abrir(titulo,url){
    $('#modalTitulo').textContent=titulo;
    $('#modalFrame').src=url + (url.includes('?')?'&':'?') + 'embed=1';
    $('#modalOperacao').classList.remove('hidden');
  }
  function fecharModal(){ $('#modalOperacao').classList.add('hidden'); $('#modalFrame').src='about:blank'; carregar(); }

  function urlAval(aluno,modo){const q=new URLSearchParams({alunoId:idAluno(aluno),professorId:idProf(professor)}); if(modo==='nova')q.set('nova','1'); if(modo==='editar')q.set('editar','1'); return `/pages/avaliacoes/index.html?${q}`;}
  function urlFicha(aluno){return `/pages/alunos/ficha.html?id=${encodeURIComponent(idAluno(aluno))}&alunoId=${encodeURIComponent(idAluno(aluno))}`;}
  function urlTreinosV3(aluno=null, modo='novo', treinoId=''){
    const q = new URLSearchParams({ embed:'1', modo });
    const pid = idProf(professor);
    if(pid) q.set('professorId', pid);
    if(aluno && idAluno(aluno)) q.set('alunoId', idAluno(aluno));
    if(treinoId) q.set('treinoId', treinoId);
    return `/pages/treinos-v4/?${q.toString()}`;
  }
  function urlAvaliacoesV3(aluno=null, modo=''){
    const q = new URLSearchParams({ embed:'1' });
    const pid = idProf(professor);
    if(pid) q.set('professorId', pid);
    if(aluno && idAluno(aluno)) q.set('alunoId', idAluno(aluno));
    if(modo === 'nova') q.set('nova', '1');
    if(modo === 'editar') q.set('editar', '1');
    return `/pages/avaliacoes/index.html?${q.toString()}`;
  }

  function carregarAvaliacoesV3(aluno=null, modo=''){
    const frame = $('#avaliacoesV3ProfessorFrame');
    if(!frame) return;
    const url = urlAvaliacoesV3(aluno, modo);
    if(frame.src && frame.src.includes(url) && avaliacaoV3Carregada) return;
    frame.src = url;
    avaliacaoV3Carregada = true;
  }


  function contextoTreinosV3(aluno=null){
    return {
      origem: 'portal_professor',
      atualizadoEm: new Date().toISOString(),
      professor: professor || {},
      professorId: idProf(professor),
      professorNome: nomeProf(professor),
      alunoSelecionadoId: aluno ? idAluno(aluno) : '',
      alunos: Array.isArray(alunos) ? alunos.map(a => ({
        ...a,
        id: idAluno(a),
        alunoId: idAluno(a),
        nome: nomeAluno(a),
        professorId: a.professorId || a.professor_id || idProf(professor),
        professorNome: a.professorNome || a.professor || nomeProf(professor)
      })) : []
    };
  }

  function carregarTreinosV3(aluno=null, modo='novo'){
    const frame = $('#treinosV3ProfessorFrame');
    if(!frame) return;
    const contexto = contextoTreinosV3(aluno);
    const treino = aluno && modo === 'editar' ? treinoAtivo(idAluno(aluno)) : null;
    const treinoId = treino ? String(treino.id || treino._id || '') : '';
    contexto.modoTreino = modo;
    contexto.treinoSelecionadoId = treinoId;
    try { localStorage.setItem('fusion_treinos_v3_professor_contexto', JSON.stringify(contexto));
    localStorage.setItem('fusion_treinos_v4_professor_contexto', JSON.stringify(contexto)); } catch {}
    const url = urlTreinosV3(aluno, modo, treinoId);
    if(frame.src && frame.src.includes(url) && treinoV3Carregado) {
      try { frame.contentWindow?.postMessage({ tipo:'fusion_treinos_v3_contexto', contexto }, location.origin); } catch {}
      return;
    }
    frame.src = url;
    treinoV3Carregado = true;
  }


  function urlNatacaoProfessor(){
    const q = new URLSearchParams({ embed:'1' });
    const pid = idProf(professor);
    if(pid) q.set('professorId', pid);
    return `/pages/natacao-professor/?${q.toString()}`;
  }

  function carregarNatacaoProfessor(){
    const frame = $('#natacaoProfessorFrame');
    if(!frame) return;
    const contexto = {
      origem: 'portal_professor',
      atualizadoEm: new Date().toISOString(),
      professor: professor || {},
      professorId: idProf(professor),
      professorNome: nomeProf(professor),
      alunos: Array.isArray(alunos) ? alunos.map(a => ({
        ...a,
        id: idAluno(a),
        alunoId: idAluno(a),
        nome: nomeAluno(a),
        professorId: a.professorId || a.professor_id || idProf(professor),
        professorNome: a.professorNome || a.professor || nomeProf(professor)
      })) : []
    };
    try { localStorage.setItem('fusion_natacao_professor_contexto', JSON.stringify(contexto)); } catch {}
    const url = urlNatacaoProfessor();
    if(frame.src && frame.src.includes(url) && natacaoCarregada){
      try { frame.contentWindow?.postMessage({ tipo:'fusion_natacao_contexto', contexto }, location.origin); } catch {}
      return;
    }
    frame.src = url;
    natacaoCarregada = true;
  }

  window.profOperacao=function(tipo,alunoId){
    const aluno = alunos.find(a=>idAluno(a)===String(alunoId));
    if(!aluno) return mostrar('Aluno não encontrado.');
    if(tipo==='nova-avaliacao') { ativarTab('avaliacoes'); carregarAvaliacoesV3(aluno,'nova'); return; }
    if(tipo==='editar-avaliacao') { ativarTab('avaliacoes'); carregarAvaliacoesV3(aluno,'editar'); return; }
    if(tipo==='novo-treino') { ativarTab('treinos'); carregarTreinosV3(aluno, 'novo'); return; }
    if(tipo==='editar-treino') {
      const tr = treinoAtivo(idAluno(aluno));
      if(!tr) return mostrar('Este aluno ainda não possui treino ativo para editar. Use Novo treino.');
      ativarTab('treinos');
      carregarTreinosV3(aluno, 'editar');
      return;
    }
    if(tipo==='executar') return abrir('Executar treino',`/pages/treinos/index.html?alunoId=${encodeURIComponent(idAluno(aluno))}&professorId=${encodeURIComponent(idProf(professor))}&embed=1`);
    if(tipo==='ficha') return abrir('Ficha do aluno',urlFicha(aluno));
    if(tipo==='evolucao') { ativarTab('evolucao'); return; }
  };

  function cardAluno(a){
    const av=ultimaAvaliacao(idAluno(a));
    const tr=treinoAtivo(idAluno(a));
    return `<div class="aluno-card">
      <h4>${esc(nomeAluno(a))}</h4>
      <small>${esc(a.plano||a.modalidade||'-')} · <span class="badge ${esc(statusClass(a.status||'ativo'))}">${esc(a.status||'Ativo')}</span></small>
      <div class="mini">
        <div><span>Avaliação</span><b>${esc(av ? data(av.data||av.criadoEm||av.criado_em) : '-')}</b></div>
        <div><span>Treino</span><b>${esc(tr ? (tr.objetivo||tr.nome||'Ativo') : '-')}</b></div>
        <div><span>Contato</span><b>${esc(a.telefone||a.whatsapp||'-')}</b></div>
      </div>
      <div class="acoes">
        <button class="btn-outline" onclick="profOperacao('nova-avaliacao','${esc(idAluno(a))}')">Nova avaliação</button>
        <button class="btn-outline" onclick="profOperacao('editar-avaliacao','${esc(idAluno(a))}')">Editar avaliação</button>
        <button class="btn-outline" onclick="profOperacao('novo-treino','${esc(idAluno(a))}')">Novo treino</button>
        <button class="btn-outline" onclick="profOperacao('editar-treino','${esc(idAluno(a))}')">Editar treino</button>
        <button class="btn-outline" onclick="profOperacao('executar','${esc(idAluno(a))}')">Executar</button>
        <button class="btn-outline" onclick="profOperacao('ficha','${esc(idAluno(a))}')">Ficha</button>
      </div>
    </div>`;
  }

  function render(){
    $('#professorNomeMenu').textContent=nomeProf(professor);
    $('#professorCrefMenu').textContent=professor.cref || 'Portal do Professor';
    $('#subtitulo').textContent=[nomeProf(professor), professor.cref].filter(Boolean).join(' · ');
    $('#ultimaAtualizacao').textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    $('#kpiAlunos').textContent=alunos.length;
    $('#kpiTreinos').textContent=treinos.length;
    $('#kpiAvaliacoes').textContent=avaliacoes.length;
    $('#kpiExecucao').textContent=portal.operacional?.kpis?.emExecucao || 0;
    $('#kpiAlertas').textContent=portal.operacional?.kpis?.alertas || 0;
    $('#alunosResumo').innerHTML=alunos.length?alunos.slice(0,6).map(cardAluno).join(''):vazio('Nenhum aluno vinculado ao professor.');
    renderAlunos(); renderAvaliacoes(); renderEvolucao(); renderOperacional(); renderPerfil();
  }

  function renderAlunos(){
    const q=norm($('#buscaAluno')?.value||'');
    const lista=alunos.filter(a=>!q || norm(nomeAluno(a)+' '+(a.plano||'')+' '+(a.telefone||'')).includes(q));
    $('#listaAlunos').innerHTML=lista.length?lista.map(cardAluno).join(''):vazio('Nenhum aluno encontrado.');
  }
  function renderAvaliacoes(){
    const lista = $('#listaAvaliacoes');
    if(!lista) return;
    lista.innerHTML=avaliacoes.length?avaliacoes.map(a=>`<div class="item"><strong>${esc(a.alunoNome||a.aluno||'Aluno')} — ${data(a.data||a.criadoEm||a.criado_em)}</strong><small>Peso: ${esc(a.peso||'-')} · IMC: ${esc(a.imc||'-')} · Objetivo: ${esc(a.objetivo||'-')}</small></div>`).join(''):vazio('Nenhuma avaliação encontrada.');
  }
  function renderEvolucao(){
    const linhas = alunos.map(a=>{ const av=ultimaAvaliacao(idAluno(a)); const tr=treinoAtivo(idAluno(a)); return `<div class="item"><strong>${esc(nomeAluno(a))}</strong><small>Última avaliação: ${esc(av?data(av.data||av.criadoEm||av.criado_em):'-')} · Treino: ${esc(tr?(tr.nome||tr.objetivo||'Ativo'):'-')}</small></div>`; });
    $('#listaEvolucao').innerHTML=linhas.length?linhas.join(''):vazio('Sem dados de evolução.');
  }
  function renderOperacional(){
    const op=portal.operacional||{};
    $('#execucoes').innerHTML=(op.alunos||[]).length?(op.alunos||[]).map(e=>`<div class="item"><strong>${esc(e.aluno)}</strong><small>${esc(e.treino||'-')} · ${esc(e.status||'-')}</small></div>`).join(''):vazio('Nenhum treino em execução agora.');
    $('#alertasOperacionais').innerHTML=(op.alunos||[]).some(a=>(a.alertas||[]).length)?(op.alunos||[]).flatMap(a=>(a.alertas||[]).map(x=>`<div class="item"><strong>${esc(a.aluno)}</strong><small>${esc(x)}</small></div>`)).join(''):vazio('Sem alertas no momento.');
    $('#checkins').innerHTML=(op.checkins||[]).length?(op.checkins||[]).map(c=>`<div class="item"><strong>${esc(c.aluno)}</strong><small>${esc(c.entrada||'-')} · ${esc(c.status||'Presente')}</small></div>`).join(''):vazio('Nenhum check-in ativo.');
    $('#listaChamada').innerHTML=(portal.turmas||[]).length?(portal.turmas||[]).map(t=>`<div class="item"><strong>${esc(t.turma||t.nome||'Turma')}</strong><small>${esc(t.horario||'-')} · ${esc(t.totalAlunos||0)} aluno(s)</small></div>`).join(''):vazio('Chamada indisponível neste painel.');
  }
  function renderPerfil(){
    $('#dadosPerfil').innerHTML=`<div class="item"><strong>Nome</strong><small>${esc(nomeProf(professor))}</small></div><div class="item"><strong>CREF</strong><small>${esc(professor.cref||'-')}</small></div><div class="item"><strong>E-mail</strong><small>${esc(professor.email||'-')}</small></div><div class="item"><strong>Telefone</strong><small>${esc(professor.telefone||professor.whatsapp||'-')}</small></div>`;
  }
  function ativarTab(tab){
    document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id===`tab-${tab}`));
    if(tab === 'treinos') carregarTreinosV3(null, 'novo');
    if(tab === 'avaliacoes') carregarAvaliacoesV3();
    if(tab === 'natacao') carregarNatacaoProfessor();
  }

  document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>ativarTab(btn.dataset.tab)));
  $('#btnSair')?.addEventListener('click',sair);
  $('#btnFecharModal')?.addEventListener('click',fecharModal);
  $('#buscaAluno')?.addEventListener('input',renderAlunos);


  window.addEventListener('message', (ev)=>{
    if(ev.origin !== location.origin) return;
    if(ev.data?.tipo === 'fusion_treinos_v3_salvo'){
      treinoV3Carregado = false;
      carregar();
    }
    if(ev.data?.tipo === 'fusion_avaliacao_v3_salva'){
      avaliacaoV3Carregada = false;
      carregar();
    }
    if(ev.data?.tipo === 'fusion_natacao_salva'){
      natacaoCarregada = false;
      carregar();
    }
  });

  function fecharMenuMobile(){
    document.body.classList.remove('portal-menu-open');
    $('#mobileMenuBackdrop')?.classList.add('hidden');
    $('#btnMobileMenu')?.setAttribute('aria-expanded','false');
  }

  function abrirMenuMobile(){
    document.body.classList.add('portal-menu-open');
    $('#mobileMenuBackdrop')?.classList.remove('hidden');
    $('#btnMobileMenu')?.setAttribute('aria-expanded','true');
  }

  function alternarMenuMobile(){
    if(document.body.classList.contains('portal-menu-open')) fecharMenuMobile();
    else abrirMenuMobile();
  }

  $('#btnMobileMenu')?.addEventListener('click', alternarMenuMobile);
  $('#mobileMenuBackdrop')?.addEventListener('click', fecharMenuMobile);
  window.addEventListener('keydown', ev => { if(ev.key === 'Escape') fecharMenuMobile(); });
  document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',fecharMenuMobile));

  carregar();
})();
