const API = "/api/treinos/aluno-app";
const KEYS = {
  installationId: "fusion_aluno_installation_id_v2",
  deviceToken: "fusion_aluno_device_token_v2",
  academiaNome: "fusion_aluno_academia_nome_v2"
};

const $ = (id) => document.getElementById(id);
const screens = ["loadingScreen", "activationScreen", "firstAccessScreen", "loginScreen", "homeScreen"];

let treinoGaleriaDivisoes = [];
let treinoGaleriaDivisaoIndice = 0;
let treinoGaleriaItens = [];
let treinoGaleriaIndice = 0;
let treinoGaleriaNoFim = false;
let treinoGaleriaTouchX = null;

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

function textoSeguro(value) {
  return String(value ?? "").trim();
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
  if (!mensalidades.length) {
    lista.appendChild(criarLinha("Mensalidades", "Sem lançamentos", "Nenhuma cobrança encontrada."));
    return;
  }
  mensalidades.slice(0, 5).forEach((item) => {
    const competencia = item.competencia ? `Mensalidade ${item.competencia}` : "Mensalidade";
    const detalhe = item.vencimento ? `Vencimento ${dataBR(item.vencimento)}` : "";
    lista.appendChild(criarLinha(competencia, `${item.status || "—"} · ${moedaBR(item.valor)}`, detalhe));
  });
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
    headers: { "X-Fusion-Device-Token": deviceToken() }
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
  renderFrequencia(data.frequencia || {});
  renderFinanceiro(data.financeiro || {});
  renderAvisos(data.avisos || []);

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
  $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") action(); });
});

boot();
