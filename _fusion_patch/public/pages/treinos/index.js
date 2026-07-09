let biblioteca = { grupos: [], objetivos: [], exercicios: [] };
let alunos = [];
let professores = [];
let divisoes = [{ nome: "A", itens: [] }, { nome: "B", itens: [] }, { nome: "C", itens: [] }];
let divisaoAtiva = 0;

const $ = (id) => document.getElementById(id);
const metodos = ["Convencional", "Bi-set", "Tri-set", "Drop-set", "Rest-pause", "FST-7", "Pirâmide", "Pirâmide inversa", "Circuito", "Super-série", "Pré-exaustão", "Pós-exaustão"];
const fotoFallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#edf2f7'/><text x='50%' y='52%' text-anchor='middle' font-size='14' fill='#64748b'>Exercício</text></svg>`);

async function api(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, mensagem: data.mensagem || data.erro || `Erro HTTP ${r.status}`, ...data };
  return data;
}

function listaDe(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta.dados)) return resposta.dados;
  if (Array.isArray(resposta.data)) return resposta.data;
  if (Array.isArray(resposta.alunos)) return resposta.alunos;
  if (Array.isArray(resposta.professores)) return resposta.professores;
  if (Array.isArray(resposta.items)) return resposta.items;
  if (resposta.dados && Array.isArray(resposta.dados.itens)) return resposta.dados.itens;
  return [];
}

function nomePessoa(p) {
  return p.nome || p.nomeCompleto || p.alunoNome || p.professorNome || p.name || p.razaoSocial || "Sem nome";
}

function idPessoa(p) {
  return String(p.id ?? p.codigo ?? p.alunoId ?? p.professorId ?? p.matriculaId ?? p.cpf ?? nomePessoa(p));
}

function textoBuscaAluno(a) {
  return [nomePessoa(a), a.cpf, a.telefone, a.celular, a.email, a.matricula, a.codigo, a.id].filter(Boolean).join(" ").toLowerCase();
}

function normalizarExercicio(ex) {
  const codigo = String(ex.codigo || ex.id || "").padStart(3, "0");
  return {
    ...ex,
    id: Number(ex.id) || ex.id,
    foto: ex.foto || ex.gif || `/assets/exercicios/flash/${codigo}.gif`,
    gif: ex.gif || ex.foto || `/assets/exercicios/flash/${codigo}.gif`
  };
}

function popularFiltros() {
  $("grupoFiltro").innerHTML = `<option value="">Todos os grupos</option>` + (biblioteca.grupos || []).map(g => `<option value="${g.id}">${g.nome}</option>`).join("");
  $("objetivo").innerHTML = `<option value="">Selecione</option>` + (biblioteca.objetivos || []).map(o => `<option value="${o.nome}">${o.nome}</option>`).join("");
}

function renderAlunos() {
  const termo = ($("buscaAluno").value || "").toLowerCase().trim();
  const lista = alunos.filter(a => !termo || textoBuscaAluno(a).includes(termo)).slice(0, 250);
  $("alunoSelect").innerHTML = `<option value="">Selecione o aluno</option>` + lista.map(a => {
    const id = idPessoa(a);
    const nome = nomePessoa(a);
    const extra = a.cpf || a.telefone || a.celular || a.email || a.matricula || "";
    return `<option value="${id}">${nome}${extra ? ` · ${extra}` : ""}</option>`;
  }).join("");
}

function renderProfessores() {
  $("professorSelect").innerHTML = `<option value="">Selecione o professor</option>` + professores.map(p => {
    const id = idPessoa(p);
    const nome = nomePessoa(p);
    const extra = p.especialidade || p.cargo || p.cref || p.email || "";
    return `<option value="${id}">${nome}${extra ? ` · ${extra}` : ""}</option>`;
  }).join("");
}

