const API_TREINOS = "/api/treinos";
const API_ALUNOS = "/api/alunos";
const API_EXERCICIOS = "/api/exercicios";

const form = document.getElementById("formTreino");

let alunos = [];
let exercicios = [];
let treinos = [];
let exerciciosDoTreino = [];

async function carregarTudo() {
  alunos = await buscarJSON(API_ALUNOS);
  exercicios = await buscarJSON(API_EXERCICIOS);
  treinos = await buscarJSON(API_TREINOS);

  carregarSelectAlunos();
  renderizarExercicios(exercicios);
  renderizarTreinos();
  renderizarTreinoAtual();
}

async function buscarJSON(url) {
  const resposta = await fetch(url);
  return await resposta.json();
}

function carregarSelectAlunos() {
  const select = document.getElementById("aluno_id");
  select.innerHTML = `<option value="">Selecione o aluno</option>`;

  alunos.forEach(aluno => {
    select.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
  });
}

function renderizarExercicios(lista) {
  const div = document.getElementById("resultadoExercicios");
  div.innerHTML = "";

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhum exercício encontrado.</p>";
    return;
  }

  lista.forEach(exercicio => {
    div.innerHTML += `
      <div class="exercicio-card">
        <div class="exercicio-thumb">
          ${
            exercicio.imagem_base64
              ? `<img src="${exercicio.imagem_base64}" alt="${exercicio.nome}">`
              : `<span>Imagem</span>`
          }
        </div>

        <div class="exercicio-info">
          <strong>${exercicio.nome || ""}</strong>
          <small>${exercicio.grupo_muscular || "-"} | ${exercicio.equipamento || "-"}</small>
          <small>${exercicio.dificuldade || ""}</small>
        </div>

        <div class="exercicio-actions">
          <button type="button" onclick="adicionarExercicio('${exercicio.id}')">Adicionar</button>
          <button type="button" onclick="window.open('/pages/exercicios/ficha.html?id=${exercicio.id}', '_blank')">Ficha</button>
        </div>
      </div>
    `;
  });
}

function filtrarExercicios() {
  const busca = valor("buscaExercicio").toLowerCase();
  const grupo = valor("filtroGrupoExercicio");

  const filtrados = exercicios.filter(exercicio => {
    return (
      (!busca || (exercicio.nome || "").toLowerCase().includes(busca)) &&
      (!grupo || exercicio.grupo_muscular === grupo)
    );
  });

  renderizarExercicios(filtrados);
}

function limparBuscaExercicios() {
  document.getElementById("buscaExercicio").value = "";
  document.getElementById("filtroGrupoExercicio").value = "";
  renderizarExercicios(exercicios);
}

function adicionarExercicio(id) {
  const exercicio = exercicios.find(item => item.id === id);
  if (!exercicio) return;

  exerciciosDoTreino.push({
    exercicio_id: exercicio.id,
    nome: exercicio.nome,
    imagem_base64: exercicio.imagem_base64 || "",
    grupo_muscular: exercicio.grupo_muscular || "",
    equipamento: exercicio.equipamento || "",
    ordem: exerciciosDoTreino.length + 1,
    series: 3,
    repeticoes: "10",
    carga: "",
    descanso: "60s",
    cadencia: "",
    observacoes: ""
  });

  renderizarTreinoAtual();
}

function renderizarTreinoAtual() {
  const div = document.getElementById("listaTreino");
  div.innerHTML = "";

  if (exerciciosDoTreino.length === 0) {
    div.innerHTML = "<p>Nenhum exercício adicionado.</p>";
    return;
  }

  exerciciosDoTreino.forEach((item, index) => {
    div.innerHTML += `
      <div class="treino-card">
        <div class="treino-card-topo">
          <div class="exercicio-thumb">
            ${
              item.imagem_base64
                ? `<img src="${item.imagem_base64}" alt="${item.nome}">`
                : `<span>Imagem</span>`
            }
          </div>

          <div>
            <h3>${index + 1}. ${item.nome}</h3>
            <p>${item.grupo_muscular || "-"} | ${item.equipamento || "-"}</p>
          </div>
        </div>

        <div class="filtros">
          <input value="${item.series}" onchange="atualizarItem(${index}, 'series', this.value)" placeholder="Séries">
          <input value="${item.repeticoes}" onchange="atualizarItem(${index}, 'repeticoes', this.value)" placeholder="Repetições">
          <input value="${item.carga}" onchange="atualizarItem(${index}, 'carga', this.value)" placeholder="Carga">
          <input value="${item.descanso}" onchange="atualizarItem(${index}, 'descanso', this.value)" placeholder="Descanso">
          <input value="${item.cadencia}" onchange="atualizarItem(${index}, 'cadencia', this.value)" placeholder="Cadência">
        </div>

        <textarea onchange="atualizarItem(${index}, 'observacoes', this.value)" placeholder="Observações">${item.observacoes || ""}</textarea>

        <div class="form-actions">
          <button type="button" onclick="subirExercicio(${index})">Subir</button>
          <button type="button" onclick="descerExercicio(${index})">Descer</button>
          <button type="button" onclick="duplicarExercicio(${index})">Duplicar</button>
          <button type="button" onclick="window.open('/pages/exercicios/ficha.html?id=${item.exercicio_id}', '_blank')">Ficha</button>
          <button type="button" onclick="removerExercicio(${index})">Remover</button>
        </div>
      </div>
    `;
  });
}

