function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

function atualizarOrdem(lista) {
  lista.forEach((item, index) => {
    item.ordem = index + 1;
  });
}

function mostrarErroConsole(contexto, erro) {
  console.error(contexto, erro);
  if (typeof mostrarAviso === "function") {
    mostrarAviso("Erro", contexto);
  } else {
    alert(contexto);
  }
}
