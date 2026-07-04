const API_AVALIACOES = "/api/avaliacoes";

const form = document.getElementById("formAvaliacao");

const parametros = new URLSearchParams(window.location.search);
const avaliacaoId = parametros.get("id");
const alunoId = parametros.get("aluno_id");

document.getElementById("aluno_id").value = alunoId || "";

iniciarAbas();

document.getElementById("peso").addEventListener("input", calcularIMC);
document.getElementById("altura").addEventListener("input", calcularIMC);

function calcularIMC() {
  const peso = Number(document.getElementById("peso").value.replace(",", "."));
  const altura = Number(document.getElementById("altura").value.replace(",", "."));

  if (peso > 0 && altura > 0) {
    const imc = peso / (altura * altura);
    document.getElementById("imc").value = imc.toFixed(2);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const avaliacao = {
    aluno_id: document.getElementById("aluno_id").value,
    data: valor("data"),
    objetivo: valor("objetivo"),
    professor: valor("professor"),

    peso: valor("peso"),
    altura: valor("altura"),
    imc: valor("imc"),
    percentual_gordura: valor("percentual_gordura"),
    massa_magra: valor("massa_magra"),
    massa_gorda: valor("massa_gorda"),

    pescoco: valor("pescoco"),
    ombro: valor("ombro"),
    torax: valor("torax"),
    cintura: valor("cintura"),
    abdomen: valor("abdomen"),
    quadril: valor("quadril"),
    braco_direito: valor("braco_direito"),
    braco_esquerdo: valor("braco_esquerdo"),
    coxa_direita: valor("coxa_direita"),
    coxa_esquerda: valor("coxa_esquerda"),
    panturrilha_direita: valor("panturrilha_direita"),
    panturrilha_esquerda: valor("panturrilha_esquerda"),

    observacoes: valor("observacoes")
  };

  const url = avaliacaoId ? `${API_AVALIACOES}/${avaliacaoId}` : API_AVALIACOES;
  const metodo = avaliacaoId ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(avaliacao)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    alert(erro.erro || "Erro ao salvar avaliação.");
    return;
  }

  alert("Avaliação salva com sucesso.");
  window.location.href = `/pages/alunos/ficha.html?id=${avaliacao.aluno_id}`;
});

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

if (avaliacaoId) {
  carregarAvaliacao(avaliacaoId);
}

async function carregarAvaliacao(id) {
  const resposta = await fetch(`${API_AVALIACOES}/${id}`);

  if (!resposta.ok) {
    alert("Avaliação não encontrada.");
    history.back();
    return;
  }

  const avaliacao = await resposta.json();

  Object.keys(avaliacao).forEach(campo => {
    const elemento = document.getElementById(campo);
    if (elemento) {
      elemento.value = avaliacao[campo] || "";
    }
  });

  const titulo = document.getElementById("tituloPagina");
  if (titulo) {
    titulo.textContent = "Editar Avaliação Física";
  }
}