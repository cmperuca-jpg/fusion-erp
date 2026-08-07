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
    try {
      sessionStorage.removeItem("fusionTenantSelectionToken");
      sessionStorage.removeItem("fusionAcademiaSelecionadaNome");
    } catch {}
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

  async function selecionarAcademia(academia, codigo) {
    const resp = await fetch("/api/auth/selecionar-empresa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify({ academia, codigoAcesso: codigo })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível selecionar esta academia.");
    return json;
  }

  function salvarSelecao(json = {}) {
    limparSessaoAnterior();
    const tenantId = String(json.tenantId || "").trim();
    const nome = String(json.academia?.nome || tenantId).trim();
    const selectionToken = String(json.selectionToken || "").trim();
    if (!tenantId || !selectionToken) throw new Error("A seleção da academia não foi concluída.");
    localStorage.setItem("fusionTenantId", tenantId);
    sessionStorage.setItem("fusionTenantSelectionToken", selectionToken);
    sessionStorage.setItem("fusionAcademiaSelecionadaNome", nome);
  }

  function irParaLogin(json = {}, extras = {}) {
    salvarSelecao(json);
    const params = new URLSearchParams({
      tenant: json.tenantId,
      academia: json.academia?.nome || json.tenantId
    });
    if (extras.next) params.set("next", extras.next);
    if (extras.onboarding) params.set("onboarding", "1");
    location.replace(`/pages/login/index.html?${params.toString()}`);
  }

  $("formAcesso").addEventListener("submit", async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const academia = $("academiaAcesso").value.trim();
    const codigo = $("codigoAcesso").value.trim().toUpperCase();
    const botao = $("btnEntrar");
    status($("mensagemAcesso"), "");
    botao.disabled = true;
    botao.textContent = "Validando academia...";

    try {
      const json = await selecionarAcademia(academia, codigo);
      const next = new URLSearchParams(location.search).get("next") || "";
      status($("mensagemAcesso"), `Academia confirmada: ${json.academia?.nome || academia}.`, "ok");
      irParaLogin(json, { next });
    } catch (error) {
      limparSessaoAnterior();
      status($("mensagemAcesso"), error.message || "Academia ou código inválidos.", "erro");
      $("codigoAcesso").focus();
    } finally {
      botao.disabled = false;
      botao.textContent = "Continuar para o login";
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
        cache: "no-store",
        body: JSON.stringify(dados)
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível criar a empresa.");

      const codigo = String(json.codigoAcesso || json.resultado?.academy_access_code || json.resultado?.access_code || "").toUpperCase();
      if (!codigo) throw new Error("Academia criada, mas o código da academia não foi retornado.");

      novaAcademia = {
        academia: dados.nomeEmpresa,
        codigo,
        tenantId: json.tenantId
      };

      panels.forEach(panel => panel.hidden = true);
      tabs.forEach(tab => tab.classList.remove("ativo"));
      $("painelSucesso").hidden = false;
      $("sucessoAcademia").textContent = dados.nomeEmpresa;
      $("sucessoCodigo").textContent = codigo;
      status($("mensagemSucesso"), "Guarde este código. Ele identifica a academia; usuários e senhas continuam individuais.", "ok");
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
      status($("mensagemSucesso"), "Código da academia copiado.", "ok");
    } catch {
      status($("mensagemSucesso"), `Código da academia: ${novaAcademia.codigo}`, "ok");
    }
  });

  $("btnEntrarNovo").addEventListener("click", async () => {
    if (!novaAcademia) return;
    const botao = $("btnEntrarNovo");
    botao.disabled = true;
    botao.textContent = "Preparando login...";
    status($("mensagemSucesso"), "");
    try {
      const json = await selecionarAcademia(novaAcademia.academia, novaAcademia.codigo);
      irParaLogin(json, { onboarding: true });
    } catch (error) {
      status($("mensagemSucesso"), error.message || "Não foi possível abrir o login.", "erro");
      botao.disabled = false;
      botao.textContent = "Ir para o login";
    }
  });

  limparSessaoAnterior();
  const params = new URLSearchParams(location.search);
  if (params.get("acao") === "criar") abrirTab("criar");
  else abrirTab("entrar");
  if (params.get("academia")) $("academiaAcesso").value = params.get("academia");
  if (params.get("codigo")) $("codigoAcesso").value = params.get("codigo").toUpperCase();
})();
