const API_BI_ACADEMIA = "/api/bi/academia";

let graficos = {};
let dadosAtuais = null;

async function carregarDashboard() {
  const inicio = valor("filtroInicio");
  const fim = valor("filtroFim");

  const params = new URLSearchParams();

  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);

  const resposta = await fetch(`${API_BI_ACADEMIA}?${params.toString()}`);
  dadosAtuais = await resposta.json();

  preencherKPIs(dadosAtuais.kpis);
  renderizarGraficos(dadosAtuais.graficos);
  renderizarTabelas(dadosAtuais.tabelas);
}

function preencherKPIs(kpis) {
  document.getElementById("kpiAlunosAtivos").textContent = kpis.alunosAtivos;
  document.getElementById("kpiAlunosNovos").textContent = kpis.alunosNovosPeriodo;
  document.getElementById("kpiMatriculasAtivas").textContent = kpis.matriculasAtivas;
  document.getElementById("kpiPresencasPeriodo").textContent = kpis.presencasPeriodo;

  document.getElementById("kpiPresencasHoje").textContent = kpis.presencasHoje;
  document.getElementById("kpiCheckinsAbertos").textContent = kpis.checkinsAbertos;
  document.getElementById("kpiMatriculasTrancadas").textContent = kpis.matriculasTrancadas;
  document.getElementById("kpiMatriculasCanceladas").textContent = kpis.matriculasCanceladas;
}

function renderizarGraficos(graficosDados) {
  criarGraficoBarra("graficoPresencas", "Presenças", graficosDados.presencasPorMes, "mes", "valor");
  criarGraficoBarra("graficoMatriculas", "Matrículas", graficosDados.matriculasPorMes, "mes", "valor");
  criarGraficoPizza("graficoPlanos", graficosDados.alunosPorPlano);
  criarGraficoBarra("graficoCidades", "Alunos", graficosDados.alunosPorCidade, "nome", "valor");
}

function criarGraficoBarra(id, label, dados, labelKey, valueKey) {
  destruirGrafico(id);

  graficos[id] = new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels: dados.map(item => item[labelKey]),
      datasets: [
        {
          label,
          data: dados.map(item => item[valueKey])
        }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function criarGraficoPizza(id, dados) {
  destruirGrafico(id);

  graficos[id] = new Chart(document.getElementById(id), {
    type: "pie",
    data: {
      labels: dados.map(item => item.nome),
      datasets: [
        {
          data: dados.map(item => item.valor)
        }
      ]
    }
  });
}

function destruirGrafico(id) {
  if (graficos[id]) {
    graficos[id].destroy();
    delete graficos[id];
  }
}

function renderizarTabelas(tabelas) {
  renderizarRankingAlunos(tabelas.rankingAlunosFrequencia || []);
  renderizarRankingTurmas(tabelas.rankingTurmasFrequencia || []);
  renderizarAlunosSemPresenca(tabelas.alunosSemPresenca || []);
}

function renderizarRankingAlunos(lista) {
  const div = document.getElementById("rankingAlunos");

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhuma frequência registrada.</p>";
    return;
  }

  div.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Presenças</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(item => `
          <tr>
            <td>${item.aluno}</td>
            <td>${item.presencas}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderizarRankingTurmas(lista) {
  const div = document.getElementById("rankingTurmas");

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhuma frequência registrada.</p>";
    return;
  }

  div.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Turma</th>
          <th>Presenças</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(item => `
          <tr>
            <td>${item.turma}</td>
            <td>${item.presencas}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderizarAlunosSemPresenca(lista) {
  const div = document.getElementById("alunosSemPresenca");

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhum aluno ativo sem presença registrada.</p>";
    return;
  }

  div.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Telefone</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(item => `
          <tr>
            <td>${item.nome}</td>
            <td>${item.telefone}</td>
            <td>${item.status}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function exportarCSV() {
  if (!dadosAtuais) return;

  const linhas = [];

  linhas.push(["Indicador", "Valor"]);
  Object.entries(dadosAtuais.kpis).forEach(([chave, valor]) => {
    linhas.push([chave, valor]);
  });

  linhas.push([]);
  linhas.push(["Ranking alunos frequência"]);
  linhas.push(["Aluno", "Presenças"]);

  (dadosAtuais.tabelas.rankingAlunosFrequencia || []).forEach(item => {
    linhas.push([item.aluno, item.presencas]);
  });

  linhas.push([]);
  linhas.push(["Ranking turmas frequência"]);
  linhas.push(["Turma", "Presenças"]);

  (dadosAtuais.tabelas.rankingTurmasFrequencia || []).forEach(item => {
    linhas.push([item.turma, item.presencas]);
  });

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "bi-academia-parte1.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function limparFiltros() {
  document.getElementById("filtroInicio").value = "";
  document.getElementById("filtroFim").value = "";
  carregarDashboard();
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

window.carregarDashboard = carregarDashboard;
window.limparFiltros = limparFiltros;
window.exportarCSV = exportarCSV;

carregarDashboard();
