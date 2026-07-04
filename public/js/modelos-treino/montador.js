function adicionarExercicioModelo(id) {
  const exercicio = exercicios.find(item => item.id === id);
  if (!exercicio) return;

  exerciciosDoModelo.push({
    exercicio_id: exercicio.id,
    nome: exercicio.nome,
    imagem_base64: exercicio.imagem_base64 || "",
    grupo_muscular: exercicio.grupo_muscular || "",
    equipamento: exercicio.equipamento || "",
    ordem: exerciciosDoModelo.length + 1,
    series: 3,
    repeticoes: "10",
    carga: "",
    descanso: "60s",
    cadencia: "",
    observacoes: ""
  });

  renderizarModeloAtual();
}

function renderizarModeloAtual() {
  const div = document.getElementById("listaModelo");
  div.innerHTML = "";

  if (exerciciosDoModelo.length === 0) {
    div.innerHTML = "<p>Nenhum exercício adicionado ao modelo.</p>";
    return;
  }

  exerciciosDoModelo.forEach((item, index) => {
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
          <input value="${item.series}" onchange="atualizarItemModelo(${index}, 'series', this.value)" placeholder="Séries">
          <input value="${item.repeticoes}" onchange="atualizarItemModelo(${index}, 'repeticoes', this.value)" placeholder="Repetições">
          <input value="${item.carga}" onchange="atualizarItemModelo(${index}, 'carga', this.value)" placeholder="Carga">
          <input value="${item.descanso}" onchange="atualizarItemModelo(${index}, 'descanso', this.value)" placeholder="Descanso">
          <input value="${item.cadencia}" onchange="atualizarItemModelo(${index}, 'cadencia', this.value)" placeholder="Cadência">
        </div>

        <textarea onchange="atualizarItemModelo(${index}, 'observacoes', this.value)" placeholder="Observações">${item.observacoes || ""}</textarea>

        <div class="form-actions">
          <button type="button" onclick="subirExercicioModelo(${index})">Subir</button>
          <button type="button" onclick="descerExercicioModelo(${index})">Descer</button>
          <button type="button" onclick="duplicarExercicioModelo(${index})">Duplicar</button>
          <button type="button" onclick="window.open('/pages/exercicios/ficha.html?id=${item.exercicio_id}', '_blank')">Ficha</button>
          <button type="button" onclick="removerExercicioModelo(${index})">Remover</button>
        </div>
      </div>
    `;
  });
}

function atualizarItemModelo(index, campo, valorCampo) {
  exerciciosDoModelo[index][campo] = campo === "series" ? Number(valorCampo) : valorCampo;
}

function subirExercicioModelo(index) {
  if (index === 0) return;

  const temp = exerciciosDoModelo[index - 1];
  exerciciosDoModelo[index - 1] = exerciciosDoModelo[index];
  exerciciosDoModelo[index] = temp;

  atualizarOrdem(exerciciosDoModelo);
  renderizarModeloAtual();
}

function descerExercicioModelo(index) {
  if (index === exerciciosDoModelo.length - 1) return;

  const temp = exerciciosDoModelo[index + 1];
  exerciciosDoModelo[index + 1] = exerciciosDoModelo[index];
  exerciciosDoModelo[index] = temp;

  atualizarOrdem(exerciciosDoModelo);
  renderizarModeloAtual();
}

function duplicarExercicioModelo(index) {
  const item = exerciciosDoModelo[index];

  exerciciosDoModelo.splice(index + 1, 0, {
    ...item,
    ordem: index + 2
  });

  atualizarOrdem(exerciciosDoModelo);
  renderizarModeloAtual();
}

function removerExercicioModelo(index) {
  exerciciosDoModelo.splice(index, 1);
  atualizarOrdem(exerciciosDoModelo);
  renderizarModeloAtual();
}

window.adicionarExercicioModelo = adicionarExercicioModelo;
window.atualizarItemModelo = atualizarItemModelo;
window.subirExercicioModelo = subirExercicioModelo;
window.descerExercicioModelo = descerExercicioModelo;
window.duplicarExercicioModelo = duplicarExercicioModelo;
window.removerExercicioModelo = removerExercicioModelo;
