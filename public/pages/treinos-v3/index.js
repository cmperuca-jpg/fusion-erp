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
    { id:'A', nome:'Treino A', descricao:'', exercicios:[] },
    { id:'B', nome:'Treino B', descricao:'', exercicios:[] },
    { id:'C', nome:'Treino C', descricao:'', exercicios:[] },
    { id:'D', nome:'Treino D', descricao:'', exercicios:[] },
    { id:'CARDIO', nome:'Cardio', descricao:'', exercicios:[] },
    { id:'FUNCIONAL', nome:'Funcional', descricao:'', exercicios:[] },
    { id:'ALONG', nome:'Alongamento', descricao:'', exercicios:[] }
  ];

  let biblioteca = [];
  let alunos = [];
  let professores = [];
  let grupos = [];
  let grupoFiltro = '';
  let mostrarTodos = false;
  let treinoAtual = 'A';
  let contextoProfessor = null;
  let treinoIntegradoAtualId = params.get('treinoId') || '';
  let modoTreino = params.get('modo') || (params.get('treinoId') || params.get('alunoId') ? 'editar' : 'novo');
  let treinoExistenteCarregado = false;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalizar(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function treino(){return treinos.find(t=>t.id===treinoAtual) || treinos[0];}
  function dataHoje(){ return new Date().toISOString().slice(0,10); }
  function dataFutura(dias=45){ const d = new Date(); d.setDate(d.getDate()+dias); return d.toISOString().slice(0,10); }
  function extrairLista(payload, chave){
    if(Array.isArray(payload)) return payload;
    return payload?.[chave] || payload?.dados || payload?.data || payload?.itens || payload?.registros || [];
  }
  function idAluno(a={}){ return String(a.id || a._id || a.alunoId || a.aluno_id || ''); }
  function nomeAluno(a={}){ return a.nome || a.alunoNome || a.name || a.nomeCompleto || 'Aluno'; }
  function idProfessor(p={}){ return String(p.id || p._id || p.professorId || p.professor_id || ''); }
  function nomeProfessor(p={}){ return p.nome || p.professorNome || p.professor || p.name || 'Professor'; }
  function arquivoMidia(ex={}){ return ex.midia || ex.media || ex.imagem || ex.image || ex.imagemUrl || ex.videoUrl || ''; }
  function chaveBiblioteca(ex={}){
    const grupo = normalizar(ex.grupo || ex.grupoMuscular || ex.group || ex.folder || '');
    const nome = normalizar((arquivoMidia(ex).split('/').pop() || ex.nome || ex.name || '').replace(/\.[^.]+$/, ''));
    return [grupo, nome].filter(Boolean).join('::');
  }
  function professorIdAluno(a={}){ return String(a.professorId || a.professor_id || a.professorResponsavelId || a.professor_responsavel_id || ''); }
  function professorNomeAluno(a={}){ return a.professorNome || a.professor || a.professor_responsavel || a.professorResponsavel || ''; }
  function lerContextoProfessor(){
    if(contextoProfessor) return contextoProfessor;
    try{
      const ctx = JSON.parse(localStorage.getItem('fusion_treinos_v3_professor_contexto') || 'null');
      if(ctx && (ctx.professorId || ctx.professor || Array.isArray(ctx.alunos))) contextoProfessor = ctx;
    }catch{}
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

  function resetTreinosV3(){
    treinos.forEach(t => { t.descricao = ''; t.exercicios = []; });
    treinoAtual = 'A';
    treinoIntegradoAtualId = '';
    treinoExistenteCarregado = false;
    const btn = $('#btnSalvar');
    if(btn) btn.textContent = 'Salvar treino';
  }

  function limparTreinoParaNovo(){
    treinos.forEach(t => { t.descricao = ''; t.exercicios = []; });
    treinoAtual = 'A';
    treinoIntegradoAtualId = '';
    modoTreino = 'novo';
    treinoExistenteCarregado = false;
    if($('#objetivoTreino') && !$('#objetivoTreino').value) $('#objetivoTreino').value = 'Hipertrofia';
    if($('#validadeTreino') && !$('#validadeTreino').value) $('#validadeTreino').value = dataFutura(45);
    const btn = $('#btnSalvar');
    if(btn) btn.textContent = 'Salvar treino';
    renderTudo();
  }

  function statusAtivo(t={}){
    return !['cancelado','cancelada','encerrado','encerrada','inativo','inativa','arquivado','removido','removida']
      .includes(normalizar(t.status || 'Ativo'));
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
    if(ordem >= 500) return 'ALONG';
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

    treinoExistente.exercicios.forEach((ex, idx) => {
      const grupoId = grupoPorOrdem(ex, idx);
      const grupo = treinos.find(t => t.id === grupoId) || treinos[0];
      const obsGrupo = String(ex.origemGrupo || ex.grupoTreino || ex.divisao || '').trim();
      if(obsGrupo && !grupo.descricao && obsGrupo !== grupo.nome) grupo.descricao = obsGrupo;

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
        descanso: ex.descanso || '60s',
        observacoes: ex.observacoes || ex.observacao || ''
      });
    });

    const primeiroComExercicio = treinos.find(t => t.exercicios.length);
    treinoAtual = primeiroComExercicio ? primeiroComExercicio.id : 'A';

    const btn = $('#btnSalvar');
    if(btn) btn.textContent = 'Atualizar treino';

    renderTudo();
    return true;
  }

  async function buscarTreinosAtivosAluno(alunoId){
    if(!alunoId) return [];
    const q = new URLSearchParams({ alunoId });
    const pid = professorIdAtivo();
    if(pid) q.set('professorId', pid);
    const resp = await fetch(`${API_TREINOS_INTEGRADO}?${q.toString()}`, {cache:'no-store'});
    const json = await safeJson(resp);
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    return extrairLista(json, 'dados')
      .filter(statusAtivo)
      .sort((a,b) => String(b.atualizadoEm || b.criadoEm || b.dataInicio || '').localeCompare(String(a.atualizadoEm || a.criadoEm || a.dataInicio || '')));
  }

  async function carregarTreinoExistente(forcar=false){
    if(!forcar && treinoExistenteCarregado) return;
    if(modoTreino !== 'editar') return;

    const alunoId = $('#alunoId')?.value || params.get('alunoId') || lerContextoProfessor().alunoSelecionadoId || '';
    if(!alunoId) return;

    try{
      const lista = await buscarTreinosAtivosAluno(alunoId);
      const escolhido = treinoIntegradoAtualId
        ? (lista.find(t => String(t.id || t._id) === String(treinoIntegradoAtualId)) || lista[0])
        : lista[0];

      if(escolhido) {
        preencherTreinoExistente(escolhido);
      } else {
        limparTreinoParaNovo();
        alert('Este aluno ainda não possui treino ativo para editar. Um novo treino será iniciado.');
      }
    }catch(erro){
      console.warn('Treinos V3: não foi possível carregar treino existente', erro);
      alert(`Não foi possível abrir o treino ativo para edição.\n${erro.message}`);
    }
  }

  function mediaTag(ex, classe='media'){
    const src = ex?.midia || ex?.image || ex?.imagem || ex?.imagemUrl || ex?.videoUrl || '';
    if(!src) return `<div class="${classe} placeholder">sem mídia</div>`;
    if(ex.tipo === 'video' || /\.(mp4|webm|mov)$/i.test(src)) return `<video class="${classe}" src="${esc(src)}" muted loop playsinline preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>`;
    return `<img class="${classe}" src="${esc(src)}" alt="${esc(ex.nome)}" loading="lazy">`;
  }

  async function safeJson(resp){ try { return await resp.json(); } catch { return {}; } }

  async function carregarContexto(){
    await Promise.all([carregarAlunos(), carregarProfessores()]);
  }

  async function carregarAlunos(){
    const select = $('#alunoId');
    if(!select) return;
    const ctx = lerContextoProfessor();
    const alunosCtx = Array.isArray(ctx.alunos) ? ctx.alunos : [];
    if(EMBED && alunosCtx.length){
      alunos = alunosCtx;
      select.innerHTML = '<option value="">Selecione o aluno</option>' + alunos
        .slice().sort((a,b)=>nomeAluno(a).localeCompare(nomeAluno(b),'pt-BR'))
        .map(a=>`<option value="${esc(idAluno(a))}">${esc(nomeAluno(a))}</option>`).join('');
      const inicial = params.get('alunoId') || ctx.alunoSelecionadoId || localStorage.getItem('fusion_treinos_v3_alunoId') || '';
      if(inicial) select.value = inicial;
      return;
    }
    try{
      const resp = await fetch(API_ALUNOS, {cache:'no-store'});
      const json = await safeJson(resp);
      if(!resp.ok) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
      alunos = extrairLista(json, 'alunos');
      const pid = professorIdAtivo();
      const filtrados = EMBED && pid ? alunos.filter(a => {
        const ap = professorIdAluno(a);
        const an = normalizar(professorNomeAluno(a));
        const pn = normalizar(professorNomeAtivo());
        return !ap || ap === String(pid) || (!!an && !!pn && (an.includes(pn) || pn.includes(an)));
      }) : alunos;
      alunos = filtrados.length ? filtrados : alunos;
      select.innerHTML = '<option value="">Selecione o aluno</option>' + alunos
        .slice().sort((a,b)=>nomeAluno(a).localeCompare(nomeAluno(b),'pt-BR'))
        .map(a=>`<option value="${esc(idAluno(a))}">${esc(nomeAluno(a))}</option>`).join('');
      const inicial = params.get('alunoId') || localStorage.getItem('fusion_treinos_v3_alunoId') || '';
      if(inicial) select.value = inicial;
    }catch(erro){
      select.innerHTML = '<option value="">Erro ao carregar alunos</option>';
      console.warn('Treinos V3: alunos indisponíveis', erro);
    }
  }

  async function carregarProfessores(){
    const select = $('#professorId');
    if(!select) return;
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
      select.innerHTML = '<option value="">Definir automaticamente</option>' + professores
        .slice().sort((a,b)=>nomeProfessor(a).localeCompare(nomeProfessor(b),'pt-BR'))
        .map(p=>`<option value="${esc(idProfessor(p))}">${esc(nomeProfessor(p))}</option>`).join('');
      const inicial = params.get('professorId') || localStorage.getItem('fusion_treinos_v3_professorId') || '';
      if(inicial) select.value = inicial;
    }catch(erro){
      select.innerHTML = '<option value="">Erro ao carregar professores</option>';
      console.warn('Treinos V3: professores indisponíveis', erro);
    }
  }

  async function carregarBiblioteca(){
    $('#bibliotecaStatus').textContent = 'Carregando...';
    try{
      const resp = await fetch(API_BIBLIOTECA, {cache:'no-store'});
      const json = await safeJson(resp);
      if(!resp.ok || json.ok === false) throw new Error(json.mensagem || `HTTP ${resp.status}`);
      biblioteca = Array.isArray(json.exercicios) ? json.exercicios : extrairLista(json, 'exercicios');
      grupos = Array.isArray(json.grupos) ? json.grupos : [...new Set(biblioteca.map(e=>e.grupo || e.grupoMuscular).filter(Boolean))].sort();
      if (!grupoFiltro && grupos.length) grupoFiltro = grupos[0];
      $('#bibliotecaStatus').textContent = `${biblioteca.length} exercício(s)`;
    }catch(erro){
      biblioteca = [];
      grupos = [];
      $('#bibliotecaStatus').textContent = 'API indisponível';
      $('#listaExercicios').innerHTML = `<div class="empty">${esc(erro.message)}. Verifique se a rota /api/exercicios-biblioteca está ativa no server.mjs.</div>`;
    }
    renderGrupos();
    renderBiblioteca();
  }

  function renderGrupos(){
    const select = $('#filtroGrupoSelect');
    if (select) {
      select.innerHTML = grupos.length
        ? grupos.map(g => `<option value="${esc(g)}" ${grupoFiltro===g?'selected':''}>${esc(g)}</option>`).join('')
        : '<option value="">Nenhum grupo encontrado</option>';
      select.onchange = () => {
        grupoFiltro = select.value || '';
        mostrarTodos = false;
        $('#buscaExercicio').value = '';
        renderGrupos();
        renderBiblioteca();
      };
    }

    const html = grupos.map(g=>`<button class="chip ${grupoFiltro===g && !mostrarTodos?'active':''}" data-grupo="${esc(g)}">${esc(g)}</button>`);
    $('#grupoChips').innerHTML = html.join('');
    $$('#grupoChips .chip').forEach(btn=>btn.onclick=()=>{
      grupoFiltro=btn.dataset.grupo||'';
      mostrarTodos=false;
      if ($('#filtroGrupoSelect')) $('#filtroGrupoSelect').value = grupoFiltro;
      $('#buscaExercicio').value = '';
      renderGrupos();
      renderBiblioteca();
    });
  }

  function renderBiblioteca(){
    const q = normalizar($('#buscaExercicio')?.value || '');
    const grupoAtivo = grupoFiltro || grupos[0] || '';
    const listaBase = mostrarTodos || !grupoAtivo ? biblioteca : biblioteca.filter(e => (e.grupo || e.grupoMuscular) === grupoAtivo);
    const lista = listaBase.filter(e => !q || normalizar([e.nome,e.grupo,e.grupoMuscular,e.arquivo,e.equipamento,e.nivel].join(' ')).includes(q));
    const status = $('#grupoBibliotecaStatus');
    if (status) {
      status.innerHTML = grupoAtivo
        ? `<b>${esc(grupoAtivo)}</b> · ${lista.length} exercício(s) encontrado(s) nesta pasta`
        : `${lista.length} exercício(s) encontrado(s)`;
    }
    if(!lista.length){ $('#listaExercicios').innerHTML = '<div class="empty">Nenhum exercício encontrado neste grupo.</div>'; return; }
    $('#listaExercicios').innerHTML = lista.map(e=>`
      <button class="exercise-card" type="button" data-id="${esc(e.id)}">
        ${mediaTag(e)}
        <span>${esc(e.grupo || e.grupoMuscular || '')}</span>
        <strong>${esc(e.nome)}</strong>
        <small>${esc(e.tipo || '')} · ${esc(e.arquivo || e.folder || '')}</small>
      </button>`).join('');
    $$('#listaExercicios .exercise-card').forEach(btn=>btn.onclick=()=>adicionarExercicio(btn.dataset.id));
  }

  function renderTabs(){
    const tabs = $('#tabsTreino');
    if(!tabs) return;
    tabs.innerHTML = treinos.map(t=>`<button type="button" class="tab-btn ${t.id===treinoAtual?'active':''}" data-id="${esc(t.id)}" aria-pressed="${t.id===treinoAtual?'true':'false'}"><span>${esc(t.nome)}</span><small>${(t.exercicios||[]).length}</small></button>`).join('');
    $$('#tabsTreino .tab-btn').forEach(btn=>btn.onclick=()=>{salvarDescricao(); treinoAtual=btn.dataset.id; renderTudo();});
    const ativo = tabs.querySelector('.tab-btn.active');
    if(ativo && typeof ativo.scrollIntoView === 'function') ativo.scrollIntoView({block:'nearest', inline:'center', behavior:'smooth'});
  }

  function salvarDescricao(){
    const atual = treino();
    if($('#descricaoGrupo')) atual.descricao = $('#descricaoGrupo').value;
  }

  function adicionarExercicio(id){
    const origem = biblioteca.find(e=>String(e.id)===String(id));
    if(!origem) return;
    treino().exercicios.push({
      ...origem,
      series:'3',
      repeticoes:'10-12',
      carga:'',
      descanso:'60s',
      observacoes:''
    });
    renderTudo();
  }

  function removerExercicio(index){ treino().exercicios.splice(index,1); renderTudo(); }

  function mover(index, delta){
    const lista = treino().exercicios;
    const novo = index + delta;
    if(novo < 0 || novo >= lista.length) return;
    [lista[index], lista[novo]] = [lista[novo], lista[index]];
    renderTudo();
  }

  function atualizarCampo(index, campo, valor){
    const item = treino().exercicios[index];
    if(item) item[campo] = valor;
    renderResumo();
  }

  function renderRotina(){
    const atual = treino();
    $('#grupoAtualLabel').textContent = atual.nome;
    $('#grupoTitulo').textContent = atual.nome;
    $('#descricaoGrupo').value = atual.descricao || '';
    if(!atual.exercicios.length){
      $('#tabelaRotina').innerHTML = `<tr><td colspan="9" class="empty-row">Selecione exercícios na biblioteca para montar este grupo.</td></tr>`;
      return;
    }
    $('#tabelaRotina').innerHTML = atual.exercicios.map((e,i)=>`
      <tr>
        <td class="ordem"><button onclick="FusionTreinosV3.mover(${i},-1)">↑</button><b>${i+1}</b><button onclick="FusionTreinosV3.mover(${i},1)">↓</button></td>
        <td><strong>${esc(e.nome)}</strong><small>${esc(e.grupo || e.grupoMuscular || '')}</small></td>
        <td>${mediaTag(e,'media-mini')}</td>
        <td><input value="${esc(e.series)}" oninput="FusionTreinosV3.campo(${i},'series',this.value)"></td>
        <td><input value="${esc(e.repeticoes)}" oninput="FusionTreinosV3.campo(${i},'repeticoes',this.value)"></td>
        <td><input value="${esc(e.carga)}" oninput="FusionTreinosV3.campo(${i},'carga',this.value)"></td>
        <td><input value="${esc(e.descanso)}" oninput="FusionTreinosV3.campo(${i},'descanso',this.value)"></td>
        <td><input value="${esc(e.observacoes)}" oninput="FusionTreinosV3.campo(${i},'observacoes',this.value)"></td>
        <td><button class="danger" onclick="FusionTreinosV3.remover(${i})">×</button></td>
      </tr>`).join('');
  }

  function renderResumo(){
    const todos = treinos.flatMap(t=>t.exercicios);
    const gruposUsados = new Set(todos.map(e=>e.grupo || e.grupoMuscular).filter(Boolean));
    $('#sumExercicios').textContent = todos.length;
    $('#sumGrupos').textContent = gruposUsados.size;
    $('#sumTempo').textContent = `${Math.max(0, todos.length * 4)} min`;
  }

  function renderTudo(){ renderTabs(); renderRotina(); renderResumo(); }

  function montarPayloadIntegrado(){
    salvarDescricao();
    const alunoId = $('#alunoId')?.value || params.get('alunoId') || '';
    const aluno = alunos.find(a=>idAluno(a)===String(alunoId));
    const professorId = professorIdAtivo() || professorIdAluno(aluno || '');
    const professor = professores.find(p=>idProfessor(p)===String(professorId)) || lerContextoProfessor().professor || null;
    const objetivo = $('#objetivoTreino')?.value || 'Condicionamento físico';
    const dataValidade = $('#validadeTreino')?.value || dataFutura(45);

    const exercicios = treinos.flatMap((grupo, gi)=>(grupo.exercicios||[]).map((ex, ei)=>({
      id: ex.id ? `v3_${grupo.id}_${ei + 1}_${String(ex.id).replace(/[^a-zA-Z0-9_-]/g,'')}` : undefined,
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
      descanso: ex.descanso || '60s',
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
      nome: `Treino V3 - ${objetivo}`,
      tipoDivisao: treinos.filter(t=>t.exercicios.length).map(t=>t.nome).join(' / ') || 'Personalizado',
      dataInicio: dataHoje(),
      dataValidade,
      status: 'Ativo',
      origem: 'treinos_v3_professor',
      usuario: 'Treinos V3 Professor',
      observacao: 'Criado pelo Montador de Treino V3 com biblioteca unificada.',
      exercicios
    };
  }

  async function salvarModelo(){
    const payload = montarPayloadIntegrado();
    if(!payload.alunoId){ alert('Selecione o aluno antes de salvar.'); return; }
    if(!payload.exercicios.length){ alert('Adicione pelo menos um exercício antes de salvar o treino.'); return; }

    const btn = $('#btnSalvar');
    const textoOriginal = btn?.textContent || 'Salvar treino';
    if(btn){ btn.disabled = true; btn.textContent = 'Salvando...'; }

    try{
      const url = treinoIntegradoAtualId && modoTreino === 'editar'
        ? `${API_TREINOS_INTEGRADO}/${encodeURIComponent(treinoIntegradoAtualId)}`
        : API_TREINOS_INTEGRADO;
      payload.politicaSalvar = treinoIntegradoAtualId && modoTreino === 'editar' ? 'editar_existente' : 'substituir_ativo_anterior';
      if(treinoIntegradoAtualId && modoTreino === 'editar') payload.id = treinoIntegradoAtualId;
      const resp = await fetch(url, {
        method: treinoIntegradoAtualId && modoTreino === 'editar' ? 'PUT' : 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const json = await safeJson(resp);
      if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
      const salvo = json.dados || json.treino || json;
      if(salvo.id) {
        treinoIntegradoAtualId = salvo.id;
        modoTreino = 'editar';
        treinoExistenteCarregado = true;
        const btnSalvar = $('#btnSalvar');
        if(btnSalvar) btnSalvar.textContent = 'Atualizar treino';
      }
      localStorage.setItem('fusion_treinos_v3_ultimo', JSON.stringify(salvo));
      localStorage.setItem('fusion_treinos_v3_alunoId', payload.alunoId);
      if(payload.professorId) localStorage.setItem('fusion_treinos_v3_professorId', payload.professorId);
      alert(`Treino V3 ${modoTreino === 'editar' ? 'atualizado' : 'salvo'} no motor integrado. ID: ${salvo.id || treinoIntegradoAtualId || 'gerado'}`);
      console.log('Treino V3 integrado salvo', salvo);
    }catch(erro){
      console.error('Erro ao salvar Treinos V3', erro, payload);
      alert(`${erro.message}\n\nVerifique se /api/treinos-integrado está registrado no server.mjs e se o aluno possui contrato/serviço ativo.`);
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = textoOriginal; }
    }
  }

  window.addEventListener('message', (ev)=>{
    if(ev.origin !== location.origin) return;
    if(ev.data?.tipo === 'fusion_treinos_v3_contexto'){
      contextoProfessor = ev.data.contexto || contextoProfessor;
      if(contextoProfessor?.modoTreino) modoTreino = contextoProfessor.modoTreino;
      if(contextoProfessor?.treinoSelecionadoId) treinoIntegradoAtualId = contextoProfessor.treinoSelecionadoId;
      treinoExistenteCarregado = false;
      try { localStorage.setItem('fusion_treinos_v3_professor_contexto', JSON.stringify(contextoProfessor)); } catch {}
      carregarContexto().then(()=>carregarTreinoExistente(true));
    }
  });

  window.FusionTreinosV3 = { remover:removerExercicio, mover, campo:atualizarCampo, payload:montarPayloadIntegrado, carregarTreinoExistente, limparTreinoParaNovo };
  $('#alunoId')?.addEventListener('change',()=>{
    localStorage.setItem('fusion_treinos_v3_alunoId', $('#alunoId')?.value || '');
    treinoExistenteCarregado = false;
    if(modoTreino === 'editar') carregarTreinoExistente(true);
  });
  $('#buscaExercicio')?.addEventListener('input', renderBiblioteca);
  $('#descricaoGrupo')?.addEventListener('input', salvarDescricao);
  $('#btnAtualizar')?.addEventListener('click', carregarBiblioteca);
  $('#btnSalvar')?.addEventListener('click', salvarModelo);
  $('#validadeTreino') && ($('#validadeTreino').value = dataFutura(45));
  renderTudo();
  carregarContexto().then(()=>{
    if(modoTreino === 'editar') return carregarTreinoExistente(true);
    limparTreinoParaNovo();
  });
  carregarBiblioteca();
})();

/* === FUSION_ERP_2_8_0_P2E_TREINOS_MOBILE_FIX_START === */
/* Removido o atalho flutuante Biblioteca/Treino no mobile.
   Ele ficava preso no meio da tela dentro do iframe do Portal do Professor
   e misturava biblioteca, formulário do aluno e edição do treino.
   A navegação agora segue o fluxo natural da página: Biblioteca acima, Treino abaixo. */
(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  ready(function(){
    document.querySelectorAll('.fusion-treinos-mobile-tools').forEach(el => el.remove());
  });
})();
/* === FUSION_ERP_2_8_0_P2E_TREINOS_MOBILE_FIX_END === */
