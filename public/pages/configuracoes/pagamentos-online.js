(function () {
  const $ = (seletor) => document.querySelector(seletor);
  const metodos = {
    PIX: $("#metodoPix"),
    CREDIT_CARD: $("#metodoCartao"),
    DEBIT_CARD: $("#metodoDebito"),
    BOLETO: $("#metodoBoleto")
  };

  function texto(valor, padrao = "") {
    return String(valor || padrao).trim();
  }

  function numero(valor, padrao = 1) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : padrao;
  }

  function semBarraFinal(valor, padrao = "https://fusionsistema.com.br") {
    return texto(valor, padrao).replace(/\/+$/, "");
  }

  function handleInfinitePay(valor) {
    return texto(valor).replace(/^\$+/, "");
  }

  function nomeGateway(provider = "") {
    const p = texto(provider).toLowerCase();
    if (p === "infinitepay") return "InfinitePay";
    if (p === "pagbank" || p === "pagseguro") return "PagBank";
    if (p === "asaas") return "Asaas";
    return "Não definido";
  }

  function webhookPadrao(provider, publicUrl) {
    const gateway = provider === "infinitepay" ? "infinitepay" : provider === "asaas" ? "asaas" : "pagbank";
    return `${semBarraFinal(publicUrl)}/api/pagamentos-online/webhooks/${gateway}`;
  }

  function webhookAutomatico(valor) {
    return !texto(valor) || /\/api\/pagamentos-online\/webhooks\/(asaas|pagbank|infinitepay)$/i.test(texto(valor));
  }

  function atualizarWebhookPadraoSeAutomatico() {
    const atual = texto($("#webhookUrl").value);
    if (webhookAutomatico(atual)) {
      $("#webhookUrl").value = webhookPadrao($("#provider").value, $("#publicUrl").value);
    }
  }

  function mensagem(valor, erro = false) {
    const el = $("#mensagemPagamentos");
    el.textContent = valor || "";
    el.classList.toggle("erro", Boolean(erro));
  }

  function chip(id, ok, textoOk, textoFalha) {
    const el = $(id);
    el.textContent = ok ? textoOk : textoFalha;
    el.classList.toggle("ok", Boolean(ok));
    el.classList.toggle("erro", !ok);
    el.classList.remove("aguardando");
  }

  async function requisitar(url, opcoes = {}) {
    const fetcher = window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth : fetch;
    const resposta = await fetcher(url, { cache: "no-store", ...opcoes });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || dados.ok === false) {
      throw new Error(dados.mensagem || dados.erro || `Erro HTTP ${resposta.status}`);
    }
    return dados;
  }

  function preencher(dados = {}) {
    const cfg = dados.configuracao || {};
    const pagbank = cfg.pagbank || {};
    const infinitepay = cfg.infinitepay || {};
    const provider = texto(cfg.provider, "pagbank");
    const ativo = provider === "infinitepay" ? infinitepay : pagbank;
    $("#provider").value = provider;
    $("#recebedorAtivo").textContent = nomeGateway(provider);
    $("#ambiente").value = texto(pagbank.ambiente, "production");
    $("#publicUrl").value = texto(ativo.publicUrl || pagbank.publicUrl || infinitepay.publicUrl, "https://fusionsistema.com.br");
    $("#checkoutExpirationHours").value = numero(pagbank.checkoutExpirationHours, 72);
    $("#installmentsLimit").value = numero(pagbank.installmentsLimit, 1);
    $("#interestFreeInstallments").value = numero(pagbank.interestFreeInstallments, 1);
    $("#webhookUrl").value = texto(ativo.webhookUrl, webhookPadrao(provider, $("#publicUrl").value));
    $("#alunoRedirectUrl").value = texto(ativo.alunoRedirectUrl);
    $("#token").value = "";
    $("#webhookToken").value = "";
    $("#infinitepayHandle").value = handleInfinitePay(infinitepay.handle || infinitepay.handleResumo);
    $("#infinitepayBaseUrl").value = texto(infinitepay.baseUrl, "https://api.checkout.infinitepay.io");

    const selecionados = new Set(Array.isArray(pagbank.paymentMethods) ? pagbank.paymentMethods : ["PIX", "CREDIT_CARD"]);
    Object.entries(metodos).forEach(([codigo, input]) => {
      input.checked = selecionados.has(codigo);
    });

    if (provider === "infinitepay") {
      chip("#statusProvider", cfg.providerConfigurado, "InfinitePay configurada", "InfinitePay pendente");
      chip("#statusToken", infinitepay.handleConfigurado, "Handle salvo", "Handle pendente");
      chip("#statusWebhook", Boolean($("#webhookUrl").value), "Webhook pronto", "Webhook pendente");
    } else {
      chip("#statusProvider", cfg.providerConfigurado, "Gateway configurado", "Gateway pendente");
      chip("#statusToken", pagbank.tokenConfigurado, "API token salvo", "API token pendente");
      chip("#statusWebhook", pagbank.webhookTokenConfigurado, "Webhook token salvo", "Webhook token pendente");
    }
    $("#origemToken").textContent = pagbank.tokenConfigurado
      ? `Token: ${pagbank.tokenResumo || "salvo"} · Webhook: ${pagbank.webhookTokenResumo || "salvo"}`
      : "";
    $("#origemInfinitePay").textContent = infinitepay.handleConfigurado
      ? `Handle: ${infinitepay.handleResumo || `$${handleInfinitePay(infinitepay.handle)}`}`
      : "";
  }

  function coletar() {
    const paymentMethods = Object.entries(metodos)
      .filter(([, input]) => input.checked)
      .map(([codigo]) => codigo);
    const provider = $("#provider").value;
    const publicUrl = semBarraFinal($("#publicUrl").value);
    const webhookUrl = texto($("#webhookUrl").value);
    const alunoRedirectUrl = texto($("#alunoRedirectUrl").value);

    return {
      provider,
      pagbank: {
        ambiente: $("#ambiente").value,
        publicUrl,
        token: texto($("#token").value),
        webhookToken: texto($("#webhookToken").value),
        paymentMethods,
        installmentsLimit: numero($("#installmentsLimit").value, 1),
        interestFreeInstallments: numero($("#interestFreeInstallments").value, 1),
        checkoutExpirationHours: numero($("#checkoutExpirationHours").value, 72),
        webhookUrl: provider === "pagbank" ? webhookUrl : undefined,
        alunoRedirectUrl: provider === "pagbank" ? alunoRedirectUrl : undefined
      },
      infinitepay: {
        publicUrl,
        handle: handleInfinitePay($("#infinitepayHandle").value),
        baseUrl: texto($("#infinitepayBaseUrl").value, "https://api.checkout.infinitepay.io"),
        webhookUrl: provider === "infinitepay" ? webhookUrl : undefined,
        alunoRedirectUrl: provider === "infinitepay" ? alunoRedirectUrl : undefined
      }
    };
  }

  async function carregar() {
    mensagem("Carregando...");
    preencher(await requisitar("/api/pagamentos-online/configuracao"));
    mensagem("");
  }

  async function salvar(evento) {
    evento.preventDefault();
    mensagem("Salvando...");
    const salvo = await requisitar("/api/pagamentos-online/configuracao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coletar())
    });
    preencher(salvo);
    mensagem("Configuração salva.");
  }

  async function copiarWebhook() {
    const valor = texto($("#webhookUrl").value);
    if (!valor) return;
    await navigator.clipboard.writeText(valor);
    mensagem("URL do webhook copiada.");
  }

  $("#formPagamentosOnline").addEventListener("submit", (evento) => {
    salvar(evento).catch((erro) => mensagem(erro.message, true));
  });
  $("#copiarWebhook").addEventListener("click", () => {
    copiarWebhook().catch((erro) => mensagem(erro.message, true));
  });
  $("#provider").addEventListener("change", () => {
    $("#recebedorAtivo").textContent = nomeGateway($("#provider").value);
    atualizarWebhookPadraoSeAutomatico();
  });
  $("#publicUrl").addEventListener("change", atualizarWebhookPadraoSeAutomatico);

  carregar().catch((erro) => mensagem(erro.message, true));
})();
