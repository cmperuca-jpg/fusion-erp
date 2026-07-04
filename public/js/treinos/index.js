window.treinosEstado = {
  alunos: [],
  exercicios: [],
  treinos: [],
  exerciciosDoTreino: []
};

const formTreino = document.getElementById("formTreino");

async function carregarTudo() {
  try {
    window.treinosEstado.alunos = await buscarJSON(API_ALUNOS);
    window.treinosEstado.exercicios = await buscarJSON(API_EXERCICIOS);
    window.treinosEstado.treinos = await buscarJSON(API_TREINOS);

    carregarSelectAlunos();
    renderizarExercicios(window.treinosEstado.exercicios);
    renderizarTreinos();
    renderizarTreinoAtual();
  } catch (erro) {
    mostrarErroConsole("Erro ao carregar dados do módulo de treinos.", erro);
  }
}

formTreino.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (window.treinosEstado.exerciciosDoTreino.length === 0) {
    mostrarAviso("Atenção", "Adicione pelo menos um exercício ao treino.");
    return;
  }

  const treino = {
    aluno_id: valor("aluno_id"),
    nome: valor("nome"),
    objetivo: valor("objetivo"),
    status: valor("status"),
    exercicios: window.treinosEstado.exerciciosDoTreino
  };

  const id = valor("treinoId");
  const url = id ? `${API_TREINOS}/${id}` : API_TREINOS;
  const metodo = id ? "PUT" : "POST";

  try {
    await salvarJSON(url, metodo, treino);
    mostrarAviso("Sucesso", "Treino salvo com sucesso.");
    limparTreino();
    window.treinosEstado.treinos = await buscarJSON(API_TREINOS);
    renderizarTreinos();
  } catch (erro) {
    mostrarAviso("Erro", erro.message || "Erro ao salvar treino.");
  }
});

carregarTudo();
