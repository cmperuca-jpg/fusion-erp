const API_AVALIACOES = "/api/avaliacoes";
const API_ALUNOS = "/api/alunos";
const API_PROFESSORES = "/api/professores";

let avaliacoes = [];
let alunos = [];
let professores = [];
let avaliacaoAtual = null;
const $ = (s) => document.querySelector(s);
const PARAMS_INICIAIS = new URLSearchParams(location.search);
const MODO_EMBED = PARAMS_INICIAIS.get('embed') === '1';
let professorIdUrl = PARAMS_INICIAIS.get('professorId') || PARAMS_INICIAIS.get('professor_id') || '';
let professorNomeUrl = '';

function sessaoProfessorPortal() {
  const chaves = ['fusion_professor_sessao', 'fusion_professor_portal'];
  for (const chave of chaves) {
    try {
      const dados = JSON.parse(localStorage.getItem(chave) || 'null');
      if (dados?.professorId || dados?.id) {
        return {
          ...dados,
          professorId: String(dados.professorId || dados.id),
          professorNome: dados.professorNome || dados.nome || dados.name || dados.professor || 'Professor'
        };
      }
    } catch {}
  }
  return null;
}

const SESSAO_PROFESSOR_PORTAL = sessaoProfessorPortal();
const PORTAL_PROFESSOR = Boolean(
  window.FUSION_PORTAL_PROFESSOR ||
  PARAMS_INICIAIS.get('origem') === 'professor' ||
  PARAMS_INICIAIS.get('portal') === 'professor' ||
  PARAMS_INICIAIS.has('professorId') ||
  PARAMS_INICIAIS.has('professor_id') ||
  SESSAO_PROFESSOR_PORTAL?.professorId
);

if (PORTAL_PROFESSOR) {
  document.documentElement.classList.add('modo-professor-avaliacao-html');
  document.body?.classList.add('modo-professor-avaliacao');
  document.documentElement.style.overflowY = 'auto';
  document.documentElement.style.overflowX = 'hidden';
  if (document.body) {
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';
    document.body.style.height = 'auto';
    document.body.style.position = 'static';
  }
}

if (!professorIdUrl && SESSAO_PROFESSOR_PORTAL?.professorId) professorIdUrl = String(SESSAO_PROFESSOR_PORTAL.professorId);
if (!professorNomeUrl && SESSAO_PROFESSOR_PORTAL?.professorNome) professorNomeUrl = String(SESSAO_PROFESSOR_PORTAL.professorNome);


function texto(v, padrao = "") { return String(v ?? padrao).trim(); }
function numero(v) { const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function soNumeros(v) { return String(v || '').replace(/\D/g, ''); }
function idsIguais(a, b) {
  const sa = texto(a);
  const sb = texto(b);
  return Boolean(sa && sb && sa === sb);
}
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function dataHoje() { return new Date().toISOString().slice(0, 10); }
function mesAtual() { return dataHoje().slice(0, 7); }
function idAluno(a = {}) { return texto(a.id || a._id || a.alunoId || a.aluno_id); }
function nomeAluno(a = {}) { return texto(a.nome || a.alunoNome || a.aluno || a.name || "Aluno não identificado"); }
function idProfessor(p = {}) { return texto(p.id || p._id || p.professorId || p.professor_id); }
function nomeProfessor(p = {}) { return texto(p.nome || p.professorNome || p.professor || p.name || ""); }
function alunoPorId(id) { return alunos.find(a => idAluno(a) === texto(id)) || null; }
function professorPorId(id) { return professores.find(p => idProfessor(p) === texto(id)) || null; }
function statusAlunoAtivo(a = {}) {
  const status = normalizar(a.status || a.situacao || 'ativo');
  const statusMat = normalizar(a.statusMatricula || a.matriculaStatus || a.status_matricula || 'ativa');
  const cadastroAtivo = !['inativo','inativa','cancelado','cancelada','excluido','excluida','excluído','excluída'].includes(status);
  const matriculaAtiva = !['inativo','inativa','cancelado','cancelada','encerrado','encerrada','excluido','excluida','excluído','excluída'].includes(statusMat);
  return cadastroAtivo && matriculaAtiva;
}
function professorLogadoRegistro() {
  const id = texto(professorIdUrl || SESSAO_PROFESSOR_PORTAL?.professorId);
  const nome = normalizar(professorNomeUrl || SESSAO_PROFESSOR_PORTAL?.professorNome);
  return professores.find(p => idsIguais(idProfessor(p), id))
    || professores.find(p => nome && normalizar(nomeProfessor(p)) === nome)
    || professores.find(p => nome && (normalizar(nomeProfessor(p)).includes(nome) || nome.includes(normalizar(nomeProfessor(p)))) )
    || null;
}

function professorAcessaTodosAlunos() {
  const p = professorLogadoRegistro();
  const sessao = SESSAO_PROFESSOR_PORTAL || {};
  const perfil = normalizar(sessao.perfil || p?.perfil || p?.tipoPerfil || p?.funcao || '');
  const mods = Array.isArray(p?.modalidades) ? p.modalidades.map(normalizar) : [];

  return sessao.acessoTodosAlunos === true ||
    p?.acessoTodosAlunos === true ||
    perfil === 'responsavel_tecnico' ||
    perfil === 'responsavel-tecnico' ||
    perfil === 'responsavel tecnico' ||
    mods.includes('todas') ||
    mods.includes('todos');
}

function alunoVinculadoAoProfessor(a = {}) {
  if (!professorIdUrl && !professorNomeUrl && !SESSAO_PROFESSOR_PORTAL?.professorId) return true;

  const professor = professorLogadoRegistro();
  const idsProfessor = [
    professorIdUrl,
    SESSAO_PROFESSOR_PORTAL?.professorId,
    professor?.id,
    professor?.professorId,
    professor?.professor_id
  ].map(texto).filter(Boolean);

  const idsAluno = [
    a.professorId,
    a.professor_id,
    a.idProfessor,
    a.professorResponsavelId,
    a.professor_responsavel_id,
    a.professor_responsavel
  ].map(texto).filter(Boolean);

  if (idsProfessor.some(pid => idsAluno.some(aid => aid === pid))) return true;

  const nomesProfessor = [
    professorNomeUrl,
    SESSAO_PROFESSOR_PORTAL?.professorNome,
    professor?.nome,
    professor?.professorNome,
    professor?.name
  ].map(normalizar).filter(Boolean);

  const nomesAluno = [
    a.professorNome,
    a.professor_nome,
    a.professor,
    a.professorResponsavel,
    a.professor_responsavel_nome
  ].map(normalizar).filter(Boolean);

  if (nomesProfessor.some(pn => nomesAluno.some(an => an === pn || an.includes(pn) || pn.includes(an)))) return true;

  return false;
}
function avaliacaoPertenceAoProfessor(av = {}) {
  if (!PORTAL_PROFESSOR || (!professorIdUrl && !professorNomeUrl)) return true;
  const ids = [av.professorId, av.professor_id, av.avaliadorId, av.avaliador_id].map(texto).filter(Boolean);
  if (professorIdUrl && ids.some(id => id === texto(professorIdUrl))) return true;
  const nomes = [av.professorNome, av.professor, av.avaliador].map(normalizar).filter(Boolean);
  const alvo = normalizar(professorNomeUrl);
  if (alvo && nomes.some(n => n === alvo || n.includes(alvo) || alvo.includes(n))) return true;
  const aluno = alunoPorId(av.alunoId || av.aluno_id);
  return aluno ? alunoVinculadoAoProfessor(aluno) : false;
}

function safeId(v){return String(v ?? '').replace(/[^a-zA-Z0-9_-]/g,'');}

function extrairLista(payload, chave) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (chave && Array.isArray(payload?.[chave])) return payload[chave];
  const chaves = [
    'alunos', 'avaliacoes', 'professores', 'dados', 'data', 'itens',
    'registros', 'items', 'resultado', 'resultados', 'lista', 'rows'
  ];
  for (const k of chaves) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  for (const k of chaves) {
    const interno = payload?.[k];
    if (interno && typeof interno === 'object') {
      const lista = extrairLista(interno, chave);
      if (lista.length) return lista;
    }
  }
  return [];
}
async function safeJson(resp) { try { return await resp.json(); } catch { return {}; } }

