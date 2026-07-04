function carregarSelectAlunos() {
  const select = document.getElementById("aluno_id");
  select.innerHTML = `<option value="">Selecione o aluno</option>`;

  window.treinosEstado.alunos.forEach(aluno => {
    select.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
  });
}

function renderizarTreinos() {
  const tabela = document.getElementById("tabelaTreinos");
  tabela.innerHTML = "";

  window.treinosEstado.treinos.forEach(treino => {
    const aluno = window.treinosEstado.alunos.find(a => a.id === treino.aluno_id);

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
  const treino = window.treinosEstado.treinos.find(item => item.id === id);
  if (!treino) return;

  document.getElementById("treinoId").value = treino.id || "";
  document.getElementById("aluno_id").value = treino.aluno_id || "";
  document.getElementById("nome").value = treino.nome || "";
  document.getElementById("objetivo").value = treino.objetivo || "";
  document.getElementById("status").value = treino.status || "ativo";

  window.treinosEstado.exerciciosDoTreino = treino.exercicios || [];

  window.treinosEstado.exerciciosDoTreino.forEach(item => {
    const exercicio = window.treinosEstado.exercicios.find(e => e.id === item.exercicio_id);

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
      try {
        await excluirJSON(`${API_TREINOS}/${id}`);
        mostrarAviso("Sucesso", "Treino excluído com sucesso.");
        window.treinosEstado.treinos = await buscarJSON(API_TREINOS);
        renderizarTreinos();
      } catch (erro) {
        mostrarErroConsole("Erro ao excluir treino.", erro);
      }
    }
  );
}

window.editarTreino = editarTreino;
window.excluirTreino = excluirTreino;
