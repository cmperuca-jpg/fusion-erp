(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  let cadastroPendente = null;

  function status(el,texto="",tipo="") {
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

  function mostrarTabs(visivel=true) {
    $("tabsAcesso").hidden = !visivel;
  }

  function abrirTab(nome) {
    $("painelAtivacao").hidden = true;
    mostrarTabs(true);

    tabs.forEach(tab => {
      const ativo = tab.dataset.tab === nome;
      tab.classList.toggle("ativo",ativo);
      tab.setAttribute("aria-selected",ativo ? "true" : "false");
    });

    panels.forEach(panel => {
      const ativo = panel.dataset.panel === nome;
      panel.hidden = !ativo;
      panel.classList.toggle("ativo",ativo);
    });
  }

  tabs.forEach(tab => tab.addEventListener("click",()=>abrirTab(tab.dataset.tab)));

  async function selecionarAcademia(academia,codigo) {
    const resp = await fetch("/api/auth/selecionar-empresa",{
      method:"POST",
      headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
      cache:"no-store",
      body:JSON.stringify({academia,codigoAcesso:codigo})
    });
    const json = await resp.json().catch(()=>({}));
    if (!resp.ok || !json.ok) throw new Error(json.mensagem || "Não foi possível selecionar esta academia.");
    return json;
  }

  function salvarSelecao(json={}) {
    limparSessaoAnterior();
    const tenantId = String(json.tenantId || "").trim();
    const nome = String(json.academia?.nome || tenantId).trim();
    const selectionToken = String(json.selectionToken || "").trim();

    if (!tenantId || !selectionToken) {
      throw new Error("A seleção da academia não foi concluída.");
    }

    localStorage.setItem("fusionTenantId",tenantId);
    sessionStorage.setItem("fusionTenantSelectionToken",selectionToken);
    sessionStorage.setItem("fusionAcademiaSelecionadaNome",nome);
  }

  function irParaLogin(json={},extras={}) {
    salvarSelecao(json);
    const params = new URLSearchParams({
      tenant:json.tenantId,
      academia:json.academia?.nome || json.tenantId
    });
    if (extras.next) params.set("next",extras.next);
    location.replace(`/pages/login/index.html?${params.toString()}`);
  }

  $("formAcesso").addEventListener("submit",async event=>{
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const academia = $("academiaAcesso").value.trim();
    const codigo = $("codigoAcesso").value.trim().toUpperCase();
    const botao = $("btnEntrar");

    status($("mensagemAcesso"),"");
    botao.disabled = true;
    botao.textContent = "Validando academia...";

    try {
      const json = await selecionarAcademia(academia,codigo);
      const next = new URLSearchParams(location.search).get("next") || "";
      status($("mensagemAcesso"),`Academia confirmada: ${json.academia?.nome || academia}.`,"ok");
      irParaLogin(json,{next});
    } catch(error) {
      limparSessaoAnterior();
      status($("mensagemAcesso"),error.message || "Academia ou código inválidos.","erro");
      $("codigoAcesso").focus();
    } finally {
      botao.disabled = false;
      botao.textContent = "Continuar para o login";
    }
  });

  function payloadEmpresa() {
    return {
      nomeEmpresa:$("nomeEmpresa").value.trim(),
      razaoSocial:$("razaoSocial").value.trim(),
      documento:$("documento").value.trim(),
      responsavel:$("responsavel").value.trim(),
      email:$("email").value.trim(),
      telefone:$("telefone").value.trim(),
      senha:$("senha").value
    };
  }

  function validarDocumentoRazao() {
    const documento = $("documento").value.replace(/\D/g,"");
    const razao = $("razaoSocial");
    const cnpj = documento.length === 14;
    razao.required = cnpj;

    if (cnpj && !razao.value.trim()) {
      razao.setCustomValidity("Informe a razão social para cadastro com CNPJ.");
    } else {
      razao.setCustomValidity("");
    }
  }

  $("documento").addEventListener("input",()=>{
    $("documento").value = $("documento").value.replace(/\D/g,"").slice(0,14);
    validarDocumentoRazao();
  });
  $("razaoSocial").addEventListener("input",validarDocumentoRazao);

  $("formEmpresa").addEventListener("submit",async event=>{
    event.preventDefault();
    const form = event.currentTarget;

    status($("mensagemCriacao"),"");
    validarDocumentoRazao();
    if (!form.reportValidity()) return;

    if ($("senha").value !== $("confirmarSenha").value) {
      status($("mensagemCriacao"),"As senhas não conferem.","erro");
      $("confirmarSenha").focus();
      return;
    }

    const botao = $("btnCriar");
    botao.disabled = true;
    botao.textContent = "Validando dados...";

    try {
      const dados = payloadEmpresa();

      const resp = await fetch("/api/saas/empresas",{
        method:"POST",
        headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
        cache:"no-store",
        body:JSON.stringify({acao:"iniciar",...dados})
      });

      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json.ok) {
        throw new Error(json.mensagem || "Não foi possível iniciar o cadastro.");
      }

      cadastroPendente = {
        requestId:String(json.requestId || ""),
        academia:dados.nomeEmpresa,
        emailAdmin:dados.email,
        senhaAdmin:dados.senha
      };

      if (!cadastroPendente.requestId) {
        throw new Error("O servidor não retornou a solicitação de ativação.");
      }

      panels.forEach(panel=>panel.hidden=true);
      tabs.forEach(tab=>tab.classList.remove("ativo"));
      mostrarTabs(false);

      $("painelAtivacao").hidden = false;
      $("emailAtivacao").textContent = json.destino || dados.email;
      $("textoAtivacao").textContent =
        `${json.mensagem || "Código enviado."} Validade: ${json.expiraMinutos || 10} minutos.`;

      status($("mensagemAtivacao"),"Verifique a caixa de entrada e também a pasta de spam.","ok");
      $("codigoAtivacao").value = "";
      $("codigoAtivacao").focus();
    } catch(error) {
      status($("mensagemCriacao"),error.message || "Não foi possível validar o cadastro.","erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Validar dados e enviar código";
    }
  });

  $("formAtivacao").addEventListener("submit",async event=>{
    event.preventDefault();

    if (!cadastroPendente?.requestId) {
      status($("mensagemAtivacao"),"Preencha o cadastro novamente.","erro");
      return;
    }

    const codigo = $("codigoAtivacao").value.replace(/\D/g,"").slice(0,6);
    $("codigoAtivacao").value = codigo;

    if (codigo.length !== 6) {
      status($("mensagemAtivacao"),"Informe os 6 dígitos enviados por e-mail.","erro");
      $("codigoAtivacao").focus();
      return;
    }

    const botao = $("btnConfirmarAtivacao");
    botao.disabled = true;
    botao.textContent = "Confirmando e-mail...";
    status($("mensagemAtivacao"),"");

    try {
      const resp = await fetch("/api/saas/empresas",{
        method:"POST",
        headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
        cache:"no-store",
        body:JSON.stringify({
          acao:"confirmar",
          requestId:cadastroPendente.requestId,
          codigo
        })
      });

      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json.ok) {
        throw new Error(json.mensagem || "Não foi possível confirmar o código.");
      }

      salvarSelecao(json);

      const tenant = String(json.tenantId || "").trim();
      const onboarding = `/pages/configuracao-inicial/index.html?tenant=${encodeURIComponent(tenant)}`;

      status($("mensagemAtivacao"),"E-mail confirmado. Preparando a configuração inicial...","ok");

      if (
        window.FusionAuth?.login &&
        cadastroPendente.emailAdmin &&
        cadastroPendente.senhaAdmin
      ) {
        try {
          await window.FusionAuth.login(
            cadastroPendente.emailAdmin,
            cadastroPendente.senhaAdmin,
            tenant
          );

          cadastroPendente.senhaAdmin = "";
          $("senha").value = "";
          $("confirmarSenha").value = "";
          location.replace(onboarding);
          return;
        } catch(error) {
          console.warn("[Cadastro] Login automático não concluído:",error.message);
        }
      }

      cadastroPendente.senhaAdmin = "";
      $("senha").value = "";
      $("confirmarSenha").value = "";
      irParaLogin(json,{next:onboarding});
    } catch(error) {
      status($("mensagemAtivacao"),error.message || "Código inválido ou expirado.","erro");
      $("codigoAtivacao").focus();
    } finally {
      botao.disabled = false;
      botao.textContent = "Ativar e continuar";
    }
  });

  $("codigoAtivacao").addEventListener("input",()=>{
    $("codigoAtivacao").value = $("codigoAtivacao").value.replace(/\D/g,"").slice(0,6);
  });

  $("btnReenviarCodigo").addEventListener("click",async()=>{
    if (!cadastroPendente?.requestId) return;

    const botao = $("btnReenviarCodigo");
    botao.disabled = true;
    botao.textContent = "Enviando...";

    try {
      const resp = await fetch("/api/saas/empresas",{
        method:"POST",
        headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
        cache:"no-store",
        body:JSON.stringify({
          acao:"reenviar",
          requestId:cadastroPendente.requestId
        })
      });

      const json = await resp.json().catch(()=>({}));
      if (!resp.ok || !json.ok) {
        throw new Error(json.mensagem || "Não foi possível reenviar o código.");
      }

      status(
        $("mensagemAtivacao"),
        `Novo código enviado para ${json.destino || "o e-mail informado"}.`,
        "ok"
      );

      $("codigoAtivacao").value = "";
      $("codigoAtivacao").focus();
    } catch(error) {
      status($("mensagemAtivacao"),error.message || "Não foi possível reenviar o código.","erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Reenviar código";
    }
  });

  $("btnCorrigirDados").addEventListener("click",()=>{
    $("painelAtivacao").hidden = true;
    mostrarTabs(true);
    cadastroPendente = null;
    abrirTab("criar");

    status(
      $("mensagemCriacao"),
      "Revise os dados. A solicitação anterior expirará automaticamente e não criou nenhuma academia.",
      "ok"
    );
  });

  limparSessaoAnterior();

  const params = new URLSearchParams(location.search);
  if (params.get("acao") === "criar") abrirTab("criar");
  else abrirTab("entrar");

  if (params.get("academia")) $("academiaAcesso").value = params.get("academia");
  if (params.get("codigo")) $("codigoAcesso").value = params.get("codigo").toUpperCase();
})();
