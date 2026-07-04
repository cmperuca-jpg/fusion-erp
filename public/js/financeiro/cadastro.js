const API_FINANCEIRO = "/api/financeiro";
const API_ALUNOS = "/api/alunos";
const API_MATRICULAS = "/api/matriculas";

const form = document.getElementById("formFinanceiro");

iniciarAbas();

const params = new URLSearchParams(window.location.search);
const lancamentoId = params.get("id");

carregarSelects().then(() => {
  if (lancamentoId) {
    carregarLancamento(lancamentoId);
  }
});

async function carregarSelects() {
  const [alunosRes, matriculasRes] = await Promise.all([
    fetch(API_ALUNOS),
    fetch(API_MATRICULAS)
  ]);

  const alunos = await alunosRes.json();
  const matriculas = await matriculasRes.json();

  const selectAluno = document.getElementById("aluno_id");
  const selectMatricula = document.getElementById("matricula_id");

  alunos.forEach(aluno => {
    selectAluno.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;
  });

  matriculas.forEach(matricula => {
    const aluno = alunos.find(a => a.id === matricula.aluno_id);
    selectMatricula.innerHTML += `<option value="${matricula.id}">${aluno ? aluno.nome : "Aluno"} - ${matricula.plano || "Matrícula"}</option>`;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const lancamento = {
    tipo: valor("tipo"),
    descricao: valor("descricao"),
    aluno_id: valor("aluno_id"),
    matricula_id: valor("matricula_id"),
    categoria: valor("categoria"),
    competencia: valor("competencia"),
    data_vencimento: valor("data_vencimento"),
    data_pagamento: valor("data_pagamento"),
    valor: valor("valor"),
    valor_pago: valor("valor_pago"),
    forma_pagamento: valor("forma_pagamento"),
    status: valor("status"),
    observacoes: valor("observacoes")
  };

  const id = valor("lancamentoId");
  const url = id ? `${API_FINANCEIRO}/${id}` : API_FINANCEIRO;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lancamento)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar lançamento.");
    return;
  }

  mostrarAviso("Sucesso", "Lançamento salvo com sucesso.");

  setTimeout(() => {
    window.location.href = "/pages/financeiro/";
  }, 600);
});

async function carregarLancamento(id) {
  const resposta = await fetch(`${API_FINANCEIRO}/${id}`);

  if (!resposta.ok) {
    mostrarAviso("Erro", "Lançamento não encontrado.");
    window.location.href = "/pages/financeiro/";
    return;
  }

  const lancamento = await resposta.json();

  document.getElementById("lancamentoId").value = lancamento.id || "";

  Object.keys(lancamento).forEach(campo => {
    const elemento = document.getElementById(campo);

    if (elemento) {
      elemento.value = lancamento[campo] || "";
    }
  });

  const titulo = document.getElementById("tituloCadastro");

  if (titulo) {
    titulo.textContent = "Editar Lançamento";
  }
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}