function valorCampo(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setCampo(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ""; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v ?? ""; }
function radioValor(nome) { return document.querySelector(`input[name="${nome}"]:checked`)?.value || ""; }
function setRadio(nome, valor) { const el = document.querySelector(`input[name="${nome}"][value="${CSS.escape(String(valor || ''))}"]`); if (el) el.checked = true; }

function mostrarAlerta(msg, tipo = "erro") {
  const el = $("#alerta");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.className = `alert ${tipo}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 9000);
}

async function carregarJsonLista(urls = [], chave = '') {
  for (const url of urls) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      const json = await safeJson(resp);
      if (!resp.ok) continue;
      const lista = extrairLista(json, chave);
      if (Array.isArray(lista) && lista.length) return lista;
    } catch {}
  }
  return [];
}

async function carregarBases() {
  alunos = await carregarJsonLista([
    API_ALUNOS,
    "/api/alunos?status=ativo",
    "/data/alunos.json",
    "/alunos.json"
  ], "alunos");

  professores = await carregarJsonLista([
    API_PROFESSORES,
    "/data/professores.json",
    "/professores.json"
  ], "professores");

  avaliacoes = await carregarJsonLista([
    API_AVALIACOES,
    "/data/avaliacoes.json",
    "/avaliacoes.json"
  ], "avaliacoes");

  if (PORTAL_PROFESSOR) {
    document.body.classList.add('modo-professor-avaliacao');

    const p = professorLogadoRegistro() || professorPorId(professorIdUrl);
    professorIdUrl = professorIdUrl || texto(SESSAO_PROFESSOR_PORTAL?.professorId || idProfessor(p || {}));
    professorNomeUrl = professorNomeUrl || nomeProfessor(p || {}) || SESSAO_PROFESSOR_PORTAL?.professorNome || '';

    const acessoGlobal = professorAcessaTodosAlunos();

    if (!acessoGlobal) {
      // Professor comum: mantém somente alunos ativos e histórico vinculado.
      alunos = alunos.filter(statusAlunoAtivo);

      const avaliacoesProfessor = avaliacoes.filter(av => avaliacaoPertenceAoProfessor(av));
      if (avaliacoesProfessor.length) {
        avaliacoes = avaliacoesProfessor;
      } else {
        const idsAtivos = new Set(alunos.map(idAluno).filter(Boolean));
        avaliacoes = avaliacoes.filter(av => {
          const aid = texto(av.alunoId || av.aluno_id);
          return !aid || idsAtivos.has(aid);
        });
      }
    }
    // Responsável técnico: preserva todos os alunos (ativos e inativos)
    // e todas as avaliações carregadas pelo sistema.
  } else {
    alunos = alunos.filter(statusAlunoAtivo);
  }

  preencherSelectAlunos();
  aplicarParametrosUrl();
  renderizar();

  if (!alunos.length) {
    const escopo = professorAcessaTodosAlunos() ? "Nenhum aluno foi carregado para avaliação." : "Nenhum aluno ativo foi carregado para avaliação.";
    mostrarAlerta(`${escopo} Verifique /api/alunos e os cadastros.`, "erro");
  }
}

function preencherSelectAlunos() {
  for (const sel of ["#filtroAluno", "#aluno_id"]) {
    const el = $(sel); if (!el) continue;
    const atual = el.value;
    const primeira = sel === "#filtroAluno" ? '<option value="">Todos</option>' : '<option value="">Selecione um aluno</option>';
    const lista = alunos.slice().sort((a,b)=>nomeAluno(a).localeCompare(nomeAluno(b), "pt-BR"));
    const opcoes = lista.map(a => `<option value="${esc(idAluno(a))}">${esc(nomeAluno(a))}</option>`).join("");
    el.innerHTML = primeira + (opcoes || '<option value="" disabled>Nenhum aluno ativo encontrado</option>');
    if (atual && Array.from(el.options).some(opt => opt.value === atual)) el.value = atual;
    else el.value = '';
  }
}

function professorResponsavelDoAluno(aluno = {}) {
  const pid = texto(aluno.professorId || aluno.professor_id || aluno.idProfessor);
  if (pid) {
    const p = professorPorId(pid);
    return { id: pid, nome: texto(aluno.professorNome || aluno.professor_responsavel || nomeProfessor(p || {})) };
  }
  const nome = texto(aluno.professorNome || aluno.professor_responsavel || aluno.professor || "");
  if (nome) {
    const p = professores.find(x => normalizar(nomeProfessor(x)) === normalizar(nome));
    return { id: idProfessor(p || {}), nome: nomeProfessor(p || {}) || nome };
  }
  if (professorIdUrl) {
    const pUrl = professorPorId(professorIdUrl);
    return { id: professorIdUrl, nome: nomeProfessor(pUrl || {}) || professorNomeUrl || 'Professor informado pela tela anterior' };
  }
  return { id: "", nome: "Nenhum professor vinculado" };
}

function sincronizarAlunoProfessor() {
  const aluno = alunoPorId(valorCampo("aluno_id"));
  if (!aluno) {
    setCampo("professor_id", ""); setCampo("professorNome", ""); setText("professorNomeDisplay", "Selecione o aluno"); setCampo("matriculaNumero", ""); return;
  }
  const prof = professorResponsavelDoAluno(aluno);
  setCampo("professor_id", prof.id);
  setCampo("professorNome", prof.nome);
  setText("professorNomeDisplay", prof.nome || "Sem professor vinculado");
  setCampo("matriculaNumero", aluno.numeroMatricula || aluno.matricula || aluno.matriculaId || "");
  setText("tituloAlunoModal", `:: ${nomeAluno(aluno)}`);
  const selecionadoAtual = avaliacaoAtual?.id || "";
  preencherSelectAvaliacoesAluno(idAluno(aluno), selecionadoAtual);
}

function alunoNomeDaAvaliacao(av = {}) { return texto(av.alunoNome || av.aluno || nomeAluno(alunoPorId(av.alunoId || av.aluno_id) || {}), "-"); }
function professorNomeDaAvaliacao(av = {}) { return texto(av.professorNome || av.avaliador || av.professor || nomeProfessor(professorPorId(av.professorId || av.professor_id) || {}), "-"); }

function filtros() { return { q: normalizar(valorCampo("busca")), alunoId: texto(valorCampo("filtroAluno")), mes: texto(valorCampo("filtroMes")) }; }
function avaliacoesFiltradas() {
  const f = filtros();
  return avaliacoes.filter(av => {
    const alunoIdAv = texto(av.alunoId || av.aluno_id);
    const alvo = normalizar([alunoNomeDaAvaliacao(av), professorNomeDaAvaliacao(av), av.objetivo, av.observacoes].join(" "));
    const data = texto(av.data || av.dataAvaliacao || av.criado_em).slice(0,10);
    return (!f.q || alvo.includes(f.q)) && (!f.alunoId || alunoIdAv === f.alunoId) && (!f.mes || data.slice(0,7) === f.mes);
  });
}

function atualizarKpis() {
  const total = avaliacoes.length;
  const esteMes = avaliacoes.filter(a => texto(a.data || a.criado_em).slice(0,7) === mesAtual()).length;
  const alunosAval = new Set(avaliacoes.map(a => texto(a.alunoId || a.aluno_id)).filter(Boolean)).size;
  const imcs = avaliacoes.map(a => numero(a.imc)).filter(n => n > 0);
  setText("kpiTotal", total); setText("kpiMes", esteMes); setText("kpiAlunos", alunosAval); setText("kpiImc", imcs.length ? (imcs.reduce((s,n)=>s+n,0)/imcs.length).toFixed(1) : "0");
}
function renderizar() { const lista = avaliacoesFiltradas(); atualizarKpis(); renderizarTabela(lista); renderizarEvolucao(); }
function renderizarTabela(lista) {
  const tbody = $("#tabela"); if (!tbody) return;
  setText("contador", `${lista.length} registro(s)`);
  if (!lista.length) { tbody.innerHTML = `<tr><td colspan="8">Nenhuma avaliação encontrada.</td></tr>`; return; }
  tbody.innerHTML = lista.map(av => `<tr><td>${esc(alunoNomeDaAvaliacao(av))}</td><td>${esc(texto(av.data || av.criado_em).slice(0,10) || "-")}</td><td>${esc(professorNomeDaAvaliacao(av))}</td><td>${esc(av.peso || "-")}</td><td>${esc(av.imc || "-")}</td><td>${esc(av.percentual_gordura || "-")}</td><td>${esc(av.objetivo || "-")}</td><td class="text-right"><button class="btn-row" type="button" onclick="editarAvaliacao('${esc(av.id)}')">Editar</button><button class="btn-row" type="button" onclick="imprimirAvaliacao('${esc(av.id)}')">Imprimir</button><button class="btn-row danger" type="button" onclick="excluirAvaliacao('${esc(av.id)}')">Excluir</button></td></tr>`).join("");
}
function renderizarEvolucao() {
  const box = $("#evolucao"); if (!box) return;
  const alunoId = texto(valorCampo("filtroAluno"));
  if (!alunoId) { box.innerHTML = "Escolha um aluno para visualizar a evolução cronológica."; setText("evolTitulo", "Selecione um aluno no filtro"); return; }
  setText("evolTitulo", nomeAluno(alunoPorId(alunoId) || {}));
  const hist = avaliacoes.filter(a => texto(a.alunoId || a.aluno_id) === alunoId).sort((a,b)=>texto(a.data || a.criado_em).localeCompare(texto(b.data || b.criado_em)));
  if (!hist.length) { box.innerHTML = "Nenhuma avaliação encontrada para este aluno."; return; }
  box.innerHTML = hist.map(a => `<div class="timeline-item"><strong>${esc(texto(a.data || a.criado_em).slice(0,10))}</strong><span>Peso: ${esc(a.peso || "-")}</span><span>IMC: ${esc(a.imc || "-")}</span><span>Gordura: ${esc(a.percentual_gordura || "-")}</span><span>RCQ: ${esc(a.rcq || "-")}</span></div>`).join("");
}


function avaliacoesDoAluno(alunoId) {
  return avaliacoes
    .filter(a => texto(a.alunoId || a.aluno_id) === texto(alunoId))
    .sort((a,b) => texto(b.data || b.criadoEm || b.criado_em || '').localeCompare(texto(a.data || a.criadoEm || a.criado_em || '')));
}

function rotuloAvaliacao(av, idx, total) {
  const dataAv = texto(av.data || av.criadoEm || av.criado_em).slice(0,10).split('-').reverse().join('/');
  const numero = Math.max(1, total - idx);
  return `${numero}ª - ${dataAv || 'sem data'}`;
}

function setModoAvaliacao(modo) {
  document.querySelectorAll('[data-avmodo]').forEach(btn => btn.classList.toggle('active', btn.dataset.avmodo === modo));
  const box = document.getElementById('modoAvaliacaoBox');
  if (box) box.dataset.modo = modo;
}

function preencherSelectAvaliacoesAluno(alunoId, selecionado = '') {
  const sel = document.getElementById('avaliacaoNumero');
  if (!sel) return;
  const lista = avaliacoesDoAluno(alunoId);
  const prox = `${lista.length + 1}ª - ${dataHoje().split('-').reverse().join('/')}`;
  sel.innerHTML = `<option value="nova">Nova avaliação (${esc(prox)})</option>` +
    lista.map((av, idx) => `<option value="${esc(av.id)}">Editar ${esc(rotuloAvaliacao(av, idx, lista.length))}</option>`).join('');
  sel.value = selecionado && lista.some(av => String(av.id) === String(selecionado)) ? selecionado : 'nova';
}

function selecionarAvaliacaoNumero() {
  const valor = valorCampo('avaliacaoNumero');
  if (!valor || valor === 'nova') {
    setCampo('id', '');
    avaliacaoAtual = null;
    setModoAvaliacao('nova');
    if (!valorCampo('data')) setCampo('data', dataHoje());
    if (!valorCampo('hora')) setCampo('hora', new Date().toTimeString().slice(0,5));
    return;
  }
  const av = avaliacoes.find(a => String(a.id) === String(valor));
  if (av) {
    setModoAvaliacao('editar');
    preencher(av);
  }
}

function trocarTab(tab) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tab}`));
  atualizarFiguraSexo();
  atualizarRelatorio();
}
function abrirModal(titulo = "Nova avaliação") {
  const modal = $("#modal");
  modal?.classList.remove("hidden");
  if (PORTAL_PROFESSOR) {
    document.documentElement.style.overflowY = 'hidden';
    document.body.style.overflowY = 'hidden';
    const card = document.querySelector('.modal-avaliacao');
    if (card) card.scrollTop = 0;
  }
  setModoAvaliacao(titulo.includes("Editar") ? "editar" : "nova");
  setTimeout(()=>$("#aluno_id")?.focus(), 60);
}
function fecharModal() {
  $("#modal")?.classList.add("hidden");
  if (PORTAL_PROFESSOR) {
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
  }
  avaliacaoAtual = null;
  $("#form")?.reset();
  ["foto_frente","foto_costas","foto_lateral_direita","foto_lateral_esquerda"].forEach(id=>renderFoto(id, ""));
  setModoAvaliacao("nova");
  trocarTab("anamnese");
  setText("professorNomeDisplay", "Definido pelo professor responsável do aluno");
}
function novaAvaliacao() { $("#form")?.reset(); avaliacaoAtual = null; setCampo("id", ""); setCampo("data", dataHoje()); setCampo("hora", new Date().toTimeString().slice(0,5)); const alunoFiltro = valorCampo("filtroAluno") || PARAMS_INICIAIS.get('alunoId') || PARAMS_INICIAIS.get('aluno_id'); if (alunoFiltro) setCampo("aluno_id", alunoFiltro); sincronizarAlunoProfessor(); setCampo("avaliacaoNumero", "nova"); setModoAvaliacao("nova"); if (!valorCampo('professor_id') && professorIdUrl) { const p = professorPorId(professorIdUrl); setCampo('professor_id', professorIdUrl); setCampo('professorNome', nomeProfessor(p || {}) || professorNomeUrl); setText('professorNomeDisplay', nomeProfessor(p || {}) || professorNomeUrl || 'Professor informado pela tela anterior'); } abrirModal("Nova avaliação"); trocarTab("anamnese"); }


