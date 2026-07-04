const API_PRESENCAS = "/api/presencas";
const API_ALUNOS = "/api/alunos";
const API_TURMAS = "/api/turmas";
const API_PROFESSORES = "/api/professores";

const params = new URLSearchParams(window.location.search);
const presencaId = params.get("id");

if (!presencaId) {
  alert("Presença não informada.");
  window.location.href = "/pages/presencas/";
}

carregarFicha();

async function carregarFicha() {
  const [presencaRes, alunosRes, turmasRes, professoresRes] = await Promise.all([
    fetch(`${API_PRESENCAS}/${presencaId}`),
    fetch(API_ALUNOS),
    fetch(API_TURMAS),
    fetch(API_PROFESSORES)
  ]);

  if (!presencaRes.ok) {
    alert("Presença não encontrada.");
    window.location.href = "/pages/presencas/";
    return;
  }

  const presenca = await presencaRes.json();
  const alunos = await alunosRes.json();
  const turmas = await turmasRes.json();
  const professores = await professoresRes.json();

  const aluno = alunos.find(a => a.id === presenca.aluno_id);
  const turma = turmas.find(t => t.id === presenca.turma_id);
  const professor = professores.find(p => p.id === presenca.professor_id);

  document.getElementById("tituloPresenca").textContent = aluno ? `Presença - ${aluno.nome}` : "Presença";

  preencher("aluno", aluno ? aluno.nome : "-");
  preencher("turma", turma ? turma.nome : "-");
  preencher("professor", professor ? professor.nome : "-");
  preencher("data", formatarData(presenca.data));
  preencher("hora_entrada", presenca.hora_entrada);
  preencher("hora_saida", presenca.hora_saida);
  preencher("tipo", presenca.tipo);
  preencher("status", presenca.status);
  preencher("responsavel", presenca.responsavel);

  document.getElementById("observacoes").textContent = presenca.observacoes || "-";

  document.getElementById("btnEditar").onclick = () => {
    window.location.href = `/pages/presencas/cadastro.html?id=${presenca.id}`;
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
