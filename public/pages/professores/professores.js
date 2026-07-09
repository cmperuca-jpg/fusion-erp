if (typeof window.carregarLayout === "function") window.carregarLayout("Professores");

const API_URL = "/api/professores";
let professores = [];

const elementos = {
  tabela: document.getElementById("tabelaProfessores"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiAtivos: document.getElementById("kpiAtivos"),
  kpiInativos: document.getElementById("kpiInativos"),
  busca: document.getElementById("buscaProfessor"),
  filtroStatus: document.getElementById("filtroStatus"),
  modal: document.getElementById("modalProfessor"),
  form: document.getElementById("formProfessor"),
  tituloModal: document.getElementById("tituloModal"),
  professorId: document.getElementById("professorId")
};

function valor(id) {
  return document.getElementById(id).value.trim();
}

function setValor(id, valorCampo) {
  document.getElementById(id).value = valorCampo || "";
}

function abrirModal(professor = null) {
  elementos.form.reset();
  elementos.professorId.value = "";
  elementos.tituloModal.textContent = professor ? "Editar Professor" : "Novo Professor";

  if (professor) {
    elementos.professorId.value = professor.id;
    setValor("nome", professor.nome);
    setValor("email", professor.email);
    setValor("telefone", professor.telefone);
    setValor("cpf", professor.cpf);
    setValor("rg", professor.rg);
    setValor("cref", professor.cref);
    setValor("especialidade", professor.especialidade);
    setValor("status", professor.status);
    setValor("endereco", professor.endereco);
    setValor("banco", professor.banco);
    setValor("agencia", professor.agencia);
    setValor("conta", professor.conta);
    setValor("chavePix", professor.chavePix);
    setValor("observacoes", professor.observacoes);
  }

  elementos.modal.classList.add("ativo");
}

function fecharModal() {
  elementos.modal.classList.remove("ativo");
}

function montarPayload() {
  return {
    nome: valor("nome"),
    email: valor("email"),
    telefone: valor("telefone"),
    cpf: valor("cpf"),
    rg: valor("rg"),
    cref: valor("cref"),
    especialidade: valor("especialidade"),
    status: valor("status"),
    endereco: valor("endereco"),
    banco: valor("banco"),
    agencia: valor("agencia"),
    conta: valor("conta"),
    chavePix: valor("chavePix"),
    observacoes: valor("observacoes")
  };
}

async function carregarProfessores() {
  const busca = encodeURIComponent(elementos.busca.value.trim());
  const status = encodeURIComponent(elementos.filtroStatus.value);
  const resposta = await fetch(`${API_URL}?busca=${busca}&status=${status}`);
  const json = await resposta.json();

  if (!json.sucesso) {
    alert(json.mensagem || "Erro ao carregar professores.");
    return;
  }

  professores = json.dados || [];
  renderizarTabela();
  renderizarKPIs();
}

function renderizarKPIs() {
  elementos.kpiTotal.textContent = professores.length;
  elementos.kpiAtivos.textContent = professores.filter((p) => p.status === "Ativo").length;
  elementos.kpiInativos.textContent = professores.filter((p) => p.status === "Inativo").length;
}

function renderizarTabela() {
  if (!professores.length) {
    elementos.tabela.innerHTML = `<tr><td colspan="6">Nenhum professor encontrado.</td></tr>`;
    return;
  }

  elementos.tabela.innerHTML = professores.map((professor) => `
    <tr>
      <td>${professor.nome || "-"}</td>
      <td>${professor.especialidade || "-"}</td>
      <td>${professor.telefone || "-"}</td>
      <td>${professor.cref || "-"}</td>
      <td><span class="status-pill ${professor.status === "Ativo" ? "status-ativo" : "status-inativo"}">${professor.status}</span></td>
      <td>
        <div class="acoes">
          <button class="btn-secondary btn-small" onclick="editarProfessor('${professor.id}')">Editar</button>
          <button class="btn-danger btn-small" onclick="excluirProfessor('${professor.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function salvarProfessor(event) {
  event.preventDefault();

  const id = elementos.professorId.value;
  const metodo = id ? "PUT" : "POST";
  const url = id ? `${API_URL}/${id}` : API_URL;

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(montarPayload())
  });

  const json = await resposta.json();

  if (!json.sucesso) {
    alert(json.mensagem || "Erro ao salvar professor.");
    return;
  }

  fecharModal();
  await carregarProfessores();
}

window.editarProfessor = function editarProfessor(id) {
  const professor = professores.find((item) => String(item.id) === String(id));
  if (professor) abrirModal(professor);
};

window.excluirProfessor = async function excluirProfessor(id) {
  if (!confirm("Deseja excluir este professor?")) return;

  const resposta = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  const json = await resposta.json();

  if (!json.sucesso) {
    alert(json.mensagem || "Erro ao excluir professor.");
    return;
  }

  await carregarProfessores();
};

document.getElementById("btnNovoProfessor").addEventListener("click", () => abrirModal());
document.getElementById("btnFecharModal").addEventListener("click", fecharModal);
document.getElementById("btnCancelar").addEventListener("click", fecharModal);
elementos.form.addEventListener("submit", salvarProfessor);
elementos.busca.addEventListener("input", carregarProfessores);
elementos.filtroStatus.addEventListener("change", carregarProfessores);

carregarProfessores();
