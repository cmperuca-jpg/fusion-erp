const $ = (id) => document.getElementById(id);

const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420'><rect width='100%' height='100%' fill='#edf2f7'/><text x='50%' y='50%' text-anchor='middle' font-size='28' fill='#64748b'>Exercício</text></svg>`);
const fotoAlunoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><rect width='100%' height='100%' rx='90' fill='#e8eef8'/><text x='50%' y='54%' text-anchor='middle' font-size='24' font-family='Arial' font-weight='700' fill='#64748b'>Aluno</text></svg>`);
let alunoDetalhe = null;

let treinoAtual = null;
let divisaoAtual = 0;
let exercicioAtual = 0;

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function sessaoAluno() {
  try {
    const sessao = JSON.parse(localStorage.getItem("fusion_aluno_treino_login") || "null");
    if (sessao?.alunoId) return sessao;
  } catch {}

  const params = new URLSearchParams(location.search);
  const alunoId = params.get("alunoId") || params.get("id");
  const alunoNome = params.get("alunoNome") || params.get("nome") || "Aluno";
  if (alunoId) return { alunoId, alunoNome };

  return null;
}

function exigirLogin() {
  const sessao = sessaoAluno();
  if (!sessao?.alunoId) {
    location.replace("/pages/aluno-login/index.html");
    return null;
  }
  return sessao;
}

function chaveConclusao() {
  const d = treinoAtual?.divisoes?.[divisaoAtual];
  return `${treinoAtual?.id || "treino"}_${d?.nome || divisaoAtual}_${exercicioAtual}`;
}

function storageKey() {
  const sessao = sessaoAluno();
  return `fusion_treino_concluidos_${sessao?.alunoId || "aluno"}`;
}

function concluidos() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || "{}"); }
  catch { return {}; }
}

function estaConcluido() {
  return Boolean(concluidos()[chaveConclusao()]);
}

function marcarConcluido(checked) {
  const dados = concluidos();
  dados[chaveConclusao()] = checked;
  localStorage.setItem(storageKey(), JSON.stringify(dados));
}

function divisoesValidas(treino) {
  return (treino?.divisoes || []).filter((d) => Array.isArray(d.itens) && d.itens.length);
}

function exerciciosDaDivisao() {
  const divisao = divisoesValidas(treinoAtual)[divisaoAtual];
  return divisao?.itens || [];
}

function setTexto(id, valor, padrao = "-") {
  $(id).textContent = valor || padrao;
}

function extrairLista(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.alunos)) return payload.alunos;
  if (Array.isArray(payload.dados)) return payload.dados;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.itens)) return payload.itens;
  if (Array.isArray(payload.registros)) return payload.registros;
  return [];
}

function idAlunoRegistro(a) {
  return String(a?.id ?? a?._id ?? a?.codigo ?? a?.alunoId ?? a?.matricula ?? "");
}

function nomeAlunoRegistro(a) {
  return a?.nome || a?.nomeCompleto || a?.alunoNome || a?.aluno || a?.name || "Aluno";
}

function fotoAlunoRegistro(a) {
  return a?.foto_base64 || a?.foto || a?.fotoBase64 || a?.avatar || a?.imagem || "";
}

async function carregarAlunoDetalhe(sessao) {
  if (!sessao?.alunoId) return null;
  try {
    const resp = await fetch(`/api/alunos/${encodeURIComponent(sessao.alunoId)}`, { cache: "no-store" });
    const json = await resp.json().catch(() => ({}));
    if (resp.ok && json) return json.aluno || json.dados || json.data || json;
  } catch {}

  try {
    const resp = await fetch(`/api/alunos`, { cache: "no-store" });
    const json = await resp.json().catch(() => ({}));
    const lista = extrairLista(json);
    return lista.find((a) => idAlunoRegistro(a) === String(sessao.alunoId)) || null;
  } catch {}
  return null;
}

function renderFotoAluno() {
  const img = $("fotoAluno");
  if (!img) return;
  const foto = fotoAlunoRegistro(alunoDetalhe);
  img.src = foto || fotoAlunoFallback;
  img.onerror = () => { img.src = fotoAlunoFallback; };
}

function renderCabecalho() {
  const nomeAluno = nomeAlunoRegistro(alunoDetalhe) || treinoAtual?.alunoNome || sessaoAluno()?.alunoNome;
  setTexto("alunoNome", nomeAluno);
  renderFotoAluno();
  setTexto("professorNome", treinoAtual?.professorNome);
  setTexto("objetivoTreino", treinoAtual?.objetivo);
  setTexto("validadeTreino", treinoAtual?.validade);
  $("subtituloAluno").textContent = `Treino prescrito para ${nomeAluno || "aluno"}.`;
}

function renderTabs() {
  const divisoes = divisoesValidas(treinoAtual);
  $("tabsDivisoes").innerHTML = divisoes.map((d, idx) => `
    <button type="button" class="tab-divisao ${idx === divisaoAtual ? "active" : ""}" data-divisao="${idx}">
      Treino ${esc(d.nome || String.fromCharCode(65 + idx))}
      <small>${(d.itens || []).length}</small>
    </button>
  `).join("");

  document.querySelectorAll("[data-divisao]").forEach((btn) => {
    btn.onclick = () => {
      divisaoAtual = Number(btn.dataset.divisao);
      exercicioAtual = 0;
      renderTudo();
    };
  });
}

function renderExercicio() {
  const exercicios = exerciciosDaDivisao();
  const ex = exercicios[exercicioAtual];

  if (!ex) {
    $("cardExercicio").classList.add("hidden");
    return;
  }

  $("semTreino").classList.add("hidden");
  $("cardExercicio").classList.remove("hidden");

  setTexto("contadorExercicio", `${exercicioAtual + 1} / ${exercicios.length}`);
  setTexto("nomeExercicio", ex.nome || "Exercício");
  setTexto("seriesExercicio", ex.series);
  setTexto("repsExercicio", ex.repeticoes);
  setTexto("cargaExercicio", ex.carga);
  setTexto("descansoExercicio", ex.descanso);
  setTexto("metodoExercicio", ex.metodo || "Convencional");
  setTexto("cadenciaExercicio", ex.cadencia);
  setTexto("descricaoExercicio", ex.descricao, "Sem descrição cadastrada.");
  setTexto("obsExercicio", ex.obs, "Sem observação.");

  const foto = ex.foto || ex.gif || "";
  $("fotoExercicio").src = foto || fotoFallback;
  $("fotoExercicio").onerror = () => { $("fotoExercicio").src = fotoFallback; };

  $("checkConcluido").checked = estaConcluido();
  $("anterior").disabled = exercicios.length <= 1;
  $("proximo").disabled = exercicios.length <= 1;
}

function renderTudo() {
  if (!treinoAtual || !divisoesValidas(treinoAtual).length) {
    $("semTreino").classList.remove("hidden");
    $("cardExercicio").classList.add("hidden");
    $("tabsDivisoes").innerHTML = "";
    return;
  }
  renderCabecalho();
  renderTabs();
  renderExercicio();
}

async function carregar() {
  const sessao = exigirLogin();
  if (!sessao) return;

  alunoDetalhe = await carregarAlunoDetalhe(sessao);
  setTexto("alunoNome", nomeAlunoRegistro(alunoDetalhe) || sessao.alunoNome || "Aluno");
  renderFotoAluno();
  const resp = await fetch(`/api/treinos?alunoId=${encodeURIComponent(sessao.alunoId)}`, { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  const treinos = Array.isArray(json.dados) ? json.dados : [];
  treinoAtual = treinos.find((t) => t.ativo !== false) || treinos[0] || null;
  divisaoAtual = 0;
  exercicioAtual = 0;
  renderTudo();
}

function proximo() {
  const total = exerciciosDaDivisao().length;
  if (!total) return;
  exercicioAtual = (exercicioAtual + 1) % total;
  renderExercicio();
}

function anterior() {
  const total = exerciciosDaDivisao().length;
  if (!total) return;
  exercicioAtual = (exercicioAtual - 1 + total) % total;
  renderExercicio();
}

$("proximo").onclick = proximo;
$("anterior").onclick = anterior;
$("atualizar").onclick = carregar;
$("checkConcluido").onchange = () => marcarConcluido($("checkConcluido").checked);
$("sair").onclick = () => {
  localStorage.removeItem("fusion_aluno_treino_login");
  location.replace("/pages/aluno-login/index.html");
};

document.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowRight") proximo();
  if (ev.key === "ArrowLeft") anterior();
});

carregar();
