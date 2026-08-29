const API = "/api/treinos/aluno-app";
const KEYS = {
  installationId: "fusion_aluno_installation_id_v2",
  deviceToken: "fusion_aluno_device_token_v2",
  academiaNome: "fusion_aluno_academia_nome_v2",
  pagamentoPendente: "fusion_aluno_pagamento_pendente_v1",
  tenant: "fusion_aluno_tenant_v1"
};

const $ = (id) => document.getElementById(id);
const screens = ["loadingScreen", "activationScreen", "firstAccessScreen", "loginScreen", "homeScreen"];

let treinoGaleriaDivisoes = [];
let treinoGaleriaDivisaoIndice = 0;
let treinoGaleriaItens = [];
let treinoGaleriaIndice = 0;
let treinoGaleriaNoFim = false;
let treinoGaleriaTouchX = null;
let mensalidadePagamentoAtual = null;

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

function tenantAtual() {
  const params = new URLSearchParams(location.search);
  const urlTenant = String(params.get("academia") || params.get("tenant") || "").trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9_-]{1,79}$/.test(urlTenant)) {
    localStorage.setItem(KEYS.tenant, urlTenant);
    return urlTenant;
  }
  return String(localStorage.getItem(KEYS.tenant) || "").trim().toLowerCase();
}

function acessoLinkAtual() {
  const params = new URLSearchParams(location.search);
  const acesso = String(params.get("acesso") || "").trim().toUpperCase();
  return /^[0-9A-F]{8}$/.test(acesso) ? acesso : "";
}

