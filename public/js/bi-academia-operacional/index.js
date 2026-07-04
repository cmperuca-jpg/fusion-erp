const API_BI_OPERACIONAL = "/api/bi/academia-operacional";

let graficos = {};
let dadosAtuais = null;

async function carregarDashboard() {
  const inicio = valor("filtroInicio");
  const fim = valor("filtroFim");

  const params = new URLSearchParams();

  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);

  const resposta = await fetch(`${API_BI_OPERACIONAL}?${params.toString()}`);
  dadosAtuais = await resposta.json();

  preencherKPIs(dadosAtuais.kpis);
  renderizarGraficos(dadosAtuais.graficos);
  renderizarTabelas(dadosAtuais.tabelas);
}

function preencherKPIs(kpis) {
  document.getElementById("kpiTurmasAtivas").textContent = kpis.turmasAtivas;
  document.getElementById("kpiCapacidadeTotal").textContent = kpis.capacidadeTotal;
  document.getElementById("kpiProfessoresAtivos").textContent = kpis.professoresAtivos;
  document.getElementById("kpiAgendaHoje").textContent = kpis.agendamentosHoje;

  document.getElementById("kpiTotalTurmas").textContent = kpis.totalTurmas;
  document.getElementById("kpiTurmasEncerradas").textContent = kpis.turmasEncerradas;
  document.getElementById("kpiTotalProfessores").textContent = kpis.totalProfessores;
  document.getElementById("kpiAgendaPeriodo").textContent = kpis.agendamentosPeriodo;
}

function renderizarGraficos(graficosDados) {
  criarGraficoPizza("graficoTurmasModalidade", graficosDados.turmasPorModalidade);
  criarGraficoPizza("graficoProfessoresEspecialidade", graficosDados.professoresPorEspecialidade);
  criarGraficoPizza("graficoAgendaTipo", graficosDados.agendaPorTipo);
  criarGraficoBarra("graficoAgendaMes", "Agenda", graficosDados.agendaPorMes, "mes", "valor");
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
  renderizarTabelaSimples("rankingProfessoresTurmas", tabelas.rankingProfessoresTurmas || [], ["professor", "turmas"], ["Professor", "Turmas"]);
  renderizarTabelaSimples("rankingProfessoresAgenda", tabelas.rankingProfessoresAgenda || [], ["professor", "agendamentos"], ["Professor", "Agendamentos"]);
  renderizarTabelaSimples("turmasSemProfessor", tabelas.turmasSemProfessor || [], ["nome", "modalidade", "status"], ["Turma", "Modalidade", "Status"]);
  renderizarTabelaSimples("agendaHoje", tabelas.agendaHoje || [], ["horario", "titulo", "tipo", "aluno", "professor", "status"], ["Horário", "Título", "Tipo", "Aluno", "Professor", "Status"]);
  renderizarTabelaSimples("turmasOcupacao", tabelas.turmasComCapacidade || [], ["nome", "modalidade", "capacidade", "matriculasAtivas", "ocupacao"], ["Turma", "Modalidade", "Capacidade", "Matrículas", "Ocupação %"]);
}

function renderizarTabelaSimples(id, lista, chaves, titulos) {
  const div = document.getElementById(id);

  if (lista.length === 0) {
    div.innerHTML = "<p>Nenhum dado encontrado.</p>";
    return;
  }

  div.innerHTML = `
    <table>
      <thead>
        <tr>
          ${titulos.map(titulo => `<th>${titulo}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${lista.map(item => `
          <tr>
            ${chaves.map(chave => `<td>${item[chave] ?? "-"}</td>`).join("")}
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
  linhas.push(["Professores por turmas"]);
  linhas.push(["Professor", "Turmas"]);

  (dadosAtuais.tabelas.rankingProfessoresTurmas || []).forEach(item => {
    linhas.push([item.professor, item.turmas]);
  });

  linhas.push([]);
  linhas.push(["Agenda de hoje"]);
  linhas.push(["Horario", "Titulo", "Tipo", "Aluno", "Professor", "Status"]);

  (dadosAtuais.tabelas.agendaHoje || []).forEach(item => {
    linhas.push([item.horario, item.titulo, item.tipo, item.aluno, item.professor, item.status]);
  });

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "bi-academia-operacional.csv";
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