function atualizarFiguraSexo() {
  const fig = document.getElementById("rcqFigura");
  if (!fig) return;
  const sexo = valorCampo("risco_sexo") || valorCampo("sexo");
  fig.classList.remove("figura-masculina", "figura-feminina", "figura-neutral");
  if (String(sexo) === "2" || normalizar(sexo).includes("mascul")) fig.classList.add("figura-masculina");
  else if (String(sexo) === "1" || normalizar(sexo).includes("fem")) fig.classList.add("figura-feminina");
  else fig.classList.add("figura-neutral");
}

function classificarIMC(imc) { if (!imc) return ""; if (imc < 18.5) return "Baixo peso"; if (imc < 25) return "Normal"; if (imc < 30) return "Sobrepeso"; if (imc < 35) return "Obesidade I"; if (imc < 40) return "Obesidade II"; return "Obesidade III"; }
function classificarRCQValor(rcq, sexoValor) {
  if (!rcq) return "Preencha cintura e quadril.";
  const sx = normalizar(sexoValor || valorCampo("risco_sexo"));
  const masculino = String(sexoValor) === "2" || sx.includes("mascul");
  const feminino = String(sexoValor) === "1" || sx.includes("fem");
  if (feminino) {
    if (rcq < 0.80) return "Risco baixo";
    if (rcq < 0.86) return "Risco moderado";
    return "Risco elevado";
  }
  if (masculino) {
    if (rcq < 0.90) return "Risco baixo";
    if (rcq < 1.00) return "Risco moderado";
    return "Risco elevado";
  }
  if (rcq < 0.84) return "Risco baixo";
  if (rcq < 0.94) return "Risco moderado";
  return "Risco elevado";
}
function deltaAtualAnterior(atual, anterior) {
  const a = numero(atual); const b = numero(anterior);
  if (!a || !b) return { texto: "-", classe: "neutro" };
  const d = a - b;
  return { texto: `${d > 0 ? "+" : ""}${d.toFixed(2).replace('.', ',')}`, classe: Math.abs(d) < 0.01 ? "neutro" : (d > 0 ? "subiu" : "desceu") };
}
function avaliacaoAnteriorDoAluno(alunoId, idAtual = "") {
  return avaliacoesDoAluno(alunoId).filter(a => String(a.id) !== String(idAtual))[0] || null;
}
function diagnosticoCompleto(av = coletar()) {
  const anterior = avaliacaoAnteriorDoAluno(av.aluno_id || av.alunoId, av.id || valorCampo("id"));
  const imc = numero(av.imc), gordura = numero(av.percentual_gordura), rcq = numero(av.rcq), massaMagra = numero(av.massa_magra), soma = numero(av.soma_perimetros);
  const pontos = [], atencao = [], conduta = [];
  if (imc) { const c = classificarIMC(imc); (c === "Normal" ? pontos : atencao).push(`IMC ${imc.toFixed(2).replace('.', ',')} classificado como ${c}.`); }
  if (gordura) { (gordura <= numero(av.percentual_ideal || 22) ? pontos : atencao).push(`Gordura corporal registrada em ${String(av.percentual_gordura).replace('.', ',')}%.`); }
  if (rcq) { const c = classificarRCQValor(rcq, av.risco_sexo); (c === "Risco baixo" ? pontos : atencao).push(`RCQ ${rcq.toFixed(2).replace('.', ',')} com ${c.toLowerCase()}.`); }
  if (massaMagra) pontos.push(`Massa magra registrada: ${String(av.massa_magra).replace('.', ',')} kg.`);
  if (soma) pontos.push(`Somatório de perímetros: ${String(av.soma_perimetros).replace('.', ',')} cm.`);
  if (anterior) {
    const dp = deltaAtualAnterior(av.peso, anterior.peso); if (dp.texto !== "-") conduta.push(`Peso variou ${dp.texto} kg em relação à avaliação anterior.`);
    const dg = deltaAtualAnterior(av.percentual_gordura, anterior.percentual_gordura); if (dg.texto !== "-") conduta.push(`Gordura corporal variou ${dg.texto} ponto(s).`);
    const dm = deltaAtualAnterior(av.massa_magra, anterior.massa_magra); if (dm.texto !== "-") conduta.push(`Massa magra variou ${dm.texto} kg.`);
    const dr = deltaAtualAnterior(av.rcq, anterior.rcq); if (dr.texto !== "-") conduta.push(`RCQ variou ${dr.texto}.`);
  } else conduta.push("Use esta avaliação como linha de base para o próximo comparativo.");
  if (atencao.length) conduta.push("Priorizar controle de composição corporal, cintura/quadril e evolução gradual de cargas.");
  conduta.push("Reavaliar em 30 a 45 dias ou conforme conduta do professor.");
  return { resumo: atencao.length ? "Acompanhamento recomendado" : "Evolução controlada", pontos: pontos.length ? pontos : ["Dados principais registrados para acompanhamento."], atencao: atencao.length ? atencao : ["Nenhum alerta crítico gerado pelos dados preenchidos."], conduta };
}
function calcular() {
  const peso = numero(valorCampo("peso")); const alturaRaw = numero(valorCampo("altura")); const altura = alturaRaw > 3 ? alturaRaw / 100 : alturaRaw;
  const imc = peso > 0 && altura > 0 ? peso / (altura * altura) : 0; setCampo("imc", imc ? imc.toFixed(2) : ""); setCampo("classificacao_imc", classificarIMC(imc));
  const gordura = numero(valorCampo("percentual_gordura"));
  if (peso > 0 && gordura > 0) { const mg = peso * gordura / 100; setCampo("massa_gorda", mg.toFixed(2)); setCampo("massa_magra", (peso - mg).toFixed(2)); setCampo("composicao_resultado", gordura > numero(valorCampo("percentual_ideal")) ? "Acima do ideal" : "Dentro do alvo"); }
  setCampo("tmb", peso > 0 ? Math.round(22 * peso) : "");
  const cintura = numero(valorCampo("cintura")); const quadril = numero(valorCampo("quadril")); const rcq = cintura > 0 && quadril > 0 ? cintura / quadril : 0; setText("rcq", rcq ? rcq.toFixed(2).replace('.',',') : "0,00"); setCampo("rcq_hidden", rcq ? rcq.toFixed(2) : "");
  setText("rcq_classificacao", classificarRCQValor(rcq, valorCampo("risco_sexo")));
  const perims = ["ombro","braco_relaxado_direito","braco_relaxado_esquerdo","braco_contraido_direito","braco_contraido_esquerdo","antebraco_direito","antebraco_esquerdo","torax_relaxado","torax_inspirado","cintura","abdomen","quadril","coxa_proximal_direita","coxa_proximal_esquerda","coxa_medial_direita","coxa_medial_esquerda","panturrilha_direita","panturrilha_esquerda","pescoco","punho","biestiloide","biepicondilo_umeral","biepicondilo_femural","bimaleolar"];
  const soma = perims.reduce((s,id)=>s+numero(valorCampo(id)),0); setText("soma_perimetros", soma.toFixed(2).replace('.',','));
  setText("rcq_cintura_view", valorCampo("cintura") || "0,00");
  setText("rcq_quadril_view", valorCampo("quadril") || "0,00");
  const risco = ["risco_idade","risco_sexo","risco_peso","risco_exercicio","risco_historico","risco_tabagismo","risco_colesterol","risco_pas"].reduce((s,id)=>s+numero(valorCampo(id)),0); setText("risco_pontuacao", risco); const pct = Math.min(100, risco / 62 * 100); const rb = $("#riscoBarra"); if (rb) rb.style.height = `${Math.max(4,pct)}%`; setText("risco_classificacao", risco <= 0 ? "Informações insuficientes" : risco <= 11 ? "Risco bem abaixo da média" : risco <= 17 ? "Risco abaixo da média" : risco <= 24 ? "Risco médio" : risco <= 31 ? "Risco moderado" : risco <= 40 ? "Risco alto" : "Risco muito alto");
  const vo2 = numero(valorCampo("vo2_obtido")); const previsto = peso > 0 ? (50 - Math.max(0, imc - 22)).toFixed(2) : ""; setCampo("vo2_previsto", previsto); setCampo("deficit_aerobico", vo2 && previsto ? Math.max(0, Number(previsto) - vo2).toFixed(2) : "");
  atualizarRelatorio();
}

