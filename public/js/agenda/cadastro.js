const API_AGENDA = "/api/agenda";
const API_ALUNOS = "/api/alunos";
const API_PROFESSORES = "/api/professores";

const form = document.getElementById("formAgenda");

iniciarAbas();

const params = new URLSearchParams(window.location.search);
const agendamentoId = params.get("id");

carregarSelects().then(() => {
  if (agendamentoId) {
    carregarAgendamento(agendamentoId);
  }
});

async function carregarSelects() {
  const [alunosRes, professoresRes] = await Promise.all([
    fetch(API_ALUNOS),
    fetch(API_PROFESSORES)
  ]);

  const alunos = await alunosRes.json();
  const professores = await professoresRes.json();

  const selectAluno = document.getElementById("aluno_id");
  const selectProfessor = document.getElementById("professor_id");

  alunos.forEach(aluno => {
    selectAluno.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
  });

  professores.forEach(professor => {
    selectProfessor.innerHTML += `<option value="${professor.id}">${professor.nome}</option>`;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const agendamento = {
    titulo: valor("titulo"),
    tipo: valor("tipo"),
    data: valor("data"),
    hora_inicio: valor("hora_inicio"),
    hora_fim: valor("hora_fim"),
    aluno_id: valor("aluno_id"),
    professor_id: valor("professor_id"),
    local: valor("local"),
    status: valor("status"),
    recorrencia: valor("recorrencia"),
    observacoes: valor("observacoes")
  };

  const id = valor("agendamentoId");
  const url = id ? `${API_AGENDA}/${id}` : API_AGENDA;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agendamento)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar agendamento.");
    return;
  }

  mostrarAviso("Sucesso", "Agendamento salvo com sucesso.");

  setTimeout(() => {
    window.location.href = "/pages/agenda/";
  }, 600);
});

async function carregarAgendamento(id) {
  const resposta = await fetch(`${API_AGENDA}/${id}`);

  if (!resposta.ok) {
    mostrarAviso("Erro", "Agendamento não encontrado.");
    window.location.href = "/pages/agenda/";
    return;
  }

  const item = await resposta.json();

  document.getElementById("agendamentoId").value = item.id || "";

  Object.keys(item).forEach(campo => {
    const elemento = document.getElementById(campo);

    if (elemento) {
      elemento.value = item[campo] || "";
    }
  });

  const titulo = document.getElementById("tituloCadastro");

  if (titulo) {
    titulo.textContent = "Editar Agendamento";
  }
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}
