function protegerPagina() {
  const logado = localStorage.getItem("usuarioLogado");
  if (!logado) {
    window.location.href = "/pages/login/";
  }
}

function salvarSessaoUsuario(nome = "Administrador") {
  localStorage.setItem("usuarioLogado", "true");
  localStorage.setItem("usuarioNome", nome);
}
