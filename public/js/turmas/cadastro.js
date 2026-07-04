const API_TURMAS = "/api/turmas";
const API_PROFESSORES = "/api/professores";

const form = document.getElementById("formTurma");

iniciarAbas();

const params = new URLSearchParams(window.location.search);
const turmaId = params.get("id");

carregarProfessores().then(() => {
  if (turmaId) {
    carregarTurma(turmaId);
  }
});

async function carregarProfessores() {
  const resposta = await fetch(API_PROFESSORES);
  const professores = await resposta.json();

  const select = document.getElementById("professor_id");

  professores.forEach(professor => {
    select.innerHTML += `<option value="${professor.id}">${professor.nome}</option>`;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const turma = {
    nome: valor("nome"),
    modalidade: valor("modalidade"),
    professor_id: valor("professor_id"),
    dias_semana: valor("dias_semana"),
    hora_inicio: valor("hora_inicio"),
    hora_fim: valor("hora_fim"),
    capacidade: valor("capacidade"),
    sala_local: valor("sala_local"),
    data_inicio: valor("data_inicio"),
    data_fim: valor("data_fim"),
    status: valor("status"),
    observacoes: valor("observacoes")
  };

  const id = valor("turmaId");
  const url = id ? `${API_TURMAS}/${id}` : API_TURMAS;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(turma)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar turma.");
    return;
  }

  mostrarAviso("Sucesso", "Turma salva com sucesso.");

  setTimeout(() => {
    window.location.href = "/pages/turmas/";
  }, 600);
});

async function carregarTurma(id) {
  const resposta = await fetch(`${API_TURMAS}/${id}`);

  if (!resposta.ok) {
    mostrarAviso("Erro", "Turma não encontrada.");
    window.location.href = "/pages/turmas/";
    return;
  }

  const turma = await resposta.json();

  document.getElementById("turmaId").value = turma.id || "";

  Object.keys(turma).forEach(campo => {
    const elemento = document.getElementById(campo);

    if (elemento) {
      elemento.value = turma[campo] || "";
    }
  });

  const titulo = document.getElementById("tituloCadastro");

  if (titulo) {
    titulo.textContent = "Editar Turma";
  }
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}
