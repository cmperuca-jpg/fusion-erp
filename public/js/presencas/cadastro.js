const API_PRESENCAS = "/api/presencas";
const API_ALUNOS = "/api/alunos";
const API_TURMAS = "/api/turmas";
const API_PROFESSORES = "/api/professores";
const API_MATRICULAS = "/api/matriculas";

const form = document.getElementById("formPresenca");

iniciarAbas();

const params = new URLSearchParams(window.location.search);
const presencaId = params.get("id");

carregarSelects().then(() => {
  preencherPadrao();

  if (presencaId) {
    carregarPresenca(presencaId);
  }
});

async function carregarSelects() {
  const [alunosRes, turmasRes, professoresRes] = await Promise.all([
    fetch(API_ALUNOS),
    fetch(API_TURMAS),
    fetch(API_PROFESSORES)
  ]);

  const alunos = await alunosRes.json();
  const turmas = await turmasRes.json();
  const professores = await professoresRes.json();

  const selectAluno = document.getElementById("aluno_id");
  const selectTurma = document.getElementById("turma_id");
  const selectProfessor = document.getElementById("professor_id");

  alunos.forEach(aluno => {
    selectAluno.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
  });

  turmas.forEach(turma => {
    selectTurma.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;
  });

  professores.forEach(professor => {
    selectProfessor.innerHTML += `<option value="${professor.id}">${professor.nome}</option>`;
  });
}

function preencherPadrao() {
  const hoje = new Date();
  const data = hoje.toISOString().slice(0, 10);
  const hora = String(hoje.getHours()).padStart(2, "0") + ":" + String(hoje.getMinutes()).padStart(2, "0");

  if (!document.getElementById("data").value) {
    document.getElementById("data").value = data;
  }

  if (!document.getElementById("hora_entrada").value) {
    document.getElementById("hora_entrada").value = hora;
  }
}

document.getElementById("aluno_id").addEventListener("change", buscarMatriculaAtiva);
document.getElementById("turma_id").addEventListener("change", buscarMatriculaAtiva);

async function buscarMatriculaAtiva() {
  const alunoId = valor("aluno_id");
  const turmaId = valor("turma_id");

  if (!alunoId || !turmaId) return;

  const resposta = await fetch(API_MATRICULAS);
  const matriculas = await resposta.json();

  const matricula = matriculas.find(item =>
    item.aluno_id === alunoId &&
    item.turma_id === turmaId &&
    item.status === "ativa"
  );

  if (matricula) {
    document.getElementById("matricula_id").value = matricula.id;
  } else {
    document.getElementById("matricula_id").value = "";
    mostrarAviso("Atenção", "Não foi encontrada matrícula ativa para este aluno nesta turma.");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const presenca = {
    aluno_id: valor("aluno_id"),
    turma_id: valor("turma_id"),
    professor_id: valor("professor_id"),
    matricula_id: valor("matricula_id"),
    data: valor("data"),
    hora_entrada: valor("hora_entrada"),
    hora_saida: valor("hora_saida"),
    tipo: valor("tipo"),
    status: valor("status"),
    responsavel: valor("responsavel"),
    observacoes: valor("observacoes")
  };

  const id = valor("presencaId");
  const url = id ? `${API_PRESENCAS}/${id}` : API_PRESENCAS;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(presenca)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar presença.");
    return;
  }

  mostrarAviso("Sucesso", "Presença salva com sucesso.");

  setTimeout(() => {
    window.location.href = "/pages/presencas/";
  }, 600);
});

async function carregarPresenca(id) {
  const resposta = await fetch(`${API_PRESENCAS}/${id}`);

  if (!resposta.ok) {
    mostrarAviso("Erro", "Presença não encontrada.");
    window.location.href = "/pages/presencas/";
    return;
  }

  const presenca = await resposta.json();

  document.getElementById("presencaId").value = presenca.id || "";

  Object.keys(presenca).forEach(campo => {
    const elemento = document.getElementById(campo);

    if (elemento) {
      elemento.value = presenca[campo] || "";
    }
  });

  const titulo = document.getElementById("tituloCadastro");

  if (titulo) {
    titulo.textContent = "Editar Presença";
  }
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}
