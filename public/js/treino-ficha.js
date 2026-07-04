const API_TREINOS = "/api/treinos";
const API_ALUNOS = "/api/alunos";
const API_EXERCICIOS = "/api/exercicios";

const params = new URLSearchParams(window.location.search);
const treinoId = params.get("id");

if (!treinoId) {
  mostrarAviso("Erro", "Treino não informado.");
  window.location.href = "/pages/treinos/";
}

carregarFicha();

async function carregarFicha() {
  try {
    const [treino, alunos, exercicios] = await Promise.all([
      buscarJSON(`${API_TREINOS}/${treinoId}`),
      buscarJSON(API_ALUNOS),
      buscarJSON(API_EXERCICIOS)
    ]);

    const aluno = alunos.find(a => a.id === treino.aluno_id);

    document.getElementById("nomeTreino").textContent = treino.nome || "Treino";
    document.getElementById("nomeAluno").textContent = aluno?.nome || "-";
    document.getElementById("objetivo").textContent = treino.objetivo || "-";
    document.getElementById("status").textContent = treino.status || "-";

    renderizarExercicios(treino.exercicios || [], exercicios);

    document.getElementById("btnEditar").onclick = () => {
      window.location.href = `/pages/treinos/?id=${treino.id}`;
    };

  } catch (erro) {
    console.error(erro);
    mostrarAviso("Erro", "Não foi possível carregar o treino.");
  }
}

function renderizarExercicios(lista, biblioteca) {

  const div = document.getElementById("listaExerciciosTreino");
  div.innerHTML = "";

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhum exercício cadastrado.</p>";
    return;
  }

  lista
    .sort((a, b) => a.ordem - b.ordem)
    .forEach(item => {

      const exercicio = biblioteca.find(e => e.id === item.exercicio_id);

      div.innerHTML += `

        <div class="card" style="margin-bottom:20px;">

          <h3>${item.ordem}. ${exercicio?.nome || item.nome || "-"}</h3>

          <div class="ficha-grid">

            <p><strong>Grupo:</strong><br>${exercicio?.grupo_muscular || "-"}</p>

            <p><strong>Equipamento:</strong><br>${exercicio?.equipamento || "-"}</p>

            <p><strong>Séries:</strong><br>${item.series || "-"}</p>

            <p><strong>Repetições:</strong><br>${item.repeticoes || "-"}</p>

            <p><strong>Carga:</strong><br>${item.carga || "-"}</p>

            <p><strong>Descanso:</strong><br>${item.descanso || "-"}</p>

            <p><strong>Cadência:</strong><br>${item.cadencia || "-"}</p>

          </div>

          <br>

          <strong>Observações</strong>

          <p>${item.observacoes || "Nenhuma observação."}</p>

        </div>

      `;
    });

}

async function buscarJSON(url) {
  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error("Erro ao carregar dados.");
  }

  return await resposta.json();
}