function renderExercicios() {
  const busca = ($("busca").value || "").toLowerCase();
  const grupo = $("grupoFiltro").value;
  const lista = (biblioteca.exercicios || [])
    .filter(e => (!grupo || String(e.grupoId) === String(grupo)) && (!busca || [e.nome, e.musculos, e.grupo].join(" ").toLowerCase().includes(busca)))
    .slice(0, 250);

  $("listaExercicios").innerHTML = lista.map(e => `
    <div class="ex" draggable="true" data-id="${e.id}">
      <img src="${e.foto}" onerror="this.src='${fotoFallback}'">
      <div>
        <strong>${e.nome}</strong>
        <small>${e.grupo || ""}${e.musculos ? ` · ${e.musculos}` : ""}</small>
        <div class="ex-actions">
          <button class="btn" data-add="${e.id}">Adicionar</button>
          <button class="btn ghost" data-view="${e.id}">Visualizar</button>
        </div>
      </div>
    </div>`).join("") || `<div class="empty">Nenhum exercício encontrado.</div>`;

  document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => adicionarExercicio(b.dataset.add, divisaoAtiva));
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => visualizarExercicio(b.dataset.view));
  document.querySelectorAll(".ex").forEach(el => el.ondragstart = (ev) => ev.dataTransfer.setData("text/plain", el.dataset.id));
}

function visualizarExercicio(id) {
  const e = biblioteca.exercicios.find(x => String(x.id) === String(id));
  if (!e) return;
  alert(`${e.nome}\n\nGrupo: ${e.grupo || "-"}\nMúsculos: ${e.musculos || "-"}\n\n${e.descricao || ""}`);
}

