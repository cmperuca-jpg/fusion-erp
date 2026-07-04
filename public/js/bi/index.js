const API_BI = "/api/bi/executivo";

let graficos = {};

async function carregarDashboard() {
  const inicio = valor("filtroInicio");
  const fim = valor("filtroFim");

  const params = new URLSearchParams();

  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);

  const resposta = await fetch(`${API_BI}?${params.toString()}`);
  const dados = await resposta.json();

  preencherKPIs(dados.kpis);
  renderizarGraficos(dados.graficos);
  renderizarAlertas(dados.alertas);
  renderizarAtividades(dados.ultimasAtividades);
}

function preencherKPIs(kpis) {
  document.getElementById("kpiAlunosAtivos").textContent = kpis.alunosAtivos;
  document.getElementById("kpiMatriculasAtivas").textContent = kpis.matriculasAtivas;
  document.getElementById("kpiPresentesHoje").textContent = kpis.presentesHoje;
  document.getElementById("kpiReceitaRecebida").textContent = moeda(kpis.receitaRecebida);

  document.getElementById("kpiReceitaPrevista").textContent = moeda(kpis.receitaPrevista);
  document.getElementById("kpiDespesasPrevistas").textContent = moeda(kpis.despesasPrevistas);
  document.getElementById("kpiInadimplencia").textContent = moeda(kpis.inadimplencia);
  document.getElementById("kpiSaldoPrevisto").textContent = moeda(kpis.saldoPrevisto);
}

function renderizarGraficos(graficosDados) {
  criarGraficoLinha("graficoReceita", "Receita", graficosDados.receitaPorMes);
  criarGraficoLinha("graficoPresencas", "Presenças", graficosDados.presencasPorMes);
  criarGraficoPizza("graficoPlanos", graficosDados.alunosPorPlano);
  criarGraficoPizza("graficoModalidades", graficosDados.turmasPorModalidade);
  criarGraficoLinha("graficoMatriculas", "Matrículas", graficosDados.matriculasPorMes);
  criarGraficoLinha("graficoAvaliacoes", "Avaliações", graficosDados.avaliacoesPorMes);
}

function criarGraficoLinha(id, label, dados) {
  destruirGrafico(id);

  const canvas = document.getElementById(id);

  graficos[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map(item => item.mes),
      datasets: [
        {
          label,
          data: dados.map(item => item.valor)
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function criarGraficoPizza(id, dados) {
  destruirGrafico(id);

  const canvas = document.getElementById(id);

  graficos[id] = new Chart(canvas, {
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

function renderizarAlertas(alertas) {
  const div = document.getElementById("listaAlertas");
  div.innerHTML = "";

  if (!alertas || alertas.length === 0) {
    div.innerHTML = "<p>Nenhum alerta gerencial no momento.</p>";
    return;
  }

  alertas.forEach(alerta => {
    div.innerHTML += `
      <p>
        <strong>${alerta.nivel.toUpperCase()}</strong>
        - ${alerta.mensagem}
      </p>
    `;
  });
}

function renderizarAtividades(atividades) {
  const div = document.getElementById("listaAtividades");
  div.innerHTML = "";

  if (!atividades || atividades.length === 0) {
    div.innerHTML = "<p>Nenhuma atividade recente.</p>";
    return;
  }

  atividades.forEach(item => {
    div.innerHTML += `
      <p>
        <strong>${item.tipo}</strong>
        - ${item.descricao}
      </p>
    `;
  });
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

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

window.carregarDashboard = carregarDashboard;
window.limparFiltros = limparFiltros;

carregarDashboard();
