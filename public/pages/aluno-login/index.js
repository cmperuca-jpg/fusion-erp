const API = "/api/treinos/aluno-app";
const KEYS = {
  installationId: "fusion_aluno_installation_id_v2",
  deviceToken: "fusion_aluno_device_token_v2",
  academiaNome: "fusion_aluno_academia_nome_v2"
};

const $ = (id) => document.getElementById(id);
const screens = ["loadingScreen", "activationScreen", "firstAccessScreen", "loginScreen", "homeScreen"];

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function installationId() {
  let value = localStorage.getItem(KEYS.installationId) || "";
  if (!value) {
    value = uuid();
    localStorage.setItem(KEYS.installationId, value);
  }
  return value;
}

function deviceToken() { return localStorage.getItem(KEYS.deviceToken) || ""; }
function academiaNome() { return localStorage.getItem(KEYS.academiaNome) || ""; }

function setAcademia(nome) {
  const valor = String(nome || "").trim();
  if (valor) localStorage.setItem(KEYS.academiaNome, valor);
  else localStorage.removeItem(KEYS.academiaNome);
  atualizarAcademiaNaTela(valor);
}

function clearTenant() {
  localStorage.removeItem(KEYS.deviceToken);
  localStorage.removeItem(KEYS.academiaNome);
  atualizarAcademiaNaTela("");
  installationId();
}

function atualizarAcademiaNaTela(nome = academiaNome()) {
  const topo = $("academiaTopo");
  topo.textContent = nome || "";
  topo.classList.toggle("hidden", !nome);
  $("loginAcademia").textContent = nome ? `Aparelho ativado para ${nome}.` : "Aparelho ativado para sua academia.";
}

function show(screenId) {
  screens.forEach((id) => $(id).classList.toggle("hidden", id !== screenId));
  window.scrollTo({ top: 0, behavior: "instant" });
}

function setMessage(id, text = "", type = "error") {
  const el = $(id);
  el.textContent = text;
  el.className = `message${text ? ` ${type}` : ""}`;
}

function digits(value) { return String(value || "").replace(/\D/g, ""); }
function cpfFormat(value) {
  const d = digits(value).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function codigoFormat(value) {
  return String(value || "").toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 8);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.mensagem || data.message || "Não foi possível concluir a operação.");
    error.status = response.status;
    error.code = data.code || "";
    throw error;
  }
  return data.dados ?? data;
}

function buttonBusy(button, busy, busyText = "Aguarde...") {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}

function dispositivoInvalido(error) {
  return [401, 403, 404].includes(error?.status) || ["INVALID_DEVICE_TOKEN", "DEVICE_NOT_FOUND"].includes(error?.code);
}

async function consultarStatus() {
  return request("/status", {
    method: "POST",
    body: JSON.stringify({ device_token: deviceToken() })
  });
}

async function ativar() {
  const btn = $("ativar");
  const codigo = codigoFormat($("codigo").value);
  setMessage("activationMessage");
  if (codigo.length !== 8) {
    setMessage("activationMessage", "Informe o código de 8 caracteres.");
    return;
  }

  buttonBusy(btn, true, "Ativando...");
  try {
    const data = await request("/ativar", {
      method: "POST",
      body: JSON.stringify({
        codigo,
        instalacao_id: installationId(),
        nome_dispositivo: navigator.userAgent.slice(0, 120)
      })
    });
    if (!data.device_token) throw new Error("O servidor não retornou a ativação do aparelho.");
    localStorage.setItem(KEYS.deviceToken, data.device_token);
    setAcademia(data.academia_nome || "");
    await decidirAposStatus();
  } catch (error) {
    setMessage("activationMessage", error.message || "Código inválido ou expirado.");
  } finally {
    buttonBusy(btn, false);
  }
}

async function decidirAposStatus() {
  try {
    const status = await consultarStatus();
    if (status.academia_nome) setAcademia(status.academia_nome);
    if (status.primeiro_acesso || status.autenticacao === "criar_senha") {
      show("firstAccessScreen");
    } else {
      await tentarHomeOuLogin();
    }
  } catch (error) {
    if (dispositivoInvalido(error)) {
      clearTenant();
      show("activationScreen");
      setMessage("activationMessage", "A ativação deste aparelho não é mais válida. Solicite um novo código à academia.");
      return;
    }
    throw error;
  }
}

function senhaValida(cpf, senha, confirmar) {
  if (digits(cpf).length !== 11) return "Informe um CPF válido.";
  if (senha.length < 8 || senha.length > 72) return "A senha deve ter entre 8 e 72 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return "A senha precisa ter pelo menos uma letra e um número.";
  if (senha === digits(cpf)) return "A senha não pode ser o próprio CPF.";
  if (senha !== confirmar) return "As senhas não conferem.";
  return "";
}