function camposTexto() { return ["data","hora","objetivo","pratica_atividade","medicamentos","cirurgias","doencas_familia","observacoes","risco_idade","risco_sexo","risco_peso","risco_exercicio","risco_historico","risco_tabagismo","risco_colesterol","risco_pas","peso","altura","imc","classificacao_imc","percentual_gordura","percentual_ideal","agua_corporal","massa_magra","massa_gorda","tmb","protocolo_dobras","subescapular","bicipital","tricipital","axilar_media","supra_iliaca","peitoral","dobra_abdominal","dobra_coxa","dobra_panturrilha","massa_magra_manual","massa_gorda_manual","gordura_visceral","idade_metabolica","ombro","braco_relaxado_direito","braco_relaxado_esquerdo","braco_contraido_direito","braco_contraido_esquerdo","antebraco_direito","antebraco_esquerdo","torax_relaxado","torax_inspirado","cintura","abdomen","quadril","coxa_proximal_direita","coxa_proximal_esquerda","coxa_medial_direita","coxa_medial_esquerda","panturrilha_direita","panturrilha_esquerda","pescoco","punho","biestiloide","biepicondilo_umeral","biepicondilo_femural","bimaleolar","vo2_obtido","vo2_previsto","deficit_aerobico","flexao_bracos","abdominal_repeticoes","banco_wells"]; }
function coletar() {
  const alunoId = valorCampo("aluno_id"); const aluno = alunoPorId(alunoId); const profId = valorCampo("professor_id");
  const dados = { aluno_id: alunoId, alunoId, alunoNome: nomeAluno(aluno || {}), professor_id: profId, professorId: profId, professorNome: valorCampo("professorNome") };
  camposTexto().forEach(c => { const v = valorCampo(c); if (v !== "") dados[c] = v; });
  dados.rcq = texto($("#rcq")?.textContent).replace(',', '.'); dados.soma_perimetros = texto($("#soma_perimetros")?.textContent).replace(',', '.'); dados.rcq_classificacao = texto($("#rcq_classificacao")?.textContent); dados.risco_pontuacao = texto($("#risco_pontuacao")?.textContent); dados.risco_classificacao = texto($("#risco_classificacao")?.textContent);
  dados.condicao_fisica = radioValor("condicao_fisica"); dados.protocolo_cardio = radioValor("protocolo_cardio");
  dados.parq = Array.from(document.querySelectorAll("[data-parq]")).map(el => ({ pergunta: el.dataset.parq, resposta: document.querySelector(`input[name="${el.name}"]:checked`)?.value || "" }));
  dados.fotos = { foto_frente: valorCampo("foto_frente_base64"), foto_costas: valorCampo("foto_costas_base64"), foto_lateral_direita: valorCampo("foto_lateral_direita_base64"), foto_lateral_esquerda: valorCampo("foto_lateral_esquerda_base64") };
  if (!dados.data) dados.data = dataHoje(); const diag = diagnosticoCompleto(dados); dados.diagnostico_ia = diag.resumo; dados.diagnostico_pontos = diag.pontos; dados.diagnostico_atencao = diag.atencao; dados.diagnostico_conduta = diag.conduta; return dados;
}

