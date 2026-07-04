const API_FINANCEIRO = "/api/financeiro";
const API_ALUNOS = "/api/alunos";

const params = new URLSearchParams(window.location.search);
const lancamentoId = params.get("id");

if (!lancamentoId) {
  alert("Lançamento não informado.");
  window.location.href = "/pages/financeiro/";
}

carregarFicha();

async function carregarFicha() {
  const [financeiroRes, alunosRes] = await Promise.all([
    fetch(`${API_FINANCEIRO}/${lancamentoId}`),
    fetch(API_ALUNOS)
  ]);

  if (!financeiroRes.ok) {
    alert("Lançamento não encontrado.");
    window.location.href = "/pages/financeiro/";
    return;
  }

  const lancamento = await financeiroRes.json();
  const alunos = await alunosRes.json();

  const aluno = alunos.find(a => a.id === lancamento.aluno_id);

  document.getElementById("tituloLancamento").textContent = lancamento.descricao || "Lançamento";

  preencher("tipo", lancamento.tipo);
  preencher("descricao", lancamento.descricao);
  preencher("categoria", lancamento.categoria);
  preencher("competencia", lancamento.competencia);
  preencher("aluno", aluno ? aluno.nome : "-");
  preencher("data_vencimento", formatarData(lancamento.data_vencimento));
  preencher("valor", lancamento.valor);
  preencher("data_pagamento", formatarData(lancamento.data_pagamento));
  preencher("valor_pago", lancamento.valor_pago);
  preencher("forma_pagamento", lancamento.forma_pagamento);
  preencher("status", lancamento.status);

  document.getElementById("observacoes").textContent = lancamento.observacoes || "-";

  document.getElementById("btnEditar").onclick = () => {
    window.location.href = `/pages/financeiro/cadastro.html?id=${lancamento.id}`;
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
