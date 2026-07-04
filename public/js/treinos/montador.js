function adicionarExercicio(id) {
  const exercicio = window.treinosEstado.exercicios.find(item => item.id === id);
  if (!exercicio) return;

  window.treinosEstado.exerciciosDoTreino.push({
    exercicio_id: exercicio.id,
    nome: exercicio.nome,
    imagem_base64: exercicio.imagem_base64 || "",
    grupo_muscular: exercicio.grupo_muscular || "",
    equipamento: exercicio.equipamento || "",
    ordem: window.treinosEstado.exerciciosDoTreino.length + 1,
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

  const lista = window.treinosEstado.exerciciosDoTreino;

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhum exercício adicionado.</p>";
    return;
  }

  lista.forEach((item, index) => {
    div.innerHTML += `
      <div class="treino-card" data-index="${index}" draggable="true">
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

  if (typeof iniciarDragDropTreino === "function") {
    iniciarDragDropTreino();
  }
}

function atualizarItem(index, campo, valorCampo) {
  window.treinosEstado.exerciciosDoTreino[index][campo] = campo === "series" ? Number(valorCampo) : valorCampo;
}

function subirExercicio(index) {
  const lista = window.treinosEstado.exerciciosDoTreino;
  if (index === 0) return;

  const temp = lista[index - 1];
  lista[index - 1] = lista[index];
  lista[index] = temp;

  atualizarOrdem(lista);
  renderizarTreinoAtual();
}

function descerExercicio(index) {
  const lista = window.treinosEstado.exerciciosDoTreino;
  if (index === lista.length - 1) return;

  const temp = lista[index + 1];
  lista[index + 1] = lista[index];
  lista[index] = temp;

  atualizarOrdem(lista);
  renderizarTreinoAtual();
}

function duplicarExercicio(index) {
  const lista = window.treinosEstado.exerciciosDoTreino;
  const item = lista[index];

  lista.splice(index + 1, 0, {
    ...item,
    ordem: index + 2
  });

  atualizarOrdem(lista);
  renderizarTreinoAtual();
}

function removerExercicio(index) {
  const lista = window.treinosEstado.exerciciosDoTreino;
  lista.splice(index, 1);
  atualizarOrdem(lista);
  renderizarTreinoAtual();
}

function limparTreino() {
  const form = document.getElementById("formTreino");
  form.reset();
  document.getElementById("treinoId").value = "";
  window.treinosEstado.exerciciosDoTreino = [];
  renderizarTreinoAtual();
}

window.adicionarExercicio = adicionarExercicio;
window.atualizarItem = atualizarItem;
window.subirExercicio = subirExercicio;
window.descerExercicio = descerExercicio;
window.duplicarExercicio = duplicarExercicio;
window.removerExercicio = removerExercicio;
window.limparTreino = limparTreino;
