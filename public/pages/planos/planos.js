if (typeof carregarLayout === "function") carregarLayout("Planos");

let planos = [];
let modalidades = [];
const API = "/api/planos";
const API_MODALIDADES = "/api/modalidades";
const PLANOS_ATUALIZADOS_KEY = "fusion_planos_atualizados_em";

const elementos = {
  tabela: document.getElementById("tabelaPlanos"),
  busca: document.getElementById("buscaPlano"),
  tipoFiltro: document.getElementById("filtroTipo"),
  statusFiltro: document.getElementById("filtroStatus"),
  modal: document.getElementById("modalPlano"),
  form: document.getElementById("formPlano"),
  modalTitulo: document.getElementById("modalTitulo")
};

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function normalizar(valor) {
  return String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function request(url, options = {}) {
  const resposta = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok || json.ok === false || json.sucesso === false) {
    throw new Error(json.mensagem || json.erro || "Erro na operação.");
  }
  if (Array.isArray(json)) return json;
  return json.dados ?? json.planos ?? json.data ?? json.itens ?? json;
}

function nomeModalidade(item) {
  return item?.nome || item?.modalidade || item?.descricao || item?.id || "";
}

function listaModalidades(valor) {
  if (Array.isArray(valor)) return valor.map((item) => String(item || "").trim()).filter(Boolean);
  return String(valor || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function modalidadesSelecionadas() {
  const container = document.getElementById("modalidadesIncluidas");
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value)
    .filter(Boolean);
}

function renderizarOpcoesModalidades(selecionadas = []) {
  const container = document.getElementById("modalidadesIncluidas");
  const ajuda = document.getElementById("modalidadesAjuda");
  if (!container) return;

  const selecionadasNorm = new Set(listaModalidades(selecionadas).map(normalizar));
  if (!modalidades.length) {
    container.innerHTML = `<div class="modalidades-empty">Nenhuma modalidade ativa cadastrada. Cadastre em Modalidades para liberar a seleção no plano.</div>`;
    if (ajuda) ajuda.textContent = "Sem modalidade cadastrada, o plano fica sem distribuição por modalidade.";
    return;
  }

  container.innerHTML = modalidades.map((item, index) => {
    const nome = nomeModalidade(item);
    const id = `modalidadePlano_${index}`;
    const checked = selecionadasNorm.has(normalizar(nome)) ? "checked" : "";
    return `
      <label class="modalidade-option" for="${esc(id)}">
        <input id="${esc(id)}" type="checkbox" value="${esc(nome)}" ${checked}>
        <span>${esc(nome)}</span>
      </label>
    `;
  }).join("");
  if (ajuda) ajuda.textContent = "Selecione as modalidades que este plano oferece.";
}

async function carregarModalidades() {
  const lista = await request(API_MODALIDADES).catch(() => []);
  const mapa = new Map();
  lista
    .filter((item) => !["inativa", "inativo", "cancelada", "cancelado"].includes(normalizar(item.status || "Ativa")))
    .forEach((item) => {
      const nome = nomeModalidade(item);
      if (nome && !mapa.has(normalizar(nome))) mapa.set(normalizar(nome), { ...item, nome });
    });
  modalidades = [...mapa.values()].sort((a, b) => nomeModalidade(a).localeCompare(nomeModalidade(b), "pt-BR"));
  renderizarOpcoesModalidades();
}

async function carregarResumo() {
  const resumo = await request(`${API}/resumo`);
  document.getElementById("kpiTotal").textContent = resumo.total;
  document.getElementById("kpiAtivos").textContent = resumo.ativos;
  document.getElementById("kpiInativos").textContent = resumo.inativos;
  document.getElementById("kpiReceita").textContent = moeda(resumo.receitaPotencial);
}

async function carregarPlanos() {
  const params = new URLSearchParams({
    q: elementos.busca.value,
    tipo: elementos.tipoFiltro.value,
    status: elementos.statusFiltro.value
  });

  planos = await request(`${API}?${params.toString()}`);
  renderizarTabela();
  await carregarResumo();
}

function renderizarModalidades(modalidades = []) {
  const lista = listaModalidades(modalidades);
  if (!lista.length) return `<span class="tag">Nenhuma</span>`;
  return lista.map((item) => `<span class="tag">${esc(item)}</span>`).join("");
}

function renderizarTabela() {
  if (!planos.length) {
    elementos.tabela.innerHTML = `<tr><td colspan="9">Nenhum plano encontrado.</td></tr>`;
    return;
  }

  elementos.tabela.innerHTML = planos.map((item) => `
    <tr>
      <td>
        <div class="plano-nome">
          <strong>${item.nome}</strong>
          <small>${item.descricao || "Sem descrição"}</small>
        </div>
      </td>
      <td>${item.tipo}</td>
      <td>${moeda(item.valorMensal)}</td>
      <td>${moeda(item.taxaMatricula)}</td>
      <td><div class="tags">${renderizarModalidades(item.modalidadesIncluidas)}</div></td>
      <td>${item.limiteSemanal ? `${item.limiteSemanal}x/semana` : "Ilimitado"}</td>
      <td>${item.fidelidadeMeses ? `${item.fidelidadeMeses} meses` : "Sem fidelidade"}</td>
      <td><span class="badge ${item.status === "Ativo" ? "ativo" : "inativo"}">${item.status}</span></td>
      <td>
        <div class="acoes">
          <button class="btn-secondary" onclick="editarPlano('${item.id}')">Editar</button>
          <button class="btn-danger" onclick="excluirPlano('${item.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function abrirModal() {
  elementos.form.reset();
  document.getElementById("planoId").value = "";
  document.getElementById("valorMensal").value = 0;
  document.getElementById("taxaMatricula").value = 0;
  document.getElementById("fidelidadeMeses").value = 0;
  document.getElementById("descontoPercentual").value = 0;
  document.getElementById("limiteSemanal").value = 0;
  document.getElementById("horariosPermitidos").value = "Livre";
  renderizarOpcoesModalidades();
  elementos.modalTitulo.textContent = "Novo Plano";
  elementos.modal.classList.add("aberto");
}

function fecharModal() {
  elementos.modal.classList.remove("aberto");
}

window.editarPlano = function (id) {
  const item = planos.find((plano) => plano.id === id);
  if (!item) return;

  document.getElementById("planoId").value = item.id;
  document.getElementById("nome").value = item.nome;
  document.getElementById("tipo").value = item.tipo;
  document.getElementById("status").value = item.status;
  document.getElementById("valorMensal").value = item.valorMensal || 0;
  document.getElementById("taxaMatricula").value = item.taxaMatricula || 0;
  document.getElementById("fidelidadeMeses").value = item.fidelidadeMeses || 0;
  document.getElementById("descontoPercentual").value = item.descontoPercentual || 0;
  document.getElementById("limiteSemanal").value = item.limiteSemanal || 0;
  renderizarOpcoesModalidades(item.modalidadesIncluidas || []);
  document.getElementById("horariosPermitidos").value = item.horariosPermitidos || "Livre";
  document.getElementById("descricao").value = item.descricao || "";

  elementos.modalTitulo.textContent = "Editar Plano";
  elementos.modal.classList.add("aberto");
};

window.excluirPlano = async function (id) {
  if (!confirm("Deseja realmente excluir este plano?")) return;
  await request(`${API}/${id}`, { method: "DELETE" });
  localStorage.setItem(PLANOS_ATUALIZADOS_KEY, String(Date.now()));
  await carregarPlanos();
};

elementos.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("planoId").value;
  const payload = {
    nome: document.getElementById("nome").value,
    tipo: document.getElementById("tipo").value,
    status: document.getElementById("status").value,
    valorMensal: document.getElementById("valorMensal").value,
    taxaMatricula: document.getElementById("taxaMatricula").value,
    fidelidadeMeses: document.getElementById("fidelidadeMeses").value,
    descontoPercentual: document.getElementById("descontoPercentual").value,
    limiteSemanal: document.getElementById("limiteSemanal").value,
    modalidadesIncluidas: modalidadesSelecionadas(),
    horariosPermitidos: document.getElementById("horariosPermitidos").value,
    descricao: document.getElementById("descricao").value
  };

  if (id) {
    await request(`${API}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await request(API, { method: "POST", body: JSON.stringify(payload) });
  }

  /* A pagina publica escuta esta chave e tambem consulta o servidor
     periodicamente, portanto outras abas e outros equipamentos se atualizam. */
  localStorage.setItem(PLANOS_ATUALIZADOS_KEY, String(Date.now()));
  fecharModal();
  await carregarPlanos();
});

document.getElementById("btnNovoPlano").addEventListener("click", abrirModal);
document.getElementById("btnFecharModal").addEventListener("click", fecharModal);
document.getElementById("btnCancelar").addEventListener("click", fecharModal);
elementos.busca.addEventListener("input", carregarPlanos);
elementos.tipoFiltro.addEventListener("change", carregarPlanos);
elementos.statusFiltro.addEventListener("change", carregarPlanos);

async function iniciar() {
  await carregarModalidades();
  await carregarPlanos();
}

iniciar().catch((erro) => alert(erro.message));
