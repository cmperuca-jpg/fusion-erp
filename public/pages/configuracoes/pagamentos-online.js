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
    $("#provider").value = texto(cfg.provider, "pagbank");
    $("#ambiente").value = texto(pagbank.ambiente, "production");
    $("#publicUrl").value = texto(pagbank.publicUrl, "https://fusionsistema.com.br");
    $("#checkoutExpirationHours").value = numero(pagbank.checkoutExpirationHours, 72);
    $("#installmentsLimit").value = numero(pagbank.installmentsLimit, 1);
    $("#interestFreeInstallments").value = numero(pagbank.interestFreeInstallments, 1);
    $("#webhookUrl").value = texto(pagbank.webhookUrl, "https://fusionsistema.com.br/api/pagamentos-online/webhooks/pagbank");
    $("#alunoRedirectUrl").value = texto(pagbank.alunoRedirectUrl);
    $("#token").value = "";
    $("#webhookToken").value = "";

    const selecionados = new Set(Array.isArray(pagbank.paymentMethods) ? pagbank.paymentMethods : ["PIX", "CREDIT_CARD"]);
    Object.entries(metodos).forEach(([codigo, input]) => {
      input.checked = selecionados.has(codigo);
    });

    chip("#statusProvider", cfg.providerConfigurado, "Gateway configurado", "Gateway pendente");
    chip("#statusToken", pagbank.tokenConfigurado, "API token salvo", "API token pendente");
    chip("#statusWebhook", pagbank.webhookTokenConfigurado, "Webhook token salvo", "Webhook token pendente");
    $("#origemToken").textContent = pagbank.tokenConfigurado
      ? `Token: ${pagbank.tokenResumo || "salvo"} · Webhook: ${pagbank.webhookTokenResumo || "salvo"}`
      : "";
  }

  function coletar() {
    const paymentMethods = Object.entries(metodos)
      .filter(([, input]) => input.checked)
      .map(([codigo]) => codigo);

    return {
      provider: $("#provider").value,
      pagbank: {
        ambiente: $("#ambiente").value,
        publicUrl: texto($("#publicUrl").value),
        token: texto($("#token").value),
        webhookToken: texto($("#webhookToken").value),
        paymentMethods,
        installmentsLimit: numero($("#installmentsLimit").value, 1),
        interestFreeInstallments: numero($("#interestFreeInstallments").value, 1),
        checkoutExpirationHours: numero($("#checkoutExpirationHours").value, 72),
        webhookUrl: texto($("#webhookUrl").value),
        alunoRedirectUrl: texto($("#alunoRedirectUrl").value)
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

  carregar().catch((erro) => mensagem(erro.message, true));
})();
