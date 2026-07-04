const API_AGENDA = "/api/agenda";
const API_ALUNOS = "/api/alunos";
const API_PROFESSORES = "/api/professores";

const params = new URLSearchParams(window.location.search);
const agendamentoId = params.get("id");

if (!agendamentoId) {
  alert("Agendamento não informado.");
  window.location.href = "/pages/agenda/";
}

carregarFicha();

async function carregarFicha() {
  const [agendaRes, alunosRes, professoresRes] = await Promise.all([
    fetch(`${API_AGENDA}/${agendamentoId}`),
    fetch(API_ALUNOS),
    fetch(API_PROFESSORES)
  ]);

  if (!agendaRes.ok) {
    alert("Agendamento não encontrado.");
    window.location.href = "/pages/agenda/";
    return;
  }

  const item = await agendaRes.json();
  const alunos = await alunosRes.json();
  const professores = await professoresRes.json();

  const aluno = alunos.find(a => a.id === item.aluno_id);
  const professor = professores.find(p => p.id === item.professor_id);

  document.getElementById("tituloAgendamento").textContent = item.titulo || "Agendamento";
  preencher("tipo", item.tipo);
  preencher("data", formatarData(item.data));
  preencher("horario", `${item.hora_inicio || "-"} ${item.hora_fim ? "às " + item.hora_fim : ""}`);
  preencher("aluno", aluno ? aluno.nome : "-");
  preencher("professor", professor ? professor.nome : "-");
  preencher("local", item.local);
  preencher("status", item.status);
  preencher("recorrencia", item.recorrencia || "Sem recorrência");
  document.getElementById("observacoes").textContent = item.observacoes || "-";

  document.getElementById("btnEditar").onclick = () => {
    window.location.href = `/pages/agenda/cadastro.html?id=${item.id}`;
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
