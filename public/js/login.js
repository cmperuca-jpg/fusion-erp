const form = document.querySelector("form");

form.addEventListener("submit", (e) => {

    e.preventDefault();

    const email = document.querySelector('input[type="email"]').value.trim();
    const senha = document.querySelector('input[type="password"]').value.trim();

    if (email === "" || senha === "") {
        alert("Informe o e-mail e a senha.");
        return;
    }

    // Login provisório para desenvolvimento
    if (email === "admin@fusion.com" && senha === "123456") {

        localStorage.setItem("usuarioLogado", "true");
        localStorage.setItem("usuarioNome", "Administrador");

        window.location.href = "/pages/dashboard/";

    } else {

        alert("E-mail ou senha inválidos.");

    }

});