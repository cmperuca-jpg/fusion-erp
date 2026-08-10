const API = "/api/treinos/aluno-app";
const DEVICE_KEY = "fusion_aluno_device_token_v2";
const $ = (id) => document.getElementById(id);

const GRUPOS = [
  { titulo: "Composição corporal", campos: [["peso","Peso"],["altura","Altura"],["imc","IMC"],["classificacao_imc","Classificação IMC"],["percentual_gordura","% Gordura"],["percentual_ideal","% Ideal"],["massa_magra","Massa magra"],["massa_gorda","Massa gorda"],["agua_corporal","Água corporal"],["gordura_visceral","Gordura visceral"],["idade_metabolica","Idade metabólica"],["tmb","TMB"],["composicao_resultado","Resultado", true]] },
  { titulo: "Perímetros e RCQ", campos: [["pescoco","Pescoço"],["punho","Punho"],["ombro","Ombro"],["braco_relaxado_direito","Braço relaxado direito"],["braco_relaxado_esquerdo","Braço relaxado esquerdo"],["braco_contraido_direito","Braço contraído direito"],["braco_contraido_esquerdo","Braço contraído esquerdo"],["antebraco_direito","Antebraço direito"],["antebraco_esquerdo","Antebraço esquerdo"],["torax_relaxado","Tórax relaxado"],["torax_inspirado","Tórax inspirado"],["cintura","Cintura"],["abdomen","Abdome"],["quadril","Quadril"],["coxa_proximal_direita","Coxa proximal direita"],["coxa_proximal_esquerda","Coxa proximal esquerda"],["coxa_medial_direita","Coxa medial direita"],["coxa_medial_esquerda","Coxa medial esquerda"],["panturrilha_direita","Panturrilha direita"],["panturrilha_esquerda","Panturrilha esquerda"],["rcq","RCQ"],["rcq_classificacao","Classificação RCQ", true],["soma_perimetros","Soma dos perímetros"]] },
  { titulo: "Dobras cutâneas e protocolo", campos: [["protocolo_dobras","Protocolo"],["subescapular","Subescapular"],["bicipital","Bicipital"],["tricipital","Tricipital"],["axilar_media","Axilar média"],["supra_iliaca","Supra-ilíaca"],["peitoral","Peitoral"],["dobra_abdominal","Abdominal"],["dobra_coxa","Coxa"],["dobra_panturrilha","Panturrilha"]] },
  { titulo: "Cardiorrespiratória", campos: [["condicao_fisica","Condição física"],["protocolo_cardio","Protocolo"],["vo2_obtido","VO² obtido"],["vo2_previsto","VO² previsto"],["deficit_aerobico","Déficit aeróbico"],["cardio_info","Resultado", true]] },
  { titulo: "Neuromotores", campos: [["flexao_bracos","Flexão de braços"],["flexao_resultado","Resultado flexão"],["abdominal_repeticoes","Abdominal"],["abdominal_resultado","Resultado abdominal"],["banco_wells","Banco de Wells"],["wells_resultado","Resultado Wells"]] },
  { titulo: "Anamnese", campos: [["pratica_atividade","Pratica atividade física"],["medicamentos","Medicamentos"],["cirurgias","Cirurgias"],["doencas_familia","Doenças na família"],["alergias","Alergias"],["restricoes_medicas","Restrições médicas"],["lesoes","Lesões"],["anamnese_observacoes","Observações", true],["observacoes","Observações gerais", true]] }
];

const METRICAS = [
  ["peso", "Peso"], ["imc", "IMC"], ["percentual_gordura", "% Gordura"],
  ["massa_magra", "Massa magra"], ["massa_gorda", "Massa gorda"],
  ["cintura", "Cintura"], ["quadril", "Quadril"], ["rcq", "RCQ"],
  ["abdomen", "Abdome"], ["soma_perimetros", "Soma perímetros"]
];

