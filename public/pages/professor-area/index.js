const $ = (id) => document.getElementById(id);

function sessaoProfessor() {
  try {
    const sessao = JSON.parse(localStorage.getItem("fusion_professor_sessao") || "null");
    if (sessao?.professorId) return sessao;
  } catch {}
  return null;
}

function exigirLoginProfessor() {
  const sessao = sessaoProfessor();
  if (!sessao?.professorId) {
    location.replace("/pages/professor-login/index.html");
    return null;
  }
  return sessao;
}

function paramsProfessor(sessao) {
  const params = new URLSearchParams();
  params.set("professorId", sessao.professorId);
  params.set("professorNome", sessao.professorNome || "Professor");
  params.set("origem", "professor");
  return params.toString();
}

function abrirAvaliacao() {
  const sessao = exigirLoginProfessor();
  if (!sessao) return;
  location.href = `/pages/avaliacoes/index.html?${paramsProfessor(sessao)}`;
}

function abrirTreinos() {
  const sessao = exigirLoginProfessor();
  if (!sessao) return;
  location.href = `/pages/treinos/index.html?${paramsProfessor(sessao)}`;
}

const sessao = exigirLoginProfessor();
if (sessao) {
  $("professorNome").textContent = sessao.professorNome || "Professor";
}

$("abrirAvaliacao").onclick = abrirAvaliacao;
$("abrirTreinos").onclick = abrirTreinos;
$("sair").onclick = () => {
  localStorage.removeItem("fusion_professor_sessao");
  location.replace("/pages/professor-login/index.html");
};
