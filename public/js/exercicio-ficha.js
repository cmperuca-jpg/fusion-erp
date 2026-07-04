const API = "/api/exercicios";

iniciarAbas();

const parametros = new URLSearchParams(window.location.search);
const exercicioId = parametros.get("id");

if (!exercicioId) {
  alert("Exercício não informado.");
  window.location.href = "/pages/exercicios/";
}

carregarFicha();

async function carregarFicha() {
  const resposta = await fetch(`${API}/${exercicioId}`);

  if (!resposta.ok) {
    alert("Exercício não encontrado.");
    window.location.href = "/pages/exercicios/";
    return;
  }

  const exercicio = await resposta.json();

  document.getElementById("nomeExercicio").textContent = exercicio.nome || "Exercício";

  preencher("grupo_muscular", exercicio.grupo_muscular);
  preencher("equipamento", exercicio.equipamento);
  preencher("dificuldade", exercicio.dificuldade);
  preencher("tipo", exercicio.tipo);
  preencher("status", exercicio.status);

  preencher("descricao", exercicio.descricao);
  preencher("execucao", exercicio.execucao);
  preencher("musculos_envolvidos", exercicio.musculos_envolvidos);
  preencher("video_url", exercicio.video_url);

  if (exercicio.imagem_base64) {
    const img = document.getElementById("imagemPreview");
    const texto = document.getElementById("imagemTexto");

    img.src = exercicio.imagem_base64;
    img.style.display = "block";
    texto.style.display = "none";
  }

  document.getElementById("btnEditar").onclick = () => {
    window.location.href = `/pages/exercicios/?id=${exercicio.id}`;
  };
}

function preencher(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valor || "-";
  }
}