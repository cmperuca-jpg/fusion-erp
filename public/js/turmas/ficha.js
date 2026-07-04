const API_TURMAS = "/api/turmas";
const API_PROFESSORES = "/api/professores";

const params = new URLSearchParams(window.location.search);
const turmaId = params.get("id");

if (!turmaId) {
  alert("Turma não informada.");
  window.location.href = "/pages/turmas/";
}

carregarFicha();

async function carregarFicha() {
  const [turmaRes, professoresRes] = await Promise.all([
    fetch(`${API_TURMAS}/${turmaId}`),
    fetch(API_PROFESSORES)
  ]);

  if (!turmaRes.ok) {
    alert("Turma não encontrada.");
    window.location.href = "/pages/turmas/";
    return;
  }

  const turma = await turmaRes.json();
  const professores = await professoresRes.json();

  const professor = professores.find(p => p.id === turma.professor_id);

  document.getElementById("nomeTurma").textContent = turma.nome || "Turma";

  preencher("modalidade", turma.modalidade);
  preencher("professor", professor ? professor.nome : "-");
  preencher("dias_semana", turma.dias_semana);
  preencher("horario", `${turma.hora_inicio || "-"} ${turma.hora_fim ? "às " + turma.hora_fim : ""}`);
  preencher("capacidade", turma.capacidade);
  preencher("sala_local", turma.sala_local);
  preencher("data_inicio", formatarData(turma.data_inicio));
  preencher("data_fim", formatarData(turma.data_fim));
  preencher("status", turma.status);

  document.getElementById("observacoes").textContent = turma.observacoes || "-";

  document.getElementById("btnEditar").onclick = () => {
    window.location.href = `/pages/turmas/cadastro.html?id=${turma.id}`;
  };
}

function preencher(id, valorCampo) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valorCampo || "-";
  }
}

function formatarData(data) {
  if (!data) return "-";
  const partes = data.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}
