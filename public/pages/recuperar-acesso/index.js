(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let requestId = "";
  let recoveryToken = "";
  let codigoAcesso = "";
  let academiaConfirmada = "";

  function mensagem(id, texto = "", tipo = "") {
    const el = $(id);
    el.textContent = texto;
    el.className = `mensagem ${tipo}`.trim();
  }

  function irParaEtapa(numero) {
    document.querySelectorAll("[data-step]").forEach(el => {
      const ativo = Number(el.dataset.step) === Number(numero);
      el.hidden = !ativo;
      el.classList.toggle("ativo", ativo);
    });
    document.querySelectorAll("[data-step-label]").forEach(el => {
      el.classList.toggle("ativo", Number(el.dataset.stepLabel) <= Number(numero));
    });
  }

  async function post(url, body) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) {
      const error = new Error(json.mensagem || "Não foi possível concluir a operação.");
      error.status = resp.status;
      error.code = json.codigo || "";
      throw error;
    }
    return json;
  }

  async function solicitarCodigo() {
    const academia = $("academia").value.trim();
    const email = $("email").value.trim();
    const json = await post("/api/auth/recuperacao/iniciar", { academia, email });
    requestId = json.requestId || "";
    $("textoDestino").textContent = json.destino
      ? `Se os dados estiverem corretos, o código foi enviado para ${json.destino}.`
      : "Se os dados estiverem corretos, o código foi enviado para o e-mail cadastrado.";
    $("codigoVerificacao").value = "";
    irParaEtapa(2);
    setTimeout(() => $("codigoVerificacao").focus(), 0);
  }

  $("formIdentificar").addEventListener("submit", async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const btn = $("btnEnviar");
    mensagem("mensagemIdentificar", "");
    btn.disabled = true;
    btn.textContent = "Enviando código...";
    try {
      await solicitarCodigo();
    } catch (error) {
      mensagem("mensagemIdentificar", error.message || "Não foi possível enviar o código.", "erro");
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar código de verificação";
    }
  });

  $("formConfirmar").addEventListener("submit", async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const btn = $("btnConfirmar");
    mensagem("mensagemConfirmar", "");
    btn.disabled = true;
    btn.textContent = "Confirmando...";
    try {
      const json = await post("/api/auth/recuperacao/confirmar", {
        requestId,
        codigo: $("codigoVerificacao").value
      });
      recoveryToken = json.recoveryToken || "";
      codigoAcesso = json.codigoAcesso || "";
      academiaConfirmada = json.academia?.nome || $("academia").value.trim();
      $("resultadoAcademia").textContent = academiaConfirmada;
      $("resultadoCodigo").textContent = codigoAcesso || "—";
      irParaEtapa(3);
    } catch (error) {
      mensagem("mensagemConfirmar", error.message || "Código inválido.", "erro");
      $("codigoVerificacao").select();
    } finally {
      btn.disabled = false;
      btn.textContent = "Confirmar código";
    }
  });

  $("btnReenviar").addEventListener("click", async () => {
    const btn = $("btnReenviar");
    btn.disabled = true;
    mensagem("mensagemConfirmar", "Enviando outro código...");
    try {
      await solicitarCodigo();
      mensagem("mensagemConfirmar", "Novo código enviado.", "ok");
    } catch (error) {
      mensagem("mensagemConfirmar", error.message || "Não foi possível reenviar.", "erro");
    } finally {
      btn.disabled = false;
    }
  });

  $("btnCopiar").addEventListener("click", async () => {
    if (!codigoAcesso) return;
    try {
      await navigator.clipboard.writeText(codigoAcesso);
      mensagem("mensagemResultado", "Código de acesso copiado.", "ok");
    } catch {
      mensagem("mensagemResultado", `Seu código é ${codigoAcesso}.`, "ok");
    }
  });

  $("btnVoltarEntrar").addEventListener("click", () => {
    const params = new URLSearchParams({
      academia: academiaConfirmada,
      codigo: codigoAcesso
    });
    location.href = `/pages/comecar/?${params.toString()}`;
  });

  $("formSenha").addEventListener("submit", async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const senha = $("novaSenha").value;
    if (senha !== $("confirmarNovaSenha").value) {
      mensagem("mensagemResultado", "As novas senhas não conferem.", "erro");
      $("confirmarNovaSenha").focus();
      return;
    }

    const btn = $("btnSenha");
    btn.disabled = true;
    btn.textContent = "Alterando senha...";
    mensagem("mensagemResultado", "");

    try {
      await post("/api/auth/recuperacao/redefinir-senha", {
        recoveryToken,
        senha
      });
      $("boxSenha").open = false;
      mensagem("mensagemResultado", "Senha alterada. Agora você já pode entrar no Fusion.", "ok");
      btn.textContent = "Senha alterada";
    } catch (error) {
      mensagem("mensagemResultado", error.message || "Não foi possível alterar a senha.", "erro");
      btn.disabled = false;
      btn.textContent = "Alterar minha senha";
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get("academia")) $("academia").value = params.get("academia");
  irParaEtapa(1);
})();
