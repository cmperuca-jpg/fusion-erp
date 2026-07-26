const form = document.querySelector("form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.querySelector('input[type="email"]').value.trim();
  const senha = document.querySelector('input[type="password"]').value.trim();

  if (!email || !senha) {
    alert("Informe o e-mail e a senha.");
    return;
  }

  try {
    if (window.FusionAuth?.login) {
      await window.FusionAuth.login(email, senha);
    } else {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });
      const payload = await resposta.json().catch(() => ({}));
      if (!resposta.ok || payload.ok === false) throw new Error(payload.mensagem || "E-mail ou senha invalidos.");

      localStorage.setItem("fusionToken", payload.token || "");
      localStorage.setItem("fusionUsuario", JSON.stringify(payload.usuario || {}));
      localStorage.setItem("usuarioLogado", "true");
      localStorage.setItem("usuarioNome", payload.usuario?.nome || "Usuario");
    }

    window.location.href = "/pages/dashboard/";
  } catch (erro) {
    alert(erro.message || "E-mail ou senha invalidos.");
  }
});
