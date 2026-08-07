(() => {
  const form = document.getElementById("formEmpresa");
  const mensagem = document.getElementById("mensagem");
  const botao = document.getElementById("btnCriar");
  const $ = id => document.getElementById(id);

  function status(texto = "", tipo = "") {
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`.trim();
  }

  function payload() {
    return {
      nomeEmpresa: $("nomeEmpresa").value.trim(),
      razaoSocial: $("razaoSocial").value.trim(),
      documento: $("documento").value.trim(),
      responsavel: $("responsavel").value.trim(),
      email: $("email").value.trim(),
      telefone: $("telefone").value.trim(),
      senha: $("senha").value
    };
  }

  async function entrar(email, senha) {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Empresa criada, mas não foi possível iniciar a sessão.");
    localStorage.setItem("fusionToken", json.token || "");
    localStorage.setItem("fusionUsuario", JSON.stringify(json.usuario || {}));
    if (json.tenantId) localStorage.setItem("fusionTenantId", json.tenantId);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    status("");
    if (!form.reportValidity()) return;
    if ($("senha").value !== $("confirmarSenha").value) {
      status("As senhas não conferem.", "erro");
      $("confirmarSenha").focus();
      return;
    }

    botao.disabled = true;
    botao.textContent = "Criando ambiente...";
    try {
      const dados = payload();
      const resp = await fetch("/api/saas/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível criar a empresa.");
      status("Ambiente criado. Entrando no Fusion...", "ok");
      await entrar(dados.email, dados.senha);
      location.replace("/pages/dashboard/index.html?onboarding=1");
    } catch (error) {
      status(error.message || "Não foi possível concluir o cadastro.", "erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar minha academia";
    }
  });
})();
