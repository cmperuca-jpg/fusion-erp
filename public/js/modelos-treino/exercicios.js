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
          <button type="button" onclick="adicionarExercicioModelo('${exercicio.id}')">Adicionar</button>
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

window.filtrarExercicios = filtrarExercicios;
window.limparBuscaExercicios = limparBuscaExercicios;
