function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

function preencher(id, valorCampo) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valorCampo || "-";
  }
}
