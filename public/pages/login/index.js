document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const erro = document.getElementById("erro");
  const btn = document.getElementById("btnEntrar");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");

  if (!form || !window.FusionAuth) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.textContent = "";
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
      const usuario = await FusionAuth.login(email.value, senha.value);
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      window.location.href = next || FusionAuth.destinoPorPerfil(usuario);
    } catch (err) {
      erro.textContent = err.message || "Erro ao entrar.";
      senha.focus();
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
});
