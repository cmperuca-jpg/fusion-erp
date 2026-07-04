carregarLayout("Agenda");

const API = "/api/agenda";

const els = {
  lista: document.getElementById("listaAgenda"),
  modal: document.getElementById("modalAula"),
  form: document.getElementById("formAula"),
  modalTitulo: document.getElementById("modalTitulo"),
  buscaProfessor: document.getElementById("buscaProfessor"),
  filtroStatus: document.getElementById("filtroStatus"),
  filtroData: document.getElementById("filtroData"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiHoje: document.getElementById("kpiHoje"),
  kpiAtivas: document.getElementById("kpiAtivas"),
  kpiCanceladas: document.getElementById("kpiCanceladas")
};

let aulas = [];

function valor(id) {
  return document.getElementById(id).value;
}

function setValor(id, value) {
  document.getElementById(id).value = value ?? "";
}

function abrirModal(aula = null) {
  els.form.reset();

  if (aula) {
    els.modalTitulo.textContent = "Editar Aula";
    setValor("aulaId", aula.id);
    setValor("titulo", aula.titulo);
    setValor("modalidade", aula.modalidade);
    setValor("turma", aula.turma);
    setValor("professor", aula.professor);
    setValor("sala", aula.sala);
    setValor("data", aula.data);
    setValor("horaInicio", aula.horaInicio);
    setValor("horaFim", aula.horaFim);
    setValor("capacidade", aula.capacidade);
    setValor("inscritos", aula.inscritos);
    setValor("status", aula.status);
    setValor("observacoes", aula.observacoes);
  } else {
    els.modalTitulo.textContent = "Nova Aula";
    setValor("aulaId", "");
    setValor("status", "Ativa");
  }

  els.modal.classList.add("ativo");
}

function fecharModal() {
  els.modal.classList.remove("ativo");
}

function statusClasse(status) {
  return String(status || "")
    .toLowerCase()
    .replace("í", "i")
    .replace("ú", "u");
}

function renderizarAgenda() {
  if (!aulas.length) {
    els.lista.innerHTML = "<p>Nenhuma aula encontrada.</p>";
    return;
  }

  els.lista.innerHTML = aulas
    .map((aula) => `
      <article class="aula-card">
        <div class="aula-hora">
          ${aula.horaInicio}<br>
          <small>${aula.horaFim}</small>
        </div>

        <div class="aula-info">
          <h3>${aula.titulo}</h3>
          <p>${aula.data} • ${aula.modalidade} • ${aula.turma}</p>
          <p>Professor: ${aula.professor} • Sala: ${aula.sala || "-"}</p>
          <p>Vagas: ${aula.inscritos}/${aula.capacidade}</p>
          <span class="badge ${statusClasse(aula.status)}">${aula.status}</span>
        </div>

        <div class="aula-acoes">
          <button class="btn-secondary" onclick="editarAula('${aula.id}')">Editar</button>
          <button class="btn-danger" onclick="excluirAula('${aula.id}')">Excluir</button>
        </div>
      </article>
    `)
    .join("");
}

async function carregarResumo() {
  const resp = await fetch(`${API}/resumo`);
  const json = await resp.json();

  if (!json.ok) return;

  els.kpiTotal.textContent = json.resumo.total;
  els.kpiHoje.textContent = json.resumo.hoje;
  els.kpiAtivas.textContent = json.resumo.ativas;
  els.kpiCanceladas.textContent = json.resumo.canceladas;
}

async function carregarAgenda() {
  const params = new URLSearchParams();

  if (els.buscaProfessor.value) {
    params.set("professor", els.buscaProfessor.value);
  }

  if (els.filtroStatus.value) {
    params.set("status", els.filtroStatus.value);
  }

  if (els.filtroData.value) {
    params.set("data", els.filtroData.value);
  }

  const resp = await fetch(`${API}?${params.toString()}`);
  const json = await resp.json();

  aulas = json.aulas || [];
  renderizarAgenda();
  await carregarResumo();
}

async function salvarAula(event) {
  event.preventDefault();

  const id = valor("aulaId");

  const payload = {
    titulo: valor("titulo"),
    modalidade: valor("modalidade"),
    turma: valor("turma"),
    professor: valor("professor"),
    sala: valor("sala"),
    data: valor("data"),
    horaInicio: valor("horaInicio"),
    horaFim: valor("horaFim"),
    capacidade: valor("capacidade"),
    inscritos: valor("inscritos"),
    status: valor("status"),
    observacoes: valor("observacoes")
  };

  await fetch(id ? `${API}/${id}` : API, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  fecharModal();
  await carregarAgenda();
}

window.editarAula = function editarAula(id) {
  const aula = aulas.find((item) => String(item.id) === String(id));
  if (aula) abrirModal(aula);
};

window.excluirAula = async function excluirAula(id) {
  if (!confirm("Deseja excluir esta aula?")) return;

  await fetch(`${API}/${id}`, {
    method: "DELETE"
  });

  await carregarAgenda();
};

document.getElementById("btnNovaAula").addEventListener("click", () => abrirModal());
document.getElementById("btnFecharModal").addEventListener("click", fecharModal);
document.getElementById("btnCancelar").addEventListener("click", fecharModal);
document.getElementById("btnFiltrar").addEventListener("click", carregarAgenda);

document.getElementById("btnLimpar").addEventListener("click", () => {
  els.buscaProfessor.value = "";
  els.filtroStatus.value = "";
  els.filtroData.value = "";
  carregarAgenda();
});

els.form.addEventListener("submit", salvarAula);

carregarAgenda();
