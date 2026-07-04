carregarLayout("Dashboard Executivo");

const dadosDashboard = {
  alunosAtivos: 524,
  receitaMensal: 28450,
  treinosAtivos: 187,
  avaliacoesMes: 43,
  frequenciaAcademia: 78,
  renovacaoPlanos: 64,

  avisos: [
    "12 mensalidades vencem nos próximos 3 dias.",
    "8 alunos estão sem avaliação física recente.",
    "5 fichas de treino vencem esta semana.",
    "Backup do sistema realizado com sucesso."
  ],

  ultimosAlunos: [
    { nome: "Carlos Henrique", status: "Ativo", plano: "Musculação" },
    { nome: "Ana Paula", status: "Ativo", plano: "Natação" },
    { nome: "Marcos Silva", status: "Pendente", plano: "Combo" },
    { nome: "Juliana Rocha", status: "Ativo", plano: "Personal" }
  ],

  vencimentos: [
    { aluno: "Carlos Henrique", data: "05/07/2026", valor: 120 },
    { aluno: "Ana Paula", data: "06/07/2026", valor: 150 },
    { aluno: "Marcos Silva", data: "07/07/2026", valor: 180 },
    { aluno: "Juliana Rocha", data: "08/07/2026", valor: 200 }
  ]
};

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function carregarKPIs() {
  document.getElementById("kpiAlunos").textContent = dadosDashboard.alunosAtivos;
  document.getElementById("kpiReceita").textContent = formatarMoeda(dadosDashboard.receitaMensal);
  document.getElementById("kpiTreinos").textContent = dadosDashboard.treinosAtivos;
  document.getElementById("kpiAvaliacoes").textContent = dadosDashboard.avaliacoesMes;

  document.getElementById("freqAcademia").textContent = `${dadosDashboard.frequenciaAcademia}%`;
  document.getElementById("renovacaoPlanos").textContent = `${dadosDashboard.renovacaoPlanos}%`;

  document.getElementById("barraFrequencia").style.width = `${dadosDashboard.frequenciaAcademia}%`;
  document.getElementById("barraRenovacao").style.width = `${dadosDashboard.renovacaoPlanos}%`;
}

function carregarAvisos() {
  const lista = document.getElementById("listaAvisos");

  lista.innerHTML = dadosDashboard.avisos
    .map((aviso) => `<li>${aviso}</li>`)
    .join("");
}

function carregarAlunos() {
  const tabela = document.getElementById("tabelaAlunos");

  tabela.innerHTML = dadosDashboard.ultimosAlunos
    .map((aluno) => `
      <tr>
        <td>${aluno.nome}</td>
        <td>${aluno.status}</td>
        <td>${aluno.plano}</td>
      </tr>
    `)
    .join("");
}

function carregarVencimentos() {
  const tabela = document.getElementById("tabelaVencimentos");

  tabela.innerHTML = dadosDashboard.vencimentos
    .map((item) => `
      <tr>
        <td>${item.aluno}</td>
        <td>${item.data}</td>
        <td>${formatarMoeda(item.valor)}</td>
      </tr>
    `)
    .join("");
}

carregarKPIs();
carregarAvisos();
carregarAlunos();
carregarVencimentos();