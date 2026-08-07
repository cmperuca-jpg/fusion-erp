(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));

  let novaAcademia = null;

  function status(el, texto = "", tipo = "") {
    if (!el) return;
    el.textContent = texto;
    el.className = `mensagem ${tipo}`.trim();
  }

  function limparSessaoAnterior() {
    [
      "fusionToken","fusionUsuario","usuarioLogado","usuarioNome",
      "usuarioEmail","usuarioPerfil","fusionTenantId"
    ].forEach(k => localStorage.removeItem(k));
  }

  function salvarSessao(json = {}) {
    limparSessaoAnterior();
    localStorage.setItem("fusionToken", json.token || "");
    localStorage.setItem("fusionUsuario", JSON.stringify(json.usuario || {}));
    localStorage.setItem("usuarioLogado", "true");
    if (json.usuario?.nome) localStorage.setItem("usuarioNome", json.usuario.nome);
    if (json.usuario?.email) localStorage.setItem("usuarioEmail", json.usuario.email);
    if (json.usuario?.perfil) localStorage.setItem("usuarioPerfil", json.usuario.perfil);
    if (json.tenantId) localStorage.setItem("fusionTenantId", json.tenantId);
  }

  function abrirTab(nome) {
    tabs.forEach(tab => {
      const ativo = tab.dataset.tab === nome;
      tab.classList.toggle("ativo", ativo);
      tab.setAttribute("aria-selected", ativo ? "true" : "false");
    });
    panels.forEach(panel => {
      const ativo = panel.dataset.panel === nome;
      panel.hidden = !ativo;
      panel.classList.toggle("ativo", ativo);
    });
    $("painelSucesso").hidden = true;
  }

  tabs.forEach(tab => tab.addEventListener("click", () => abrirTab(tab.dataset.tab)));

  async function loginGeral(academia, codigo, senha) {
    const resp = await fetch("/api/auth/login-empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ academia, codigoAcesso: codigo, senha })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível entrar nesta academia.");
    salvarSessao(json);
    return json;
  }

  $("formAcesso").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const academia = $("academiaAcesso").value.trim();
    const codigo = $("codigoAcesso").value.trim().toUpperCase();
    const senha = $("senhaAcesso").value;
    const botao = $("btnEntrar");

    status($("mensagemAcesso"), "");
    botao.disabled = true;
    botao.textContent = "Validando academia...";

    try {
      const json = await loginGeral(academia, codigo, senha);
      status($("mensagemAcesso"), `Acesso confirmado: ${json.academia?.nome || academia}.`, "ok");
      location.replace(`/pages/dashboard/index.html?tenant=${encodeURIComponent(json.tenantId)}`);
    } catch (error) {
      limparSessaoAnterior();
      status($("mensagemAcesso"), error.message || "Academia, código ou senha inválidos.", "erro");
      $("senhaAcesso").focus();
    } finally {
      botao.disabled = false;
      botao.textContent = "Entrar no sistema";
    }
  });

  function payloadEmpresa() {
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

  $("formEmpresa").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    status($("mensagemCriacao"), "");
    if (!form.reportValidity()) return;

    if ($("senha").value !== $("confirmarSenha").value) {
      status($("mensagemCriacao"), "As senhas não conferem.", "erro");
      $("confirmarSenha").focus();
      return;
    }

    const botao = $("btnCriar");
    botao.disabled = true;
    botao.textContent = "Criando ambiente...";

    try {
      const dados = payloadEmpresa();
      const resp = await fetch("/api/saas/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(dados)
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível criar a empresa.");

      const codigo = String(json.codigoAcesso || json.resultado?.access_code || "").toUpperCase();
      if (!codigo) throw new Error("Academia criada, mas o código de acesso não foi retornado.");

      novaAcademia = {
        academia: dados.nomeEmpresa,
        codigo,
        senha: dados.senha,
        tenantId: json.tenantId
      };

      panels.forEach(panel => panel.hidden = true);
      tabs.forEach(tab => tab.classList.remove("ativo"));
      $("painelSucesso").hidden = false;
      $("sucessoAcademia").textContent = dados.nomeEmpresa;
      $("sucessoCodigo").textContent = codigo;
      status($("mensagemSucesso"), "Guarde este código. Ele identifica o acesso administrativo desta academia.", "ok");
    } catch (error) {
      status($("mensagemCriacao"), error.message || "Não foi possível concluir o cadastro.", "erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar minha academia";
    }
  });

  $("btnCopiarCodigo").addEventListener("click", async () => {
    if (!novaAcademia?.codigo) return;
    try {
      await navigator.clipboard.writeText(novaAcademia.codigo);
      status($("mensagemSucesso"), "Código copiado.", "ok");
    } catch {
      status($("mensagemSucesso"), `Código: ${novaAcademia.codigo}`, "ok");
    }
  });

  $("btnEntrarNovo").addEventListener("click", async () => {
    if (!novaAcademia) return;
    const botao = $("btnEntrarNovo");
    botao.disabled = true;
    botao.textContent = "Entrando...";
    try {
      const json = await loginGeral(novaAcademia.academia, novaAcademia.codigo, novaAcademia.senha);
      location.replace(`/pages/dashboard/index.html?onboarding=1&tenant=${encodeURIComponent(json.tenantId)}`);
    } catch (error) {
      status($("mensagemSucesso"), error.message || "Não foi possível iniciar a sessão.", "erro");
      botao.disabled = false;
      botao.textContent = "Entrar no sistema";
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get("acao") === "criar") abrirTab("criar");
  else abrirTab("entrar");
})();
