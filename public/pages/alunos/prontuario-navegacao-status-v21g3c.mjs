const FILTROS_NAV = new Set(["ativos", "inativos", "todos"]);

function normalizarNav(valor) {
  return String(valor ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function idAlunoNavegacao(aluno = {}) {
  return String(aluno.id ?? aluno._id ?? aluno.alunoId ?? aluno.aluno_id ?? "").trim();
}

export function nomeAlunoNavegacao(aluno = {}) {
  return String(aluno.nome ?? aluno.aluno ?? aluno.name ?? "Aluno").trim() || "Aluno";
}

export function alunoAtivoNavegacao(aluno = {}) {
  const estados = [
    aluno.status,
    aluno.situacao,
    aluno.statusMatricula,
    aluno.matriculaStatus
  ].map(normalizarNav).filter(Boolean);

  const inativos = new Set([
    "inativo", "inativa",
    "suspenso", "suspensa",
    "cancelado", "cancelada",
    "encerrado", "encerrada",
    "removido", "removida",
    "excluido", "excluida"
  ]);

  if (aluno.ativo === false || estados.some(s => inativos.has(s))) return false;

  // Bloqueio financeiro/de acesso é uma restrição operacional, não torna
  // automaticamente o cadastro/matrícula do aluno inativo.
  if (aluno.ativo === true) return true;
  return estados.some(s => ["ativo", "ativa", "regular"].includes(s));
}

export function filtroNavegacaoValido(valor = "") {
  const v = normalizarNav(valor);
  return FILTROS_NAV.has(v) ? v : "ativos";
}

export function filtrarAlunosNavegacao(alunos = [], filtro = "ativos") {
  const modo = filtroNavegacaoValido(filtro);

  return (Array.isArray(alunos) ? alunos : [])
    .filter(aluno => idAlunoNavegacao(aluno))
    .filter(aluno => {
      if (modo === "todos") return true;
      const ativo = alunoAtivoNavegacao(aluno);
      return modo === "ativos" ? ativo : !ativo;
    })
    .sort((a, b) => {
      if (modo === "todos") {
        const aAtivo = alunoAtivoNavegacao(a) ? 0 : 1;
        const bAtivo = alunoAtivoNavegacao(b) ? 0 : 1;
        if (aAtivo !== bAtivo) return aAtivo - bAtivo;
      }
      return nomeAlunoNavegacao(a).localeCompare(
        nomeAlunoNavegacao(b),
        "pt-BR",
        { sensitivity: "base" }
      );
    });
}

export function destinoNavegacao(alunos = [], atualId = "", filtro = "ativos", direcao = 1) {
  const lista = filtrarAlunosNavegacao(alunos, filtro);
  if (!lista.length) return null;

  const atual = String(atualId || "");
  const indice = lista.findIndex(aluno => idAlunoNavegacao(aluno) === atual);

  if (indice < 0) {
    return direcao < 0 ? lista[lista.length - 1] : lista[0];
  }

  const passo = direcao < 0 ? -1 : 1;
  return lista[(indice + passo + lista.length) % lista.length];
}

function textoBotao(node) {
  return normalizarNav(node?.textContent || "");
}

function localizarBotoesNavegacao() {
  const raiz = document.querySelector(".prontuario-header") || document;
  const candidatos = [...raiz.querySelectorAll("button, a")];

  const voltar = candidatos.find(node => textoBotao(node) === "voltar") || null;
  const proximo = candidatos.find(node => textoBotao(node) === "proximo aluno") || null;

  return { voltar, proximo };
}

function filtroAtualUrl() {
  const params = new URLSearchParams(location.search);
  return filtroNavegacaoValido(params.get("nav") || "ativos");
}

function gravarFiltroUrl(filtro) {
  const url = new URL(location.href);
  url.searchParams.set("nav", filtroNavegacaoValido(filtro));
  history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function carregarAlunosNavegacao() {
  const resp = await fetch("/api/alunos", { cache: "no-store" });
  const payload = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(payload?.mensagem || payload?.erro || `Erro HTTP ${resp.status}`);
  if (!Array.isArray(payload)) throw new Error("A listagem de alunos retornou formato inesperado.");
  return payload;
}

function criarSeletorNavegacao({ voltar, proximo }) {
  const existente = document.getElementById("prontuarioNavStatus");
  if (existente) return existente;

  const alvo = voltar || proximo;
  if (!alvo?.parentElement) return null;

  const wrap = document.createElement("label");
  wrap.className = "prontuario-nav-status-wrap";
  wrap.setAttribute("for", "prontuarioNavStatus");
  wrap.innerHTML = `
    <span>Navegar</span>
    <select id="prontuarioNavStatus" aria-label="Filtrar alunos da navegação">
      <option value="ativos">Ativos</option>
      <option value="inativos">Inativos</option>
      <option value="todos">Todos</option>
    </select>`;

  alvo.parentElement.insertBefore(wrap, alvo);
  const select = wrap.querySelector("select");
  select.value = filtroAtualUrl();
  select.addEventListener("change", () => gravarFiltroUrl(select.value));
  return select;
}

function atualizarContagens(select, alunos) {
  if (!select) return;
  const ativos = filtrarAlunosNavegacao(alunos, "ativos").length;
  const inativos = filtrarAlunosNavegacao(alunos, "inativos").length;
  const todos = filtrarAlunosNavegacao(alunos, "todos").length;

  const porValor = {
    ativos: `Ativos (${ativos})`,
    inativos: `Inativos (${inativos})`,
    todos: `Todos (${todos})`
  };

  [...select.options].forEach(option => {
    option.textContent = porValor[option.value] || option.textContent;
  });
}

function irParaAluno(aluno, filtro) {
  const id = idAlunoNavegacao(aluno);
  if (!id) return;
  location.href = `/pages/alunos/prontuario.html?id=${encodeURIComponent(id)}&nav=${encodeURIComponent(filtroNavegacaoValido(filtro))}`;
}


export function resumirIndicadoresRapidos({
  indicadores = {},
  alunoId = ""
} = {}) {
  const id = String(alunoId || "");
  const item = indicadores?.indicadores?.[id] || {};
  const tri = (valor) => valor === true ? true : valor === false ? false : null;

  return {
    treino: tri(item.treino),
    avaliacao: tri(item.avaliacao),
    app: tri(item.aplicativo),
    biometria: tri(item.biometria)
  };
}

function garantirPainelIndicadoresRapidos() {
  let painel = document.getElementById("prontuarioIndicadoresRapidos");
  if (painel) return painel;

  const subtitulo = document.getElementById("subtituloAluno");
  if (!subtitulo?.parentElement) return null;

  subtitulo.parentElement.classList.add("prontuario-identidade-v21g3c");

  painel = document.createElement("div");
  painel.id = "prontuarioIndicadoresRapidos";
  painel.className = "prontuario-indicadores-rapidos";
  painel.setAttribute("aria-label", "Indicadores rápidos do aluno");
  painel.innerHTML = `
    <span class="prontuario-indicador neutro" data-indicador="treino"><i></i>Treino</span>
    <span class="prontuario-indicador neutro" data-indicador="avaliacao"><i></i>Avaliação</span>
    <span class="prontuario-indicador neutro" data-indicador="app"><i></i>App</span>
    <span class="prontuario-indicador neutro" data-indicador="biometria"><i></i>Biometria</span>`;

  subtitulo.insertAdjacentElement("afterend", painel);
  return painel;
}

function aplicarEstadoIndicador(painel, nome, valor, detalhes = {}) {
  const item = painel?.querySelector(`[data-indicador="${nome}"]`);
  if (!item) return;

  item.classList.remove("ok", "bad", "neutro");
  item.classList.add(valor === true ? "ok" : valor === false ? "bad" : "neutro");

  const rotulos = {
    treino: "Treino",
    avaliacao: "Avaliação",
    app: "App",
    biometria: "Biometria"
  };

  const mensagens = {
    treino: valor === true ? "Treino cadastrado" : valor === false ? "Sem treino cadastrado" : "Treino indisponível",
    avaliacao: valor === true ? "Avaliação cadastrada" : valor === false ? "Sem avaliação cadastrada" : "Avaliação indisponível",
    app: valor === true ? "App ativado" : valor === false ? "App não ativado" : "Status do App indisponível",
    biometria: valor === true ? "Biometria cadastrada" : valor === false ? "Biometria não cadastrada" : "Status da biometria indisponível"
  };

  item.setAttribute("title", mensagens[nome] || rotulos[nome] || nome);
  item.setAttribute(
    "aria-label",
    `${rotulos[nome] || nome}: ${valor === true ? "sim" : valor === false ? "não" : "indisponível"}`
  );

  if (detalhes?.texto) item.dataset.detalhe = detalhes.texto;
}

async function respostaJsonLeitura(url) {
  const resp = await fetch(url, { cache: "no-store" });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.ok === false) {
    throw new Error(json?.mensagem || json?.erro || `Erro HTTP ${resp.status}`);
  }
  return json;
}

async function iniciarPainelIndicadoresRapidos() {
  const painel = garantirPainelIndicadoresRapidos();
  if (!painel) return;

  const id = new URLSearchParams(location.search).get("id") || "";
  if (!id) return;

  const indicadores = await respostaJsonLeitura("/api/alunos/indicadores");
  const resumo = resumirIndicadoresRapidos({ indicadores, alunoId: id });

  aplicarEstadoIndicador(painel, "treino", resumo.treino);
  aplicarEstadoIndicador(painel, "avaliacao", resumo.avaliacao);
  aplicarEstadoIndicador(painel, "app", resumo.app);
  aplicarEstadoIndicador(painel, "biometria", resumo.biometria);

  console.info("[Prontuário] Indicadores rápidos V21G3C atualizados.");
}


async function iniciarNavegacaoStatus() {
  const { voltar, proximo } = localizarBotoesNavegacao();
  if (!voltar || !proximo) {
    console.warn("[Prontuário] Navegação V21G3C não encontrou os botões Voltar/Próximo aluno.");
    return;
  }

  const select = criarSeletorNavegacao({ voltar, proximo });
  if (!select) return;

  let alunosCache = null;
  let carregando = null;

  const obterAlunos = async () => {
    if (alunosCache) return alunosCache;
    if (!carregando) {
      carregando = carregarAlunosNavegacao()
        .then(lista => {
          alunosCache = lista;
          atualizarContagens(select, lista);
          return lista;
        })
        .finally(() => { carregando = null; });
    }
    return carregando;
  };

  obterAlunos().catch(error => {
    console.warn("[Prontuário] Não foi possível preparar navegação por status:", error);
  });

  const navegar = async (evento, direcao) => {
    evento.preventDefault();
    evento.stopImmediatePropagation();

    try {
      voltar.disabled = true;
      proximo.disabled = true;

      const alunos = await obterAlunos();
      const filtro = filtroNavegacaoValido(select.value);
      const atualId = new URLSearchParams(location.search).get("id") || "";
      const destino = destinoNavegacao(alunos, atualId, filtro, direcao);

      if (!destino) {
        alert(`Nenhum aluno encontrado no filtro "${select.options[select.selectedIndex]?.textContent || filtro}".`);
        return;
      }

      irParaAluno(destino, filtro);
    } catch (error) {
      console.error("[Prontuário] Falha ao navegar:", error);
      alert(error?.message || "Não foi possível carregar a navegação de alunos.");
    } finally {
      voltar.disabled = false;
      proximo.disabled = false;
    }
  };

  voltar.addEventListener("click", evento => navegar(evento, -1), { capture: true });
  proximo.addEventListener("click", evento => navegar(evento, 1), { capture: true });

  voltar.title = "Aluno anterior conforme filtro de navegação";
  proximo.title = "Próximo aluno conforme filtro de navegação";

  console.info("[Prontuário] Navegação V21G3C ativa; filtro padrão: ativos.");
}

function iniciarProntuarioV21G3C() {
  iniciarNavegacaoStatus();
  iniciarPainelIndicadoresRapidos().catch(error => {
    console.warn("[Prontuário] Indicadores rápidos V21G3C indisponíveis:", error);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarProntuarioV21G3C, { once: true });
  } else {
    iniciarProntuarioV21G3C();
  }
}
