const form = document.getElementById("formModelo");

let alunos = [];
let exercicios = [];
let modelos = [];
let exerciciosDoModelo = [];

async function carregarTudo() {
  alunos = await buscarJSON(API_ALUNOS);
  exercicios = await buscarJSON(API_EXERCICIOS);
  modelos = await buscarJSON(API_MODELOS);

  carregarSelectAlunos();
  renderizarExercicios(exercicios);
  renderizarModeloAtual();
  renderizarModelos();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (exerciciosDoModelo.length === 0) {
    mostrarAviso("Atenção", "Adicione pelo menos um exercício ao modelo.");
    return;
  }

  const modelo = {
    nome: valor("nome"),
    objetivo: valor("objetivo"),
    categoria: valor("categoria"),
    nivel: valor("nivel"),
    status: valor("status"),
    descricao: valor("descricao"),
    exercicios: exerciciosDoModelo
  };

  const id = valor("modeloId");
  const url = id ? `${API_MODELOS}/${id}` : API_MODELOS;
  const metodo = id ? "PUT" : "POST";

  try {
    await salvarJSON(url, metodo, modelo);
    mostrarAviso("Sucesso", "Modelo salvo com sucesso.");

    limparModelo();

    modelos = await buscarJSON(API_MODELOS);
    renderizarModelos();

  } catch (erro) {
    mostrarAviso("Erro", erro.message);
  }
});

function limparModelo() {
  form.reset();
  document.getElementById("modeloId").value = "";
  exerciciosDoModelo = [];
  renderizarModeloAtual();
}

async function aplicarModeloAoAluno() {
  const modeloId = valor("modeloAplicar");
  const alunoId = valor("alunoAplicar");

  if (!modeloId || !alunoId) {
    mostrarAviso("Atenção", "Selecione um modelo e um aluno.");
    return;
  }

  const modelo = modelos.find(item => item.id === modeloId);

  if (!modelo) {
    mostrarAviso("Erro", "Modelo não encontrado.");
    return;
  }

  const treino = {
    aluno_id: alunoId,
    nome: modelo.nome,
    objetivo: modelo.objetivo || "",
    status: "ativo",
    exercicios: (modelo.exercicios || []).map((item, index) => ({
      exercicio_id: item.exercicio_id,
      ordem: index + 1,
      series: item.series || 3,
      repeticoes: item.repeticoes || "10",
      carga: item.carga || "",
      descanso: item.descanso || "60s",
      cadencia: item.cadencia || "",
      observacoes: item.observacoes || ""
    }))
  };

  try {
    await salvarJSON(API_TREINOS, "POST", treino);
    mostrarAviso("Sucesso", "Modelo aplicado ao aluno e treino criado.");
  } catch (erro) {
    mostrarAviso("Erro", erro.message);
  }
}

window.limparModelo = limparModelo;
window.aplicarModeloAoAluno = aplicarModeloAoAluno;

carregarTudo();
