(function(){
  const API_BIBLIOTECA = '/api/exercicios-biblioteca';
  const API_TREINOS_INTEGRADO = '/api/treinos-integrado';
  const API_ALUNOS = '/api/alunos';
  const API_PROFESSORES = '/api/professores';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const EMBED = params.get('embed') === '1';
  if (EMBED) document.body.classList.add('embed-mode');

  const treinos = [
    { id:'A', nome:'Treino A', curto:'A', descricao:'', exercicios:[] },
    { id:'B', nome:'Treino B', curto:'B', descricao:'', exercicios:[] },
    { id:'C', nome:'Treino C', curto:'C', descricao:'', exercicios:[] },
    { id:'D', nome:'Treino D', curto:'D', descricao:'', exercicios:[] },
    { id:'CARDIO', nome:'Cardio', curto:'Cardio', descricao:'', exercicios:[] },
    { id:'FUNCIONAL', nome:'Funcional', curto:'Funcional', descricao:'', exercicios:[] },
    { id:'ALONG', nome:'Alongamento', curto:'Along.', descricao:'', exercicios:[] }
  ];

  let biblioteca = [];
  let alunos = [];
  let professores = [];
  let grupos = [];
  let grupoFiltro = '';
  let treinoAtual = 'A';
  let contextoProfessor = null;
  let treinoIntegradoAtualId = params.get('treinoId') || '';
  let modoTreino = params.get('modo') || (params.get('treinoId') || params.get('alunoId') ? 'editar' : 'novo');
  let treinoExistenteCarregado = false;
  let bibliotecaModo = 'todos';
  let ultimoAdicionadoInstancia = '';
  let dragIndex = null;
  let alterado = false;
  const FAVORITOS_KEY = 'fusion_treinos_v4_favoritos';
  const RECENTES_KEY = 'fusion_treinos_v4_recentes';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalizar(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function dataHoje(){return new Date().toISOString().slice(0,10);}
  function dataFutura(dias=45){const d=new Date(); d.setDate(d.getDate()+dias); return d.toISOString().slice(0,10);}
  function treino(){return treinos.find(t=>t.id===treinoAtual) || treinos[0];}
  function extrairLista(payload, chave){
    if(Array.isArray(payload)) return payload;
    return payload?.[chave] || payload?.dados || payload?.data || payload?.itens || payload?.registros || payload?.exercicios || [];
  }
  async function safeJson(resp){try{return await resp.json();}catch{return {};}}
  function idAluno(a={}){return String(a.id || a._id || a.alunoId || a.aluno_id || '');}
  function nomeAluno(a={}){return a.nome || a.alunoNome || a.name || a.nomeCompleto || 'Aluno';}
  function idProfessor(p={}){return String(p.id || p._id || p.professorId || p.professor_id || '');}
  function nomeProfessor(p={}){return p.nome || p.professorNome || p.professor || p.name || 'Professor';}
  function professorIdAluno(a={}){return String(a.professorId || a.professor_id || a.professorResponsavelId || a.professor_responsavel_id || '');}
  function professorNomeAluno(a={}){return a.professorNome || a.professor || a.professor_responsavel || a.professorResponsavel || '';}
  function arquivoMidia(ex={}){return ex.midia || ex.media || ex.imagem || ex.image || ex.imagemUrl || ex.videoUrl || '';}
  function exercicioKey(ex={}){return String(ex.bibliotecaId || ex.id || ex.exercicioId || chaveBiblioteca(ex) || ex.nome || ex.name || '');}
  function lerListaStorage(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[];}catch{return [];} }
  function salvarListaStorage(key, lista){localStorage.setItem(key, JSON.stringify(Array.from(new Set(lista)).slice(0,80)));}
  function favoritos(){return lerListaStorage(FAVORITOS_KEY);}
  function recentes(){return lerListaStorage(RECENTES_KEY);}
  function isFavorito(ex){return favoritos().includes(exercicioKey(ex));}
  function registrarRecente(ex){const key=exercicioKey(ex); if(!key) return; salvarListaStorage(RECENTES_KEY, [key, ...recentes().filter(k=>k!==key)].slice(0,40));}
  function alternarFavorito(id){const ex=biblioteca.find(e=>String(exercicioKey(e))===String(id) || String(e.id||e.bibliotecaId)===String(id)); if(!ex) return; const key=exercicioKey(ex); const lista=favoritos(); const nova=lista.includes(key) ? lista.filter(k=>k!==key) : [key, ...lista]; salvarListaStorage(FAVORITOS_KEY, nova); renderBiblioteca();}
  function chaveBiblioteca(ex={}){
    const grupo = normalizar(ex.grupo || ex.grupoMuscular || ex.group || ex.folder || '');
    const nome = normalizar((arquivoMidia(ex).split('/').pop() || ex.nome || ex.name || '').replace(/\.[^.]+$/, ''));
    return [grupo, nome].filter(Boolean).join('::');
  }
  function statusAtivo(t={}){
    return !['cancelado','cancelada','encerrado','encerrada','inativo','inativa','arquivado','removido','removida']
      .includes(normalizar(t.status || 'Ativo'));
  }
  function lerContextoProfessor(){
    if(contextoProfessor) return contextoProfessor;
    for (const key of ['fusion_treinos_v4_professor_contexto','fusion_treinos_v3_professor_contexto']) {
      try{
        const ctx = JSON.parse(localStorage.getItem(key) || 'null');
        if(ctx && (ctx.professorId || ctx.professor || Array.isArray(ctx.alunos))) { contextoProfessor = ctx; break; }
      }catch{}
    }
    return contextoProfessor || {};
  }
  function professorIdAtivo(){
    const ctx = lerContextoProfessor();
    return params.get('professorId') || ctx.professorId || idProfessor(ctx.professor || {}) || $('#professorId')?.value || '';
  }
  function professorNomeAtivo(aluno=null){
    const pid = professorIdAtivo();
    const ctx = lerContextoProfessor();
    const prof = professores.find(p => idProfessor(p) === String(pid));
    return nomeProfessor(prof || ctx.professor || {}) || professorNomeAluno(aluno || {}) || '';
  }

  function mediaTag(ex, classe='v4-media'){
    const src = arquivoMidia(ex);
    const nome = ex.nome || ex.name || 'Exercício';
    if(!src) return `<div class="${classe} v4-placeholder">sem mídia</div>`;
    if(ex.tipo === 'video' || ex.tipoMidia === 'video' || /\.(mp4|webm|mov)$/i.test(src)) {
      return `<video class="${classe}" src="${esc(src)}" muted loop playsinline preload="metadata"></video>`;
    }
    return `<img class="${classe}" src="${esc(src)}" alt="${esc(nome)}" loading="lazy">`;
  }

  function numeroTempo(v, padrao=60){
    const n = Number(String(v ?? '').replace(/[^0-9.,]/g,'').replace(',','.'));
    return Number.isFinite(n) && n > 0 ? n : padrao;
  }
  function estimarMinutosTreino(grupo=null){
    const listaGrupos = grupo ? [grupo] : treinos;
    let segundos = 0;
    listaGrupos.forEach(g => (g.exercicios || []).forEach(ex => {
      const tipo = tipoExecucao(ex, g.id);
      if(tipo === 'cardio'){
        segundos += tempoMinutosCardio(ex) * 60 + 20;
        return;
      }
      if(tipo === 'alongamento'){
        segundos += Math.max(15, Number(String(ex.tempoSegundos || ex.tempo || 30).replace(/\D/g,'')) || 30) + 10;
        return;
      }
      const series = Math.max(1, Number.parseInt(String(ex.series || '3'), 10) || 3);
      const descanso = descansoAtivado(ex) ? numeroTempo(ex.descanso, 60) : 0;
      segundos += (series * 45) + (Math.max(0, series - 1) * descanso) + 20;
    }));
    return Math.max(0, Math.round(segundos / 60));
  }
  function toast(msg){
    const el = $('#v4Toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(()=>el.classList.remove('show'), 1800);
  }
  function instanciaId(){
    return `v4inst_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }


  function tipoExecucao(ex = {}, grupoTreino = treinoAtual){
    const bruto = normalizar([ex.tipoExecucao, ex.tipo_execucao, ex.tipo, ex.categoria, ex.grupo, ex.grupoMuscular, ex.group, grupoTreino, ex.nome].join(' '));
    if(bruto.includes('cardio') || bruto.includes('esteira') || bruto.includes('bike') || bruto.includes('bicicleta') || bruto.includes('eliptico') || bruto.includes('escada')) return 'cardio';
    if(bruto.includes('along')) return 'alongamento';
    if(bruto.includes('funcional') || bruto.includes('circuito')) return 'funcional';
    return 'musculacao';
  }

  function descansoAtivado(ex = {}){
    if(ex.descansoAtivo === false || ex.usarDescanso === false) return false;
    const v = String(ex.descanso ?? '').trim().toLowerCase();
    if(!v || v === '-' || v === '0' || v === '0s' || v.includes('sem')) return false;
    return true;
  }

  function valorDescanso(ex = {}){
    return descansoAtivado(ex) ? String(ex.descanso || '60s') : '';
  }

  function tempoMinutosCardio(ex = {}){
    const base = ex.tempoMinutos ?? ex.tempoMin ?? ex.tempo ?? ex.duracao ?? ex.repeticoes ?? '20';
    const n = Number(String(base).replace(/[^0-9.,]/g,'').replace(',','.'));
    return Number.isFinite(n) && n > 0 ? n : 20;
  }

  function marcarAlterado(){
    alterado = true;
  }

  async function confirmarSaidaPainel(){
    if(!alterado){
      location.href = '/pages/professor-painel/';
      return;
    }
    const acao = prompt('Existem alterações não salvas. Digite SALVAR para salvar e sair, SAIR para sair sem salvar ou CANCELAR para continuar.');
    const normal = normalizar(acao || '');
    if(normal === 'salvar'){
      await salvarModelo(true);
      location.href = '/pages/professor-painel/';
    }else if(normal === 'sair'){
      location.href = '/pages/professor-painel/';
    }
  }

  function resetTreinos(){
    treinos.forEach(t => { t.descricao = ''; t.exercicios = []; });
    treinoAtual = 'A';
    treinoIntegradoAtualId = '';
    treinoExistenteCarregado = false;
    const btn = $('#btnSalvar'); if(btn) btn.textContent = 'Salvar treino';
  }

  function normalizarGrupoTreino(v=''){
    const n = normalizar(v);
    if(n.includes('treino b') || n === 'b') return 'B';
    if(n.includes('treino c') || n === 'c') return 'C';
    if(n.includes('treino d') || n === 'd') return 'D';
    if(n.includes('cardio')) return 'CARDIO';
    if(n.includes('funcional')) return 'FUNCIONAL';
    if(n.includes('along')) return 'ALONG';
    return 'A';
  }
  function grupoPorOrdem(ex={}, idx=0){
    const bruto = ex.treinoGrupoId || ex.origemGrupo || ex.grupoTreino || ex.divisao || ex.observacao || ex.observacoes || '';
    if(bruto) return normalizarGrupoTreino(bruto);
    const ordem = Number(ex.ordem || idx + 1);
    if(ordem >= 600) return 'ALONG';
    if(ordem >= 500) return 'FUNCIONAL';
    if(ordem >= 400) return 'CARDIO';
    if(ordem >= 300) return 'D';
    if(ordem >= 200) return 'C';
    if(ordem >= 100) return 'B';
    return 'A';
  }
  function preencherTreinoExistente(treinoExistente={}){
    if(!treinoExistente || !Array.isArray(treinoExistente.exercicios)) return false;
    treinos.forEach(t => { t.descricao = ''; t.exercicios = []; });
    treinoIntegradoAtualId = treinoExistente.id || treinoExistente._id || treinoIntegradoAtualId || '';
    modoTreino = 'editar';
    treinoExistenteCarregado = true;
    if($('#alunoId') && (treinoExistente.alunoId || treinoExistente.aluno_id)) $('#alunoId').value = treinoExistente.alunoId || treinoExistente.aluno_id;
    if($('#professorId') && (treinoExistente.professorId || treinoExistente.professor_id)) $('#professorId').value = treinoExistente.professorId || treinoExistente.professor_id;
    if($('#objetivoTreino')) $('#objetivoTreino').value = treinoExistente.objetivo || treinoExistente.nome || 'Condicionamento físico';
    if($('#validadeTreino')) $('#validadeTreino').value = (treinoExistente.dataValidade || treinoExistente.validade || '').slice(0,10) || dataFutura(45);
    treinoExistente.exercicios.forEach((ex, idx)=>{
      const grupoId = grupoPorOrdem(ex, idx);
      const grupo = treinos.find(t => t.id === grupoId) || treinos[0];
      grupo.exercicios.push({
        ...ex,
        id: ex.bibliotecaId || ex.exercicioId || ex.id || `ex_${idx}`,
        exercicioId: ex.exercicioId || ex.bibliotecaId || ex.id || '',
        bibliotecaId: ex.bibliotecaId || ex.exercicioId || ex.id || '',
        bibliotecaKey: ex.bibliotecaKey || chaveBiblioteca(ex),
        nome: ex.nome || ex.nomeOriginal || ex.exercicio || 'Exercício',
        grupo: ex.grupo || ex.grupoMuscular || '',
        grupoMuscular: ex.grupoMuscular || ex.grupo || '',
        equipamento: ex.equipamento || '',
        series: ex.series || '3',
        repeticoes: ex.repeticoes || ex.reps || '10-12',
        carga: ex.carga || '',
        descanso: ex.descanso || '',
        descansoAtivo: descansoAtivado(ex),
        tipoExecucao: ex.tipoExecucao || tipoExecucao(ex, grupoId),
        tempoMinutos: ex.tempoMinutos || ex.tempo || '',
        permiteAlunoAlterarTempo: ex.permiteAlunoAlterarTempo !== false,
        intensidade: ex.intensidade || 'Moderada',
        observacoes: ex.observacoes || ex.observacao || ''
      });
    });
    const primeiro = treinos.find(t=>t.exercicios.length);
    treinoAtual = primeiro ? primeiro.id : 'A';
    const btn=$('#btnSalvar'); if(btn) btn.textContent='Atualizar treino';
    renderTudo();
    return true;
  }

  async function carregarAlunos(){
    const select = $('#alunoId'); if(!select) return;
    const ctx = lerContextoProfessor();
    const alunosCtx = Array.isArray(ctx.alunos) ? ctx.alunos : [];
    if(EMBED && alunosCtx.length){
      alunos = alunosCtx;
    } else {
      try{
        const resp = await fetch(API_ALUNOS, {cache:'no-store'});
        const json = await safeJson(resp);
        if(!resp.ok) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
        alunos = extrairLista(json, 'alunos');
      }catch(erro){ console.warn('Treinos V4: alunos indisponíveis', erro); alunos = alunosCtx; }
    }
    const pid = professorIdAtivo();
    if(EMBED && pid && alunos.length){
      const filtrados = alunos.filter(a => {
        const ap = professorIdAluno(a);
        const an = normalizar(professorNomeAluno(a));
        const pn = normalizar(professorNomeAtivo());
        return !ap || ap === String(pid) || (!!an && !!pn && (an.includes(pn) || pn.includes(an)));
      });
      if(filtrados.length) alunos = filtrados;
    }
    select.innerHTML = '<option value="">Selecione o aluno</option>' + alunos
      .slice().sort((a,b)=>nomeAluno(a).localeCompare(nomeAluno(b),'pt-BR'))
      .map(a=>`<option value="${esc(idAluno(a))}">${esc(nomeAluno(a))}</option>`).join('');
    const inicial = params.get('alunoId') || ctx.alunoSelecionadoId || localStorage.getItem('fusion_treinos_v4_alunoId') || localStorage.getItem('fusion_treinos_v3_alunoId') || '';
    if(inicial) select.value = inicial;
  }

  async function carregarProfessores(){
    const select = $('#professorId'); if(!select) return;
    const ctx = lerContextoProfessor();
    const pidCtx = professorIdAtivo();
    if(EMBED && pidCtx){
      const nome = professorNomeAtivo();
      professores = [{ ...(ctx.professor || {}), id: pidCtx, nome }];
      select.innerHTML = `<option value="${esc(pidCtx)}" selected>${esc(nome || pidCtx)}</option>`;
      select.value = pidCtx;
      return;
    }
    try{
      const resp = await fetch(API_PROFESSORES, {cache:'no-store'});
      const json = await safeJson(resp);
      if(!resp.ok) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
      professores = extrairLista(json, 'professores');
      select.innerHTML = '<option value="">Selecione professor</option>' + professores.map(p=>`<option value="${esc(idProfessor(p))}">${esc(nomeProfessor(p))}</option>`).join('');
      const inicial = pidCtx || localStorage.getItem('fusion_treinos_v4_professorId') || '';
      if(inicial) select.value = inicial;
    }catch(erro){
      console.warn('Treinos V4: professores indisponíveis', erro);
      select.innerHTML = '<option value="">Professor não carregado</option>';
    }
  }

  async function carregarBiblioteca(){
    const status = $('#bibliotecaStatus'); if(status) status.textContent='Carregando...';
    try{
      const resp = await fetch(API_BIBLIOTECA, {cache:'no-store'});
      const json = await safeJson(resp);
      if(!resp.ok) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
      biblioteca = extrairLista(json, 'exercicios').filter(e => normalizar(e.status || 'Ativo') !== 'inativo');
    }catch(erro){
      console.warn('Treinos V4: API biblioteca indisponível', erro);
      biblioteca = [];
    }
    grupos = [...new Set(biblioteca.map(e=>e.grupo || e.grupoMuscular || e.group || e.folder).filter(Boolean))]
      .sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    const sel = $('#filtroGrupoSelect');
    if(sel){
      sel.innerHTML = '<option value="">Todos os grupos</option>' + grupos.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
      const preferido = grupos.includes('PEITO') ? 'PEITO' : (grupos[0] || '');
      grupoFiltro = preferido;
      sel.value = preferido;
    }
    if(status) status.textContent = `${biblioteca.length} exercício(s)`;
    renderGrupos();
    renderBiblioteca();
  }

  async function buscarTreinosAtivosAluno(alunoId){
    if(!alunoId) return [];
    const q = new URLSearchParams({ alunoId });
    const pid = professorIdAtivo(); if(pid) q.set('professorId', pid);
    const resp = await fetch(`${API_TREINOS_INTEGRADO}?${q.toString()}`, {cache:'no-store'});
    const json = await safeJson(resp);
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    return extrairLista(json, 'dados').filter(statusAtivo)
      .sort((a,b)=>String(b.atualizadoEm || b.criadoEm || b.dataInicio || '').localeCompare(String(a.atualizadoEm || a.criadoEm || a.dataInicio || '')));
  }
  async function carregarTreinoExistente(forcar=false){
    if(!forcar && treinoExistenteCarregado) return;
    if(modoTreino !== 'editar') return;
    const alunoId = $('#alunoId')?.value || params.get('alunoId') || lerContextoProfessor().alunoSelecionadoId || '';
    if(!alunoId) return;
    try{
      const lista = await buscarTreinosAtivosAluno(alunoId);
      const escolhido = treinoIntegradoAtualId ? (lista.find(t=>String(t.id || t._id)===String(treinoIntegradoAtualId)) || lista[0]) : lista[0];
      if(escolhido) preencherTreinoExistente(escolhido);
    }catch(erro){ console.warn('Treinos V4: não foi possível carregar treino existente', erro); }
  }

  function renderTabs(){
    const tabs = $('#tabsTreino'); if(!tabs) return;
    tabs.innerHTML = treinos.map(t=>`<button type="button" class="v4-tab ${t.id===treinoAtual?'active':''}" data-id="${esc(t.id)}"><span>${esc(t.curto)}</span><b>${(t.exercicios||[]).length}</b></button>`).join('');
    $$('#tabsTreino .v4-tab').forEach(btn=>btn.onclick=()=>{salvarDescricao(); treinoAtual=btn.dataset.id; renderTudo();});
  }
  function renderGrupos(){
    const box = $('#grupoChips'); if(!box) return;
    const principais = ['PEITO','COSTAS','PERNAS','OMBRO','BÍCEPS','TRÍCEPS','ABDOME','GLÚTEO','CARDIO','FUNCIONAL'].filter(g=>grupos.includes(g));
    const lista = principais.length ? principais : grupos.slice(0,10);
    box.innerHTML = lista.map(g=>`<button type="button" class="v4-chip ${g===grupoFiltro?'active':''}" data-grupo="${esc(g)}">${esc(g)}</button>`).join('');
    $$('#grupoChips .v4-chip').forEach(btn=>btn.onclick=()=>{grupoFiltro=btn.dataset.grupo; if($('#filtroGrupoSelect')) $('#filtroGrupoSelect').value=grupoFiltro; renderGrupos(); renderBiblioteca();});
  }
  function listaFiltradaBiblioteca(){
    const q = normalizar($('#buscaExercicio')?.value || '');
    const favs = favoritos();
    const recs = recentes();
    let listaBase = biblioteca;
    if (bibliotecaModo === 'favoritos') listaBase = biblioteca.filter(e => favs.includes(exercicioKey(e)));
    else if (bibliotecaModo === 'recentes') listaBase = biblioteca.filter(e => recs.includes(exercicioKey(e)));
    else if (grupoFiltro) listaBase = biblioteca.filter(e => String(e.grupo || e.grupoMuscular || e.group || e.folder) === String(grupoFiltro));
    if (q) {
      listaBase = listaBase.filter(e => normalizar([e.nome,e.name,e.grupo,e.grupoMuscular,e.equipamento,e.nivel,e.categoria].join(' ')).includes(q));
    }
    if (bibliotecaModo === 'recentes') {
      const ordem = new Map(recs.map((k,i)=>[k,i]));
      listaBase = listaBase.slice().sort((a,b)=>(ordem.get(exercicioKey(a)) ?? 9999) - (ordem.get(exercicioKey(b)) ?? 9999));
    }
    return listaBase.slice(0,160);
  }

  function renderBiblioteca(){
    const lista = listaFiltradaBiblioteca();
    const status = $('#grupoBibliotecaStatus');
    const totalGrupo = grupoFiltro ? biblioteca.filter(e => String(e.grupo || e.grupoMuscular || e.group || e.folder) === String(grupoFiltro)).length : biblioteca.length;
    if(status) {
      const modoLabel = bibliotecaModo === 'favoritos' ? 'Favoritos' : (bibliotecaModo === 'recentes' ? 'Recentes' : (grupoFiltro || 'Todos'));
      status.innerHTML = `<b>${esc(modoLabel)}</b> · ${lista.length} exibido(s)${bibliotecaModo==='todos' && grupoFiltro ? ` de ${totalGrupo}` : ''}`;
    }
    const box = $('#listaExercicios'); if(!box) return;
    if(!lista.length){
      const msg = bibliotecaModo === 'favoritos'
        ? 'Nenhum favorito ainda. Toque na estrela de um exercício para fixar aqui.'
        : (bibliotecaModo === 'recentes' ? 'Nenhum exercício recente ainda.' : 'Nenhum exercício encontrado.');
      box.innerHTML = `<div class="v4-empty">${msg}</div>`;
      return;
    }
    box.innerHTML = lista.map(e=>{
      const key = exercicioKey(e);
      const fav = favoritos().includes(key);
      const grupo = e.grupo || e.grupoMuscular || e.group || '';
      const nome = e.nome || e.name || 'Exercício';
      const equipamento = e.equipamento ? `<em>${esc(e.equipamento)}</em>` : '';
      return `<article class="v4-exercise-item" data-id="${esc(key)}" tabindex="0" title="Adicionar ${esc(nome)}">
        ${mediaTag(e)}
        <div class="v4-exercise-text">
          <strong>${esc(nome)}</strong>
          <span>${esc(grupo)}</span>
          ${equipamento}
        </div>
        <div class="v4-exercise-actions">
          <button type="button" class="v4-fav ${fav?'active':''}" data-id="${esc(key)}" aria-label="Favoritar exercício">${fav?'★':'☆'}</button>
          <button type="button" class="v4-add" data-id="${esc(key)}" aria-label="Adicionar exercício">+</button>
        </div>
      </article>`;
    }).join('');
    $$('#listaExercicios .v4-add').forEach(btn=>btn.onclick=(ev)=>{ev.stopPropagation(); adicionarExercicio(btn.dataset.id);});
    $$('#listaExercicios .v4-fav').forEach(btn=>btn.onclick=(ev)=>{ev.stopPropagation(); alternarFavorito(btn.dataset.id);});
    $$('#listaExercicios .v4-exercise-item').forEach(card=>{
      card.onclick=()=>adicionarExercicio(card.dataset.id);
      card.onkeydown=(ev)=>{if(ev.key==='Enter' || ev.key===' '){ev.preventDefault(); adicionarExercicio(card.dataset.id);}};
    });
  }
  function salvarDescricao(){ const atual=treino(); if($('#descricaoGrupo')) { atual.descricao = $('#descricaoGrupo').value; marcarAlterado(); } }
  function adicionarExercicio(id){
    const origem = biblioteca.find(e=>String(exercicioKey(e))===String(id) || String(e.id || e.bibliotecaId)===String(id));
    if(!origem) return;
    adicionarOrigemAoTreino(origem);
    renderTudo();
    setTimeout(()=>{ ultimoAdicionadoInstancia=''; renderTreino(); }, 1700);
  }
  function removerExercicio(index){
    const item = treino().exercicios[index];
    treino().exercicios.splice(index,1);
    marcarAlterado();
    renderTudo();
    if(item) toast(`${item.nome || item.name || 'Exercício'} removido.`);
  }
  function duplicarExercicio(index){
    const item = treino().exercicios[index];
    if(!item) return;
    const inst = instanciaId();
    treino().exercicios.splice(index + 1, 0, {...item, instanciaId: inst});
    marcarAlterado();
    ultimoAdicionadoInstancia = inst;
    renderTudo();
    toast('Exercício duplicado.');
    setTimeout(()=>{ ultimoAdicionadoInstancia=''; renderTreino(); }, 1700);
  }
  function mover(index, delta){
    const lista=treino().exercicios; const novo=index+delta; if(novo<0||novo>=lista.length) return;
    [lista[index],lista[novo]]=[lista[novo],lista[index]];
    marcarAlterado();
    renderTudo();
  }
  function moverPara(origem, destino){
    const lista = treino().exercicios;
    origem = Number(origem); destino = Number(destino);
    if(!Number.isInteger(origem) || !Number.isInteger(destino) || origem === destino || origem < 0 || destino < 0 || origem >= lista.length || destino >= lista.length) return;
    const [item] = lista.splice(origem, 1);
    lista.splice(destino, 0, item);
    marcarAlterado();
    renderTudo();
  }
  function atualizarCampo(index,campo,valor){
    const item=treino().exercicios[index];
    if(item) item[campo]=valor;
    marcarAlterado();
    atualizarResumoTreino();
  }
  function atualizarResumoTreino(){
    const atual = treino();
    const el = $('#treinoResumoAtual');
    if(el) el.textContent = `${(atual.exercicios||[]).length} exercício(s) · ${estimarMinutosTreino(atual)} min estimados · total ${estimarMinutosTreino()} min`;
  }
  function camposPorTipo(e, i){
    const tipo = tipoExecucao(e);
    if(tipo === 'cardio'){
      return `<div class="v4-fields v4-fields-cardio">
          <label>Tempo sugerido (min)<input inputmode="numeric" value="${esc(tempoMinutosCardio(e))}" oninput="FusionTreinosV4.campo(${i},'tempoMinutos',this.value)"></label>
          <label>Intensidade<input value="${esc(e.intensidade || 'Moderada')}" oninput="FusionTreinosV4.campo(${i},'intensidade',this.value)"></label>
          <label>Equipamento<input value="${esc(e.equipamento || '')}" oninput="FusionTreinosV4.campo(${i},'equipamento',this.value)"></label>
          <label class="v4-check"><input type="checkbox" ${e.permiteAlunoAlterarTempo !== false ? 'checked' : ''} onchange="FusionTreinosV4.campo(${i},'permiteAlunoAlterarTempo',this.checked)"> Aluno ajusta tempo</label>
        </div>`;
    }
    if(tipo === 'funcional'){
      return `<div class="v4-fields">
          <label>Séries<input inputmode="numeric" value="${esc(e.series || '3')}" oninput="FusionTreinosV4.campo(${i},'series',this.value)"></label>
          <label>Modo<input value="${esc(e.modoExecucao || 'tempo')}" oninput="FusionTreinosV4.campo(${i},'modoExecucao',this.value)"></label>
          <label>Tempo/Reps<input value="${esc(e.tempoSegundos || e.repeticoes || '45s')}" oninput="FusionTreinosV4.campo(${i},'tempoSegundos',this.value)"></label>
          <label>Circuito<input value="${esc(e.circuito || '')}" oninput="FusionTreinosV4.campo(${i},'circuito',this.value)"></label>
        </div>
        ${campoDescansoOpcional(e,i)}`;
    }
    if(tipo === 'alongamento'){
      return `<div class="v4-fields v4-fields-along">
          <label>Tempo<input value="${esc(e.tempoSegundos || e.tempo || '30s')}" oninput="FusionTreinosV4.campo(${i},'tempoSegundos',this.value)"></label>
          <label>Lado<input value="${esc(e.lado || 'Ambos')}" oninput="FusionTreinosV4.campo(${i},'lado',this.value)"></label>
        </div>`;
    }
    return `<div class="v4-fields">
          <label>Séries<input inputmode="numeric" value="${esc(e.series || '3')}" oninput="FusionTreinosV4.campo(${i},'series',this.value)"></label>
          <label>Reps<input value="${esc(e.repeticoes || '')}" oninput="FusionTreinosV4.campo(${i},'repeticoes',this.value)"></label>
          <label>Carga<input value="${esc(e.carga || '')}" oninput="FusionTreinosV4.campo(${i},'carga',this.value)"></label>
          <label>Tipo<input value="Musculação" disabled></label>
        </div>
        ${campoDescansoOpcional(e,i)}`;
  }

  function campoDescansoOpcional(e, i){
    const ativo = descansoAtivado(e);
    return `<div class="v4-descanso">
      <label class="v4-check"><input type="checkbox" ${ativo ? 'checked' : ''} onchange="FusionTreinosV4.campo(${i},'descansoAtivo',this.checked); if(!this.checked) FusionTreinosV4.campo(${i},'descanso','')"> Utilizar descanso</label>
      <input ${ativo ? '' : 'disabled'} inputmode="numeric" placeholder="Ex.: 60s" value="${esc(valorDescanso(e))}" oninput="FusionTreinosV4.campo(${i},'descanso',this.value)">
      <div class="v4-descanso-presets">
        ${['15s','30s','45s','60s','90s','120s'].map(v=>`<button type="button" onclick="FusionTreinosV4.descanso(${i},'${v}')">${v}</button>`).join('')}
      </div>
    </div>`;
  }

  function renderTreino(){
    const atual = treino();
    if($('#grupoAtualLabel')) $('#grupoAtualLabel').textContent = atual.nome;
    if($('#grupoTitulo')) $('#grupoTitulo').textContent = atual.nome;
    if($('#descricaoGrupo')) $('#descricaoGrupo').value = atual.descricao || '';
    atualizarResumoTreino();
    const box = $('#listaTreinoSelecionado'); if(!box) return;
    if(!atual.exercicios.length){box.innerHTML = `<div class="v4-empty v4-empty-big">Toque no <b>+</b> da biblioteca para adicionar exercícios ao ${esc(atual.nome)}.</div>`; return;}
    box.innerHTML = atual.exercicios.map((e,i)=>{
      const inst = e.instanciaId || `idx_${i}`;
      const tipo = tipoExecucao(e);
      return `<article class="v4-selected-card ${inst===ultimoAdicionadoInstancia?'v4-just-added':''}" draggable="true" data-index="${i}">
        <div class="v4-selected-main">
          <div class="v4-order"><button type="button" title="Subir" onclick="FusionTreinosV4.mover(${i},-1)">↑</button><b>${i+1}</b><button type="button" title="Descer" onclick="FusionTreinosV4.mover(${i},1)">↓</button></div>
          ${mediaTag(e,'v4-media-small')}
          <div class="v4-selected-title"><strong>${esc(e.nome || e.name || 'Exercício')}</strong><span>${esc(e.grupo || e.grupoMuscular || '')} · ${esc(tipo)}</span></div>
          <div class="v4-card-actions"><button type="button" title="Duplicar" onclick="FusionTreinosV4.duplicar(${i})">⧉</button><button type="button" class="v4-remove" title="Remover" onclick="FusionTreinosV4.remover(${i})">×</button></div>
        </div>
        ${camposPorTipo(e,i)}
        <input class="v4-obs" placeholder="Observação" value="${esc(e.observacoes || '')}" oninput="FusionTreinosV4.campo(${i},'observacoes',this.value)">
      </article>`;
    }).join('');
    $$('#listaTreinoSelecionado .v4-selected-card').forEach(card=>{
      card.addEventListener('dragstart', ev=>{dragIndex = Number(card.dataset.index); ev.dataTransfer.effectAllowed='move';});
      card.addEventListener('dragover', ev=>{ev.preventDefault(); card.classList.add('v4-drop-target');});
      card.addEventListener('dragleave', ()=>card.classList.remove('v4-drop-target'));
      card.addEventListener('drop', ev=>{ev.preventDefault(); card.classList.remove('v4-drop-target'); moverPara(dragIndex, Number(card.dataset.index)); dragIndex=null;});
    });
  }
  function renderTudo(){renderTabs(); renderTreino();}



  function gruposParaTreinoAtual(){
    const mapa = {
      A: ['PEITO','TRÍCEPS','ABDOME'],
      B: ['COSTAS','BÍCEPS','ABDOME'],
      C: ['PERNAS','GLÚTEO','PANTURRILHA'],
      D: ['OMBRO','ABDOME','TRAPÉZIO'],
      CARDIO: ['CARDIO'],
      FUNCIONAL: ['FUNCIONAL'],
      ALONG: ['ALONGAMENTO','ALONG','ABDOME']
    };
    return mapa[treinoAtual] || ['PEITO'];
  }

  function presetsDoObjetivo(){
    const objetivo = normalizar($('#objetivoTreino')?.value || 'hipertrofia');
    if(objetivo.includes('forca') || objetivo.includes('força')) return {series:'4', repeticoes:'6-8', descanso:'90s'};
    if(objetivo.includes('emagrec') || objetivo.includes('condicion')) return {series:'3', repeticoes:'12-15', descanso:'45s'};
    if(treinoAtual === 'CARDIO') return {series:'1', repeticoes:'10-20 min', descanso:'30s'};
    if(treinoAtual === 'ALONG') return {series:'2', repeticoes:'30-40s', descanso:'20s'};
    return {series:'3', repeticoes:'10-12', descanso:'60s'};
  }

  function mesmoGrupo(ex, grupoAlvo){
    const alvo = normalizar(grupoAlvo);
    const g = normalizar([ex.grupo, ex.grupoMuscular, ex.group, ex.folder].join(' '));
    return g.includes(alvo) || alvo.includes(g);
  }

  function jaNoTreinoAtual(ex){
    const key = exercicioKey(ex);
    return (treino().exercicios || []).some(item => exercicioKey(item) === key || String(item.bibliotecaId || item.id) === String(ex.bibliotecaId || ex.id));
  }

  function adicionarOrigemAoTreino(origem, silencioso=false){
    if(!origem) return false;
    const preset = presetsDoObjetivo();
    const inst = instanciaId();
    const tipo = tipoExecucao(origem);
    registrarRecente(origem);
    const novo = {
      ...origem,
      instanciaId: inst,
      id: origem.id || origem.bibliotecaId,
      exercicioId: origem.exercicioId || origem.bibliotecaId || origem.id || '',
      bibliotecaId: origem.bibliotecaId || origem.id || '',
      tipoExecucao: tipo,
      series: tipo === 'cardio' ? '1' : preset.series,
      repeticoes: tipo === 'cardio' ? '' : preset.repeticoes,
      carga: tipo === 'cardio' || tipo === 'alongamento' ? '' : '',
      descanso: '',
      descansoAtivo: false,
      tempoMinutos: tipo === 'cardio' ? '20' : '',
      permiteAlunoAlterarTempo: true,
      intensidade: tipo === 'cardio' ? 'Moderada' : '',
      modoExecucao: tipo === 'funcional' ? 'tempo' : '',
      tempoSegundos: tipo === 'funcional' ? '45' : (tipo === 'alongamento' ? '30' : ''),
      lado: tipo === 'alongamento' ? 'Ambos' : '',
      circuito: '',
      observacoes: ''
    };
    treino().exercicios.push(novo);
    ultimoAdicionadoInstancia = inst;
    marcarAlterado();
    if(!silencioso) toast(`${origem.nome || origem.name || 'Exercício'} adicionado ao ${treino().nome}.`);
    return true;
  }

  function escolherExerciciosDoGrupo(grupo, limite=3){
    const termosBase = ['SUPINO','PUXADA','REMADA','AGACHAMENTO','LEG','DESENVOLVIMENTO','ROSCA','TRICEPS','CRUCIFIXO','CADEIRA','MESA','PULLEY','ESTEIRA','BIKE','PRANCHA'];
    const candidatos = biblioteca
      .filter(e => normalizar(e.status || 'Ativo') !== 'inativo')
      .filter(e => mesmoGrupo(e, grupo))
      .filter(e => !jaNoTreinoAtual(e))
      .sort((a,b)=>{
        const an = normalizar(a.nome || a.name || '');
        const bn = normalizar(b.nome || b.name || '');
        const ap = termosBase.some(t=>an.includes(normalizar(t))) ? -1 : 0;
        const bp = termosBase.some(t=>bn.includes(normalizar(t))) ? -1 : 0;
        return ap - bp || an.localeCompare(bn, 'pt-BR');
      });
    return candidatos.slice(0, limite);
  }

  function completarTreinoAtual(){
    const atual = treino();
    const alvo = treinoAtual === 'CARDIO' || treinoAtual === 'ALONG' ? 3 : 6;
    let adicionados = 0;
    for(const grupo of gruposParaTreinoAtual()){
      if((atual.exercicios || []).length >= alvo) break;
      const precisa = Math.max(1, Math.ceil((alvo - atual.exercicios.length) / Math.max(1, gruposParaTreinoAtual().length)));
      for(const ex of escolherExerciciosDoGrupo(grupo, precisa)){
        if((atual.exercicios || []).length >= alvo) break;
        if(adicionarOrigemAoTreino(ex, true)) adicionados++;
      }
    }
    renderTudo();
    renderBiblioteca();
    toast(adicionados ? `IA adicionou ${adicionados} exercício(s) ao ${atual.nome}.` : 'IA não encontrou novos exercícios para completar este treino.');
  }

  function ajustarSeriesPorObjetivo(){
    const preset = presetsDoObjetivo();
    const atual = treino();
    (atual.exercicios || []).forEach(ex => {
      ex.series = preset.series;
      ex.repeticoes = preset.repeticoes;
      ex.descanso = preset.descanso;
    });
    renderTudo();
    toast(`Séries do ${atual.nome} ajustadas pelo objetivo.`);
  }

  function limparTreinoAtual(){
    const atual = treino();
    if(!(atual.exercicios || []).length){ toast(`${atual.nome} já está vazio.`); return; }
    if(!confirm(`Limpar todos os exercícios do ${atual.nome}?`)) return;
    atual.exercicios = [];
    renderTudo();
    toast(`${atual.nome} limpo.`);
  }

  function aplicarModelo(tipo){
    const plano = {
      'hipertrofia-abc': [
        ['A', ['PEITO','TRÍCEPS','ABDOME'], 6],
        ['B', ['COSTAS','BÍCEPS','ABDOME'], 6],
        ['C', ['PERNAS','GLÚTEO','PANTURRILHA'], 6]
      ],
      'iniciante-ab': [
        ['A', ['PEITO','COSTAS','OMBRO','ABDOME'], 6],
        ['B', ['PERNAS','GLÚTEO','BÍCEPS','TRÍCEPS'], 6]
      ],
      'emagrecimento': [
        ['A', ['PERNAS','PEITO','COSTAS','ABDOME'], 6],
        ['CARDIO', ['CARDIO'], 3],
        ['FUNCIONAL', ['FUNCIONAL'], 4]
      ]
    }[tipo];
    if(!plano) return;
    if(!confirm('Aplicar este modelo? Ele vai preencher as abas vazias e manter o que já estiver montado.')) return;
    const anterior = treinoAtual;
    let total = 0;
    plano.forEach(([id, gruposModelo, alvo]) => {
      treinoAtual = id;
      const atual = treino();
      for(const grupo of gruposModelo){
        if((atual.exercicios || []).length >= alvo) break;
        for(const ex of escolherExerciciosDoGrupo(grupo, 2)){
          if((atual.exercicios || []).length >= alvo) break;
          if(adicionarOrigemAoTreino(ex, true)) total++;
        }
      }
    });
    treinoAtual = anterior;
    renderTudo();
    renderBiblioteca();
    toast(`Modelo aplicado: ${total} exercício(s) adicionados.`);
  }

  function montarPayloadIntegrado(){
    salvarDescricao();
    const alunoId = $('#alunoId')?.value || params.get('alunoId') || '';
    const aluno = alunos.find(a=>idAluno(a)===String(alunoId));
    const professorId = professorIdAtivo() || professorIdAluno(aluno || '');
    const professor = professores.find(p=>idProfessor(p)===String(professorId)) || lerContextoProfessor().professor || null;
    const objetivo = $('#objetivoTreino')?.value || 'Condicionamento físico';
    const dataValidade = $('#validadeTreino')?.value || dataFutura(45);
    const exercicios = treinos.flatMap((grupo, gi)=>(grupo.exercicios||[]).map((ex, ei)=>({
      id: ex.id ? `v4_${grupo.id}_${ei+1}_${String(ex.id).replace(/[^a-zA-Z0-9_-]/g,'')}` : undefined,
      exercicioId: ex.exercicioId || ex.bibliotecaId || ex.id || '',
      bibliotecaId: ex.bibliotecaId || ex.exercicioId || ex.id || '',
      bibliotecaKey: ex.bibliotecaKey || chaveBiblioteca(ex),
      ordem: gi * 100 + ei + 1,
      nome: ex.nome || ex.name || ex.exercicio || 'Exercício',
      nomeOriginal: ex.nome || ex.name || ex.exercicio || 'Exercício',
      grupoMuscular: ex.grupoMuscular || ex.grupo || ex.group || grupo.nome,
      grupo: ex.grupo || ex.grupoMuscular || ex.group || grupo.nome,
      equipamento: ex.equipamento || '',
      series: ex.series || 3,
      repeticoes: ex.repeticoes || ex.reps || '10-12',
      carga: ex.carga || '',
      descanso: ex.descanso || '',
        descansoAtivo: descansoAtivado(ex),
        tipoExecucao: ex.tipoExecucao || tipoExecucao(ex, grupoId),
        tempoMinutos: ex.tempoMinutos || ex.tempo || '',
        permiteAlunoAlterarTempo: ex.permiteAlunoAlterarTempo !== false,
        intensidade: ex.intensidade || 'Moderada',
      observacao: [grupo.nome, grupo.descricao, ex.observacoes || ex.observacao].filter(Boolean).join(' · '),
      midia: arquivoMidia(ex),
      tipoMidia: ex.tipoMidia || ex.tipo || (/\.(mp4|webm|mov)$/i.test(arquivoMidia(ex)) ? 'video' : (arquivoMidia(ex) ? 'imagem' : '')),
      imagemUrl: ex.imagemUrl || ex.imagem || ex.image || (/\.(gif|png|jpe?g|webp)$/i.test(arquivoMidia(ex)) ? arquivoMidia(ex) : ''),
      videoUrl: ex.videoUrl || (/\.(mp4|webm|mov)$/i.test(arquivoMidia(ex)) ? arquivoMidia(ex) : ''),
      origemGrupo: grupo.nome,
      treinoGrupoId: grupo.id,
      ordemGrupo: gi + 1
    })));
    return {
      alunoId,
      aluno: aluno ? nomeAluno(aluno) : '',
      professorId,
      professor: professor ? nomeProfessor(professor) : professorNomeAtivo(aluno),
      objetivo,
      nome: `Treino V4 - ${objetivo}`,
      tipoDivisao: treinos.filter(t=>t.exercicios.length).map(t=>t.nome).join(' / ') || 'Personalizado',
      dataInicio: dataHoje(),
      dataValidade,
      status:'Ativo',
      origem:'treinos_v4_professor',
      usuario:'Treinos V4 Professor',
      observacao:'Criado pelo Treinos V4 Professor.',
      exercicios
    };
  }
  async function salvarModelo(silencioso=false){
    const payload = montarPayloadIntegrado();
    if(!payload.alunoId){alert('Selecione o aluno antes de salvar.'); return;}
    if(!payload.exercicios.length){alert('Adicione pelo menos um exercício antes de salvar.'); return;}
    const btn=$('#btnSalvar'); const original=btn?.textContent || 'Salvar treino';
    if(btn){btn.disabled=true; btn.textContent='Salvando...';}
    try{
      const editando = treinoIntegradoAtualId && modoTreino === 'editar';
      const url = editando ? `${API_TREINOS_INTEGRADO}/${encodeURIComponent(treinoIntegradoAtualId)}` : API_TREINOS_INTEGRADO;
      payload.politicaSalvar = editando ? 'editar_existente' : 'substituir_ativo_anterior';
      if(editando) payload.id = treinoIntegradoAtualId;
      const resp = await fetch(url,{method: editando ? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const json = await safeJson(resp);
      if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
      const salvo = json.dados || json.treino || json;
      if(salvo.id){treinoIntegradoAtualId=salvo.id; modoTreino='editar'; treinoExistenteCarregado=true; if(btn) btn.textContent='Atualizar treino';}
      localStorage.setItem('fusion_treinos_v4_ultimo', JSON.stringify(salvo));
      localStorage.setItem('fusion_treinos_v4_alunoId', payload.alunoId);
      if(payload.professorId) localStorage.setItem('fusion_treinos_v4_professorId', payload.professorId);
      alterado = false;
      if(!silencioso) alert(`Treino V4 salvo com sucesso. ID: ${salvo.id || treinoIntegradoAtualId || 'gerado'}`);
    }catch(erro){
      console.error('Erro ao salvar Treinos V4', erro, payload);
      alert(`${erro.message}\n\nVerifique se /api/treinos-integrado está online.`);
    }finally{ if(btn){btn.disabled=false; if(btn.textContent==='Salvando...') btn.textContent=original;} }
  }

  function atualizarModoBiblioteca(){
    document.querySelectorAll('[data-bib-mode]').forEach(btn=>btn.classList.toggle('active', (btn.dataset.bibMode || 'todos') === bibliotecaModo));
    const grupoBox = document.getElementById('grupoChips');
    if(grupoBox) grupoBox.classList.toggle('is-muted', bibliotecaModo !== 'todos');
  }

  function bind(){
    $('#btnSalvar')?.addEventListener('click', ()=>salvarModelo(false));
    $('#btnBottomSalvar')?.addEventListener('click', ()=>salvarModelo(false));
    $('#btnVoltarPainel')?.addEventListener('click', confirmarSaidaPainel);
    $('#btnBottomPainel')?.addEventListener('click', confirmarSaidaPainel);
    $('#btnBottomIa')?.addEventListener('click', completarTreinoAtual);
    window.addEventListener('beforeunload', ev=>{ if(alterado){ ev.preventDefault(); ev.returnValue=''; } });
    $('#btnAtualizar')?.addEventListener('click', async()=>{await carregarBiblioteca();});
    $('#filtroGrupoSelect')?.addEventListener('change', ev=>{grupoFiltro=ev.target.value; bibliotecaModo='todos'; atualizarModoBiblioteca(); renderGrupos(); renderBiblioteca();});
    $('#buscaExercicio')?.addEventListener('input', renderBiblioteca);
    $('#descricaoGrupo')?.addEventListener('input', salvarDescricao);
    $('#btnLimparBusca')?.addEventListener('click', ()=>{ if($('#buscaExercicio')) $('#buscaExercicio').value=''; renderBiblioteca(); });
    document.querySelectorAll('[data-bib-mode]').forEach(btn=>btn.addEventListener('click', ()=>{bibliotecaModo=btn.dataset.bibMode || 'todos'; atualizarModoBiblioteca(); renderBiblioteca();}));
    $('#alunoId')?.addEventListener('change', async ev=>{localStorage.setItem('fusion_treinos_v4_alunoId', ev.target.value); if(modoTreino==='editar'){resetTreinos(); modoTreino='editar'; await carregarTreinoExistente(true);}});
    $('#btnIaCompletar')?.addEventListener('click', completarTreinoAtual);
    $('#btnIaSeries')?.addEventListener('click', ajustarSeriesPorObjetivo);
    $('#btnLimparTreinoAtual')?.addEventListener('click', limparTreinoAtual);
    document.querySelectorAll('[data-v4-modelo]').forEach(btn=>btn.addEventListener('click', ()=>aplicarModelo(btn.dataset.v4Modelo)));
  }
  async function init(){
    if($('#validadeTreino') && !$('#validadeTreino').value) $('#validadeTreino').value = dataFutura(45);
    bind();
    atualizarModoBiblioteca();
    renderTudo();
    await Promise.all([carregarAlunos(), carregarProfessores(), carregarBiblioteca()]);
    await carregarTreinoExistente();
    renderTudo();
  }
  window.FusionTreinosV4 = { mover, remover:removerExercicio, duplicar:duplicarExercicio, campo:atualizarCampo, completar:completarTreinoAtual, ajustarSeries:ajustarSeriesPorObjetivo, descanso:(i,v)=>{ atualizarCampo(i,'descansoAtivo',true); atualizarCampo(i,'descanso',v); renderTreino(); } };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