async function salvar(ev) {
  ev?.preventDefault();
  const btn = document.getElementById('btnSalvar');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    calcular();
    const dados = coletar();
    if (!dados.aluno_id) return mostrarAlerta("Selecione o aluno.", "erro");
    if (!dados.professor_id && professorIdUrl) {
      dados.professor_id = professorIdUrl;
      dados.professorId = professorIdUrl;
      dados.professorNome = professorNomeUrl || nomeProfessor(professorPorId(professorIdUrl) || {}) || dados.professorNome;
    }
    if (!dados.professor_id) return mostrarAlerta("Este aluno não possui professor responsável vinculado. Vincule o professor no cadastro do aluno antes de avaliar.", "erro");
    const id = avaliacaoAtual?.id || valorCampo("id");
    const resp = await fetch(id ? `${API_AVALIACOES}/${encodeURIComponent(id)}` : API_AVALIACOES, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    const j = await safeJson(resp);
    if (!resp.ok || j.ok === false || j.erro) return mostrarAlerta(j.mensagem || j.erro || `Erro HTTP ${resp.status}`, "erro");
    mostrarAlerta(id ? "Avaliação atualizada." : "Avaliação cadastrada.", "sucesso");
    fecharModal();
    await carregarBases();
  } catch (erro) {
    mostrarAlerta(erro.message || 'Erro ao salvar avaliação.', 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar avaliação'; }
  }
}

function preencher(av) {
  $("#form")?.reset(); avaliacaoAtual = av; setCampo("id", av.id); setCampo("aluno_id", av.alunoId || av.aluno_id); sincronizarAlunoProfessor(); setCampo("avaliacaoNumero", av.id || "nova"); setModoAvaliacao("editar"); camposTexto().forEach(c => setCampo(c, av[c] ?? "")); if (av.professorId || av.professor_id) setCampo("professor_id", av.professorId || av.professor_id); if (av.professorNome) { setCampo("professorNome", av.professorNome); setText("professorNomeDisplay", av.professorNome); }
  setRadio("condicao_fisica", av.condicao_fisica); setRadio("protocolo_cardio", av.protocolo_cardio); if (av.fotos) { Object.entries(av.fotos).forEach(([k,v])=>{ setCampo(`${k}_base64`, v); renderFoto(k, v); }); } calcular();
}
window.editarAvaliacao = function(id) { const av = avaliacoes.find(a => String(a.id) === String(id)); if (!av) return mostrarAlerta("Avaliação não encontrada.", "erro"); preencher(av); abrirModal("Editar avaliação"); trocarTab("anamnese"); };
window.excluirAvaliacao = async function(id) { if (!confirm("Excluir esta avaliação?")) return; const resp = await fetch(`${API_AVALIACOES}/${encodeURIComponent(id)}`, { method: "DELETE" }); const j = await safeJson(resp); if (!resp.ok || j.erro) return mostrarAlerta(j.mensagem || j.erro || `Erro HTTP ${resp.status}`, "erro"); mostrarAlerta("Avaliação excluída.", "sucesso"); await carregarBases(); };
window.imprimirAvaliacao = function(id) { const av = avaliacoes.find(a => String(a.id) === String(id)); if (av) preencher(av); atualizarRelatorio(); const w = window.open("", "_blank"); w.document.write(`<html><head><title>Avaliação</title><style>body{font-family:Arial;padding:24px}h1{color:#ff6600}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px}</style></head><body>${$("#relatorioPreview").innerHTML}</body></html>`); w.document.close(); w.print(); };

function atualizarRelatorio() {
  const aluno = alunoPorId(valorCampo("aluno_id"));
  const dados = coletar();
  const diag = diagnosticoCompleto(dados);
  const anterior = avaliacaoAnteriorDoAluno(dados.aluno_id, valorCampo("id"));
  const comp = anterior ? `
    <h3>Comparativo com avaliação anterior</h3>
    <table><tr><th>Indicador</th><th>Atual</th><th>Anterior</th><th>Variação</th></tr>
      <tr><td>Peso</td><td>${esc(dados.peso || '-')} kg</td><td>${esc(anterior.peso || '-')} kg</td><td>${esc(deltaAtualAnterior(dados.peso, anterior.peso).texto)} kg</td></tr>
      <tr><td>IMC</td><td>${esc(dados.imc || '-')}</td><td>${esc(anterior.imc || '-')}</td><td>${esc(deltaAtualAnterior(dados.imc, anterior.imc).texto)}</td></tr>
      <tr><td>Gordura</td><td>${esc(dados.percentual_gordura || '-')}%</td><td>${esc(anterior.percentual_gordura || '-')}%</td><td>${esc(deltaAtualAnterior(dados.percentual_gordura, anterior.percentual_gordura).texto)} p.p.</td></tr>
      <tr><td>RCQ</td><td>${esc(dados.rcq || '-')}</td><td>${esc(anterior.rcq || '-')}</td><td>${esc(deltaAtualAnterior(dados.rcq, anterior.rcq).texto)}</td></tr>
      <tr><td>Massa magra</td><td>${esc(dados.massa_magra || '-')} kg</td><td>${esc(anterior.massa_magra || '-')} kg</td><td>${esc(deltaAtualAnterior(dados.massa_magra, anterior.massa_magra).texto)} kg</td></tr>
    </table>` : `<h3>Comparativo</h3><p>Sem avaliação anterior para comparação.</p>`;
  const html = `<div class="print-report"><h1>Fusion ERP - Avaliação Física</h1>
    <p><strong>Aluno:</strong> ${esc(nomeAluno(aluno || {}) || "-")} &nbsp; <strong>Professor:</strong> ${esc(valorCampo("professorNome") || "-")}</p>
    <p><strong>Data:</strong> ${esc(valorCampo("data") || "-")} &nbsp; <strong>Objetivo:</strong> ${esc(valorCampo("objetivo") || "-")}</p>
    <h3>Diagnóstico automático</h3><p><strong>${esc(diag.resumo)}</strong></p>
    <div class="report-grid"><div><h4>Pontos positivos</h4>${diag.pontos.map(x=>`<p>✓ ${esc(x)}</p>`).join('')}</div><div><h4>Pontos de atenção</h4>${diag.atencao.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><div><h4>Conduta sugerida</h4>${diag.conduta.map(x=>`<p>→ ${esc(x)}</p>`).join('')}</div></div>
    <h3>Composição</h3><div class="grid"><p>Peso: ${esc(valorCampo("peso") || "-")}</p><p>Altura: ${esc(valorCampo("altura") || "-")}</p><p>IMC: ${esc(valorCampo("imc") || "-")}</p><p>Classificação: ${esc(valorCampo("classificacao_imc") || "-")}</p><p>Gordura: ${esc(valorCampo("percentual_gordura") || "-")}%</p><p>Massa magra: ${esc(valorCampo("massa_magra") || "-")}</p><p>Massa gorda: ${esc(valorCampo("massa_gorda") || "-")}</p><p>TMB: ${esc(valorCampo("tmb") || "-")}</p></div>
    <h3>Perímetros / RCQ</h3><p>RCQ: ${esc(texto($("#rcq")?.textContent) || "-")} · ${esc(texto($("#rcq_classificacao")?.textContent) || "-")} · Cintura: ${esc(valorCampo("cintura") || "-")} · Quadril: ${esc(valorCampo("quadril") || "-")} · Somatório: ${esc(texto($("#soma_perimetros")?.textContent) || "-")}</p>
    ${comp}
    <h3>Risco coronariano</h3><p>${esc(texto($("#risco_classificacao")?.textContent) || "-")} (${esc(texto($("#risco_pontuacao")?.textContent) || "0")} pontos)</p>
    <h3>Observações</h3><p>${esc(valorCampo("observacoes") || "-")}</p><br><p>___________________________________<br>Assinatura do avaliador</p></div>`;
  const el = $("#relatorioPreview"); if (el) el.innerHTML = html;
}

function aplicarParametrosUrl() {
  const params = new URLSearchParams(location.search);
  const alunoId = params.get("alunoId") || params.get("aluno_id");
  const professorId = params.get("professorId") || params.get("professor_id");
  const avaliacaoId = params.get("avaliacaoId") || params.get("avaliacao_id") || params.get("id");
  if (professorId) {
    professorIdUrl = professorId;
    const p = professorPorId(professorId);
    professorNomeUrl = nomeProfessor(p || {});
    setCampo("professor_id", professorId);
    setCampo("professorNome", professorNomeUrl);
    setText("professorNomeDisplay", professorNomeUrl || "Professor informado pela tela anterior");
  }
  if (alunoId) { setCampo("filtroAluno", alunoId); setCampo("aluno_id", alunoId); sincronizarAlunoProfessor(); }
  if (params.get("nova") === "1") setTimeout(novaAvaliacao, 120);
  if (params.get("editar") === "1") {
    setTimeout(() => {
      let av = avaliacaoId ? avaliacoes.find(a => String(a.id) === String(avaliacaoId)) : null;
      if (!av && alunoId) {
        av = avaliacoes.filter(a => texto(a.alunoId || a.aluno_id) === texto(alunoId))
          .sort((a,b)=>texto(b.data || b.criadoEm || b.criado_em).localeCompare(texto(a.data || a.criadoEm || a.criado_em)))[0] || null;
      }
      if (av) window.editarAvaliacao(av.id);
      else if (alunoId) novaAvaliacao();
      else renderizar();
    }, 180);
  }
}

function renderParq() { const perguntas = ["Alguma vez um médico lhe disse que você possui problema do coração e recomendou atividade física supervisionada?","Você sente dor no peito causada pela prática de atividade física?","Você sentiu dor no peito no último mês?","Você tende a perder a consciência ou cair por tontura ou desmaio?","Você tem problema ósseo ou muscular que poderia ser agravado pela prática de atividade física?","Algum médico já recomendou medicamento para pressão arterial, circulação ou coração?","Você tem outra razão para procurar orientação médica antes de praticar atividade física?"]; const box = $("#parqBox"); if (!box) return; box.innerHTML = perguntas.map((p,i)=>`<div class="parq-item"><span>${i+1}. ${esc(p)}</span><label><input data-parq="${esc(p)}" name="parq_${i}" type="radio" value="sim"> Sim</label><label><input name="parq_${i}" type="radio" value="nao"> Não</label></div>`).join(""); }
function renderFoto(id, base64) { const prev = $(`#prev_${id}`); if (!prev) return; const rotulo = prev.dataset.rotulo || prev.textContent || "Foto postural"; prev.dataset.rotulo = rotulo; prev.innerHTML = base64 ? `<img src="${base64}" alt="Foto">` : `<span>${esc(rotulo)}</span>`; }
function lerFoto(input) { const arq = input.files?.[0]; if (!arq) return; const reader = new FileReader(); reader.onload = () => { setCampo(`${input.id}_base64`, reader.result); renderFoto(input.id, reader.result); }; reader.readAsDataURL(arq); }


/* Fusion ERP 2.7.6 P1 — IA de Avaliação Física por Voz */
const AVAL_VOZ_KEY = 'fusion_avaliacao_voz_ativa';
let avaliacaoVozAtiva = false;
let avaliacaoReconhecimento = null;
let avaliacaoReconhecimentoRodando = false;
let avaliacaoUltimaInstrucao = 'Fale uma medida, por exemplo: peso oitenta e dois vírgula quatro, cintura noventa, quadril cento e dois.';

function suporteVozAvaliacao(){
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function falarAvaliacao(texto){
  avaliacaoUltimaInstrucao = texto || avaliacaoUltimaInstrucao;
  try{
    if(!('speechSynthesis' in window) || !texto) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    fala.rate = 0.95;
    fala.pitch = 1;
    window.speechSynthesis.speak(fala);
  }catch{}
}

function setStatusVozAvaliacao(texto, tipo=''){
  const st = document.getElementById('avaliacaoVozStatus');
  const box = document.getElementById('avaliacaoVozBox');
  const btn = document.getElementById('btnVozAvaliacao');
  if(st) st.textContent = texto || (avaliacaoVozAtiva ? 'Ouvindo medidas.' : 'Pronto para ouvir o professor.');
  if(box){
    box.classList.toggle('ouvindo', avaliacaoVozAtiva);
    box.classList.toggle('erro', tipo === 'erro');
  }
  if(btn){
    btn.textContent = avaliacaoVozAtiva ? '■ Parar voz' : '🎙️ Iniciar voz';
    btn.classList.toggle('danger', avaliacaoVozAtiva);
  }
}

function setTranscricaoAvaliacao(texto){
  const el = document.getElementById('avaliacaoVozTranscricao');
  if(el) el.textContent = texto || '';
}

function numeroPorExtensoPT(textoOriginal){
  let s = normalizar(textoOriginal)
    .replace(/\bvirgula\b|\bponto\b/g, ',')
    .replace(/\bmetro[s]?\b|\bquilo[s]?\b|\bquilos\b|\bkg\b|\bcentimetro[s]?\b|\bcm\b/g, ' ')
    .replace(/\be\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const direto = s.match(/\d+(?:[\.,]\d+)?/);
  if(direto) return Number(direto[0].replace(',', '.'));

  const unidades = {zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9};
  const especiais = {dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezassseis:16,dezessete:17,dezoito:18,dezenove:19};
  const dezenas = {vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90};
  const centenas = {cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900};

  function parseParte(parte){
    let total = 0;
    for(const token of parte.split(/\s+/).filter(Boolean)){
      if(centenas[token] !== undefined) total += centenas[token];
      else if(dezenas[token] !== undefined) total += dezenas[token];
      else if(especiais[token] !== undefined) total += especiais[token];
      else if(unidades[token] !== undefined) total += unidades[token];
    }
    return total;
  }

  const partes = s.split(',').map(x => x.trim()).filter(Boolean);
  if(!partes.length) return NaN;
  const inteiro = parseParte(partes[0]);
  if(partes.length === 1) return inteiro || NaN;
  const dec = parseParte(partes[1]);
  const casas = dec < 10 ? 10 : 100;
  return inteiro + (dec / casas);
}

function formatarNumeroAvaliacao(n, campo=''){
  if(!Number.isFinite(n)) return '';
  if(campo === 'altura'){
    if(n > 3) n = n / 100;
    return String(Number(n.toFixed(2))).replace('.', ',');
  }
  return String(Number(n.toFixed(2))).replace('.', ',');
}

const MAPA_MEDIDAS_VOZ = [
  {rx:/\bpeso\b/, campo:'peso', rotulo:'Peso'},
  {rx:/\baltura\b|\bestatura\b/, campo:'altura', rotulo:'Altura'},
  {rx:/\bpesco[cç]o\b/, campo:'pescoco', rotulo:'Pescoço'},
  {rx:/\bpunho\b/, campo:'punho', rotulo:'Punho'},
  {rx:/\bombr[oo]s?\b/, campo:'ombro', rotulo:'Ombro'},
  {rx:/\bbra[cç]o\s+relaxado\s+direit[oa]\b/, campo:'braco_relaxado_direito', rotulo:'Braço relaxado direito'},
  {rx:/\bbra[cç]o\s+relaxado\s+esquerd[oa]\b/, campo:'braco_relaxado_esquerdo', rotulo:'Braço relaxado esquerdo'},
  {rx:/\bbra[cç]o\s+contra[ií]do\s+direit[oa]\b/, campo:'braco_contraido_direito', rotulo:'Braço contraído direito'},
  {rx:/\bbra[cç]o\s+contra[ií]do\s+esquerd[oa]\b/, campo:'braco_contraido_esquerdo', rotulo:'Braço contraído esquerdo'},
  {rx:/\bbra[cç]o\s+direit[oa]\b/, campo:'braco_relaxado_direito', rotulo:'Braço direito'},
  {rx:/\bbra[cç]o\s+esquerd[oa]\b/, campo:'braco_relaxado_esquerdo', rotulo:'Braço esquerdo'},
  {rx:/\bantebra[cç]o\s+direit[oa]\b/, campo:'antebraco_direito', rotulo:'Antebraço direito'},
  {rx:/\bantebra[cç]o\s+esquerd[oa]\b/, campo:'antebraco_esquerdo', rotulo:'Antebraço esquerdo'},
  {rx:/\bt[oó]rax\s+inspirado\b/, campo:'torax_inspirado', rotulo:'Tórax inspirado'},
  {rx:/\bt[oó]rax\s+relaxado\b|\bt[oó]rax\b/, campo:'torax_relaxado', rotulo:'Tórax'},
  {rx:/\bcintura\b/, campo:'cintura', rotulo:'Cintura'},
  {rx:/\babd[oô]men\b|\babdominal\b/, campo:'abdomen', rotulo:'Abdômen'},
  {rx:/\bquadril\b/, campo:'quadril', rotulo:'Quadril'},
  {rx:/\bcoxa\s+proximal\s+direit[oa]\b/, campo:'coxa_proximal_direita', rotulo:'Coxa proximal direita'},
  {rx:/\bcoxa\s+proximal\s+esquerd[oa]\b/, campo:'coxa_proximal_esquerda', rotulo:'Coxa proximal esquerda'},
  {rx:/\bcoxa\s+medial\s+direit[oa]\b|\bcoxa\s+direit[oa]\b/, campo:'coxa_medial_direita', rotulo:'Coxa direita'},
  {rx:/\bcoxa\s+medial\s+esquerd[oa]\b|\bcoxa\s+esquerd[oa]\b/, campo:'coxa_medial_esquerda', rotulo:'Coxa esquerda'},
  {rx:/\bpanturrilha\s+direit[oa]\b/, campo:'panturrilha_direita', rotulo:'Panturrilha direita'},
  {rx:/\bpanturrilha\s+esquerd[oa]\b/, campo:'panturrilha_esquerda', rotulo:'Panturrilha esquerda'},
  {rx:/\bgordura\b|\bpercentual\s+de\s+gordura\b/, campo:'percentual_gordura', rotulo:'Percentual de gordura'},
  {rx:/\bdobra\s+abdominal\b/, campo:'dobra_abdominal', rotulo:'Dobra abdominal'},
  {rx:/\bdobra\s+coxa\b/, campo:'dobra_coxa', rotulo:'Dobra da coxa'},
  {rx:/\bdobra\s+panturrilha\b/, campo:'dobra_panturrilha', rotulo:'Dobra da panturrilha'},
  {rx:/\bpeitoral\b/, campo:'peitoral', rotulo:'Peitoral'}
];

function extrairMedidasDaFala(fala){
  const original = texto(fala);
  const n = normalizar(original);
  const encontrados = [];
  for(const item of MAPA_MEDIDAS_VOZ){
    const match = n.match(item.rx);
    if(!match) continue;
    const inicio = match.index + match[0].length;
    const depois = n.slice(inicio, inicio + 70)
      .replace(/^\s*(de|com|igual|mede|medindo|valor|foi|e|eh|é)\s+/, '')
      .trim();
    const valor = numeroPorExtensoPT(depois);
    if(Number.isFinite(valor) && valor > 0){
      encontrados.push({ ...item, valor, textoValor: depois });
    }
  }
  return encontrados;
}

function aplicarMedidasPorVoz(fala){
  const medidas = extrairMedidasDaFala(fala);
  if(!medidas.length){
    setStatusVozAvaliacao('Não entendi nenhuma medida. Repita informando o nome e o valor.', 'erro');
    falarAvaliacao('Não entendi nenhuma medida. Repita informando o nome e o valor.');
    return;
  }
  const aplicadas = [];
  for(const m of medidas){
    const el = document.getElementById(m.campo);
    if(!el) continue;
    const valor = formatarNumeroAvaliacao(m.valor, m.campo);
    setCampo(m.campo, valor);
    el.classList.add('campo-preenchido-voz');
    setTimeout(() => el.classList.remove('campo-preenchido-voz'), 1800);
    aplicadas.push(`${m.rotulo}: ${valor}`);
  }
  calcular();
  atualizarRelatorio();
  if(aplicadas.length){
    const msg = `Registrado: ${aplicadas.join(', ')}.`;
    setStatusVozAvaliacao(msg);
    setTranscricaoAvaliacao(`${fala}\n→ ${msg}`);
    falarAvaliacao(msg);
  }else{
    setStatusVozAvaliacao('As medidas foram entendidas, mas os campos não foram encontrados.', 'erro');
  }
}

function tratarComandoAvaliacaoVoz(fala){
  const n = normalizar(fala);
  if(!n) return;
  setTranscricaoAvaliacao(fala);
  if(/\b(parar|encerrar|desligar microfone|finalizar voz)\b/.test(n)){ alternarVozAvaliacao(false); return; }
  if(/\b(repetir|repete|instru[cç][aã]o)\b/.test(n)){ falarAvaliacao(avaliacaoUltimaInstrucao); return; }
  if(/\bproxima aba\b|\bpr[oó]xima\b/.test(n)){ navegarAbaAvaliacao(1); return; }
  if(/\baba anterior\b|\bvoltar aba\b/.test(n)){ navegarAbaAvaliacao(-1); return; }
  aplicarMedidasPorVoz(fala);
}

function navegarAbaAvaliacao(delta){
  const abas = Array.from(document.querySelectorAll('.sca-tabs .tab'));
  const idx = abas.findIndex(b => b.classList.contains('active'));
  const prox = abas[Math.max(0, Math.min(abas.length - 1, idx + delta))];
  if(prox){
    trocarTab(prox.dataset.tab);
    falarAvaliacao(`Aba ${prox.textContent.trim()}.`);
  }
}

function iniciarReconhecimentoAvaliacao(){
  if(!avaliacaoVozAtiva || avaliacaoReconhecimentoRodando || !suporteVozAvaliacao()) return;
  try{
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    avaliacaoReconhecimento = avaliacaoReconhecimento || new Ctor();
    avaliacaoReconhecimento.lang = 'pt-BR';
    avaliacaoReconhecimento.continuous = true;
    avaliacaoReconhecimento.interimResults = false;
    avaliacaoReconhecimento.maxAlternatives = 1;
    avaliacaoReconhecimento.onstart = () => { avaliacaoReconhecimentoRodando = true; setStatusVozAvaliacao('Ouvindo medidas do professor.'); };
    avaliacaoReconhecimento.onend = () => {
      avaliacaoReconhecimentoRodando = false;
      if(avaliacaoVozAtiva) setTimeout(iniciarReconhecimentoAvaliacao, 450);
      else setStatusVozAvaliacao('Voz desligada.');
    };
    avaliacaoReconhecimento.onerror = () => { avaliacaoReconhecimentoRodando = false; setStatusVozAvaliacao('Microfone indisponível ou bloqueado.', 'erro'); };
    avaliacaoReconhecimento.onresult = ev => {
      const fala = ev.results?.[ev.results.length - 1]?.[0]?.transcript || '';
      tratarComandoAvaliacaoVoz(fala);
    };
    avaliacaoReconhecimento.start();
  }catch{
    avaliacaoReconhecimentoRodando = false;
    setStatusVozAvaliacao('Não foi possível iniciar o microfone.', 'erro');
  }
}

function pararReconhecimentoAvaliacao(){
  try{ avaliacaoReconhecimento?.stop?.(); }catch{}
  avaliacaoReconhecimentoRodando = false;
}

function alternarVozAvaliacao(forcar){
  const novo = typeof forcar === 'boolean' ? forcar : !avaliacaoVozAtiva;
  if(novo && !suporteVozAvaliacao()){
    mostrarAlerta('Reconhecimento de voz indisponível neste navegador. Use Chrome no Android ou desktop.', 'erro');
    return;
  }
  avaliacaoVozAtiva = novo;
  localStorage.setItem(AVAL_VOZ_KEY, avaliacaoVozAtiva ? '1' : '0');
  setStatusVozAvaliacao(avaliacaoVozAtiva ? 'Ouvindo medidas do professor.' : 'Voz desligada.');
  if(avaliacaoVozAtiva){
    falarAvaliacao('Avaliação por voz ativada. Fale o nome da medida e o valor.');
    iniciarReconhecimentoAvaliacao();
  }else{
    pararReconhecimentoAvaliacao();
    falarAvaliacao('Avaliação por voz encerrada.');
  }
}

function inicializar() {
  if (MODO_EMBED) document.body.classList.add('modo-embed-avaliacao');
  renderParq();
  document.getElementById("btnVozAvaliacao")?.addEventListener("click", () => alternarVozAvaliacao());
  document.getElementById("btnRepetirVozAvaliacao")?.addEventListener("click", () => falarAvaliacao(avaliacaoUltimaInstrucao));
  setStatusVozAvaliacao("Pronto para ouvir o professor.");
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => trocarTab(b.dataset.tab)));
  document.querySelectorAll(".subtab").forEach(b => b.addEventListener("click", () => { document.querySelectorAll(".subtab").forEach(x=>x.classList.toggle("active", x === b)); document.querySelectorAll(".subpanel").forEach(p=>p.classList.toggle("active", p.id === b.dataset.sub)); }));
  // Página administrativa de avaliações: histórico/consulta.
  // A criação de nova avaliação deve ocorrer pelo Portal do Professor.
  $("#btnAtualizar")?.addEventListener("click", carregarBases); $("#btnFechar")?.addEventListener("click", fecharModal); $("#btnCancelar")?.addEventListener("click", fecharModal); $("#btnImprimir")?.addEventListener("click", () => window.imprimirAvaliacao(avaliacaoAtual?.id)); $("#form")?.addEventListener("submit", salvar);
  $("#aluno_id")?.addEventListener("change", () => { sincronizarAlunoProfessor(); setCampo("avaliacaoNumero", "nova"); setModoAvaliacao("nova"); calcular(); });
  $("#avaliacaoNumero")?.addEventListener("change", selecionarAvaliacaoNumero);
  document.querySelectorAll("[data-avmodo]").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.avmodo === "editar") {
      const sel = $("#avaliacaoNumero");
      const primeiraExistente = Array.from(sel?.options || []).find(opt => opt.value && opt.value !== "nova");
      if (primeiraExistente) { sel.value = primeiraExistente.value; selecionarAvaliacaoNumero(); }
      else mostrarAlerta("Nenhuma avaliação anterior encontrada para editar.", "erro");
      return;
    }
    setCampo("avaliacaoNumero", "nova"); selecionarAvaliacaoNumero();
  }));
  $("#btnLimpar")?.addEventListener("click", () => { setCampo("busca", ""); setCampo("filtroAluno", ""); setCampo("filtroMes", ""); renderizar(); });
  ["busca","filtroAluno","filtroMes"].forEach(id => { document.getElementById(id)?.addEventListener("input", renderizar); document.getElementById(id)?.addEventListener("change", renderizar); });
  document.querySelectorAll("input,select,textarea").forEach(el => el.addEventListener("input", calcular));
  ["foto_frente","foto_costas","foto_lateral_direita","foto_lateral_esquerda"].forEach(id => { renderFoto(id, ""); document.getElementById(id)?.addEventListener("change", e => lerFoto(e.target)); });
  document.getElementById("risco_sexo")?.addEventListener("change", () => { atualizarFiguraSexo(); calcular(); });
  carregarBases().catch(e => mostrarAlerta(e.message || "Erro ao carregar avaliações.", "erro"));
}
inicializar();