const FOTOS = [
  ["foto_frente_base64", "Frente"],
  ["foto_costas_base64", "Costas"],
  ["foto_lateral_direita_base64", "Lateral direita"],
  ["foto_lateral_esquerda_base64", "Lateral esquerda"]
];

function texto(v) { return String(v ?? "").trim(); }
function temValor(v) { return v !== undefined && v !== null && texto(v) !== ""; }
function deviceToken() { return localStorage.getItem(DEVICE_KEY) || ""; }

function dataISO(v) {
  if (!v) return "";
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  const b = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return b ? `${b[3]}-${b[2]}-${b[1]}` : s;
}

function dataBR(v) {
  const s = dataISO(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (texto(v) || "-");
}

function dataAvaliacao(item = {}) {
  return dataISO(item.data || item.criado_em || item.criadoEm || item.atualizado_em || item.atualizadoEm);
}

function num(v) {
  const n = Number(String(v ?? "").replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function carregarMe() {
  const token = deviceToken();
  if (!token) {
    location.replace("/pages/aluno-login/index.html");
    return null;
  }

  const response = await fetch(`${API}/me`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "X-Fusion-Device-Token": token }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const erro = new Error(payload.mensagem || "Não foi possível carregar sua avaliação.");
    erro.status = response.status;
    throw erro;
  }
  return payload.dados || payload;
}

function renderStatus(avaliacao = {}) {
  const status = texto(avaliacao.status) || "Pendente";
  $("statusAvaliacao").textContent = status;
  $("statusMensagem").textContent = avaliacao.mensagem || "";

  const box = $("statusBox");
  box.dataset.status = texto(avaliacao.codigo_status) || "pendente";

  const partes = [];
  if (avaliacao.ultima_data) partes.push(`Última: ${dataBR(avaliacao.ultima_data)}`);
  if (avaliacao.validade) partes.push(`Validade: ${dataBR(avaliacao.validade)}`);
  if (avaliacao.proxima_data) partes.push(`Próxima: ${dataBR(avaliacao.proxima_data)}`);
  $("statusDatas").textContent = partes.join(" · ");
}

function renderComparacao(atual, anterior) {
  const container = $("comparacao");
  container.replaceChildren();

  if (!anterior) {
    $("comparacaoInfo").textContent = "Esta é a primeira avaliação registrada.";
    const aviso = document.createElement("div");
    aviso.className = "simple-notice";
    aviso.textContent = "Quando houver uma nova avaliação, a evolução será comparada automaticamente.";
    container.appendChild(aviso);
    return;
  }

  $("comparacaoInfo").textContent =
    `Comparando ${dataBR(dataAvaliacao(atual))} com ${dataBR(dataAvaliacao(anterior))}.`;

  let total = 0;
  METRICAS.forEach(([key, nome]) => {
    const a = atual?.[key];
    const b = anterior?.[key];
    if (!temValor(a) && !temValor(b)) return;

    total += 1;
    const card = document.createElement("article");
    card.className = "metric-card";

    const titulo = document.createElement("h3");
    titulo.textContent = nome;

    const row = document.createElement("div");
    row.className = "metric-row";

    const na = num(a);
    const nb = num(b);
    let diferenca = "-";
    let classe = "neutral";
    if (na !== null && nb !== null) {
      const d = na - nb;
      diferenca = `${d > 0 ? "+" : ""}${d.toFixed(2).replace(".", ",")}`;
      classe = d > 0 ? "positive" : d < 0 ? "negative" : "neutral";
    }

    [["Anterior", temValor(b) ? b : "-"], ["Atual", temValor(a) ? a : "-"], ["Diferença", diferenca]].forEach(([rotulo, valor], idx) => {
      const celula = document.createElement("div");
      const span = document.createElement("span");
      span.textContent = rotulo;
      const strong = document.createElement("strong");
      strong.textContent = String(valor);
      if (idx === 2) strong.className = `difference ${classe}`;
      celula.append(span, strong);
      row.appendChild(celula);
    });

    card.append(titulo, row);
    container.appendChild(card);
  });

  if (!total) {
    const aviso = document.createElement("div");
    aviso.className = "simple-notice";
    aviso.textContent = "Não há métricas numéricas suficientes para comparação.";
    container.appendChild(aviso);
  }
}

function renderCompleto(atual = {}) {
  const container = $("resultadoCompleto");
  container.replaceChildren();

  let grupos = 0;
  GRUPOS.forEach((grupo) => {
    const camposValidos = grupo.campos.filter(([key]) => temValor(atual?.[key]));
    if (!camposValidos.length) return;
    grupos += 1;

    const section = document.createElement("section");
    section.className = "result-group";
    const h3 = document.createElement("h3");
    h3.textContent = grupo.titulo;
    const grid = document.createElement("div");
    grid.className = "field-grid";

    camposValidos.forEach(([key, label, full]) => {
      const box = document.createElement("div");
      box.className = `field${full ? " full" : ""}`;
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = String(atual[key]);
      box.append(span, strong);
      grid.appendChild(box);
    });

    section.append(h3, grid);
    container.appendChild(section);
  });

  if (!grupos) {
    const aviso = document.createElement("div");
    aviso.className = "simple-notice";
    aviso.textContent = "A avaliação existe, mas ainda não possui medidas detalhadas para exibição.";
    container.appendChild(aviso);
  }
}

function renderFotos(atual = {}) {
  const fotos = FOTOS
    .map(([key, label]) => ({ src: texto(atual?.[key]), label }))
    .filter(item => item.src);

  $("fotosBox").classList.toggle("hidden", !fotos.length);
  const container = $("fotosPosturais");
  container.replaceChildren();

  fotos.forEach(({ src, label }) => {
    const card = document.createElement("figure");
    card.className = "photo-card";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Foto postural - ${label}`;
    const cap = document.createElement("figcaption");
    cap.textContent = label;
    card.append(img, cap);
    container.appendChild(card);
  });
}

function renderResultados(avaliacao = {}) {
  const lista = Array.isArray(avaliacao.itens) ? [...avaliacao.itens] : [];
  lista.sort((a, b) => String(dataAvaliacao(b)).localeCompare(String(dataAvaliacao(a))));

  renderStatus(avaliacao);

  if (!lista.length) {
    $("semAvaliacao").classList.remove("hidden");
    $("resultadoAvaliacao").classList.add("hidden");
    return;
  }

  $("semAvaliacao").classList.add("hidden");
  $("resultadoAvaliacao").classList.remove("hidden");

  const atual = lista[0];
  const anterior = lista[1] || null;

  $("dataAtual").textContent = dataBR(dataAvaliacao(atual));
  $("dataAnterior").textContent = anterior ? dataBR(dataAvaliacao(anterior)) : "Sem anterior";
  $("professor").textContent = texto(atual.professorNome || atual.professor_nome || atual.professor) || "-";
  $("objetivo").textContent = texto(atual.objetivo) || "-";

  renderComparacao(atual, anterior);
  renderCompleto(atual);
  renderFotos(atual);
}

async function carregar() {
  $("loading").classList.remove("hidden");
  $("conteudo").classList.add("hidden");
  $("erroBox").classList.add("hidden");

  try {
    const data = await carregarMe();
    if (!data) return;

    $("academiaNome").textContent = texto(data.academia_nome);
    renderResultados(data.avaliacao || {});
    $("conteudo").classList.remove("hidden");
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      location.replace("/pages/aluno-login/index.html");
      return;
    }
    $("erroMensagem").textContent = error.message || "Tente novamente em alguns instantes.";
    $("erroBox").classList.remove("hidden");
  } finally {
    $("loading").classList.add("hidden");
  }
}

function voltar() {
  location.href = "/pages/aluno-login/index.html";
}

$("btnVoltar").addEventListener("click", voltar);
$("btnVoltarVazio").addEventListener("click", voltar);
$("btnTentarNovamente").addEventListener("click", carregar);

carregar();
