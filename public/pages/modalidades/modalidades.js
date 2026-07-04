if (typeof carregarLayout === "function") carregarLayout("Modalidades");

let modalidades = [];
const API = "/api/modalidades";

const elementos = {
  tabela: document.getElementById("tabelaModalidades"),
  busca: document.getElementById("buscaModalidade"),
  statusFiltro: document.getElementById("filtroStatus"),
  modal: document.getElementById("modalModalidade"),
  form: document.getElementById("formModalidade"),
  modalTitulo: document.getElementById("modalTitulo")
};

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  return json.dados ?? json.modalidades ?? json.data ?? json.itens ?? json;
}

async function carregarResumo() {
  const resumo = await request(`${API}/resumo`);
  document.getElementById("kpiTotal").textContent = resumo.total;
  document.getElementById("kpiAtivas").textContent = resumo.ativas;
  document.getElementById("kpiInativas").textContent = resumo.inativas;
  document.getElementById("kpiCategorias").textContent = resumo.categorias;
}

async function carregarModalidades() {
  const params = new URLSearchParams({
    q: elementos.busca.value,
    status: elementos.statusFiltro.value
  });

  modalidades = await request(`${API}?${params.toString()}`);
  renderizarTabela();
  await carregarResumo();
}

function renderizarTabela() {
  if (!modalidades.length) {
    elementos.tabela.innerHTML = `<tr><td colspan="8">Nenhuma modalidade encontrada.</td></tr>`;
    return;
  }

  elementos.tabela.innerHTML = modalidades.map((item) => `
    <tr>
      <td>
        <div class="modalidade-nome">
          <span class="modalidade-icone" style="background:${item.cor}">${item.icone || "🏋️"}</span>
          <span>${item.nome}</span>
        </div>
      </td>
      <td>${item.categoria}</td>
      <td>${item.professorResponsavel || "-"}</td>
      <td>${item.duracaoMinutos} min</td>
      <td>${item.capacidadeMaxima}</td>
      <td>${moeda(item.valorSugerido)}</td>
      <td><span class="badge ${item.status === "Ativa" ? "ativa" : "inativa"}">${item.status}</span></td>
      <td>
        <div class="acoes">
          <button class="btn-secondary" onclick="editarModalidade('${item.id}')">Editar</button>
          <button class="btn-danger" onclick="excluirModalidade('${item.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function abrirModal() {
  elementos.form.reset();
  document.getElementById("modalidadeId").value = "";
  document.getElementById("duracaoMinutos").value = 60;
  document.getElementById("capacidadeMaxima").value = 20;
  document.getElementById("valorSugerido").value = 0;
  document.getElementById("cor").value = "#ff6b00";
  elementos.modalTitulo.textContent = "Nova Modalidade";
  elementos.modal.classList.add("aberto");
}

function fecharModal() {
  elementos.modal.classList.remove("aberto");
}

window.editarModalidade = function (id) {
  const item = modalidades.find((modalidade) => modalidade.id === id);
  if (!item) return;

  document.getElementById("modalidadeId").value = item.id;
  document.getElementById("nome").value = item.nome;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("professorResponsavel").value = item.professorResponsavel || "";
  document.getElementById("duracaoMinutos").value = item.duracaoMinutos || 60;
  document.getElementById("capacidadeMaxima").value = item.capacidadeMaxima || 20;
  document.getElementById("valorSugerido").value = item.valorSugerido || 0;
  document.getElementById("icone").value = item.icone || "";
  document.getElementById("cor").value = item.cor || "#ff6b00";
  document.getElementById("status").value = item.status || "Ativa";
  document.getElementById("descricao").value = item.descricao || "";

  elementos.modalTitulo.textContent = "Editar Modalidade";
  elementos.modal.classList.add("aberto");
};

window.excluirModalidade = async function (id) {
  if (!confirm("Deseja realmente excluir esta modalidade?")) return;
  await request(`${API}/${id}`, { method: "DELETE" });
  await carregarModalidades();
};

elementos.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("modalidadeId").value;
  const payload = {
    nome: document.getElementById("nome").value,
    categoria: document.getElementById("categoria").value,
    professorResponsavel: document.getElementById("professorResponsavel").value,
    duracaoMinutos: document.getElementById("duracaoMinutos").value,
    capacidadeMaxima: document.getElementById("capacidadeMaxima").value,
    valorSugerido: document.getElementById("valorSugerido").value,
    icone: document.getElementById("icone").value,
    cor: document.getElementById("cor").value,
    status: document.getElementById("status").value,
    descricao: document.getElementById("descricao").value
  };

  if (id) {
    await request(`${API}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await request(API, { method: "POST", body: JSON.stringify(payload) });
  }

  fecharModal();
  await carregarModalidades();
});

document.getElementById("btnNovaModalidade").addEventListener("click", abrirModal);
document.getElementById("btnFecharModal").addEventListener("click", fecharModal);
document.getElementById("btnCancelar").addEventListener("click", fecharModal);
elementos.busca.addEventListener("input", carregarModalidades);
elementos.statusFiltro.addEventListener("change", carregarModalidades);

carregarModalidades();
