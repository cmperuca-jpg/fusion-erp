let indiceArrastado = null;

function iniciarDragDropTreino() {
  const cards = document.querySelectorAll(".treino-card");

  cards.forEach(card => {
    card.addEventListener("dragstart", () => {
      indiceArrastado = Number(card.dataset.index);
      card.classList.add("arrastando");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("arrastando");
      indiceArrastado = null;
    });

    card.addEventListener("dragover", e => {
      e.preventDefault();
    });

    card.addEventListener("drop", () => {
      const indiceDestino = Number(card.dataset.index);

      if (indiceArrastado === null || indiceArrastado === indiceDestino) {
        return;
      }

      const lista = window.treinosEstado.exerciciosDoTreino;
      const [movido] = lista.splice(indiceArrastado, 1);
      lista.splice(indiceDestino, 0, movido);

      atualizarOrdem(lista);
      renderizarTreinoAtual();
    });
  });
}
