function toast(mensagem, tipo = "info") {
  let container = document.querySelector(".toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const item = document.createElement("div");
  item.className = `toast toast-${tipo}`;
  item.textContent = mensagem;
  container.appendChild(item);

  setTimeout(() => item.remove(), 3500);
}