function proximaLetra() {
  let n = divisoes.length;
  let s = "";
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

function adicionarDivisao() {
  divisoes.push({ nome: proximaLetra(), itens: [] });
  divisaoAtiva = divisoes.length - 1;
  renderDivisoes();
}

function selecionarDivisao(idx) {
  if (!divisoes[idx]) return;
  divisaoAtiva = idx;
  renderDivisoes();
}

function adicionarExercicio(id, idx) {
  const ex = biblioteca.exercicios.find(e => String(e.id) === String(id));
  if (!ex || !divisoes[idx]) return;
  divisoes[idx].itens.push({
    ...ex,
    series: "3",
    repeticoes: "10",
    carga: "",
    descanso: "60s",
    metodo: "Convencional",
    cadencia: "",
    obs: ""
  });
  renderDivisoes();
}

function renderAbasDivisoes() {
  const alvo = $("abasDivisoes");
  if (!alvo) return;
  alvo.innerHTML = divisoes.map((d, idx) => `
    <button type="button" class="aba-divisao ${idx === divisaoAtiva ? "ativa" : ""}" data-aba="${idx}">
      Treino ${d.nome} <span>${(d.itens || []).length}</span>
    </button>`).join("") + `<button type="button" class="aba-divisao aba-mais" id="addDivisaoAba" title="Adicionar divisão">+</button>`;

  document.querySelectorAll("[data-aba]").forEach(b => b.onclick = () => selecionarDivisao(Number(b.dataset.aba)));
  const add = $("addDivisaoAba");
  if (add) add.onclick = adicionarDivisao;
}

function renderDivisoes() {
  if (divisaoAtiva >= divisoes.length) divisaoAtiva = Math.max(0, divisoes.length - 1);
  if (divisaoAtiva < 0) divisaoAtiva = 0;
  renderAbasDivisoes();

  const d = divisoes[divisaoAtiva] || { nome: "A", itens: [] };
  const idx = divisaoAtiva;

  $("divisoes").innerHTML = `
    <div class="divisao divisao-ativa">
      <div class="divisao-head">
        <h3>Treino ${d.nome}</h3>
        <div class="divisao-actions">
          <button class="btn" data-add-to-div="${idx}">+ Exercício</button>
          <button class="btn" data-remdiv="${idx}">Remover divisão</button>
        </div>
      </div>
      <div class="drop" data-drop="${idx}">
        ${(d.itens || []).map((it, i) => `
          <div class="item">
            <img src="${it.foto || it.gif || fotoFallback}" onerror="this.src='${fotoFallback}'">
            <div>
              <strong>${it.nome}</strong>
              <small>${it.grupo || ""}${it.musculos ? ` · ${it.musculos}` : ""}</small>
              <div class="prescricao">
                <input placeholder="Séries" value="${it.series || ""}" data-f="series" data-d="${idx}" data-i="${i}">
                <input placeholder="Reps" value="${it.repeticoes || ""}" data-f="repeticoes" data-d="${idx}" data-i="${i}">
                <input placeholder="Carga" value="${it.carga || ""}" data-f="carga" data-d="${idx}" data-i="${i}">
                <input placeholder="Descanso" value="${it.descanso || ""}" data-f="descanso" data-d="${idx}" data-i="${i}">
                <select data-f="metodo" data-d="${idx}" data-i="${i}">${metodos.map(m => `<option value="${m}" ${m === (it.metodo || "Convencional") ? "selected" : ""}>${m}</option>`).join("")}</select>
                <input placeholder="Cadência" value="${it.cadencia || ""}" data-f="cadencia" data-d="${idx}" data-i="${i}">
              </div>
              <input placeholder="Observação do exercício" value="${it.obs || ""}" data-f="obs" data-d="${idx}" data-i="${i}">
            </div>
            <button class="btn danger" data-rem="${idx}:${i}">×</button>
          </div>`).join("") || `<small>Arraste exercícios para o Treino ${d.nome} ou use o botão adicionar.</small>`}
      </div>
    </div>`;

  document.querySelectorAll("[data-drop]").forEach(z => {
    z.ondragover = e => e.preventDefault();
    z.ondrop = e => { e.preventDefault(); adicionarExercicio(e.dataTransfer.getData("text/plain"), Number(z.dataset.drop)); };
  });
  document.querySelectorAll("[data-f]").forEach(inp => inp.oninput = inp.onchange = () => {
    const d = Number(inp.dataset.d), i = Number(inp.dataset.i);
    if (divisoes[d]?.itens?.[i]) divisoes[d].itens[i][inp.dataset.f] = inp.value;
  });
  document.querySelectorAll("[data-rem]").forEach(b => b.onclick = () => {
    const [d, i] = b.dataset.rem.split(":").map(Number);
    divisoes[d].itens.splice(i, 1); renderDivisoes();
  });
  document.querySelectorAll("[data-remdiv]").forEach(b => b.onclick = () => {
    if (divisoes.length > 1) {
      divisoes.splice(Number(b.dataset.remdiv), 1);
      if (divisaoAtiva >= divisoes.length) divisaoAtiva = divisoes.length - 1;
      renderDivisoes();
    }
  });
  document.querySelectorAll("[data-add-to-div]").forEach(b => b.onclick = () => {
    const primeiroVisivel = document.querySelector(".ex[data-id]");
    if (primeiroVisivel) adicionarExercicio(primeiroVisivel.dataset.id, Number(b.dataset.addToDiv));
  });
}

function selecionado(lista, selectId) {
  const id = $(selectId).value;
  return lista.find(p => String(idPessoa(p)) === String(id));
}


function alunoSelecionadoAtual() {
  return selecionado(alunos, "alunoSelect");
}

function professorSelecionadoAtual() {
  return selecionado(professores, "professorSelect");
}

function prescricaoLiberada() {
  return Boolean(alunoSelecionadoAtual() && professorSelecionadoAtual());
}

function atualizarLinkAluno() {
  const link = $("verPaginaAluno");
  if (!link) return;
  const aluno = alunoSelecionadoAtual();
  if (!aluno) {
    link.href = "/pages/aluno-treinos/index.html";
    link.classList.add("disabled-link");
    link.title = "Selecione um aluno para abrir a página de treino do aluno.";
    return;
  }
  const alunoId = idPessoa(aluno);
  const alunoNome = nomePessoa(aluno);
  localStorage.setItem("fusion_aluno_treino_selecionado", JSON.stringify({ alunoId, alunoNome }));
  link.href = `/pages/aluno-treinos/index.html?alunoId=${encodeURIComponent(alunoId)}&alunoNome=${encodeURIComponent(alunoNome)}`;
  link.classList.remove("disabled-link");
  link.title = `Abrir treino de ${alunoNome}`;
}

function atualizarEstadoPrescricao() {
  const liberado = prescricaoLiberada();
  ["salvarTreino", "salvarTreinoRodape"].forEach((id) => {
    const botao = $(id);
    if (!botao) return;
    botao.disabled = !liberado;
    botao.classList.toggle("disabled", !liberado);
    botao.title = liberado ? "Salvar treino prescrito" : "Selecione aluno e professor para liberar a prescrição.";
  });
  atualizarLinkAluno();
}

async function salvar() {
  const aluno = alunoSelecionadoAtual();
  const professor = professorSelecionadoAtual();
  if (!aluno || !professor) {
    atualizarEstadoPrescricao();
    return alert("Para prescrever treino é obrigatório selecionar o aluno e o professor responsável.");
  }
  if (!divisoes.some(d => (d.itens || []).length)) return alert("Adicione pelo menos um exercício ao treino.");

  const payload = {
    alunoId: idPessoa(aluno),
    alunoNome: nomePessoa(aluno),
    professorId: idPessoa(professor),
    professorNome: nomePessoa(professor),
    objetivo: $("objetivo").value,
    validade: $("validade").value,
    dataPrescricao: $("dataPrescricao").value,
    observacoes: $("observacoes").value,
    divisoes
  };
  const r = await api("/api/treinos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (r.ok) {
    localStorage.setItem("fusion_aluno_treino_selecionado", JSON.stringify({ alunoId: payload.alunoId, alunoNome: payload.alunoNome }));
  }
  alert(r.ok ? "Treino prescrito salvo." : (r.mensagem || "Erro ao salvar treino."));
  atualizarEstadoPrescricao();
}

async function carregarAlunos() {
  const r = await api("/api/alunos");
  alunos = listaDe(r);
  renderAlunos();
  atualizarEstadoPrescricao();
}

async function carregarProfessores() {
  const r = await api("/api/professores");
  professores = listaDe(r);
  renderProfessores();
  atualizarEstadoPrescricao();
}

async function init() {
  $("dataPrescricao").value = new Date().toISOString().slice(0, 10);
  const r = await api("/api/treinos/biblioteca");
  biblioteca = r.dados || biblioteca;
  biblioteca.exercicios = (biblioteca.exercicios || []).map(normalizarExercicio);
  popularFiltros();
  renderExercicios();
  renderDivisoes();
  atualizarEstadoPrescricao();
  carregarAlunos();
  carregarProfessores();
}

$("busca").oninput = renderExercicios;
$("grupoFiltro").onchange = renderExercicios;
$("buscaAluno").oninput = () => { renderAlunos(); atualizarEstadoPrescricao(); };
$("alunoSelect").onchange = atualizarEstadoPrescricao;
$("professorSelect").onchange = atualizarEstadoPrescricao;
const verPaginaAluno = $("verPaginaAluno");
if (verPaginaAluno) verPaginaAluno.onclick = (ev) => {
  if (!alunoSelecionadoAtual()) {
    ev.preventDefault();
    alert("Selecione um aluno antes de abrir a página de treino do aluno.");
  }
};
if ($("addDivisao")) $("addDivisao").onclick = adicionarDivisao;
$("salvarTreino").onclick = salvar;
if ($("salvarTreinoRodape")) $("salvarTreinoRodape").onclick = salvar;
init();