async function criarSenha() {
  const btn = $("criarSenha");
  const cpf = digits($("cpfPrimeiro").value);
  const senha = $("senhaNova").value;
  const confirmar = $("senhaConfirmar").value;
  const validacao = senhaValida(cpf, senha, confirmar);
  setMessage("firstAccessMessage");
  if (validacao) return setMessage("firstAccessMessage", validacao);

  buttonBusy(btn, true, "Criando acesso...");
  try {
    await request("/primeiro-acesso", {
      method: "POST",
      body: JSON.stringify({ device_token: deviceToken(), cpf, senha, confirmar_senha: confirmar })
    });
    $("senhaNova").value = "";
    $("senhaConfirmar").value = "";
    await carregarHome();
  } catch (error) {
    if (error.code === "PASSWORD_ALREADY_CREATED" || error.status === 409) {
      show("loginScreen");
      setMessage("loginMessage", "Sua senha já foi criada. Entre com CPF e senha.");
      return;
    }
    setMessage("firstAccessMessage", error.message || "Não foi possível criar sua senha.");
  } finally {
    buttonBusy(btn, false);
  }
}

async function entrar() {
  const btn = $("entrar");
  const cpf = digits($("cpfLogin").value);
  const senha = $("senhaLogin").value;
  setMessage("loginMessage");
  if (cpf.length !== 11 || !senha) {
    setMessage("loginMessage", "Informe CPF e senha.");
    return;
  }

  buttonBusy(btn, true, "Entrando...");
  try {
    await request("/login", {
      method: "POST",
      body: JSON.stringify({ device_token: deviceToken(), cpf, senha })
    });
    $("senhaLogin").value = "";
    await carregarHome();
  } catch (error) {
    if (error.code === "FIRST_ACCESS_REQUIRED" || error.status === 409) {
      $("cpfPrimeiro").value = cpfFormat(cpf);
      show("firstAccessScreen");
      setMessage("firstAccessMessage", "Este é seu primeiro acesso. Crie sua senha para continuar.", "success");
      return;
    }
    if (error.status === 429) {
      setMessage("loginMessage", "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      return;
    }
    if (dispositivoInvalido(error)) {
      clearTenant();
      show("activationScreen");
      setMessage("activationMessage", "Este aparelho precisa ser ativado novamente.");
      return;
    }
    setMessage("loginMessage", error.message || "CPF ou senha inválidos.");
  } finally {
    buttonBusy(btn, false);
  }
}

async function carregarHome() {
  const data = await request("/me", {
    method: "GET",
    headers: { "X-Fusion-Device-Token": deviceToken() }
  });
  if (data.academia_nome) setAcademia(data.academia_nome);
  const aluno = data.aluno || {};
  $("saudacaoAluno").textContent = aluno.nome ? `Olá, ${String(aluno.nome).split(/\s+/)[0]}` : "Olá";
  $("statusAluno").textContent = aluno.status || "Aluno";
  $("matriculaAluno").textContent = aluno.matricula ? `Matrícula ${aluno.matricula}` : "";
  setMessage("homeMessage");
  show("homeScreen");
}

async function tentarHomeOuLogin() {
  try {
    await carregarHome();
  } catch (error) {
    if (error.status === 401) {
      show("loginScreen");
      return;
    }
    if (dispositivoInvalido(error)) {
      clearTenant();
      show("activationScreen");
      return;
    }
    show("loginScreen");
    setMessage("loginMessage", error.message || "Não foi possível restaurar sua sessão.");
  }
}

async function sair() {
  const btn = $("sair");
  buttonBusy(btn, true, "Saindo...");
  try { await request("/logout", { method: "POST", body: "{}" }); } catch {}
  finally {
    buttonBusy(btn, false);
    show("loginScreen");
  }
}

async function trocarAcademia() {
  const confirmar = window.confirm("Trocar a academia deste aparelho? Você precisará de um novo código de ativação.");
  if (!confirmar) return;
  try { await request("/logout", { method: "POST", body: "{}" }); } catch {}
  clearTenant();
  $("codigo").value = "";
  show("activationScreen");
}

async function boot() {
  installationId();
  atualizarAcademiaNaTela();
  if (!deviceToken()) {
    show("activationScreen");
    return;
  }
  try {
    await decidirAposStatus();
  } catch (error) {
    show("loginScreen");
    setMessage("loginMessage", error.message || "Não foi possível verificar o acesso agora.");
  }
}

$("codigo").addEventListener("input", (event) => { event.target.value = codigoFormat(event.target.value); });
["cpfPrimeiro", "cpfLogin"].forEach((id) => {
  $(id).addEventListener("input", (event) => { event.target.value = cpfFormat(event.target.value); });
});

document.querySelectorAll(".show-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Mostrar" : "Ocultar";
  });
});

$("ativar").addEventListener("click", ativar);
$("criarSenha").addEventListener("click", criarSenha);
$("voltarLogin").addEventListener("click", () => show("loginScreen"));
$("entrar").addEventListener("click", entrar);
$("sair").addEventListener("click", sair);
$("trocarAcademiaLogin").addEventListener("click", trocarAcademia);
$("trocarAcademiaHome").addEventListener("click", trocarAcademia);

[["codigo", ativar], ["senhaConfirmar", criarSenha], ["senhaLogin", entrar]].forEach(([id, action]) => {
  $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") action(); });
});

boot();
