const usuarioLogado = localStorage.getItem("usuarioLogado");
const usuarioNome = localStorage.getItem("usuarioNome") || "Usuário";

if (usuarioLogado !== "true") {
    window.location.href = "/pages/login/";
}

const nomeUsuario = document.getElementById("nomeUsuario");

if (nomeUsuario) {
    nomeUsuario.textContent = usuarioNome;
}

function sair() {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("usuarioNome");
    window.location.href = "/pages/login.html";
}