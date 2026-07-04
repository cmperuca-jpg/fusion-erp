const API_TREINOS = "/api/treinos";
const API_ALUNOS = "/api/alunos";
const API_PROFESSORES = "/api/professores";
const API_TREINOS_OPERACIONAL = "/api/treinos-operacional";

let treinos = [];
let alunos = [];
let professores = [];
let exercicios = [];
let editandoId = "";
let execucaoAtual = null;
let treinoExecucaoAtual = null;
let execucaoIndiceAtual = 0;
let execucaoInicioMs = 0;
let execucaoTimer = null;
let descansoTimer = null;
let descansoRestante = 0;
let progressaoAtual = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const params = new URLSearchParams(location.search);
const EMBED = params.get("embed") === "1";

function esc(v) { return String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function norm(v) { return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function dataHoje() { return new Date().toISOString().slice(0, 10); }
function dataFutura(dias = 45) { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
function idAluno(a = {}) { return String(a.id || a._id || a.alunoId || a.aluno_id || ""); }
function idProfessor(p = {}) { return String(p.id || p._id || p.professorId || p.professor_id || ""); }
function nomeAluno(a = {}) { return a.nome || a.alunoNome || a.name || "Aluno"; }
function nomeProfessor(p = {}) { return p.nome || p.professorNome || p.name || "Professor"; }
function professorAtivo(p = {}) { const st = norm(p.status || "ativo"); return !st || ["ativo", "ativa"].includes(st); }
function alunoPorId(id) { return alunos.find(a => idAluno(a) === String(id)) || null; }
function professorPorId(id) { return professores.find(p => idProfessor(p) === String(id)) || null; }

async function safeJson(resp) { try { return await resp.json(); } catch { return {}; } }
function extrairLista(payload, chave) {
  if (Array.isArray(payload)) return payload;
  return payload?.[chave] || payload?.dados || payload?.data || payload?.itens || payload?.registros || [];
}

function mostrar(msg, tipo = "erro") {
  const el = $("#alerta");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.className = `alert ${tipo}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 8000);
}

async function carregar() {
  const tbody = $("#tabela");
  if (tbody) tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

  try {
    const [ra, rp, rt] = await Promise.all([
      fetch(API_ALUNOS, { cache: "no-store" }),
      fetch(API_PROFESSORES, { cache: "no-store" }),
      fetch(API_TREINOS, { cache: "no-store" })
    ]);

    const ja = await safeJson(ra);
    const jp = await safeJson(rp);
    const jt = await safeJson(rt);

    if (!ra.ok) throw new Error(ja.mensagem || ja.erro || `Erro ao carregar alunos: HTTP ${ra.status}`);
    if (!rp.ok) throw new Error(jp.mensagem || jp.erro || `Erro ao carregar professores: HTTP ${rp.status}`);
    if (!rt.ok) throw new Error(jt.mensagem || jt.erro || `Erro ao carregar treinos: HTTP ${rt.status}`);

    alunos = extrairLista(ja, "alunos");
    professores = extrairLista(jp, "professores");
    treinos = extrairLista(jt, "treinos");

    preencherSelects();
    aplicarParametrosIniciais();
    render();
  } catch (erro) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9">${esc(erro.message)}</td></tr>`;
    mostrar(erro.message, "erro");
  }
}

function preencherSelects() {
  const alunoOptions = alunos.slice().sort((a, b) => nomeAluno(a).localeCompare(nomeAluno(b), "pt-BR"))
    .map(a => `<option value="${esc(idAluno(a))}">${esc(nomeAluno(a))}</option>`).join("");

  const professorOptions = professores.filter(professorAtivo).slice().sort((a, b) => nomeProfessor(a).localeCompare(nomeProfessor(b), "pt-BR"))
    .map(p => `<option value="${esc(idProfessor(p))}">${esc(nomeProfessor(p))}</option>`).join("");

  if ($("#filtroAluno")) $("#filtroAluno").innerHTML = '<option value="">Todos</option>' + alunoOptions;
  if ($("#alunoId")) $("#alunoId").innerHTML = '<option value="">Selecione um aluno</option>' + alunoOptions;
  if ($("#filtroProfessor")) $("#filtroProfessor").innerHTML = '<option value="">Todos</option>' + professorOptions;
  if ($("#professorManual")) $("#professorManual").innerHTML = '<option value="">Definido pelo aluno</option>' + professorOptions;
}

function professorDoAluno(aluno = {}) {
  const professorId = String(aluno.professorId || aluno.professor_id || aluno.professorResponsavelId || "").trim();
  if (professorId) {
    const p = professorPorId(professorId);
    return { id: professorId, nome: aluno.professorNome || aluno.professor_responsavel_nome || nomeProfessor(p || {}) };
  }

  const nome = aluno.professorNome || aluno.professor_responsavel || aluno.professor || "";
  const encontrado = professores.find(p => norm(nomeProfessor(p)) === norm(nome));
  return { id: encontrado ? idProfessor(encontrado) : "", nome: encontrado ? nomeProfessor(encontrado) : nome };
}

function sincronizarProfessor() {
  const manualId = $("#professorManual")?.value || "";
  if (manualId) {
    const p = professorPorId(manualId);
    $("#professorId").value = manualId;
    $("#professorNome").value = p ? nomeProfessor(p) : "";
    return;
  }

  const aluno = alunoPorId($("#alunoId")?.value || "");
  const prof = professorDoAluno(aluno || {});
  $("#professorId").value = prof.id || "";
  $("#professorNome").value = prof.nome || "";
  if ($("#professorManual") && prof.id && professorPorId(prof.id)) $("#professorManual").value = prof.id;
}

function statusTreino(t) {
  const st = String(t.status || "ativo").toLowerCase();
  if (["cancelado", "inativo", "arquivado"].includes(st)) return "cancelado";
  if ((t.dataValidade || t.data_validade) && (t.dataValidade || t.data_validade) < dataHoje()) return "vencido";
  return "ativo";
}

function treinosFiltrados() {
  const q = norm($("#busca")?.value || "");
  const filtroAluno = $("#filtroAluno")?.value || "";
  const filtroProfessor = $("#filtroProfessor")?.value || "";
  const filtroStatus = $("#filtroStatus")?.value || "";

  return treinos.filter(t => {
    const alvo = norm([
      t.alunoNome,
      t.professorNome,
      t.objetivo,
      t.nome,
      t.divisao,
      t.nivel,
      t.observacoes,
      ...(Array.isArray(t.exercicios) ? t.exercicios.map(e => `${e.nome} ${e.grupoMuscular}`) : [])
    ].join(" "));

    return (!q || alvo.includes(q)) &&
      (!filtroAluno || String(t.alunoId || t.aluno_id) === filtroAluno) &&
      (!filtroProfessor || String(t.professorId || t.professor_id) === filtroProfessor) &&
      (!filtroStatus || statusTreino(t) === filtroStatus);
  });
}

function render() {
  const lista = treinosFiltrados();
  $("#contador").textContent = `${lista.length} registro(s)`;
  $("#kpiTotal").textContent = treinos.length;
  $("#kpiAtivos").textContent = treinos.filter(t => statusTreino(t) === "ativo").length;
  $("#kpiVencidos").textContent = treinos.filter(t => statusTreino(t) === "vencido").length;
  $("#kpiAlunos").textContent = new Set(treinos.map(t => String(t.alunoId || t.aluno_id)).filter(Boolean)).size;

  const tb = $("#tabela");
  if (!lista.length) {
    tb.innerHTML = '<tr><td colspan="9">Nenhum treino encontrado.</td></tr>';
    return;
  }

  tb.innerHTML = lista.map(t => {
    const aluno = alunoPorId(t.alunoId || t.aluno_id);
    const professor = professorPorId(t.professorId || t.professor_id);
    const status = statusTreino(t);
    return `<tr>
      <td>${esc(t.alunoNome || nomeAluno(aluno || {}) || "-")}</td>
      <td>${esc(t.professorNome || nomeProfessor(professor || {}) || "-")}</td>
      <td>${esc(t.objetivo || "-")}</td>
      <td>${esc(t.divisao || "-")}</td>
      <td>${esc(t.dataInicio || t.data_inicio || "-")}</td>
      <td>${esc(t.dataValidade || t.data_validade || "-")}</td>
      <td><span class="badge status-${esc(status)}">${esc(status)}</span></td>
      <td><button class="btn-row primary" type="button" onclick="iniciarExecucao('${esc(t.id)}')" ${status !== "ativo" ? "disabled" : ""}>Executar</button></td>
      <td class="text-right">
        <button class="btn-row" type="button" onclick="editarTreino('${esc(t.id)}')">Editar</button>
        <button class="btn-row" type="button" onclick="imprimirTreino('${esc(t.id)}')">Imprimir</button>
        <button class="btn-row danger" type="button" onclick="excluirTreino('${esc(t.id)}')">Excluir</button>
      </td>
    </tr>`;
  }).join("");
}

function abrirModal(titulo = "Novo treino") {
  $("#modalTitulo").textContent = titulo;
  $("#modal").classList.remove("hidden");
  setTimeout(() => $("#alunoId")?.focus(), 40);
}

function fecharModal() {
  if (EMBED && window.parent && window.parent !== window) {
    try { window.parent.postMessage({ tipo: "fusion-fechar-modal", origem: "treinos" }, "*"); } catch {}
  }
  $("#modal").classList.add("hidden");
  $("#form").reset();
  editandoId = "";
  exercicios = [];
  renderExercicios();
}

function novoTreino() {
  fecharModal();
  $("#dataInicio").value = dataHoje();
  $("#dataValidade").value = dataFutura(45);
  $("#status").value = "ativo";
  const alunoInicial = params.get("alunoId") || params.get("aluno_id") || $("#filtroAluno")?.value || "";
  if (alunoInicial) $("#alunoId").value = alunoInicial;
  sincronizarProfessor();
  adicionarExercicio();
  abrirModal("Novo treino");
}

function coletar() {
  sincronizarProfessor();
  const aluno = alunoPorId($("#alunoId").value);
  if (!$("#alunoId").value) throw new Error("Selecione o aluno.");
  if (!$("#professorId").value) throw new Error("Aluno sem professor responsável. Vincule um professor no cadastro do aluno antes de prescrever treino.");

  const listaExercicios = coletarExercicios();
  if (!listaExercicios.length) throw new Error("Informe ao menos um exercício.");

  return {
    id: editandoId || $("#id").value || undefined,
    alunoId: $("#alunoId").value,
    aluno_id: $("#alunoId").value,
    alunoNome: nomeAluno(aluno || {}),
    professorId: $("#professorId").value,
    professor_id: $("#professorId").value,
    professorNome: $("#professorNome").value,
    nome: $("#nome").value || `Treino ${$("#objetivo").value || "do aluno"}`,
    objetivo: $("#objetivo").value.trim(),
    nivel: $("#nivel").value,
    divisao: $("#divisao").value,
    dataInicio: $("#dataInicio").value,
    data_inicio: $("#dataInicio").value,
    dataValidade: $("#dataValidade").value,
    data_validade: $("#dataValidade").value,
    status: $("#status").value,
    observacoes: $("#observacoes").value,
    exercicios: listaExercicios,
    origem: "modulo_treinos",
    usuario: "operador"
  };
}

function adicionarExercicio(data = {}) {
  exercicios.push({
    nome: data.nome || "",
    grupoMuscular: data.grupoMuscular || "",
    series: data.series || "",
    repeticoes: data.repeticoes || "",
    carga: data.carga || "",
    descanso: data.descanso || "",
    cadencia: data.cadencia || "",
    observacoes: data.observacoes || data.obs || ""
  });
  renderExercicios();
}

function renderExercicios() {
  const box = $("#exerciciosBox");
  if (!box) return;
  if (!exercicios.length) {
    box.innerHTML = '<p>Nenhum exercício inserido.</p>';
    return;
  }

  box.innerHTML = exercicios.map((e, i) => `<div class="exercicio-item">
    <div class="exercicio-grid">
      <div class="field"><label>Exercício *</label><input data-ex="${i}" data-k="nome" value="${esc(e.nome)}"></div>
      <div class="field"><label>Grupo</label><input data-ex="${i}" data-k="grupoMuscular" value="${esc(e.grupoMuscular)}"></div>
      <div class="field"><label>Séries *</label><input data-ex="${i}" data-k="series" value="${esc(e.series)}"></div>
      <div class="field"><label>Repetições *</label><input data-ex="${i}" data-k="repeticoes" value="${esc(e.repeticoes)}"></div>
      <div class="field"><label>Carga</label><input data-ex="${i}" data-k="carga" value="${esc(e.carga)}"></div>
      <div class="field"><label>Descanso</label><input data-ex="${i}" data-k="descanso" value="${esc(e.descanso)}"></div>
      <div class="field"><label>Cadência</label><input data-ex="${i}" data-k="cadencia" value="${esc(e.cadencia)}"></div>
      <div class="field"><label>Observação</label><input data-ex="${i}" data-k="observacoes" value="${esc(e.observacoes)}"></div>
      <button type="button" class="btn-row danger" onclick="removerExercicio(${i})">×</button>
    </div>
  </div>`).join("");
}

function coletarExercicios() {
  const resultado = [];
  $$('[data-ex]').forEach(el => {
    const i = Number(el.dataset.ex);
    resultado[i] = resultado[i] || {};
    resultado[i][el.dataset.k] = el.value.trim();
  });
  return resultado
    .map((e, i) => ({ ...e, ordem: i + 1 }))
    .filter(e => e.nome || e.series || e.repeticoes);
}

window.removerExercicio = function (i) {
  exercicios.splice(i, 1);
  renderExercicios();
};

window.editarTreino = function (id) {
  const t = treinos.find(x => String(x.id) === String(id));
  if (!t) return mostrar("Treino não encontrado.", "erro");
  editandoId = t.id;
  $("#id").value = t.id;
  $("#alunoId").value = t.alunoId || t.aluno_id || "";
  $("#professorId").value = t.professorId || t.professor_id || "";
  $("#professorNome").value = t.professorNome || "";
  if ($("#professorManual")) $("#professorManual").value = t.professorId || t.professor_id || "";
  $("#nome").value = t.nome || "";
  $("#objetivo").value = t.objetivo || "";
  $("#nivel").value = t.nivel || "";
  $("#divisao").value = t.divisao || "";
  $("#dataInicio").value = t.dataInicio || t.data_inicio || "";
  $("#dataValidade").value = t.dataValidade || t.data_validade || "";
  $("#status").value = t.status || "ativo";
  $("#observacoes").value = t.observacoes || "";
  exercicios = Array.isArray(t.exercicios) ? t.exercicios : [];
  renderExercicios();
  abrirModal("Editar treino");
};

window.excluirTreino = async function (id) {
  if (!confirm("Excluir este treino?")) return;
  try {
    const resp = await fetch(`${API_TREINOS}/${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await safeJson(resp);
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    mostrar("Treino excluído.", "sucesso");
    await carregar();
  } catch (erro) {
    mostrar(erro.message, "erro");
  }
};

window.imprimirTreino = function (id) {
  window.editarTreino(id);
  setTimeout(() => window.print(), 200);
};

async function salvar(ev) {
  ev.preventDefault();
  try {
    const dados = coletar();
    const editando = Boolean(editandoId);
    const resp = await fetch(editando ? `${API_TREINOS}/${encodeURIComponent(editandoId)}` : API_TREINOS, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const json = await safeJson(resp);
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    fecharModal();
    mostrar(editando ? "Treino atualizado." : "Treino salvo.", "sucesso");
    await carregar();
  } catch (erro) {
    mostrar(erro.message, "erro");
  }
}

function aplicarParametrosIniciais() {
  const alunoId = params.get("alunoId") || params.get("aluno_id") || "";
  const professorId = params.get("professorId") || params.get("professor_id") || "";
  if (alunoId && $("#filtroAluno")) $("#filtroAluno").value = alunoId;
  if (professorId && $("#filtroProfessor")) $("#filtroProfessor").value = professorId;
  if (params.get("novo") === "1") setTimeout(novoTreino, 250);
  if (params.get("editar") === "1") {
    setTimeout(() => {
      const ultimo = treinos.filter(t => String(t.alunoId || t.aluno_id) === alunoId).slice(-1)[0];
      if (ultimo) window.editarTreino(ultimo.id);
      else novoTreino();
    }, 250);
  }
  if (params.get("executar") === "1") {
    setTimeout(() => {
      const ativo = treinos.filter(t => String(t.alunoId || t.aluno_id) === alunoId && statusTreino(t) === "ativo").slice(-1)[0];
      if (ativo && typeof window.iniciarExecucao === "function") window.iniciarExecucao(ativo.id);
      else if (ativo) window.editarTreino(ativo.id);
      else novoTreino();
    }, 350);
  }
}

function registrarEventos() {
  $("#btnNovo")?.addEventListener("click", novoTreino);
  $("#btnAtualizar")?.addEventListener("click", carregar);
  $("#btnFechar")?.addEventListener("click", fecharModal);
  $("#btnCancelar")?.addEventListener("click", fecharModal);
  $("#btnAddExercicio")?.addEventListener("click", () => adicionarExercicio());
  $("#form")?.addEventListener("submit", salvar);
  $("#alunoId")?.addEventListener("change", sincronizarProfessor);
  $("#professorManual")?.addEventListener("change", sincronizarProfessor);
  ["busca", "filtroAluno", "filtroProfessor", "filtroStatus"].forEach(id => $("#" + id)?.addEventListener("input", render));
  ["filtroAluno", "filtroProfessor", "filtroStatus"].forEach(id => $("#" + id)?.addEventListener("change", render));
}

registrarEventos();
carregar();


function mostrarExec(msg, tipo = "erro") {
  const el = $("#execAlerta");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.className = `alert ${tipo}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 7000);
}

function segundosParaTempo(total = 0) {
  const s = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}

function numero(v) {
  const n = Number(String(v ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0] || 0);
  return Number.isFinite(n) ? n : 0;
}

function seriesNumero(v) {
  const n = numero(v);
  return n > 0 ? n : 1;
}

function calcularVolumeExecucao(execucao = execucaoAtual) {
  return (execucao?.exercicios || []).reduce((total, ex) => {
    const carga = numero(ex.cargaRealizada || ex.cargaPrevista);
    const reps = numero(ex.repeticoesRealizadas || ex.repeticoes);
    const series = seriesNumero(ex.series);
    return total + (carga * reps * series);
  }, 0);
}

function tempoExecucaoSegundos() {
  if (!execucaoInicioMs) return Number(execucaoAtual?.tempoSegundos || 0);
  return Math.floor((Date.now() - execucaoInicioMs) / 1000) + Number(execucaoAtual?.tempoSegundosBase || 0);
}

function atualizarTempoTela() {
  const tempo = tempoExecucaoSegundos();
  const el = $("#execTempoTotal");
  if (el) el.textContent = segundosParaTempo(tempo);
  const vol = $("#execVolumeTotal");
  if (vol) vol.textContent = Math.round(calcularVolumeExecucao()).toLocaleString("pt-BR");
}

function iniciarTimerExecucao() {
  clearInterval(execucaoTimer);
  execucaoInicioMs = Date.now();
  execucaoTimer = setInterval(atualizarTempoTela, 1000);
}

function pararTimerExecucao() {
  clearInterval(execucaoTimer);
  execucaoTimer = null;
}

function pararDescanso() {
  clearInterval(descansoTimer);
  descansoTimer = null;
  descansoRestante = 0;
  const el = $("#descansoTempo");
  if (el) el.textContent = "00:00";
}

function fecharExecucao() {
  pararTimerExecucao();
  pararDescanso();
  $("#modalExecucao")?.classList.add("hidden");
  execucaoAtual = null;
  treinoExecucaoAtual = null;
  execucaoIndiceAtual = 0;
}

function resumoExecucao(execucao = {}) {
  const total = Array.isArray(execucao.exercicios) ? execucao.exercicios.length : 0;
  const concluidos = Array.isArray(execucao.exercicios) ? execucao.exercicios.filter(e => e.concluido).length : 0;
  const percentual = total ? Math.round((concluidos / total) * 100) : 0;
  return { total, concluidos, percentual };
}

function indicePrimeiroPendente(execucao = execucaoAtual) {
  const lista = execucao?.exercicios || [];
  const idx = lista.findIndex(e => !e.concluido);
  return idx >= 0 ? idx : Math.max(0, lista.length - 1);
}

function descansoEmSegundos(ex = {}) {
  const bruto = String(ex.descanso || ex.tempoDescanso || "").trim().toLowerCase();
  const n = numero(bruto);
  if (!n) return 90;
  if (bruto.includes(":")) {
    const [m, s] = bruto.split(":").map(x => Number(x) || 0);
    return (m * 60) + s;
  }
  if (bruto.includes("min")) return n * 60;
  return n > 10 ? n : n * 60;
}

function iniciarDescanso(segundos = 90) {
  pararDescanso();
  descansoRestante = Math.max(0, Math.floor(segundos));
  const atualizar = () => {
    const el = $("#descansoTempo");
    if (el) el.textContent = segundosParaTempo(descansoRestante);
    if (descansoRestante <= 0) {
      pararDescanso();
      mostrarExec("Descanso finalizado.", "sucesso");
      return;
    }
    descansoRestante -= 1;
  };
  atualizar();
  descansoTimer = setInterval(atualizar, 1000);
}

function irParaExercicio(indice) {
  const total = execucaoAtual?.exercicios?.length || 0;
  if (!total) return;
  execucaoIndiceAtual = Math.max(0, Math.min(total - 1, indice));
  renderExecucao();
}

function renderMarcadorExercicios() {
  return (execucaoAtual.exercicios || []).map((ex, i) => `<button type="button" class="exec-dot ${i === execucaoIndiceAtual ? "ativo" : ""} ${ex.concluido ? "feito" : ""}" onclick="irParaExercicio(${i})">${i + 1}</button>`).join("");
}

function renderExecucao() {
  if (!execucaoAtual) return;
  const r = resumoExecucao(execucaoAtual);
  const treino = treinoExecucaoAtual || {};
  const aluno = alunoPorId(execucaoAtual.alunoId || treino.alunoId || treino.aluno_id);
  const professor = professorPorId(execucaoAtual.professorId || treino.professorId || treino.professor_id);
  const lista = Array.isArray(execucaoAtual.exercicios) ? execucaoAtual.exercicios : [];
  if (execucaoIndiceAtual >= lista.length) execucaoIndiceAtual = Math.max(0, lista.length - 1);
  const ex = lista[execucaoIndiceAtual] || null;

  $("#execTitulo").textContent = `Execução assistida — ${treino.nome || treino.objetivo || "Treino"}`;
  $("#execResumo").innerHTML = `
    <div><span>Aluno</span><strong>${esc(execucaoAtual.aluno || treino.alunoNome || nomeAluno(aluno || {}))}</strong></div>
    <div><span>Professor</span><strong>${esc(execucaoAtual.professor || treino.professorNome || nomeProfessor(professor || {}))}</strong></div>
    <div><span>Status</span><strong>${esc(execucaoAtual.status || "Em andamento")}</strong></div>
    <div><span>Tempo</span><strong id="execTempoTotal">00:00</strong></div>
    <div><span>Progresso</span><strong>${r.concluidos}/${r.total} (${r.percentual}%)</strong></div>
    <div><span>Volume estimado</span><strong><span id="execVolumeTotal">0</span> kg</strong></div>
    <div class="exec-progress-card"><span>Barra de progresso</span><div class="exec-progress"><i style="width:${r.percentual}%"></i></div></div>`;

  const box = $("#execBox");
  if (!box) return;
  if (!lista.length || !ex) {
    box.innerHTML = '<p>Nenhum exercício encontrado para esta execução.</p>';
    return;
  }

  const descanso = descansoEmSegundos(ex);
  const progressaoHtml = renderProgressaoExercicio(ex);
  box.innerHTML = `
    <div class="exec-navegador">${renderMarcadorExercicios()}</div>
    <div class="exec-atual ${ex.concluido ? "concluido" : ""}">
      <div class="exec-head">
        <div><span>Exercício ${execucaoIndiceAtual + 1} de ${lista.length}</span><h4>${esc(ex.nome || "Exercício")}</h4></div>
        <span class="badge ${ex.concluido ? "status-ativo" : ""}">${ex.concluido ? "Concluído" : "Em andamento"}</span>
      </div>
      <div class="exec-prescricao">
        <div><span>Séries</span><strong>${esc(ex.series || "-")}</strong></div>
        <div><span>Repetições previstas</span><strong>${esc(ex.repeticoes || "-")}</strong></div>
        <div><span>Carga prevista</span><strong>${esc(ex.cargaPrevista || "-")}</strong></div>
        <div><span>Descanso previsto</span><strong>${segundosParaTempo(descanso)}</strong></div>
      </div>
      ${progressaoHtml}
      <div class="exec-inputs exec-inputs-b2">
        <div class="field"><label>Carga utilizada</label><input id="execCargaAtual" value="${esc(ex.cargaRealizada || "")}" placeholder="Ex.: 30 kg"></div>
        <div class="field"><label>Repetições realizadas</label><input id="execRepsAtual" value="${esc(ex.repeticoesRealizadas || "")}" placeholder="Ex.: 12"></div>
        <div class="field"><label>Observação</label><input id="execObsAtual" value="${esc(ex.observacao || "")}" placeholder="Opcional"></div>
      </div>
      <div class="exec-descanso-card">
        <div><span>Descanso</span><strong id="descansoTempo">00:00</strong></div>
        <button type="button" class="btn-light" onclick="iniciarDescanso(${descanso})">Iniciar descanso</button>
        <button type="button" class="btn-light" onclick="pararDescanso()">Zerar</button>
      </div>
      <div class="exec-nav-actions">
        <button type="button" class="btn-light" onclick="irParaExercicio(${execucaoIndiceAtual - 1})" ${execucaoIndiceAtual <= 0 ? "disabled" : ""}>Exercício anterior</button>
        <button type="button" class="fusion-button" onclick="concluirExercicioAtual()">${ex.concluido ? "Atualizar exercício" : "Concluir exercício"}</button>
        <button type="button" class="btn-light" onclick="irParaExercicio(${execucaoIndiceAtual + 1})" ${execucaoIndiceAtual >= lista.length - 1 ? "disabled" : ""}>Próximo exercício</button>
      </div>
    </div>`;
  atualizarTempoTela();
}

window.irParaExercicio = irParaExercicio;
window.iniciarDescanso = iniciarDescanso;
window.pararDescanso = pararDescanso;

window.iniciarExecucao = async function (treinoId) {
  const treino = treinos.find(t => String(t.id) === String(treinoId));
  if (!treino) return mostrar("Treino não encontrado.", "erro");
  try {
    const resp = await fetch(`${API_TREINOS_OPERACIONAL}/treinos/${encodeURIComponent(treinoId)}/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem: "treinos_execucao_assistida_b2", usuario: "operador" })
    });
    const json = await safeJson(resp);
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    execucaoAtual = json.dados || json.execucao || json.data;
    execucaoAtual.tempoSegundosBase = Number(execucaoAtual.tempoSegundos || 0);
    treinoExecucaoAtual = treino;
    execucaoIndiceAtual = indicePrimeiroPendente(execucaoAtual);
    $("#modalExecucao")?.classList.remove("hidden");
    iniciarTimerExecucao();
    await carregarProgressao(execucaoAtual.alunoId || treino.alunoId || treino.aluno_id);
    renderExecucao();
    mostrar(json.reutilizado ? "Execução em andamento reutilizada." : "Execução iniciada.", "sucesso");
  } catch (erro) {
    mostrar(erro.message, "erro");
  }
};

async function salvarExercicioExecucao(exercicioTreinoId, concluir = true) {
  if (!execucaoAtual?.id) return mostrarExec("Nenhuma execução ativa.", "erro");
  const carga = $("#execCargaAtual")?.value || "";
  const reps = $("#execRepsAtual")?.value || "";
  const obs = $("#execObsAtual")?.value || "";
  try {
    const resp = await fetch(`${API_TREINOS_OPERACIONAL}/execucoes/${encodeURIComponent(execucaoAtual.id)}/exercicios/${encodeURIComponent(exercicioTreinoId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cargaRealizada: carga, repeticoesRealizadas: reps, observacao: obs, concluido: concluir, tempoSegundos: tempoExecucaoSegundos(), volumeTotal: calcularVolumeExecucao() })
    });
    const json = await safeJson(resp);
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    execucaoAtual = json.dados || execucaoAtual;
    await carregarProgressao(execucaoAtual.alunoId || treinoExecucaoAtual?.alunoId || treinoExecucaoAtual?.aluno_id);
    execucaoAtual.tempoSegundosBase = tempoExecucaoSegundos();
    execucaoInicioMs = Date.now();
    const atual = execucaoAtual.exercicios?.[execucaoIndiceAtual];
    if (concluir && atual) iniciarDescanso(descansoEmSegundos(atual));
    if (concluir && execucaoIndiceAtual < (execucaoAtual.exercicios?.length || 1) - 1) execucaoIndiceAtual += 1;
    renderExecucao();
    mostrarExec(concluir ? "Exercício registrado. Avançando para o próximo." : "Exercício atualizado.", "sucesso");
  } catch (erro) {
    mostrarExec(erro.message, "erro");
  }
}

window.concluirExercicioAtual = function () {
  const ex = execucaoAtual?.exercicios?.[execucaoIndiceAtual];
  if (!ex) return mostrarExec("Exercício não encontrado.", "erro");
  salvarExercicioExecucao(ex.exercicioTreinoId, true);
};

window.concluirExercicioExecucao = function (exercicioTreinoId) {
  salvarExercicioExecucao(exercicioTreinoId, true);
};

async function finalizarExecucao() {
  if (!execucaoAtual?.id) return mostrarExec("Nenhuma execução ativa.", "erro");
  const r = resumoExecucao(execucaoAtual);
  if (r.total && r.concluidos < r.total && !confirm(`Ainda existem ${r.total - r.concluidos} exercício(s) pendente(s). Finalizar mesmo assim?`)) return;
  try {
    const resp = await fetch(`${API_TREINOS_OPERACIONAL}/execucoes/${encodeURIComponent(execucaoAtual.id)}/concluir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacao: $("#execObservacaoFinal")?.value || "", tempoSegundos: tempoExecucaoSegundos(), volumeTotal: calcularVolumeExecucao() })
    });
    const json = await safeJson(resp);
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    execucaoAtual = json.dados || execucaoAtual;
    await carregarProgressao(execucaoAtual.alunoId || treinoExecucaoAtual?.alunoId || treinoExecucaoAtual?.aluno_id);
    pararTimerExecucao();
    pararDescanso();
    renderExecucao();
    mostrarExec("Treino finalizado.", "sucesso");
    setTimeout(fecharExecucao, 1100);
    await carregar();
  } catch (erro) {
    mostrarExec(erro.message, "erro");
  }
}

$("#btnFecharExecucao")?.addEventListener("click", fecharExecucao);
$("#btnCancelarExecucao")?.addEventListener("click", fecharExecucao);
$("#btnFinalizarExecucao")?.addEventListener("click", finalizarExecucao);


async function carregarProgressao(alunoId) {
  progressaoAtual = null;
  if (!alunoId) return null;
  try {
    const resp = await fetch(`${API_TREINOS_OPERACIONAL}/progressao/alunos/${encodeURIComponent(alunoId)}`, { cache: "no-store" });
    const json = await safeJson(resp);
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `HTTP ${resp.status}`);
    progressaoAtual = json;
    return json;
  } catch (erro) {
    progressaoAtual = null;
    console.warn("Falha ao carregar progressão", erro);
    return null;
  }
}

function localizarProgressaoExercicio(ex = {}) {
  const alvo = norm(ex.nome || "");
  if (!alvo || !Array.isArray(progressaoAtual?.exercicios)) return null;
  return progressaoAtual.exercicios.find(item => norm(item.nome) === alvo) ||
    progressaoAtual.exercicios.find(item => norm(item.nome).includes(alvo) || alvo.includes(norm(item.nome))) || null;
}

function sinalNumero(n = 0, sufixo = "") {
  const v = Number(n || 0);
  if (!v) return `0${sufixo}`;
  return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR")}${sufixo}`;
}

function renderProgressaoExercicio(ex = {}) {
  const p = localizarProgressaoExercicio(ex);
  if (!p) {
    return `<div class="progressao-card"><div><span>Progressão automática</span><strong>Sem histórico deste exercício</strong></div><p>Registre carga e repetições para gerar comparação na próxima execução.</p></div>`;
  }
  const historico = Array.isArray(p.historico) ? p.historico.slice(0, 4) : [];
  return `<div class="progressao-card">
    <div class="progressao-head">
      <div><span>Progressão automática</span><strong>${esc(p.tendencia || "Estável")}</strong></div>
      <div><span>Melhor carga</span><strong>${Number(p.melhorCarga || 0).toLocaleString("pt-BR")} kg</strong></div>
      <div><span>Melhor volume</span><strong>${Math.round(Number(p.melhorVolume || 0)).toLocaleString("pt-BR")} kg</strong></div>
      <div><span>Variação volume</span><strong>${sinalNumero(p.percentualVolume, "%")}</strong></div>
    </div>
    <p>${esc(p.sugestao || "Manter registro regular para calcular progressão.")}</p>
    <div class="progressao-mini-historico">
      ${historico.map(h => `<span>${esc(h.data || "-")} · ${Number(h.carga || 0).toLocaleString("pt-BR")}kg · ${Number(h.repeticoes || 0).toLocaleString("pt-BR")} rep · ${Math.round(Number(h.volume || 0)).toLocaleString("pt-BR")}kg vol.</span>`).join("") || "<span>Sem registros anteriores.</span>"}
    </div>
  </div>`;
}
