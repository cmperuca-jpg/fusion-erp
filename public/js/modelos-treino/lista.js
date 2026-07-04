function renderizarModelos() {
  const tabela = document.getElementById("tabelaModelos");
  tabela.innerHTML = "";

  const selectModelo = document.getElementById("modeloAplicar");
  selectModelo.innerHTML = `<option value="">Selecione o modelo</option>`;

  modelos.forEach(modelo => {
    selectModelo.innerHTML += `<option value="${modelo.id}">${modelo.nome}</option>`;

    tabela.innerHTML += `
      <tr>
        <td>${modelo.nome || ""}</td>
        <td>${modelo.objetivo || ""}</td>
        <td>${modelo.categoria || ""}</td>
        <td>${modelo.nivel || ""}</td>
        <td>${modelo.status || ""}</td>
        <td>${(modelo.exercicios || []).length}</td>
        <td>
          <button onclick="editarModelo('${modelo.id}')">Editar</button>
          <button onclick="aplicarModeloRapido('${modelo.id}')">Aplicar</button>
          <button onclick="excluirModelo('${modelo.id}')">Excluir</button>
        </td>
      </tr>
    `;
  });
}

function carregarSelectAlunos() {
  const select = document.getElementById("alunoAplicar");
  select.innerHTML = `<option value="">Selecione o aluno</option>`;

  alunos.forEach(aluno => {
    select.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
  });
}

function editarModelo(id) {
  const modelo = modelos.find(item => item.id === id);
  if (!modelo) return;

  document.getElementById("modeloId").value = modelo.id || "";
  document.getElementById("nome").value = modelo.nome || "";
  document.getElementById("objetivo").value = modelo.objetivo || "";
  document.getElementById("categoria").value = modelo.categoria || "";
  document.getElementById("nivel").value = modelo.nivel || "";
  document.getElementById("status").value = modelo.status || "ativo";
  document.getElementById("descricao").value = modelo.descricao || "";

  exerciciosDoModelo = modelo.exercicios || [];

  exerciciosDoModelo.forEach(item => {
    const exercicio = exercicios.find(e => e.id === item.exercicio_id);

    if (exercicio) {
      item.nome = exercicio.nome;
      item.imagem_base64 = exercicio.imagem_base64 || "";
      item.grupo_muscular = exercicio.grupo_muscular || "";
      item.equipamento = exercicio.equipamento || "";
    }
  });

  renderizarModeloAtual();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirModelo(id) {
  mostrarModal(
    "Excluir modelo",
    "Deseja realmente excluir este modelo de treino?",
    async () => {
      try {
        await excluirJSON(`${API_MODELOS}/${id}`);
        mostrarAviso("Sucesso", "Modelo excluído com sucesso.");
        modelos = await buscarJSON(API_MODELOS);
        renderizarModelos();
      } catch (erro) {
        mostrarAviso("Erro", erro.message);
      }
    }
  );
}

function aplicarModeloRapido(id) {
  document.getElementById("modeloAplicar").value = id;
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

window.editarModelo = editarModelo;
window.excluirModelo = excluirModelo;
window.aplicarModeloRapido = aplicarModeloRapido;