/* Fusion ERP 2.7.6 P2B — Avaliação Física Mobile */
(function(){
  const $m = (s) => document.querySelector(s);
  const $$m = (s) => Array.from(document.querySelectorAll(s));

  function isMobileAvaliacao(){
    return window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
  }

  function atualizarResumoMobileAvaliacao(){
    const imc = $m('#imc')?.value || '-';
    const rcq = ($m('#rcq')?.textContent || '').trim() || '-';
    const imcEl = $m('#mobileResumoImc');
    const rcqEl = $m('#mobileResumoRcq');
    if(imcEl) imcEl.textContent = imc || '-';
    if(rcqEl) rcqEl.textContent = rcq || '-';
  }

  function ativarTecladoNumericoAvaliacao(){
    const idsDecimal = [
      'peso','altura','percentual_gordura','percentual_ideal','agua_corporal','massa_magra','massa_gorda','massa_magra_manual','massa_gorda_manual',
      'pescoco','punho','ombro','braco_relaxado_direito','braco_relaxado_esquerdo','braco_contraido_direito','braco_contraido_esquerdo',
      'antebraco_direito','antebraco_esquerdo','torax_relaxado','torax_inspirado','cintura','abdomen','quadril',
      'coxa_proximal_direita','coxa_proximal_esquerda','coxa_medial_direita','coxa_medial_esquerda','panturrilha_direita','panturrilha_esquerda',
      'subescapular','bicipital','tricipital','axilar_media','supra_iliaca','peitoral','dobra_abdominal','dobra_coxa','dobra_panturrilha',
      'vo2_obtido','banco_wells','gordura_visceral'
    ];
    idsDecimal.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.setAttribute('inputmode', 'decimal');
      el.setAttribute('autocomplete', 'off');
    });
    ['idade_metabolica','flexao_bracos','abdominal_repeticoes'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.setAttribute('inputmode', 'numeric');
      el.setAttribute('autocomplete', 'off');
    });
  }

  function prepararAbasMobileAvaliacao(){
    $$m('.sca-tabs .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if(isMobileAvaliacao()) setTimeout(() => btn.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}), 40);
      });
    });
  }

  function ligarBotaoVozMobile(){
    const btn = $m('#btnMobileVozAvaliacao');
    if(!btn) return;
    btn.addEventListener('click', () => {
      const original = $m('#btnVozAvaliacao');
      if(original) original.click();
    });
  }

  function observarFormularioMobile(){
    const form = $m('#form');
    if(!form) return;
    form.addEventListener('input', () => setTimeout(atualizarResumoMobileAvaliacao, 20));
    form.addEventListener('change', () => setTimeout(atualizarResumoMobileAvaliacao, 20));
  }

  function inicializarMobileAvaliacaoP2B(){
    document.body.classList.add('avaliacao-mobile-p2b-ready');
    ativarTecladoNumericoAvaliacao();
    prepararAbasMobileAvaliacao();
    ligarBotaoVozMobile();
    observarFormularioMobile();
    atualizarResumoMobileAvaliacao();
    setInterval(atualizarResumoMobileAvaliacao, 1200);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializarMobileAvaliacaoP2B);
  else setTimeout(inicializarMobileAvaliacaoP2B, 0);
})();


// Fusion ERP — proteção visual extra para avaliação no Portal Professor
if (PORTAL_PROFESSOR) {
  document.addEventListener('DOMContentLoaded', () => document.body.classList.add('modo-professor-avaliacao'));
}

// Fusion ERP v5 — liga botões após carregar a tela sem quebrar o script principal.
document.addEventListener('DOMContentLoaded', () => {
  const btnNovaMobile = document.getElementById('btnNovaMobile');
  if (btnNovaMobile) btnNovaMobile.addEventListener('click', novaAvaliacao);
});