function limparAcessoLink() {
  const url = new URL(location.href);
  if (!url.searchParams.has("acesso")) return;
  url.searchParams.delete("acesso");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function deviceToken() { return localStorage.getItem(KEYS.deviceToken) || ""; }
function academiaNome() { return localStorage.getItem(KEYS.academiaNome) || ""; }

function pagamentoPendente() {
  try {
    const dados = JSON.parse(localStorage.getItem(KEYS.pagamentoPendente) || "null");
    return dados && typeof dados === "object" ? dados : null;
  } catch {
    return null;
  }
}

function nomeGatewayPagamento(provider = "") {
  const p = String(provider || "").toLowerCase();
  if (p === "infinitepay") return "InfinitePay";
  if (p === "pagbank" || p === "pagseguro") return "PagBank";
  if (p === "asaas") return "Asaas";
  return "gateway";
}

function salvarPagamentoPendente(resposta = {}) {
  const pagamento = resposta.pagamento || {};
  const checkout = resposta.checkout || {};
  if (!pagamento.id) return;
  localStorage.setItem(KEYS.pagamentoPendente, JSON.stringify({
    id: pagamento.id,
    mensalidadeId: pagamento.target?.mensalidadeId || pagamento.mensalidadeId || "",
    url: checkout.url || "",
    provider: pagamento.provider || checkout.provider || "",
    providerName: checkout.providerName || nomeGatewayPagamento(pagamento.provider || checkout.provider),
    status: pagamento.status || "",
    criadoEm: new Date().toISOString()
  }));
}

function limparPagamentoPendente() {
  localStorage.removeItem(KEYS.pagamentoPendente);
}

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
  $("loginAcademia").textContent = nome ? `Acesso a ${nome}.` : "Entre com CPF e senha.";
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

function setButtonLabel(button, label = "") {
  if (!button) return;
  button.dataset.label = label;
  button.textContent = label;
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


async function gerarMeuCodigo() {
  const btn = $("gerarMeuCodigo");
  const tenant = tenantAtual();
  const cpf = digits($("autoCpf")?.value);
  const dataNascimento = String($("autoNascimento")?.value || "").trim();
  const telefoneFinal = digits($("autoTelefoneFinal")?.value).slice(-4);
  setMessage("selfServiceMessage");
  if (!tenant) return setMessage("selfServiceMessage", "Abra o link fornecido pela sua academia.");
  if (cpf.length !== 11 || !dataNascimento || telefoneFinal.length !== 4) {
    return setMessage("selfServiceMessage", "Preencha CPF, nascimento e os 4 últimos dígitos do telefone.");
  }
  buttonBusy(btn, true, "Gerando...");
  try {
    const data = await request("/auto-codigo", {
      method: "POST",
      body: JSON.stringify({ tenant, cpf, data_nascimento: dataNascimento, telefone_final: telefoneFinal })
    });
    if (!data.codigo) throw new Error("Código não retornado.");
    $("codigo").value = codigoFormat(data.codigo);
    if (data.academia_nome) setAcademia(data.academia_nome);
    setMessage("selfServiceMessage", `Código gerado: ${data.codigo}. Clique em Ativar aplicativo.`, "success");
  } catch (error) {
    setMessage("selfServiceMessage", error.message || "Não foi possível gerar seu código.");
  } finally {
    buttonBusy(btn, false);
  }
}

function abrirLoginDireto() {
  if (!tenantAtual()) return setMessage("activationMessage", "Abra o link fornecido pela sua academia.");
  show("loginScreen");
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
  const tenant = tenantAtual();
  const acesso = acessoLinkAtual();
  setMessage("firstAccessMessage");
  if (validacao) return setMessage("firstAccessMessage", validacao);
  if (tenant && !acesso) {
    return setMessage(
      "firstAccessMessage",
      "Este primeiro acesso precisa ser aberto pelo link enviado pela academia no WhatsApp."
    );
  }

  buttonBusy(btn, true, "Criando acesso...");
  try {
    await request("/primeiro-acesso", {
      method: "POST",
      body: JSON.stringify(
        tenant
          ? { tenant, access_code: acesso, cpf, senha, confirmar_senha: confirmar }
          : { device_token: deviceToken(), cpf, senha, confirmar_senha: confirmar }
      )
    });
    $("senhaNova").value = "";
    $("senhaConfirmar").value = "";
    localStorage.removeItem(KEYS.deviceToken);
    limparAcessoLink();
    await carregarHome();
  } catch (error) {
    if (error.code === "PASSWORD_ALREADY_CREATED" || error.status === 409) {
      limparAcessoLink();
      show("loginScreen");
      setMessage("loginMessage", "Sua senha já foi criada. Entre com CPF e senha.");
      return;
    }
    if (error.code === "INVALID_FIRST_ACCESS_LINK") {
      setMessage("firstAccessMessage", "Este link expirou ou já foi usado. Peça à academia para enviar um novo link.");
      return;
    }
    if (error.status === 429) {
      setMessage("firstAccessMessage", "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
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
      body: JSON.stringify(tenantAtual() ? { tenant: tenantAtual(), cpf, senha } : { device_token: deviceToken(), cpf, senha })
    });
    $("senhaLogin").value = "";
    await carregarHome();
  } catch (error) {
    if (error.code === "FIRST_ACCESS_REQUIRED" || error.status === 409) {
      if (tenantAtual() && !acessoLinkAtual()) {
        setMessage("loginMessage", "Primeiro acesso: peça à academia para enviar seu link pelo WhatsApp.");
        return;
      }
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
      if (tenantAtual()) {
        show("loginScreen");
        setMessage("loginMessage", "Entre com CPF e senha.");
      } else {
        clearTenant();
        show("activationScreen");
        setMessage("activationMessage", "Abra novamente o link fornecido pela sua academia.");
      }
      return;
    }
    setMessage("loginMessage", error.message || "CPF ou senha inválidos.");
  } finally {
    buttonBusy(btn, false);
  }
}

function textoSeguro(value) {
  return String(value ?? "").trim();
}

function htmlSeguro(value) {
  return textoSeguro(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function moedaBR(value) {
  const numero = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(numero) ? numero : 0);
}

function dataBR(value) {
  if (!value) return "";
  const texto = textoSeguro(value);
  const dataSomente = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dataSomente) return `${dataSomente[3]}/${dataSomente[2]}/${dataSomente[1]}`;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleDateString("pt-BR");
}

function iniciais(nome = "") {
  const partes = textoSeguro(nome).split(/\s+/).filter(Boolean);
  if (!partes.length) return "A";
  return `${partes[0][0] || ""}${partes.length > 1 ? (partes.at(-1)?.[0] || "") : ""}`.toUpperCase();
}

function mostrarFotoAluno(aluno = {}) {
  const img = $("fotoAlunoImg");
  const fallback = $("fotoAlunoIniciais");
  const foto = textoSeguro(aluno.foto);
  fallback.textContent = iniciais(aluno.nome);
  fallback.classList.remove("hidden");
  img.classList.add("hidden");
  img.removeAttribute("src");

  if (!foto || !(foto.startsWith("data:image/") || foto.startsWith("/"))) return;
  img.onload = () => {
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  };
  img.onerror = () => {
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  };
  img.src = foto;
}

function detalhePlano(plano = {}) {
  return [plano.modalidade, plano.tipo, plano.valor_mensal > 0 ? moedaBR(plano.valor_mensal) : ""]
    .filter(Boolean)
    .join(" · ");
}

function limparLista(id) {
  const node = $(id);
  node.replaceChildren();
  return node;
}

function criarLinha(titulo, valor, detalhe = "") {
  const linha = document.createElement("div");
  linha.className = "data-row";

  const texto = document.createElement("div");
  texto.className = "data-row-copy";
  const strong = document.createElement("strong");
  strong.textContent = titulo;
  texto.appendChild(strong);
  if (detalhe) {
    const small = document.createElement("small");
    small.textContent = detalhe;
    texto.appendChild(small);
  }

  const valorEl = document.createElement("span");
  valorEl.textContent = valor;
  linha.append(texto, valorEl);
  return linha;
}

function statusMensalidadeNormalizado(item = {}) {
  return textoSeguro(item.status)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function saldoMensalidade(item = {}) {
  const n = Number(item.valor_restante ?? item.valorRestante ?? item.saldoRestante ?? item.valor ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function mensalidadePodePagar(item = {}) {
  const status = statusMensalidadeNormalizado(item);
  if (["pago", "paga", "recebido", "recebida", "quitado", "quitada", "cancelado", "cancelada"].includes(status)) return false;
  if (item.programada === true || ["programada", "programado", "previsto", "prevista"].includes(status)) return false;
  return Boolean(item.id && saldoMensalidade(item) > 0);
}

function escolherMensalidadeParaPagamento(mensalidades = []) {
  return [...mensalidades]
    .filter(mensalidadePodePagar)
    .sort((a, b) => String(a.vencimento || "").localeCompare(String(b.vencimento || "")))[0] || null;
}

function renderPlano(plano = null) {
  if (!plano?.nome) {
    $("planoNome").textContent = "Sem plano ativo";
    $("planoDetalhe").textContent = "Procure a recepção para verificar sua matrícula.";
    $("planoVencimento").textContent = "";
    return;
  }
  $("planoNome").textContent = plano.nome;
  $("planoDetalhe").textContent = detalhePlano(plano);
  $("planoVencimento").textContent = plano.proximo_vencimento
    ? `Próximo vencimento: ${dataBR(plano.proximo_vencimento)}`
    : (plano.horario ? `Horário: ${plano.horario}` : "");
}

function imagemTreino(item = {}) {
  return [item.imagem, item.gif, item.foto]
    .map(textoSeguro)
    .find((valor) => valor.startsWith("/")) || "";
}

function montarGaleriaPorDivisao(divisoes = []) {
  return divisoes
    .map((divisao) => {
      const itens = Array.isArray(divisao?.itens) ? divisao.itens : [];
      return {
        nome: textoSeguro(divisao?.nome) || "Treino",
        itens: itens.map((item) => ({
          ...item,
          imagem: imagemTreino(item)
        }))
      };
    })
    .filter((divisao) => divisao.itens.length > 0);
}

function renderTreinos(treinos = {}) {
  const divisoes = Array.isArray(treinos.divisoes) ? treinos.divisoes : [];
  const totalExercicios = divisoes.reduce((total, divisao) => total + (Array.isArray(divisao.itens) ? divisao.itens.length : 0), 0);
  const temTreino = totalExercicios > 0;
  const card = $("treinoCard");

  treinoGaleriaDivisoes = temTreino ? montarGaleriaPorDivisao(divisoes) : [];
  treinoGaleriaDivisaoIndice = 0;
  treinoGaleriaItens = treinoGaleriaDivisoes[0]?.itens || [];
  treinoGaleriaIndice = 0;

  $("treinoResumo").textContent = temTreino
    ? `${treinoGaleriaDivisoes.length} divisão${treinoGaleriaDivisoes.length === 1 ? "" : "ões"}`
    : "Nenhum treino prescrito";
  $("treinoDetalhe").textContent = temTreino
    ? `${totalExercicios} exercício${totalExercicios === 1 ? "" : "s"}${treinos.professor ? ` · ${treinos.professor}` : ""}`
    : "Quando o professor prescrever, aparecerá aqui.";
  $("treinoAcao").textContent = temTreino ? "Abra uma divisão para ver os exercícios" : "";

  card.classList.toggle("feature-card-disabled", !temTreino);
  card.setAttribute("aria-disabled", temTreino ? "false" : "true");

  const section = $("treinoSection");
  section.classList.toggle("hidden", !temTreino);
  if (!temTreino) return;

  $("treinoValidade").textContent = treinos.validade ? `Até ${dataBR(treinos.validade)}` : "Ativo";
  $("treinoObjetivo").textContent = [
    treinos.objetivo ? `Objetivo: ${treinos.objetivo}` : "",
    treinos.professor ? `Professor: ${treinos.professor}` : ""
  ].filter(Boolean).join(" · ");

  const container = limparLista("treinoDivisoes");

  treinoGaleriaDivisoes.forEach((divisaoGaleria, indiceDivisao) => {
    const details = document.createElement("details");
    details.className = "training-division";

    const summary = document.createElement("summary");
    summary.textContent = `${divisaoGaleria.nome} · ${divisaoGaleria.itens.length} exercício${divisaoGaleria.itens.length === 1 ? "" : "s"}`;
    details.appendChild(summary);

    const lista = document.createElement("div");
    lista.className = "exercise-list";

    divisaoGaleria.itens.forEach((item, indiceItem) => {
      const linha = document.createElement("button");
      linha.type = "button";
      linha.className = "exercise-row exercise-row-button";
      linha.dataset.galleryDivision = String(indiceDivisao);
      linha.dataset.galleryIndex = String(indiceItem);

      const thumb = document.createElement("span");
      thumb.className = "exercise-thumb";
      const imagem = imagemTreino(item);
      if (imagem) {
        const img = document.createElement("img");
        img.src = imagem;
        img.alt = "";
        img.loading = "lazy";
        img.onerror = () => {
          img.remove();
          thumb.textContent = "🏋";
        };
        thumb.appendChild(img);
      } else {
        thumb.textContent = "🏋";
      }

      const copy = document.createElement("span");
      copy.className = "exercise-copy";
      const nome = document.createElement("strong");
      nome.textContent = item.nome || "Exercício";
      const meta = document.createElement("small");
      meta.textContent = [
        item.series ? `${item.series} série${item.series === "1" ? "" : "s"}` : "",
        item.repeticoes ? `${item.repeticoes} rep.` : "",
        item.carga ? `Carga: ${item.carga}` : "",
        item.descanso ? `Descanso: ${item.descanso}` : ""
      ].filter(Boolean).join(" · ");
      const acao = document.createElement("small");
      acao.className = "exercise-open-hint";
      acao.textContent = imagem ? "Ver imagem" : "Ver exercício";
      copy.append(nome, meta, acao);

      linha.append(thumb, copy);
      linha.addEventListener("click", () => abrirGaleriaTreino(indiceDivisao, indiceItem));
      lista.appendChild(linha);
    });

    details.appendChild(lista);
    container.appendChild(details);
  });
}

function galeriaDivisaoAtual() {
  return treinoGaleriaDivisoes[treinoGaleriaDivisaoIndice] || null;
}

function galeriaItemAtual() {
  return treinoGaleriaItens[treinoGaleriaIndice] || null;
}

function selecionarDivisaoGaleria(indiceDivisao, indiceItem = 0) {
  if (!treinoGaleriaDivisoes.length) return false;

  const indiceSeguro = Math.max(
    0,
    Math.min(Number(indiceDivisao) || 0, treinoGaleriaDivisoes.length - 1)
  );

  treinoGaleriaDivisaoIndice = indiceSeguro;
  treinoGaleriaItens = treinoGaleriaDivisoes[indiceSeguro]?.itens || [];
  treinoGaleriaIndice = Math.max(
    0,
    Math.min(Number(indiceItem) || 0, Math.max(0, treinoGaleriaItens.length - 1))
  );
  treinoGaleriaNoFim = false;
  return treinoGaleriaItens.length > 0;
}

function renderDivisoesGaleria() {
  const container = $("treinoGaleriaDivisoesTabs");
  container.replaceChildren();

  treinoGaleriaDivisoes.forEach((divisao, indice) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `gallery-division-tab${indice === treinoGaleriaDivisaoIndice ? " active" : ""}`;
    botao.textContent = divisao.nome || `Divisão ${indice + 1}`;
    botao.setAttribute(
      "aria-label",
      `Abrir ${divisao.nome || `divisão ${indice + 1}`}, ${divisao.itens.length} exercícios`
    );
    botao.addEventListener("click", () => {
      if (!selecionarDivisaoGaleria(indice, 0)) return;
      renderGaleriaTreino();
    });
    container.appendChild(botao);
  });
}

function renderMiniaturasGaleria() {
  const container = $("treinoGaleriaMiniaturas");
  container.replaceChildren();

  treinoGaleriaItens.forEach((item, indice) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `gallery-thumb${!treinoGaleriaNoFim && indice === treinoGaleriaIndice ? " active" : ""}`;
    botao.setAttribute("aria-label", `Abrir ${item.nome || `exercício ${indice + 1}`}`);

    const imagem = imagemTreino(item);
    if (imagem) {
      const img = document.createElement("img");
      img.src = imagem;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        botao.textContent = String(indice + 1);
      };
      botao.appendChild(img);
    } else {
      botao.textContent = String(indice + 1);
    }

    botao.addEventListener("click", () => {
      treinoGaleriaNoFim = false;
      treinoGaleriaIndice = indice;
      renderGaleriaTreino();
    });
    container.appendChild(botao);
  });

  container.querySelector(".gallery-thumb.active")?.scrollIntoView({
    block: "nearest",
    inline: "center",
    behavior: "smooth"
  });
}

function renderGaleriaTreino() {
  const divisao = galeriaDivisaoAtual();
  if (!divisao || !treinoGaleriaItens.length) return fecharGaleriaTreino();

  const img = $("treinoGaleriaImagem");
  const semImagem = $("treinoGaleriaSemImagem");
  const fim = $("treinoGaleriaFim");

  img.onload = null;
  img.onerror = null;
  img.classList.add("hidden");
  img.removeAttribute("src");
  semImagem.classList.add("hidden");
  fim.classList.add("hidden");

  if (treinoGaleriaNoFim) {
    $("treinoGaleriaDivisao").textContent = divisao.nome || "Treino";
    $("treinoGaleriaTitulo").textContent = "Fim do treino";
    $("treinoGaleriaContador").textContent =
      `${divisao.nome || "Treino"} · ${treinoGaleriaItens.length} exercício${treinoGaleriaItens.length === 1 ? "" : "s"} concluídos`;

    $("treinoGaleriaMeta").textContent = "";
    $("treinoGaleriaObservacao").classList.add("hidden");
    $("treinoGaleriaDescricao").classList.add("hidden");

    $("treinoGaleriaFimTitulo").textContent = `${divisao.nome || "Treino"} concluído`;
    $("treinoGaleriaFimTexto").textContent =
      `Você chegou ao fim dos ${treinoGaleriaItens.length} exercício${treinoGaleriaItens.length === 1 ? "" : "s"} desta divisão.`;
    fim.classList.remove("hidden");

    // No fim: anterior volta ao último exercício; próximo nunca reinicia.
    $("treinoGaleriaAnterior").classList.remove("hidden");
    $("treinoGaleriaProximo").classList.add("hidden");

    renderDivisoesGaleria();
    renderMiniaturasGaleria();
    return;
  }

  const item = galeriaItemAtual();
  if (!item) return fecharGaleriaTreino();

  $("treinoGaleriaDivisao").textContent = divisao.nome || "Treino";
  $("treinoGaleriaTitulo").textContent = item.nome || "Exercício";
  $("treinoGaleriaContador").textContent =
    `${divisao.nome || "Treino"} · ${treinoGaleriaIndice + 1} de ${treinoGaleriaItens.length}`;

  const meta = [
    item.grupo,
    item.series ? `${item.series} série${item.series === "1" ? "" : "s"}` : "",
    item.repeticoes ? `${item.repeticoes} rep.` : "",
    item.carga ? `Carga: ${item.carga}` : "",
    item.descanso ? `Descanso: ${item.descanso}` : "",
    item.metodo ? `Método: ${item.metodo}` : ""
  ].filter(Boolean);
  $("treinoGaleriaMeta").textContent = meta.join(" · ");

  const observacao = textoSeguro(item.observacao);
  $("treinoGaleriaObservacao").textContent = observacao ? `Observação: ${observacao}` : "";
  $("treinoGaleriaObservacao").classList.toggle("hidden", !observacao);

  const descricao = textoSeguro(item.descricao);
  $("treinoGaleriaDescricao").textContent = descricao;
  $("treinoGaleriaDescricao").classList.toggle("hidden", !descricao);

  const imagem = imagemTreino(item);
  if (imagem) {
    img.alt = `Demonstração do exercício ${item.nome || ""}`;
    img.onload = () => {
      img.classList.remove("hidden");
      semImagem.classList.add("hidden");
    };
    img.onerror = () => {
      img.classList.add("hidden");
      semImagem.classList.remove("hidden");
    };
    img.src = imagem;
  } else {
    semImagem.classList.remove("hidden");
  }

  // Em qualquer exercício há anterior apenas se não for o primeiro.
  $("treinoGaleriaAnterior").classList.toggle("hidden", treinoGaleriaIndice === 0);

  // Próximo continua visível inclusive no último exercício:
  // no último, ele abre a tela final em vez de voltar ao início.
  $("treinoGaleriaProximo").classList.remove("hidden");

  renderDivisoesGaleria();
  renderMiniaturasGaleria();
}

function abrirGaleriaTreino(indiceDivisao = 0, indiceItem = 0) {
  if (!selecionarDivisaoGaleria(indiceDivisao, indiceItem)) return;

  treinoGaleriaNoFim = false;
  renderGaleriaTreino();
  $("treinoGaleria").classList.remove("hidden");
  document.body.classList.add("gallery-open");
  $("treinoGaleriaFechar").focus();
}

function fecharGaleriaTreino() {
  $("treinoGaleria").classList.add("hidden");
  document.body.classList.remove("gallery-open");
}

function navegarGaleria(delta) {
  if (!treinoGaleriaItens.length) return;

  if (delta > 0) {
    if (treinoGaleriaNoFim) return;

    if (treinoGaleriaIndice >= treinoGaleriaItens.length - 1) {
      // Último exercício -> imagem/tela de fim. Nunca volta ao começo.
      treinoGaleriaNoFim = true;
      renderGaleriaTreino();
      return;
    }

    treinoGaleriaIndice += 1;
    renderGaleriaTreino();
    return;
  }

  if (delta < 0) {
    if (treinoGaleriaNoFim) {
      treinoGaleriaNoFim = false;
      treinoGaleriaIndice = treinoGaleriaItens.length - 1;
      renderGaleriaTreino();
      return;
    }

    // Primeiro exercício: não atravessa para outra divisão nem volta pelo final.
    if (treinoGaleriaIndice <= 0) return;

    treinoGaleriaIndice -= 1;
    renderGaleriaTreino();
  }
}


function renderAvaliacao(avaliacao = {}) {
  const status = textoSeguro(avaliacao.status) || "Pendente";
  const codigo = textoSeguro(avaliacao.codigo_status) || "pendente";

  $("avaliacaoResumo").textContent = status;
  $("avaliacaoCard").dataset.statusAvaliacao = codigo;

  if (avaliacao.total > 0) {
    const detalhes = [];
    if (avaliacao.ultima_data) detalhes.push(`Última: ${dataBR(avaliacao.ultima_data)}`);
    if (avaliacao.validade) detalhes.push(`Validade: ${dataBR(avaliacao.validade)}`);
    else if (avaliacao.proxima_data) detalhes.push(`Próxima: ${dataBR(avaliacao.proxima_data)}`);
    $("avaliacaoDetalhe").textContent = detalhes.join(" · ") || avaliacao.mensagem || "Resultado disponível.";
    $("avaliacaoAcao").textContent = "Toque para ver resultados";
  } else {
    $("avaliacaoDetalhe").textContent = avaliacao.mensagem || "Nenhuma avaliação física registrada.";
    $("avaliacaoAcao").textContent = "Toque para acompanhar o status";
  }
}

function abrirAvaliacao() {
  location.href = "/pages/aluno-avaliacao/index.html";
}

function renderFrequencia(frequencia = {}) {
  const total30 = Number(frequencia.ultimos_30_dias || 0);
  $("frequenciaResumo").textContent = `${total30} acesso${total30 === 1 ? "" : "s"} em 30 dias`;
  $("frequenciaDetalhe").textContent = frequencia.ultimo_acesso
    ? `Último acesso: ${dataBR(frequencia.ultimo_acesso)}`
    : "Nenhuma frequência registrada ainda.";
}

function renderFinanceiro(financeiro = {}) {
  const situacao = textoSeguro(financeiro.situacao) || "Sem dados";
  $("financeiroResumo").textContent = situacao;
  $("financeiroSituacao").textContent = situacao;

  if (financeiro.valor_em_aberto > 0) {
    $("financeiroDetalhe").textContent = `${moedaBR(financeiro.valor_em_aberto)} em aberto`;
  } else if (financeiro.proximo_vencimento) {
    $("financeiroDetalhe").textContent = `Próximo: ${dataBR(financeiro.proximo_vencimento)} · ${moedaBR(financeiro.proximo_valor)}`;
  } else {
    $("financeiroDetalhe").textContent = "Nenhuma cobrança em aberto.";
  }

  const lista = limparLista("financeiroLista");
  const mensalidades = Array.isArray(financeiro.mensalidades) ? financeiro.mensalidades : [];
  mensalidadePagamentoAtual = escolherMensalidadeParaPagamento(mensalidades);
  const pendente = pagamentoPendente();
  const pendenteDaMensalidade = pendente?.id && (
    !mensalidadePagamentoAtual?.id ||
    !pendente.mensalidadeId ||
    pendente.mensalidadeId === mensalidadePagamentoAtual.id
  );
  const btnPagamento = $("pagarMensalidadeAluno");
  if (btnPagamento) {
    btnPagamento.dataset.acaoPagamento = pendenteDaMensalidade ? "verificar" : "pagar";
    btnPagamento.classList.toggle("hidden", !mensalidadePagamentoAtual && !pendenteDaMensalidade);
    setButtonLabel(btnPagamento, pendenteDaMensalidade
      ? "Verificar pagamento"
      : mensalidadePagamentoAtual
      ? `Pagar ${moedaBR(saldoMensalidade(mensalidadePagamentoAtual))}`
      : "Pagar agora");
  }

  if (!mensalidades.length) {
    lista.appendChild(criarLinha("Mensalidades", "Sem lançamentos", "Nenhuma cobrança encontrada."));
    return;
  }
  mensalidades.slice(0, 5).forEach((item) => {
    const competencia = item.competencia ? `Mensalidade ${item.competencia}` : "Mensalidade";
    const detalhe = item.vencimento ? `Vencimento ${dataBR(item.vencimento)}` : "";
    const valor = saldoMensalidade(item) || item.valor;
    lista.appendChild(criarLinha(competencia, `${item.status || "—"} · ${moedaBR(valor)}`, detalhe));
  });
}

async function consultarPagamentoAluno(pagamentoId) {
  return request(`/pagamentos/${encodeURIComponent(pagamentoId)}`, {
    method: "GET",
    headers: { "X-Fusion-Device-Token": deviceToken() }
  });
}

function abrirJanelaPagamento(url = "", janela = null) {
  if (!url) return false;
  if (janela) {
    try { janela.opener = null; } catch {}
    janela.location.href = url;
  } else {
    const nova = window.open(url, "_blank", "noopener");
    if (!nova) location.href = url;
  }
  return true;
}

function htmlAbaPagamento(titulo = "", mensagem = "", erro = false) {
  const tituloSeguro = htmlSeguro(titulo || "Preparando pagamento");
  const mensagemSegura = htmlSeguro(mensagem || "Gerando link seguro de pagamento...");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tituloSeguro || "Pagamento Fusion"}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f3f7f6;color:#10201e}.box{width:min(420px,100%);background:#fff;border:1px solid #dce7e5;border-radius:18px;padding:24px;box-shadow:0 14px 40px rgba(16,32,30,.08)}h1{margin:0 0 10px;font-size:24px}p{margin:0;color:#61716f;line-height:1.45}.status{display:inline-block;margin-bottom:14px;padding:6px 10px;border-radius:999px;background:${erro ? "#fee2e2" : "#e8f5f2"};color:${erro ? "#991b1b" : "#0b5f59"};font-size:12px;font-weight:800;text-transform:uppercase}button{margin-top:18px;border:0;border-radius:12px;background:#0f766e;color:#fff;padding:12px 16px;font-weight:800;cursor:pointer}</style></head><body><main class="box"><span class="status">${erro ? "Erro" : "Pagamento"}</span><h1>${tituloSeguro}</h1><p>${mensagemSegura}</p>${erro ? "<button onclick=\"window.close();history.back();\">Voltar</button>" : ""}</main></body></html>`;
}

function escreverAbaPagamento(janela = null, titulo = "", mensagem = "", erro = false) {
  if (!janela) return;
  try {
    janela.document.open();
    janela.document.write(htmlAbaPagamento(titulo, mensagem, erro));
    janela.document.close();
  } catch {}
}

function abrirAbaPagamentoPreparando() {
  const janela = window.open("about:blank", "_blank");
  escreverAbaPagamento(janela, "Preparando pagamento", "Gerando link seguro de pagamento...");
  return janela;
}

function mostrarErroAbaPagamento(janela = null, mensagem = "") {
  escreverAbaPagamento(
    janela,
    "Pagamento não aberto",
    mensagem || "Não foi possível gerar o link de pagamento. Volte ao app do aluno e tente novamente.",
    true
  );
}

async function verificarPagamentoPendente({ abrirCheckout = false, janela = null, silencioso = false } = {}) {
  const pendente = pagamentoPendente();
  if (!pendente?.id) return false;

  let resposta;
  try {
    resposta = await consultarPagamentoAluno(pendente.id);
  } catch (error) {
    if (Number(error?.status) === 404 && String(error?.code || "") === "PAYMENT_NOT_FOUND") {
      limparPagamentoPendente();
      if (janela) janela.close();
      await carregarHome();
      if (!silencioso) {
        setMessage(
          "homeMessage",
          "O pagamento pendente anterior não existe mais. O financeiro foi atualizado.",
          "success"
        );
      }
      return false;
    }
    throw error;
  }

  const recebido = resposta.pagamento?.recebido === true || resposta.recebimento?.baixado === true;
  if (recebido) {
    limparPagamentoPendente();
    if (janela) janela.close();
    await carregarHome();
    setMessage("homeMessage", resposta.mensagem || "Pagamento recebido e baixa automática concluída.", "success");
    return true;
  }

  const url = resposta.checkout?.url || pendente.url || "";
  salvarPagamentoPendente(resposta);
  if (abrirCheckout && url) {
    abrirJanelaPagamento(url, janela);
    const gateway = resposta.checkout?.providerName || pendente.providerName || nomeGatewayPagamento(resposta.pagamento?.provider || pendente.provider);
    setMessage("homeMessage", `Pagamento ainda não confirmado pela ${gateway}. O link foi reaberto para concluir.`, "success");
  } else {
    if (janela && abrirCheckout) mostrarErroAbaPagamento(janela, "O pagamento ainda não tem link de checkout disponível.");
    else if (janela) janela.close();
    if (!silencioso) setMessage("homeMessage", resposta.mensagem || "Pagamento ainda aguardando confirmação.", "success");
  }
  return false;
}

async function pagarMensalidadeAluno() {
  const btn = $("pagarMensalidadeAluno");
  if (!btn) return;

  setMessage("homeMessage");
  const janela = abrirAbaPagamentoPreparando();
  buttonBusy(btn, true, "Gerando...");
  try {
    if (btn.dataset.acaoPagamento === "verificar") {
      await verificarPagamentoPendente({ abrirCheckout: true, janela });
      return;
    }

    if (!mensalidadePagamentoAtual?.id) {
      if (janela) janela.close();
      return;
    }

    const resposta = await request("/pagamentos", {
      method: "POST",
      headers: { "X-Fusion-Device-Token": deviceToken() },
      body: JSON.stringify({
        mensalidadeId: mensalidadePagamentoAtual.id,
        forma: "UNDEFINED"
      })
    });

    const url = resposta.checkout?.url || resposta.invoiceUrl || "";
    if (!url) throw new Error("A cobrança foi criada, mas o link de pagamento não foi retornado.");
    salvarPagamentoPendente(resposta);
    abrirJanelaPagamento(url, janela);
    btn.dataset.acaoPagamento = "verificar";
    setButtonLabel(btn, "Verificar pagamento");
    const gateway = resposta.checkout?.providerName || nomeGatewayPagamento(resposta.pagamento?.provider);
    setMessage("homeMessage", `Pagamento aberto pela ${gateway}. Assim que o gateway confirmar, a baixa será automática.`, "success");
  } catch (error) {
    const mensagem = error.message || "Não foi possível iniciar o pagamento.";
    mostrarErroAbaPagamento(janela, mensagem);
    setMessage("homeMessage", mensagem);
  } finally {
    buttonBusy(btn, false);
  }
}

function renderAvisos(avisos = []) {
  const listaAvisos = Array.isArray(avisos) ? avisos : [];
  const primeiro = listaAvisos[0] || {};
  $("avisosResumo").textContent = listaAvisos.length
    ? `${listaAvisos.length} aviso${listaAvisos.length === 1 ? "" : "s"}`
    : "Sem avisos";
  $("avisosDetalhe").textContent = primeiro.titulo || "Nenhum aviso pendente.";

  const lista = limparLista("avisosLista");
  if (!listaAvisos.length) {
    lista.appendChild(criarLinha("Tudo certo", "OK", "Nenhum aviso pendente para sua conta."));
    return;
  }
  listaAvisos.forEach((aviso) => {
    const linha = criarLinha(aviso.titulo || "Aviso", aviso.tipo === "alerta" ? "Atenção" : "", aviso.mensagem || "");
    linha.classList.add(`notice-${aviso.tipo || "info"}`);
    lista.appendChild(linha);
  });
}

async function carregarHome() {
  const data = await request("/me", {
    method: "GET",
    headers: deviceToken() ? { "X-Fusion-Device-Token": deviceToken() } : {}
  });
  if (data.academia_nome) setAcademia(data.academia_nome);

  const aluno = data.aluno || {};
  const primeiroNome = textoSeguro(aluno.nome).split(/\s+/).filter(Boolean)[0] || "";
  $("saudacaoAluno").textContent = primeiroNome ? `Olá, ${primeiroNome}` : "Olá";
  $("statusAluno").textContent = aluno.status || "Aluno";
  $("matriculaAluno").textContent = aluno.matricula ? `Matrícula ${aluno.matricula}` : "";
  $("modalidadeAluno").textContent = aluno.modalidade || "";

  mostrarFotoAluno(aluno);
  renderPlano(data.plano || null);
  renderTreinos(data.treinos || {});
  renderAvaliacao(data.avaliacao || {});
  renderFrequencia(data.frequencia || {});
  renderFinanceiro(data.financeiro || {});
  renderAvisos(data.avisos || []);

  setMessage("homeMessage");
  show("homeScreen");
  if (pagamentoPendente()?.id) {
    verificarPagamentoPendente({ silencioso: true }).catch(() => {});
  }
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
      if (tenantAtual()) show("loginScreen");
      else { clearTenant(); show("activationScreen"); }
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
  const confirmar = window.confirm("Trocar de academia neste acesso?");
  if (!confirmar) return;
  try { await request("/logout", { method: "POST", body: "{}" }); } catch {}
  clearTenant();
  localStorage.removeItem(KEYS.tenant);
  if ($("codigo")) $("codigo").value = "";
  show("activationScreen");
}

async function boot() {
  installationId();
  atualizarAcademiaNaTela();
  const tenant = tenantAtual();

  // Com tenant na URL/localStorage, a conta é a identidade.
  // Token de dispositivo antigo é ignorado e removido.
  if (tenant) {
    localStorage.removeItem(KEYS.deviceToken);
    try {
      await carregarHome();
      return;
    } catch (error) {
      if (error.status !== 401) {
        setMessage("loginMessage", error.message || "Não foi possível restaurar sua sessão.");
      }
    }

    if (acessoLinkAtual()) {
      show("firstAccessScreen");
      setMessage("firstAccessMessage", "Crie sua senha para acessar o Fusion Aluno.", "success");
      return;
    }

    show("loginScreen");
    return;
  }

  show("activationScreen");
  setMessage("activationMessage", "Abra o link enviado pela sua academia no WhatsApp.");
}

$("codigo")?.addEventListener("input", (event) => { event.target.value = codigoFormat(event.target.value); });
["cpfPrimeiro", "cpfLogin", "autoCpf"].forEach((id) => {
  $(id)?.addEventListener("input", (event) => { event.target.value = cpfFormat(event.target.value); });
});
$("autoTelefoneFinal")?.addEventListener("input", (event) => {
  event.target.value = digits(event.target.value).slice(0, 4);
});

document.querySelectorAll(".show-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Mostrar" : "Ocultar";
  });
});

