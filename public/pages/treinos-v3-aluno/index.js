(function(){
  const $ = s => document.querySelector(s);
  const API_BIBLIOTECA = '/api/exercicios-biblioteca';
  const API_INTEGRADO = '/api/treinos-integrado';
  const API_OPERACIONAL = '/api/treinos-operacional';

  let descansoTimer = null;
  let descansoRestante = 0;
  let descansoAtivo = false;
  let treinoAtual = '';
  let exercicioAtual = 0;
  let alunoIdAtual = '';
  let treinoExecucaoId = '';
  let execucaoAtual = null;
  let inicioExecucaoMs = 0;
  let biblioteca = [];
  let bibliotecaPorNome = new Map();
  let bibliotecaPorGrupo = new Map();
  let treinos = {};

  const params = new URLSearchParams(location.search);

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function isVideo(src){return /\.(mp4|webm|mov)$/i.test(String(src||''));}
  async function safeJson(resp){ try { return await resp.json(); } catch { return {}; } }
  function extrairLista(payload, chave){
    if(Array.isArray(payload)) return payload;
    return payload?.[chave] || payload?.dados || payload?.data || payload?.itens || payload?.registros || [];
  }

  function segundos(descanso){
    const s = String(descanso||'60s').toLowerCase();
    if(s === '-' || s === '0' || s.includes('livre')) return 0;
    const n = Number((s.match(/\d+/)||['60'])[0]);
    if(s.includes('min')) return n * 60;
    return n || 60;
  }
  function fmt(t){
    const m = Math.floor(t/60), s = t%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function toast(msg){
    const el = $('#toast');
    if(!el) return console.log(msg);
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(()=>el.classList.add('hidden'), 3500);
  }

  async function apiGet(url){
    const resp = await fetch(url, {cache:'no-store'});
    const json = await safeJson(resp);
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    return json;
  }
  async function apiSend(url, method, body){
    const resp = await fetch(url, {
      method,
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body || {})
    });
    const json = await safeJson(resp);
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    return json;
  }

  async function carregarBiblioteca(){
    try{
      const json = await apiGet(API_BIBLIOTECA);
      biblioteca = extrairLista(json, 'exercicios').map(normalizarItemBiblioteca).filter(x => x.midia);
      montarIndicesBiblioteca();
    }catch(e){
      biblioteca = [];
      montarIndicesBiblioteca();
      console.warn('Falha ao carregar biblioteca de exercícios', e);
    }
  }

  function normalizarItemBiblioteca(item = {}){
    const grupo = item.grupo || item.group || item.grupoMuscular || item.categoria || '';
    const nome = item.nome || item.name || item.titulo || nomePorArquivo(item.arquivo || item.filename || item.midia || item.imagem || item.url || item.image);
    const midia = item.midia || item.imagem || item.image || item.url || item.caminho || item.videoUrl || item.imagemUrl || '';
    const tipo = item.tipo || (isVideo(midia) ? 'video' : 'imagem');
    return { ...item, grupo, nome, midia, tipo };
  }

  function nomePorArquivo(path = ''){
    const base = String(path).split('/').pop().split('\\').pop().replace(/\.[^.]+$/, '');
    return base.replace(/[-_]+/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function montarIndicesBiblioteca(){
    bibliotecaPorNome = new Map();
    bibliotecaPorGrupo = new Map();
    for(const item of biblioteca){
      const keys = [item.nome, item.arquivo, item.filename, String(item.midia || '').split('/').pop()?.replace(/\.[^.]+$/, '')]
        .filter(Boolean).map(norm);
      for(const key of keys){ if(key && !bibliotecaPorNome.has(key)) bibliotecaPorNome.set(key, item); }
      const grupo = norm(item.grupo);
      if(grupo){
        if(!bibliotecaPorGrupo.has(grupo)) bibliotecaPorGrupo.set(grupo, []);
        bibliotecaPorGrupo.get(grupo).push(item);
      }
    }
  }

  function resolverMidia(ex = {}){
    if(ex.midia || ex.imagem || ex.image || ex.imagemUrl || ex.videoUrl) return ex.midia || ex.imagem || ex.image || ex.imagemUrl || ex.videoUrl;
    const nomeKey = norm(ex.nome || ex.exercicio || '');
    const grupoKey = norm(ex.grupo || ex.grupoMuscular || '');
    if(nomeKey && bibliotecaPorNome.has(nomeKey)) return bibliotecaPorNome.get(nomeKey).midia;
    if(grupoKey && bibliotecaPorGrupo.has(grupoKey)){
      const grupo = bibliotecaPorGrupo.get(grupoKey);
      const porNome = grupo.find(item => {
        const a = norm(item.nome);
        return a && nomeKey && (a.includes(nomeKey) || nomeKey.includes(a));
      });
      if(porNome) return porNome.midia;
      if(grupo.length === 1) return grupo[0].midia;
    }
    const parecido = biblioteca.find(item => {
      const a = norm(item.nome);
      return a && nomeKey && (a.includes(nomeKey) || nomeKey.includes(a));
    });
    return parecido?.midia || '';
  }

  function midiaHtml(ex){
    const src = resolverMidia(ex);
    if(!src) return '<div>Mídia não localizada na biblioteca</div>';
    return isVideo(src)
      ? `<video src="${esc(src)}" muted loop autoplay playsinline></video>`
      : `<img src="${esc(src)}" alt="${esc(ex.nome)}" onerror="this.parentElement.innerHTML='<small>Mídia não encontrada</small>'">`;
  }


  function dataTreinoMs(t = {}){
    const campos = [t.atualizadoEm, t.updatedAt, t.criadoEm, t.createdAt, t.dataInicio, t.data, t.dataValidade];
    for (const c of campos){
      if(!c) continue;
      const ms = Date.parse(String(c));
      if(Number.isFinite(ms)) return ms;
    }
    return 0;
  }

  function statusAtivoTreino(t = {}){
    const s = norm(t.statusCalculado || t.status || 'ativo');
    return !['cancelado','cancelada','inativo','inativa','arquivado','arquivada','vencido','vencida','encerrado','encerrada'].includes(s);
  }

  function treinoMaisRecente(lista = []){
    const ativos = lista.filter(statusAtivoTreino);
    const base = ativos.length ? ativos : lista;
    return [...base].sort((a,b) => dataTreinoMs(b) - dataTreinoMs(a))[0] || null;
  }

  async function resolverAlunoId(){
    const direto = params.get('alunoId') || params.get('aluno_id') || params.get('id') || localStorage.getItem('fusion_aluno_id') || '';
    if(direto) return direto;

    const json = await apiGet(API_INTEGRADO);
    const lista = extrairLista(json, 'treinos')
      .filter(t => t && (t.alunoId || t.aluno_id))
      .sort((a,b) => dataTreinoMs(b) - dataTreinoMs(a));
    return lista[0]?.alunoId || lista[0]?.aluno_id || '';
  }

  async function carregarTreinosBackend(){
    alunoIdAtual = await resolverAlunoId();
    if(!alunoIdAtual) throw new Error('Aluno não identificado. Abra com ?alunoId=ID_DO_ALUNO ou salve um treino V3 primeiro.');

    const json = await apiGet(`${API_OPERACIONAL}/portal/alunos/${encodeURIComponent(alunoIdAtual)}?apenasAtivos=true`);
    const lista = extrairLista(json, 'treinos');
    if(!lista.length) throw new Error('Nenhum treino ativo encontrado para este aluno.');

    const maisRecente = treinoMaisRecente(lista);
    if(!maisRecente) throw new Error('Nenhum treino válido encontrado para este aluno.');

    treinos = normalizarTreinosOperacionais([maisRecente]);
    const primeiraAba = Object.keys(treinos)[0] || '';
    treinoAtual = treinos[treinoAtual] ? treinoAtual : primeiraAba;
    treinoExecucaoId = treinos[treinoAtual]?._treinoId || maisRecente.id || '';
  }

  function extrairAbaTreino(ex = {}, treino = {}){
    const direto = ex.origemGrupo || ex.grupoTreino || ex.treinoGrupo || ex.treinoGrupoNome || ex.divisao || ex.nomeDivisao || ex.nomeGrupo || '';
    if(direto) return String(direto).trim();

    const obs = String(ex.observacao || ex.observacoes || ex.obs || '').trim();
    const primeiraParte = obs.split('·')[0]?.trim();
    if(/^treino\s+[a-z0-9]+$/i.test(primeiraParte) || ['Cardio','Alongamento','Full Body','Push','Pull','Legs'].includes(primeiraParte)){
      return primeiraParte;
    }

    const tipo = String(treino.tipoDivisao || treino.divisao || '').trim();
    const match = obs.match(/\b(Treino\s+[A-Z0-9]+|Cardio|Alongamento|Full Body|Push|Pull|Legs)\b/i);
    if(match) return match[1];
    return tipo && !tipo.includes('/') ? tipo : (treino.nome || treino.objetivo || 'Treino');
  }

  function normalizarTreinosOperacionais(lista){
    const out = {};
    for(const treino of lista || []){
      const exercicios = Array.isArray(treino.exercicios) ? treino.exercicios : [];
      for(const ex of exercicios){
        const aba = extrairAbaTreino(ex, treino);
        if(!out[aba]){
          out[aba] = {
            _treinoId: treino.id,
            _treinoNome: treino.nome || aba,
            descricao: [treino.objetivo, aba, treino.dataValidade ? `Validade: ${treino.dataValidade}` : ''].filter(Boolean).join(' · '),
            exercicios: []
          };
        }
        out[aba].exercicios.push({
          _treinoId: treino.id,
          _exercicioTreinoId: ex.id || ex.exercicioTreinoId || ex.exercicioId || ex.exercicio_id || '',
          grupo: ex.grupo || ex.grupoMuscular || ex.group || '',
          nome: ex.nome || ex.exercicio || ex.name || 'Exercício',
          series: ex.series || ex.sets || '',
          reps: ex.reps || ex.repeticoes || ex.repetitions || '',
          carga: ex.carga || ex.weight || '',
          descanso: ex.descanso || ex.rest || '',
          obs: ex.obs || ex.observacao || ex.observacoes || '',
          midia: ex.midia || ex.imagem || ex.image || ex.imagemUrl || ex.videoUrl || '',
          ordem: Number(ex.ordem || out[aba].exercicios.length + 1),
          concluido: false
        });
      }
    }
    for(const aba of Object.keys(out)){
      out[aba].exercicios.sort((a,b)=>Number(a.ordem||0)-Number(b.ordem||0));
    }
    return out;
  }

  function renderTabs(){
    const nomes = Object.keys(treinos);
    $('#tabsTreino').innerHTML = nomes.map(nome=>{
      return `<button type="button" class="${nome===treinoAtual?'active':''}" data-treino="${esc(nome)}">${esc(nome)}</button>`;
    }).join('');
    document.querySelectorAll('[data-treino]').forEach(btn=>{
      btn.onclick = () => {
        treinoAtual = btn.dataset.treino;
        treinoExecucaoId = treinos[treinoAtual]?._treinoId || treinoExecucaoId;
        exercicioAtual = 0;
        resetDescanso();
        render();
      };
    });
  }

  function renderLista(){
    const t = treinos[treinoAtual] || {exercicios:[]};
    $('#tituloTreino').textContent = treinoAtual || 'Treino do aluno';
    $('#descricaoTreino').textContent = t.descricao || 'Prescrição carregada do motor operacional';
    $('#nomeGrupo').textContent = treinoAtual || 'Prescrição';
    $('#btnIniciarTreino').disabled = !(t.exercicios || []).length;
    $('#listaExercicios').innerHTML = (t.exercicios||[]).map((ex,i)=>`
      <article class="exercise-card ${ex.concluido?'done':''}">
        <div class="thumb">${midiaHtml(ex)}</div>
        <div>
          <h3>${esc(ex.nome)}</h3>
          <small>${esc(ex.grupo||'-')}</small>
          <div class="mini-grid">
            <div><span>Séries</span><b>${esc(ex.series||'-')}</b></div>
            <div><span>Reps</span><b>${esc(ex.reps||'-')}</b></div>
            <div><span>Carga</span><b>${esc(ex.carga||'-')}</b></div>
            <div><span>Descanso</span><b>${esc(ex.descanso||'-')}</b></div>
          </div>
          <small>${esc(ex.obs||'')}</small>
        </div>
        <button type="button" data-ver="${i}">Ver</button>
      </article>
    `).join('') || '<p>Nenhum exercício neste treino.</p>';
    document.querySelectorAll('[data-ver]').forEach(btn=>btn.onclick=()=>abrirExercicio(Number(btn.dataset.ver)));
  }

  function render(){ renderTabs(); renderLista(); }

  async function garantirExecucao(){
    const treinoId = treinos[treinoAtual]?._treinoId || treinoExecucaoId;
    if(!treinoId) throw new Error('Treino sem ID operacional. Recarregue a página.');
    if(execucaoAtual && String(execucaoAtual.treinoId) === String(treinoId)) return execucaoAtual;
    const json = await apiSend(`${API_OPERACIONAL}/treinos/${encodeURIComponent(treinoId)}/iniciar`, 'POST', {
      origem: 'treinos_v3_aluno',
      usuario: 'Aluno',
      data: new Date().toISOString().slice(0,10)
    });
    execucaoAtual = json.dados || json.data || json;
    inicioExecucaoMs = Date.now();
    toast(json.reutilizado ? 'Execução em andamento retomada.' : 'Execução iniciada.');
    return execucaoAtual;
  }

  async function abrirExercicio(i){
    const lista = treinos[treinoAtual]?.exercicios || [];
    if(!lista.length) return;
    try { await garantirExecucao(); } catch(e) { alert(e.message); return; }
    exercicioAtual = Math.max(0, Math.min(lista.length-1, i));
    const ex = lista[exercicioAtual];
    $('#modalGrupo').textContent = ex.grupo || '-';
    $('#modalNome').textContent = ex.nome || 'Exercício';
    $('#modalMedia').innerHTML = midiaHtml(ex);
    $('#modalSeries').textContent = ex.series || '-';
    $('#modalReps').textContent = ex.reps || '-';
    $('#modalCarga').textContent = ex.carga || '-';
    $('#modalDescanso').textContent = ex.descanso || '-';
    $('#modalObs').textContent = ex.obs || '';
    $('#modalContador').textContent = `Exercício ${exercicioAtual+1} de ${lista.length}`;
    $('#barraProgresso').style.width = `${Math.round(((exercicioAtual+1)/lista.length)*100)}%`;
    $('#btnAnterior').disabled = exercicioAtual <= 0;
    const ultimo = exercicioAtual >= lista.length-1;
    $('#btnProximo').textContent = ultimo ? '✓ Finalizar treino' : 'Próximo exercício →';
    $('#btnProximo').classList.toggle('finalizar', ultimo);
    atualizarBotaoProximo();
    $('#modalExercicio').classList.remove('hidden');
  }

  function resetDescanso(){
    clearInterval(descansoTimer);
    descansoTimer = null;
    descansoRestante = 0;
    descansoAtivo = false;
    $('#cronometroDescanso').textContent = '00:00';
    atualizarBotaoProximo();
  }

  function atualizarBotaoProximo(){
    const btn = $('#btnProximo');
    if(!btn) return;
    if(descansoAtivo){
      btn.disabled = true;
      btn.dataset.textOriginal ||= btn.textContent;
      btn.textContent = `Aguarde ${fmt(descansoRestante)}`;
    }else{
      btn.disabled = false;
      if(btn.dataset.textOriginal){ btn.textContent = btn.dataset.textOriginal; delete btn.dataset.textOriginal; }
    }
  }

  function iniciarDescanso(){
    const ex = treinos[treinoAtual]?.exercicios?.[exercicioAtual];
    const total = segundos(ex?.descanso || '60s');
    resetDescanso();
    if(total <= 0){ toast('Este exercício não possui descanso configurado.'); return; }
    descansoRestante = total;
    descansoAtivo = true;
    $('#cronometroDescanso').textContent = fmt(descansoRestante);
    atualizarBotaoProximo();
    toast('Descanso iniciado.');
    descansoTimer = setInterval(()=>{
      descansoRestante -= 1;
      $('#cronometroDescanso').textContent = fmt(Math.max(0, descansoRestante));
      atualizarBotaoProximo();
      if(descansoRestante <= 0){
        clearInterval(descansoTimer);
        descansoTimer = null;
        descansoAtivo = false;
        $('#cronometroDescanso').textContent = '00:00';
        atualizarBotaoProximo();
        toast('Descanso finalizado. Próximo exercício liberado.');
      }
    },1000);
  }

  async function registrarExercicioConcluido(ex){
    const exec = await garantirExecucao();
    const exId = ex._exercicioTreinoId || ex.id || ex.exercicioId;
    if(!exec?.id || !exId) return;
    const json = await apiSend(`${API_OPERACIONAL}/execucoes/${encodeURIComponent(exec.id)}/exercicios/${encodeURIComponent(exId)}`, 'PUT', {
      cargaRealizada: ex.carga || '',
      repeticoesRealizadas: ex.reps || '',
      concluido: true,
      observacao: ex.obs || '',
      tempoSegundos: Math.round((Date.now() - inicioExecucaoMs) / 1000)
    });
    execucaoAtual = json.dados || execucaoAtual;
  }

  async function concluirExecucao(){
    if(!execucaoAtual?.id) return;
    const tempoSegundos = Math.round((Date.now() - inicioExecucaoMs) / 1000);
    const json = await apiSend(`${API_OPERACIONAL}/execucoes/${encodeURIComponent(execucaoAtual.id)}/concluir`, 'POST', {
      origem: 'treinos_v3_aluno',
      usuario: 'Aluno',
      tempoSegundos
    });
    execucaoAtual = json.dados || execucaoAtual;
  }

  async function proximo(){
    if(descansoAtivo) return;
    const lista = treinos[treinoAtual]?.exercicios || [];
    if(!lista.length) return;
    try{
      const ex = lista[exercicioAtual];
      ex.concluido = true;
      await registrarExercicioConcluido(ex);
      if(exercicioAtual >= lista.length - 1){
        await concluirExecucao();
        $('#modalExercicio').classList.add('hidden');
        resetDescanso();
        render();
        toast(`Treino finalizado: ${treinoAtual}.`);
        alert(`Treino finalizado e gravado no histórico: ${treinoAtual}.`);
        return;
      }
      resetDescanso();
      await abrirExercicio(exercicioAtual + 1);
      renderLista();
    }catch(e){
      alert(e.message || 'Erro ao registrar execução do treino.');
    }
  }

  $('#btnIniciarTreino').onclick = () => abrirExercicio(0);
  $('#btnFecharModal').onclick = () => $('#modalExercicio').classList.add('hidden');
  $('#btnAnterior').onclick = () => { resetDescanso(); abrirExercicio(exercicioAtual - 1); };
  $('#btnProximo').onclick = proximo;
  $('#btnDescanso').onclick = iniciarDescanso;
  $('#modalExercicio').addEventListener('click', ev => { if(ev.target.id === 'modalExercicio') $('#modalExercicio').classList.add('hidden'); });

  (async function init(){
    $('#tituloTreino').textContent = 'Carregando treino...';
    $('#descricaoTreino').textContent = 'Buscando prescrição no motor operacional.';
    $('#listaExercicios').innerHTML = '<p>Carregando treino do aluno...</p>';
    try{
      await carregarBiblioteca();
      await carregarTreinosBackend();
      render();
      toast('Treino carregado do backend operacional.');
    }catch(e){
      $('#tituloTreino').textContent = 'Treino não encontrado';
      $('#descricaoTreino').textContent = e.message || 'Falha ao carregar treino.';
      $('#nomeGrupo').textContent = 'Sem prescrição';
      $('#listaExercicios').innerHTML = `<p>${esc(e.message || 'Falha ao carregar treino.')}</p>`;
      $('#tabsTreino').innerHTML = '';
      $('#btnIniciarTreino').disabled = true;
    }
  })();
})();