function atualizarItem(index, campo, valorCampo) {
  exerciciosDoTreino[index][campo] = campo === "series" ? Number(valorCampo) : valorCampo;
}

function subirExercicio(index) {
  if (index === 0) return;

  const temp = exerciciosDoTreino[index - 1];
  exerciciosDoTreino[index - 1] = exerciciosDoTreino[index];
  exerciciosDoTreino[index] = temp;

  atualizarOrdem();
  renderizarTreinoAtual();
}

function descerExercicio(index) {
  if (index === exerciciosDoTreino.length - 1) return;

  const temp = exerciciosDoTreino[index + 1];
  exerciciosDoTreino[index + 1] = exerciciosDoTreino[index];
  exerciciosDoTreino[index] = temp;

  atualizarOrdem();
  renderizarTreinoAtual();
}

function duplicarExercicio(index) {
  const item = exerciciosDoTreino[index];

  exerciciosDoTreino.splice(index + 1, 0, {
    ...item,
    ordem: index + 2
  });

  atualizarOrdem();
  renderizarTreinoAtual();
}

function removerExercicio(index) {
  exerciciosDoTreino.splice(index, 1);
  atualizarOrdem();
  renderizarTreinoAtual();
}

function atualizarOrdem() {
  exerciciosDoTreino.forEach((item, index) => {
    item.ordem = index + 1;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (exerciciosDoTreino.length === 0) {
    mostrarAviso("Atenção", "Adicione pelo menos um exercício ao treino.");
    return;
  }

  const treino = {
    aluno_id: valor("aluno_id"),
    nome: valor("nome"),
    objetivo: valor("objetivo"),
    status: valor("status"),
    exercicios: exerciciosDoTreino
  };

  const id = valor("treinoId");
  const url = id ? `${API_TREINOS}/${id}` : API_TREINOS;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(treino)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar treino.");
    return;
  }

  mostrarAviso("Sucesso", "Treino salvo com sucesso.");
  limparTreino();
  treinos = await buscarJSON(API_TREINOS);
  renderizarTreinos();
});

function renderizarTreinos() {
  const tabela = document.getElementById("tabelaTreinos");
  tabela.innerHTML = "";

  treinos.forEach(treino => {
    const aluno = alunos.find(a => a.id === treino.aluno_id);

    tabela.innerHTML += `
      <tr>
        <td>${aluno ? aluno.nome : "Aluno"}</td>
        <td>${treino.nome || ""}</td>
        <td>${treino.objetivo || ""}</td>
        <td>${treino.status || ""}</td>
        <td>${(treino.exercicios || []).length}</td>
        <td>
          <button onclick="editarTreino('${treino.id}')">Editar</button>
          <button onclick="window.location='/pages/treinos/ficha.html?id=${treino.id}'">Ficha</button>
          <button onclick="excluirTreino('${treino.id}')">Excluir</button>
        </td>
      </tr>
    `;
  });
}

function editarTreino(id) {
  const treino = treinos.find(item => item.id === id);
  if (!treino) return;

  document.getElementById("treinoId").value = treino.id || "";
  document.getElementById("aluno_id").value = treino.aluno_id || "";
  document.getElementById("nome").value = treino.nome || "";
  document.getElementById("objetivo").value = treino.objetivo || "";
  document.getElementById("status").value = treino.status || "ativo";

  exerciciosDoTreino = treino.exercicios || [];

  exerciciosDoTreino.forEach(item => {
    const exercicio = exercicios.find(e => e.id === item.exercicio_id);

    if (exercicio) {
      item.nome = exercicio.nome;
      item.imagem_base64 = exercicio.imagem_base64 || "";
      item.grupo_muscular = exercicio.grupo_muscular || "";
      item.equipamento = exercicio.equipamento || "";
    }
  });

  renderizarTreinoAtual();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirTreino(id) {
  mostrarModal(
    "Excluir treino",
    "Deseja realmente excluir este treino?",
    async () => {
      const resposta = await fetch(`${API_TREINOS}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir treino.");
        return;
      }

      mostrarAviso("Sucesso", "Treino excluído com sucesso.");
      treinos = await buscarJSON(API_TREINOS);
      renderizarTreinos();
    }
  );
}

function limparTreino() {
  form.reset();
  document.getElementById("treinoId").value = "";
  exerciciosDoTreino = [];
  renderizarTreinoAtual();
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

window.adicionarExercicio = adicionarExercicio;
window.filtrarExercicios = filtrarExercicios;
window.limparBuscaExercicios = limparBuscaExercicios;
window.atualizarItem = atualizarItem;
window.subirExercicio = subirExercicio;
window.descerExercicio = descerExercicio;
window.duplicarExercicio = duplicarExercicio;
window.removerExercicio = removerExercicio;
window.editarTreino = editarTreino;
window.excluirTreino = excluirTreino;
window.limparTreino = limparTreino;

carregarTudo();