$("ativar")?.addEventListener("click", ativar);
$("gerarMeuCodigo")?.addEventListener("click", gerarMeuCodigo);
$("jaTenhoSenha")?.addEventListener("click", abrirLoginDireto);
$("criarSenha").addEventListener("click", criarSenha);
$("voltarLogin").addEventListener("click", () => show("loginScreen"));
$("entrar").addEventListener("click", entrar);
$("sair").addEventListener("click", sair);
$("trocarAcademiaLogin").addEventListener("click", trocarAcademia);
$("trocarAcademiaHome").addEventListener("click", trocarAcademia);
$("pagarMensalidadeAluno")?.addEventListener("click", pagarMensalidadeAluno);

$("avaliacaoCard").addEventListener("click", abrirAvaliacao);
$("avaliacaoCard").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    abrirAvaliacao();
  }
});

$("treinoCard").addEventListener("click", () => abrirGaleriaTreino(0, 0));
$("treinoCard").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && treinoGaleriaItens.length) {
    event.preventDefault();
    abrirGaleriaTreino(0, 0);
  }
});
$("treinoGaleriaFechar").addEventListener("click", fecharGaleriaTreino);
$("treinoGaleriaFimFechar").addEventListener("click", fecharGaleriaTreino);
$("treinoGaleriaAnterior").addEventListener("click", () => navegarGaleria(-1));
$("treinoGaleriaProximo").addEventListener("click", () => navegarGaleria(1));
$("treinoGaleria").addEventListener("click", (event) => {
  if (event.target === $("treinoGaleria")) fecharGaleriaTreino();
});
$("treinoGaleria").addEventListener("touchstart", (event) => {
  treinoGaleriaTouchX = event.changedTouches?.[0]?.clientX ?? null;
}, { passive: true });
$("treinoGaleria").addEventListener("touchend", (event) => {
  if (treinoGaleriaTouchX == null) return;
  const fim = event.changedTouches?.[0]?.clientX ?? treinoGaleriaTouchX;
  const delta = fim - treinoGaleriaTouchX;
  treinoGaleriaTouchX = null;
  if (Math.abs(delta) < 55) return;
  navegarGaleria(delta > 0 ? -1 : 1);
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if ($("treinoGaleria").classList.contains("hidden")) return;
  if (event.key === "Escape") fecharGaleriaTreino();
  if (event.key === "ArrowLeft") navegarGaleria(-1);
  if (event.key === "ArrowRight") navegarGaleria(1);
});

[["codigo", ativar], ["senhaConfirmar", criarSenha], ["senhaLogin", entrar]].forEach(([id, action]) => {
  $(id)?.addEventListener("keydown", (event) => { if (event.key === "Enter") action(); });
});


function prepararAutoacessoDoLink() {
  const tenant = tenantAtual();
  $("selfServiceBox")?.classList.toggle("hidden", !tenant);
  $("jaTenhoSenha")?.classList.toggle("hidden", !tenant);
}
prepararAutoacessoDoLink();

boot();
