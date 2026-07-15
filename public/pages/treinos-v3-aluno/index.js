(function(){
  const $ = s => document.querySelector(s);
  const EMBED = new URLSearchParams(location.search).get('embed') === '1';
  if (EMBED) document.body.classList.add('embed-mode');

  function emitirAlturaEmbed(){
    if(!EMBED || !window.parent || window.parent === window) return;
    const doc = document.documentElement;
    const body = document.body;
    const altura = Math.ceil(Math.max(
      body.scrollHeight || 0,
      body.offsetHeight || 0,
      doc.clientHeight || 0,
      doc.scrollHeight || 0,
      doc.offsetHeight || 0
    ));
    window.parent.postMessage({ tipo: 'fusion-treinos-v3-resize', altura }, '*');
  }

  window.addEventListener('load', emitirAlturaEmbed);
  window.addEventListener('resize', emitirAlturaEmbed);
  setInterval(emitirAlturaEmbed, 800);
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
  let treinoEmAndamento = false;
  let treinoFinalizado = false;
  let relogioTimer = null;
  let treinoInicioMs = 0;
  let wakeLock = null;
  const CACHE_TREINO_KEY = 'fusion_treino_aluno_cache_v1';
  const ESTADO_TREINO_KEY = 'fusion_treino_aluno_estado_v1';
  const TEMPO_SERIE_PADRAO = 45;
  const TEMPO_TRANSICAO_PADRAO = 20;

  const params = new URLSearchParams(location.search);

  const AUDIO_KEY = 'fusion_treino_audio_ativo';
  const AUDIO_VOLUME_KEY = 'fusion_treino_audio_volume';
  const VOICE_COMMAND_KEY = 'fusion_treino_comando_voz_ativo';
  let audioTreinoAtivo = localStorage.getItem(AUDIO_KEY) !== '0';
  let volumeTreino = Math.max(0, Math.min(1, Number(localStorage.getItem(AUDIO_VOLUME_KEY) || '1')));
  let comandoVozAtivo = localStorage.getItem(VOICE_COMMAND_KEY) === '1';
  let reconhecimentoVoz = null;
  let reconhecimentoRodando = false;
  let ultimoComandoVozMs = 0;
  let ultimaInstrucaoTreino = '';
  let avisoCincoSegundosEmitido = false;
  let cardioTimer = null;
  let cardioRestante = 0;

  function suporteVoz(){
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  function falarTreino(texto){
    if(texto) ultimaInstrucaoTreino = texto;
    if(!audioTreinoAtivo || !texto || !suporteVoz()) return;
    try{
      window.speechSynthesis.cancel();
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = 'pt-BR';
      fala.rate = 0.95;
      fala.pitch = 1;
      fala.volume = volumeTreino;
      window.speechSynthesis.speak(fala);
    }catch{}
  }

  function atualizarBotaoAudio(){
    const btn = $('#btnAudioTreino');
    if(!btn) return;
    btn.textContent = audioTreinoAtivo ? 'Áudio ativo' : 'Áudio desativado';
    btn.classList.toggle('muted', !audioTreinoAtivo);
    btn.setAttribute('aria-pressed', audioTreinoAtivo ? 'true' : 'false');
  }

  function alternarAudioTreino(){
    audioTreinoAtivo = !audioTreinoAtivo;
    localStorage.setItem(AUDIO_KEY, audioTreinoAtivo ? '1' : '0');
    if(!audioTreinoAtivo && suporteVoz()) window.speechSynthesis.cancel();
    atualizarBotaoAudio();
    if(audioTreinoAtivo) falarTreino('Voz do treino ativada.');
  }

  function atualizarControleVolume(){
    const range = $('#volumeTreino');
    if(range) range.value = String(Math.round(volumeTreino * 100));
  }

  function alterarVolumeTreino(valor){
    const n = Math.max(0, Math.min(100, Number(valor || 0)));
    volumeTreino = n / 100;
    localStorage.setItem(AUDIO_VOLUME_KEY, String(volumeTreino));
  }

  function SpeechRecognitionCtor(){
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function suporteComandoVoz(){
    return typeof window !== 'undefined' && Boolean(SpeechRecognitionCtor());
  }

  function atualizarStatusComandoVoz(texto){
    const el = $('#statusComandoVoz');
    if(el) el.textContent = texto || (comandoVozAtivo ? 'Ouvindo: diga “concluí”' : 'Voz manual');
    const btn = $('#btnComandoVoz');
    if(btn){
      btn.textContent = comandoVozAtivo ? 'Ouvindo comando' : 'Comando de voz';
      btn.classList.toggle('active', comandoVozAtivo);
      btn.setAttribute('aria-pressed', comandoVozAtivo ? 'true' : 'false');
    }
  }

  function iniciarReconhecimentoVoz(){
    if(!comandoVozAtivo || reconhecimentoRodando || !suporteComandoVoz()) return;
    try{
      const Ctor = SpeechRecognitionCtor();
      reconhecimentoVoz = reconhecimentoVoz || new Ctor();
      reconhecimentoVoz.lang = 'pt-BR';
      reconhecimentoVoz.continuous = true;
      reconhecimentoVoz.interimResults = false;
      reconhecimentoVoz.maxAlternatives = 1;
      reconhecimentoVoz.onstart = () => { reconhecimentoRodando = true; atualizarStatusComandoVoz('Ouvindo: diga “concluí”'); };
      reconhecimentoVoz.onend = () => {
        reconhecimentoRodando = false;
        if(comandoVozAtivo && treinoEmAndamento && !treinoFinalizado){
          setTimeout(iniciarReconhecimentoVoz, 500);
        }else{
          atualizarStatusComandoVoz();
        }
      };
      reconhecimentoVoz.onerror = () => { reconhecimentoRodando = false; atualizarStatusComandoVoz('Microfone indisponível'); };
      reconhecimentoVoz.onresult = ev => {
        const resultado = ev.results?.[ev.results.length - 1]?.[0]?.transcript || '';
        tratarComandoVoz(resultado);
      };
      reconhecimentoVoz.start();
    }catch{
      reconhecimentoRodando = false;
    }
  }

  function pararReconhecimentoVoz(){
    try{ reconhecimentoVoz?.stop?.(); }catch{}
    reconhecimentoRodando = false;
    atualizarStatusComandoVoz();
  }

  function alternarComandoVoz(){
    if(!suporteComandoVoz()){
      toast('Comando por voz indisponível neste navegador.');
      falarTreino('Comando por voz indisponível neste navegador.');
      return;
    }
    comandoVozAtivo = !comandoVozAtivo;
    localStorage.setItem(VOICE_COMMAND_KEY, comandoVozAtivo ? '1' : '0');
    atualizarStatusComandoVoz();
    if(comandoVozAtivo){
      falarTreino('Comando por voz ativado. Durante o treino, diga concluí para avançar.');
      iniciarReconhecimentoVoz();
    }else{
      pararReconhecimentoVoz();
      falarTreino('Comando por voz desativado.');
    }
  }

  function comandoNormalizado(texto){
    return norm(texto).replace(/fusion/g, '').trim();
  }

  function tratarComandoVoz(texto){
    const cmd = comandoNormalizado(texto);
    if(!cmd || !treinoEmAndamento || treinoFinalizado) return;
    const agora = Date.now();
    if(agora - ultimoComandoVozMs < 1600) return;

    if(/(conclui|concluido|concluida|terminei|feito|ok|proxima|proximo|avance|avancar|ja fiz|acabei)/.test(cmd)){
      ultimoComandoVozMs = agora;
      atualizarStatusComandoVoz('Comando: concluído');
      proximo();
      return;
    }
    if(/(repetir|repete|instrucao|instrucoes)/.test(cmd)){
      ultimoComandoVozMs = agora;
      falarTreino(ultimaInstrucaoTreino || 'Nenhuma instrução disponível.');
      return;
    }
    if(/(quanto falta|tempo restante|falta quanto|progresso)/.test(cmd)){
      ultimoComandoVozMs = agora;
      falarResumoRestante();
      return;
    }
    if(/(parar de ouvir|desativar microfone|desligar comando)/.test(cmd)){
      ultimoComandoVozMs = agora;
      alternarComandoVoz();
    }
  }

  function falarResumoRestante(){
    const lista = treinos[treinoAtual]?.exercicios || [];
    const restantes = lista.filter((ex, i) => i > exercicioAtual || !ex.concluido).length;
    const decorrido = treinoInicioMs ? Math.floor((Date.now() - treinoInicioMs) / 1000) : 0;
    const estimado = estimarTempoTreino();
    const falta = Math.max(0, estimado - decorrido);
    falarTreino(`Faltam aproximadamente ${textoTempo(falta)} e ${restantes} exercício${restantes === 1 ? '' : 's'}.`);
  }


  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function isVideo(src){return /\.(mp4|webm|mov)$/i.test(String(src||''));}
  async function safeJson(resp){ try { return await resp.json(); } catch { return {}; } }
  function extrairLista(payload, chave){
    if(Array.isArray(payload)) return payload;
    return payload?.[chave] || payload?.dados || payload?.data || payload?.itens || payload?.registros || [];
  }

  function segundos(descanso){
    const raw = String(descanso ?? '').trim();
    const s = raw.toLowerCase();
    if(!raw || s === '-' || s === '0' || s === '0s' || s.includes('livre') || s.includes('sem')) return 0;
    const n = Number((s.match(/\d+/)||['0'])[0]);
    if(s.includes('min')) return n * 60;
    return n || 0;
  }
  function fmt(t){
    const m = Math.floor(t/60), s = t%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function totalSeries(ex = {}){
    const n = Number(String(ex.series || ex.sets || '1').match(/\d+/)?.[0] || 1);
    return Math.max(1, n || 1);
  }

  function tipoExecucao(ex = {}){
    const bruto = norm([ex.tipoExecucao, ex.tipo_execucao, ex.tipo, ex.categoria, ex.grupo, ex.grupoMuscular, ex.treinoGrupoId, ex.origemGrupo, ex.nome].join(' '));
    if(bruto.includes('cardio') || bruto.includes('esteira') || bruto.includes('bike') || bruto.includes('bicicleta') || bruto.includes('eliptico') || bruto.includes('escada')) return 'cardio';
    if(bruto.includes('along')) return 'alongamento';
    if(bruto.includes('funcional') || bruto.includes('circuito')) return 'funcional';
    return 'musculacao';
  }

  function tempoCardioMinutos(ex = {}){
    const base = ex.tempoAlunoMinutos || ex.tempoMinutos || ex.tempo || ex.duracao || ex.repeticoes || 20;
    const n = Number(String(base).replace(/[^0-9.,]/g,'').replace(',','.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 20;
  }

  function descansoAtivado(ex = {}){
    if(ex.descansoAtivo === false || ex.usarDescanso === false) return false;
    return segundos(ex.descanso) > 0;
  }

  function serieAtualEx(ex = {}){
    const atual = Number(ex._serieAtual || 1);
    return Math.max(1, Math.min(totalSeries(ex), atual || 1));
  }

  function textoTempo(totalSegundos){
    const total = Math.max(0, Math.round(totalSegundos || 0));
    const horas = Math.floor(total / 3600);
    const minutos = Math.round((total % 3600) / 60);
    if(horas && minutos) return `${horas} hora${horas > 1 ? 's' : ''} e ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    if(horas) return `${horas} hora${horas > 1 ? 's' : ''}`;
    return `${Math.max(1, minutos)} minuto${minutos > 1 ? 's' : ''}`;
  }

  function fmtLongo(t){
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : fmt(t);
  }

  function estimarTempoTreino(){
    const lista = treinos[treinoAtual]?.exercicios || [];
    const total = lista.reduce((acc, ex) => {
      const tipo = tipoExecucao(ex);
      if(tipo === 'cardio') return acc + (tempoCardioMinutos(ex) * 60) + TEMPO_TRANSICAO_PADRAO;
      if(tipo === 'alongamento') {
        const t = Number(String(ex.tempoSegundos || ex.tempo || 30).replace(/\D/g,'')) || 30;
        return acc + t + TEMPO_TRANSICAO_PADRAO;
      }
      const series = totalSeries(ex);
      const descanso = descansoAtivado(ex) ? segundos(ex.descanso) : 0;
      const descansosEntreSeries = Math.max(0, series - 1) * descanso;
      return acc + (series * TEMPO_SERIE_PADRAO) + descansosEntreSeries + TEMPO_TRANSICAO_PADRAO;
    }, 0);
    return Math.max(60, total);
  }

  function atualizarTempoEstimado(){
    const el = $('#tempoEstimadoTreino');
    if(!el) return;
    const total = estimarTempoTreino();
    el.textContent = fmtLongo(total);
  }

  function iniciarRelogioTreino(){
    treinoInicioMs = treinoInicioMs || Date.now();
    const box = $('#relogioTreino');
    if(box) box.classList.add('ativo');
    clearInterval(relogioTimer);
    relogioTimer = setInterval(() => {
      const decorrido = Math.floor((Date.now() - treinoInicioMs) / 1000);
      const el = $('#tempoDecorridoTreino');
      if(el) el.textContent = fmtLongo(decorrido);
      const modalEl = $('#modalTempoDecorrido');
      if(modalEl) modalEl.textContent = fmtLongo(decorrido);
      salvarEstadoTreino();
    }, 1000);
  }

  function pararRelogioTreino(){
    clearInterval(relogioTimer);
    relogioTimer = null;
    salvarEstadoTreino();
  }

  async function ativarWakeLock(){
    try{
      if('wakeLock' in navigator){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener?.('release', () => { wakeLock = null; });
      }
    }catch{}
  }

  async function restaurarWakeLockSeNecessario(){
    if(document.visibilityState === 'visible' && treinoEmAndamento && !treinoFinalizado) await ativarWakeLock();
  }

  function soltarWakeLock(){
    try{ wakeLock?.release?.(); }catch{}
    wakeLock = null;
  }

  function equipamentoPorExercicio(ex = {}){
    const bruto = [ex.equipamento, ex.maquina, ex.aparelho, ex.obs, ex.nome].filter(Boolean).join(' ');
    const n = norm(bruto);
    const regras = [
      [/cadeira extensora|extensora/, 'cadeira extensora, máquina de quadríceps'],
      [/cadeira flexora|mesa flexora|flexora/, 'máquina flexora'],
      [/leg press|legpress/, 'leg press'],
      [/supino/, 'banco de supino'],
      [/pulley|puxada|puxador/, 'máquina de puxada'],
      [/remada baixa|remada articulada|remada/, 'máquina de remada'],
      [/peck deck|voador|crucifixo inverso/, 'máquina peck deck'],
      [/cross|crossover|polia/, 'estação de polias'],
      [/smith/, 'máquina smith'],
      [/hack/, 'máquina hack'],
      [/scott/, 'banco Scott'],
      [/esteira/, 'esteira'],
      [/bike|bicicleta/, 'bicicleta ergométrica'],
      [/eliptico|elptico/, 'elíptico'],
      [/abdominal|abdome|prancha|cruzamento obliquo/, 'colchonete ou área de abdominal'],
      [/halter|halteres/, 'área de pesos livres com halteres'],
      [/barra/, 'área de barras e pesos livres']
    ];
    for(const [rx, texto] of regras) if(rx.test(n)) return texto;
    return ex.grupo ? `área de ${ex.grupo}` : 'próxima estação indicada pelo professor';
  }

  function falarOrientacaoExercicio(ex = {}){
    const tipo = tipoExecucao(ex);
    const nome = ex.nome || 'exercício';
    if(tipo === 'cardio'){
      const tempo = tempoCardioMinutos(ex);
      falarTreino(`Próximo exercício: ${nome}. Tempo sugerido: ${tempo} minutos. ${ex.permiteAlunoAlterarTempo !== false ? 'Você pode ajustar esse tempo antes de iniciar.' : 'Inicie o cardio quando estiver pronto.'}`);
      return;
    }
    if(tipo === 'alongamento'){
      falarTreino(`Próximo exercício: ${nome}. Mantenha a posição por ${ex.tempoSegundos || ex.tempo || '30 segundos'}.`);
      return;
    }
    if(tipo === 'funcional'){
      falarTreino(`Próximo exercício: ${nome}. Execute ${ex.tempoSegundos || ex.repeticoes || 'o tempo indicado'}.`);
      return;
    }
    const series = totalSeries(ex);
    const reps = ex.reps || ex.repeticoes || '';
    const carga = String(ex.carga || '').trim();
    const equipamento = equipamentoPorExercicio(ex);
    const partes = [
      `Próximo exercício: ${nome}.`,
      `Vá até ${equipamento}.`,
      `Faça ${series} série${series > 1 ? 's' : ''}${reps ? ` de ${reps} repetições` : ''}${carga && carga !== '-' ? ` com carga de ${carga}` : ''}.`
    ];
    falarTreino(partes.join(' '));
  }

  function salvarTreinoOffline(){
    try{
      if(!alunoIdAtual || !Object.keys(treinos || {}).length) return;
      localStorage.setItem(CACHE_TREINO_KEY, JSON.stringify({
        alunoId: alunoIdAtual,
        treinoAtual,
        treinoExecucaoId,
        treinos,
        biblioteca,
        salvoEm: new Date().toISOString()
      }));
    }catch{}
  }

  function carregarTreinoOffline(){
    try{
      const cache = JSON.parse(localStorage.getItem(CACHE_TREINO_KEY) || 'null');
      if(!cache || !cache.treinos) return false;
      alunoIdAtual = alunoIdAtual || cache.alunoId || '';
      treinoAtual = cache.treinoAtual || Object.keys(cache.treinos)[0] || '';
      treinoExecucaoId = cache.treinoExecucaoId || '';
      treinos = cache.treinos || {};
      if(Array.isArray(cache.biblioteca) && cache.biblioteca.length){
        biblioteca = cache.biblioteca;
        montarIndicesBiblioteca();
      }
      const badge = $('#offlineBadge');
      if(badge) badge.classList.remove('hidden');
      toast('Modo offline: usando último treino salvo.');
      return true;
    }catch{
      return false;
    }
  }

  function salvarEstadoTreino(){
    try{
      localStorage.setItem(ESTADO_TREINO_KEY, JSON.stringify({
        alunoId: alunoIdAtual,
        treinoAtual,
        exercicioAtual,
        treinoEmAndamento,
        treinoFinalizado,
        treinoInicioMs,
        treinos,
        salvoEm: new Date().toISOString()
      }));
    }catch{}
  }

  function restaurarEstadoTreino(){
    try{
      const estado = JSON.parse(localStorage.getItem(ESTADO_TREINO_KEY) || 'null');
      if(!estado || !estado.treinoEmAndamento || estado.treinoFinalizado) return;
      if(estado.treinos && Object.keys(estado.treinos).length){
        treinos = estado.treinos;
        treinoAtual = estado.treinoAtual || treinoAtual;
        exercicioAtual = Number(estado.exercicioAtual || 0);
        treinoEmAndamento = true;
        treinoFinalizado = false;
        treinoInicioMs = Number(estado.treinoInicioMs || Date.now());
      }
    }catch{}
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
    if(!alunoIdAtual) {
      if(carregarTreinoOffline()) return;
      throw new Error('Aluno não identificado. Abra com ?alunoId=ID_DO_ALUNO ou salve um treino V3 primeiro.');
    }

    try{
      const json = await apiGet(`${API_OPERACIONAL}/portal/alunos/${encodeURIComponent(alunoIdAtual)}?apenasAtivos=true`);
      const lista = extrairLista(json, 'treinos');
      if(!lista.length) throw new Error('Nenhum treino ativo encontrado para este aluno.');

      const maisRecente = treinoMaisRecente(lista);
      if(!maisRecente) throw new Error('Nenhum treino válido encontrado para este aluno.');

      treinos = normalizarTreinosOperacionais([maisRecente]);
      const primeiraAba = Object.keys(treinos)[0] || '';
      treinoAtual = treinos[treinoAtual] ? treinoAtual : primeiraAba;
      treinoExecucaoId = treinos[treinoAtual]?._treinoId || maisRecente.id || '';
      salvarTreinoOffline();
      const badge = $('#offlineBadge');
      if(badge) badge.classList.add('hidden');
    }catch(e){
      if(carregarTreinoOffline()) return;
      throw e;
    }
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
          equipamento: ex.equipamento || ex.maquina || ex.aparelho || '',
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
    const semExercicios = !(t.exercicios || []).length;
    $('#btnIniciarTreino').disabled = semExercicios;
    if($('#btnInicioLivre')) $('#btnInicioLivre').disabled = semExercicios || treinoEmAndamento;
    if($('#btnTerminarLivre')) $('#btnTerminarLivre').disabled = semExercicios || !treinoEmAndamento || treinoFinalizado;
    $('#listaExercicios').innerHTML = (t.exercicios||[]).map((ex,i)=>`
      <article class="exercise-card compact ${ex.concluido?'done':''}" data-ver="${i}" role="button" tabindex="0">
        <div class="thumb">${midiaHtml(ex)}</div>
        <div class="exercise-card-body">
          <h3>${esc(ex.nome)}</h3>
          <small>${esc(ex.grupo||'-')} · ${tipoExecucao(ex)==='cardio' ? `cardio · ${tempoCardioMinutos(ex)} min` : `${esc(totalSeries(ex))} séries · ${esc(ex.reps||ex.repeticoes||'-')} reps · ${descansoAtivado(ex) ? `descanso ${esc(ex.descanso)}` : 'sem descanso'}`}</small>
        </div>
      </article>
    `).join('') || '<p>Nenhum exercício neste treino.</p>';
    document.querySelectorAll('[data-ver]').forEach(card=>{
      const abrir = () => abrirExercicio(Number(card.dataset.ver));
      card.onclick = abrir;
      card.onkeydown = ev => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); abrir(); } };
    });
  }

  function render(){ renderTabs(); renderLista(); atualizarTempoEstimado(); }

  async function garantirExecucao(){
    const treinoId = treinos[treinoAtual]?._treinoId || treinoExecucaoId || `offline_${alunoIdAtual || 'aluno'}_${treinoAtual || 'treino'}`;
    if(execucaoAtual && String(execucaoAtual.treinoId) === String(treinoId)) return execucaoAtual;
    try{
      const json = await apiSend(`${API_OPERACIONAL}/treinos/${encodeURIComponent(treinoId)}/iniciar`, 'POST', {
        origem: 'treinos_v3_aluno',
        usuario: 'Aluno',
        data: new Date().toISOString().slice(0,10)
      });
      execucaoAtual = json.dados || json.data || json;
      inicioExecucaoMs = Date.now();
      toast(json.reutilizado ? 'Execução em andamento retomada.' : 'Execução iniciada.');
      return execucaoAtual;
    }catch(e){
      execucaoAtual = { id:`offline_${Date.now()}`, treinoId, offline:true };
      inicioExecucaoMs = Date.now();
      toast('Modo offline: execução local iniciada.');
      return execucaoAtual;
    }
  }

  async function abrirExercicio(i, falar = true){
    const lista = treinos[treinoAtual]?.exercicios || [];
    if(!lista.length) return;
    try { await garantirExecucao(); } catch(e) { alert(e.message); return; }
    exercicioAtual = Math.max(0, Math.min(lista.length-1, i));
    const ex = lista[exercicioAtual];
    if(!ex._serieAtual) ex._serieAtual = 1;
    const serieAtual = serieAtualEx(ex);
    const seriesTotal = totalSeries(ex);
    $('#modalGrupo').textContent = ex.grupo || '-';
    $('#modalNome').textContent = ex.nome || 'Exercício';
    $('#modalMedia').innerHTML = midiaHtml(ex);
    const tipo = tipoExecucao(ex);
    const cardioBox = $('#cardioControl');
    if(cardioBox) cardioBox.classList.toggle('hidden', tipo !== 'cardio');
    if($('#cardioTempoAluno')) {
      $('#cardioTempoAluno').disabled = ex.permiteAlunoAlterarTempo === false;
      $('#cardioTempoAluno').value = String(tempoCardioMinutos(ex));
    }
    $('#modalSeries').textContent = tipo === 'cardio' ? '1' : `${serieAtual}/${seriesTotal}`;
    $('#modalReps').textContent = tipo === 'cardio' ? `${tempoCardioMinutos(ex)} min` : (ex.reps || ex.repeticoes || '-');
    $('#modalCarga').textContent = tipo === 'cardio' ? (ex.intensidade || 'Moderada') : (ex.carga || '-');
    $('#modalDescanso').textContent = descansoAtivado(ex) ? ex.descanso : 'Sem descanso';
    $('#modalObs').textContent = ex.obs || '';
    $('#modalContador').textContent = `Exercício ${exercicioAtual+1} de ${lista.length} · Série ${serieAtual} de ${seriesTotal}`;
    $('#barraProgresso').style.width = `${Math.round(((exercicioAtual+1)/lista.length)*100)}%`;
    $('#btnAnterior').disabled = exercicioAtual <= 0 || treinoEmAndamento;
    $('#btnDescanso').disabled = true;
    const ultimo = exercicioAtual >= lista.length-1 && serieAtual >= seriesTotal;
    $('#btnProximo').textContent = ultimo ? '✓ Finalizar treino' : 'Concluir série';
    $('#btnProximo').classList.toggle('finalizar', ultimo);
    atualizarBotaoProximo();
    $('#modalExercicio').classList.remove('hidden');
    atualizarControleVolume();
    atualizarStatusComandoVoz();
    salvarEstadoTreino();
    if(falar) falarOrientacaoExercicio(ex);
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

  function iniciarDescanso(mensagemInicial = ''){
    const ex = treinos[treinoAtual]?.exercicios?.[exercicioAtual];
    const total = descansoAtivado(ex || {}) ? segundos(ex?.descanso) : 0;
    resetDescanso();
    if(total <= 0){ 
      if(mensagemInicial) falarTreino(mensagemInicial);
      return; 
    }
    descansoRestante = total;
    descansoAtivo = true;
    $('#cronometroDescanso').textContent = fmt(descansoRestante);
    atualizarBotaoProximo();
    toast('Descanso iniciado.');
    avisoCincoSegundosEmitido = false;
    falarTreino(mensagemInicial || `Descanse por ${total} segundos.`);
    descansoTimer = setInterval(()=>{
      descansoRestante -= 1;
      $('#cronometroDescanso').textContent = fmt(Math.max(0, descansoRestante));
      atualizarBotaoProximo();
      if(descansoRestante === 5 && !avisoCincoSegundosEmitido){
        avisoCincoSegundosEmitido = true;
        falarTreino('Prepare-se para a próxima série.');
      }
      if(descansoRestante <= 0){
        clearInterval(descansoTimer);
        descansoTimer = null;
        descansoAtivo = false;
        $('#cronometroDescanso').textContent = '00:00';
        atualizarBotaoProximo();
        const serie = serieAtualEx(ex);
        toast('Descanso finalizado.');
        falarTreino(`Inicie a série ${serie}.`);
      }
    },1000);
  }

  function iniciarCardioAluno(ex){
    const minutos = Math.max(1, Number($('#cardioTempoAluno')?.value || tempoCardioMinutos(ex)) || 20);
    ex.tempoAlunoMinutos = minutos;
    ex._cardioConcluido = false;
    cardioRestante = minutos * 60;
    clearInterval(cardioTimer);
    if($('#cardioCronometro')) $('#cardioCronometro').textContent = fmt(cardioRestante);
    toast(`Cardio iniciado: ${minutos} min.`);
    falarTreino(`Cardio iniciado por ${minutos} minutos.`);
    cardioTimer = setInterval(()=>{
      cardioRestante -= 1;
      if($('#cardioCronometro')) $('#cardioCronometro').textContent = fmt(Math.max(0, cardioRestante));
      if(cardioRestante <= 0){
        clearInterval(cardioTimer);
        cardioTimer = null;
        ex._cardioConcluido = true;
        toast('Cardio concluído.');
        falarTreino('Cardio concluído. Toque em próximo exercício.');
        atualizarBotaoProximo();
      }
    }, 1000);
  }

  async function registrarExercicioConcluido(ex){
    const exec = await garantirExecucao();
    const exId = ex._exercicioTreinoId || ex.id || ex.exercicioId;
    if(!exec?.id || !exId || exec.offline) return;
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
    if(!execucaoAtual?.id || execucaoAtual.offline) return;
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
      const atual = serieAtualEx(ex);
      const total = totalSeries(ex);

      if(tipoExecucao(ex) === 'cardio'){
        const tempoInput = Number($('#cardioTempoAluno')?.value || tempoCardioMinutos(ex));
        ex.tempoAlunoMinutos = tempoInput;
        if(!ex._cardioConcluido){ iniciarCardioAluno(ex); return; }
      }

      if(atual < total){
        ex._serieAtual = atual + 1;
        salvarEstadoTreino();
        $('#modalSeries').textContent = `${ex._serieAtual}/${total}`;
        $('#modalContador').textContent = `Exercício ${exercicioAtual+1} de ${lista.length} · Série ${ex._serieAtual} de ${total}`;
        const restantes = total - atual;
        const descansoSeg = descansoAtivado(ex) ? segundos(ex.descanso) : 0;
        const msg = descansoSeg > 0
          ? `Série ${atual} concluída. ${restantes} ${restantes > 1 ? 'séries restantes' : 'série restante'}. Descanse ${descansoSeg} segundos.`
          : `Série ${atual} concluída. ${restantes} ${restantes > 1 ? 'séries restantes' : 'série restante'}. Sem descanso programado.`;
        if(descansoSeg > 0) iniciarDescanso(msg); else falarTreino(msg);
        return;
      }

      ex.concluido = true;
      await registrarExercicioConcluido(ex);

      if(exercicioAtual >= lista.length - 1){
        treinoFinalizado = true;
        treinoEmAndamento = false;
        await concluirExecucao();
        $('#modalExercicio').classList.add('hidden');
        resetDescanso();
        pararRelogioTreino();
        pararReconhecimentoVoz();
        soltarWakeLock();
        render();
        localStorage.removeItem(ESTADO_TREINO_KEY);
        toast(`Treino finalizado: ${treinoAtual}.`);
        falarTreino('Treino encerrado com sucesso. Bom descanso e até o próximo treino.');
        alert(`Treino finalizado e gravado no histórico: ${treinoAtual}.`);
        return;
      }

      falarTreino('Última série concluída. Exercício finalizado.');
      resetDescanso();
      await abrirExercicio(exercicioAtual + 1, true);
      renderLista();
    }catch(e){
      alert(e.message || 'Erro ao registrar execução do treino.');
    }
  }


  async function iniciarTreinoLivre(){
    if(treinoEmAndamento && !treinoFinalizado){
      toast('Treino já está em andamento.');
      return;
    }
    treinoEmAndamento = true;
    treinoFinalizado = false;
    treinoInicioMs = Date.now();
    iniciarRelogioTreino();
    await ativarWakeLock();
    try{ await garantirExecucao(); }catch{}
    renderLista();
    const estimado = textoTempo(estimarTempoTreino());
    toast(`Treino iniciado. Tempo estimado: ${estimado}.`);
    falarTreino(`Treino iniciado. Tempo estimado: ${estimado}. Use a lista livre e toque em treino terminado ao finalizar.`);
    salvarEstadoTreino();
  }

  async function finalizarTreinoLivre(){
    if(!treinoEmAndamento || treinoFinalizado){
      toast('Nenhum treino em andamento para finalizar.');
      return;
    }
    if(!confirm('Finalizar este treino agora?')) return;
    try{
      treinoFinalizado = true;
      treinoEmAndamento = false;
      try{ await concluirExecucao(); }catch{}
      resetDescanso();
      pararRelogioTreino();
      pararReconhecimentoVoz();
      soltarWakeLock();
      localStorage.removeItem(ESTADO_TREINO_KEY);
      renderLista();
      toast(`Treino finalizado: ${treinoAtual}.`);
      falarTreino('Treino encerrado com sucesso. Bom descanso e até o próximo treino.');
    }catch(e){
      alert(e.message || 'Erro ao finalizar o treino.');
    }
  }

  $('#btnIniciarTreino').onclick = async () => {
    treinoEmAndamento = true;
    treinoFinalizado = false;
    treinoInicioMs = Date.now();
    iniciarRelogioTreino();
    await ativarWakeLock();
    if(comandoVozAtivo) iniciarReconhecimentoVoz();
    const estimado = textoTempo(estimarTempoTreino());
    falarTreino(`Vamos iniciar o treino. Tempo estimado: ${estimado}.`);
    abrirExercicio(0, true);
  };
  $('#btnAudioTreino')?.addEventListener('click', alternarAudioTreino);
  $('#btnComandoVoz')?.addEventListener('click', alternarComandoVoz);
    $('#btnIniciarCardio')?.addEventListener('click', ()=>{ const ex = treinos[treinoAtual]?.exercicios?.[exercicioAtual]; if(ex) iniciarCardioAluno(ex); });
  $('#btnInicioLivre')?.addEventListener('click', iniciarTreinoLivre);
  $('#btnTerminarLivre')?.addEventListener('click', finalizarTreinoLivre);
  $('#volumeTreino')?.addEventListener('input', ev => alterarVolumeTreino(ev.target.value));
  atualizarBotaoAudio();
  atualizarControleVolume();
  atualizarStatusComandoVoz();

  const btnFechar = $('#btnFecharModal');
  if(btnFechar) btnFechar.onclick = () => {
    if(treinoEmAndamento && !treinoFinalizado){
      toast('Finalize o treino para sair desta tela.');
      falarTreino('Finalize o treino para sair desta tela.');
      return;
    }
    $('#modalExercicio').classList.add('hidden');
  };

  $('#btnAnterior').onclick = () => {
    if(treinoEmAndamento && !treinoFinalizado){
      toast('Durante o treino guiado, avance concluindo as séries.');
      return;
    }
    resetDescanso();
    abrirExercicio(exercicioAtual - 1, false);
  };
  $('#btnProximo').onclick = proximo;
  $('#btnDescanso').onclick = () => iniciarDescanso();
  $('#modalExercicio').addEventListener('click', ev => {
    if(ev.target.id === 'modalExercicio'){
      if(treinoEmAndamento && !treinoFinalizado){
        toast('O treino guiado fica aberto até a finalização.');
        return;
      }
      $('#modalExercicio').classList.add('hidden');
    }
  });

  document.addEventListener('visibilitychange', () => {
    restaurarWakeLockSeNecessario();
    if(document.visibilityState === 'visible' && comandoVozAtivo && treinoEmAndamento && !treinoFinalizado) iniciarReconhecimentoVoz();
  });
  window.addEventListener('beforeunload', ev => {
    if(treinoEmAndamento && !treinoFinalizado){
      salvarEstadoTreino();
      ev.preventDefault();
      ev.returnValue = '';
    }
  });

  (async function init(){
    $('#tituloTreino').textContent = 'Carregando treino...';
    $('#descricaoTreino').textContent = 'Buscando prescrição no motor operacional.';
    $('#listaExercicios').innerHTML = '<p>Carregando treino do aluno...</p>';
    try{
      await carregarBiblioteca();
      await carregarTreinosBackend();
      restaurarEstadoTreino();
      render();
      if(treinoEmAndamento && !treinoFinalizado){
        iniciarRelogioTreino();
        await ativarWakeLock();
        abrirExercicio(exercicioAtual || 0, false);
        toast('Treino em andamento restaurado.');
      }else{
        toast('Treino carregado do backend operacional.');
      }
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
