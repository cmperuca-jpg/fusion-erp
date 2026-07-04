let graficoPlanos = null;
let graficoStatus = null;

async function carregarDashboard() {
  const alunos = await buscarJSON("/api/alunos");
  const avaliacoes = await buscarJSON("/api/avaliacoes");

  carregarCards(alunos, avaliacoes);
  carregarGraficos(alunos);
  carregarAniversariantes(alunos);
  carregarUltimasAvaliacoes(avaliacoes, alunos);
}

async function buscarJSON(url) {
  const resposta = await fetch(url);
  return await resposta.json();
}

function carregarCards(alunos, avaliacoes) {
  const ativos = alunos.filter(a => a.status === "ativo").length;
  const inativos = alunos.filter(a => a.status === "inativo").length;

  document.getElementById("totalAtivos").textContent = ativos;
  document.getElementById("totalInativos").textContent = inativos;
  document.getElementById("totalAlunos").textContent = alunos.length;
  document.getElementById("totalAvaliacoes").textContent = avaliacoes.length;
}

function carregarGraficos(alunos) {
  carregarGraficoPlanos(alunos);
  carregarGraficoStatus(alunos);
}

function carregarGraficoPlanos(alunos) {
  const planos = {};

  alunos.forEach(aluno => {
    const plano = aluno.plano || "Sem plano";
    planos[plano] = (planos[plano] || 0) + 1;
  });

  const labels = Object.keys(planos);
  const dados = Object.values(planos);

  const canvas = document.getElementById("graficoPlanos");

  if (graficoPlanos) {
    graficoPlanos.destroy();
  }

  graficoPlanos = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Alunos por plano",
          data: dados
        }
      ]
    }
  });
}

function carregarGraficoStatus(alunos) {
  const ativos = alunos.filter(a => a.status === "ativo").length;
  const inativos = alunos.filter(a => a.status === "inativo").length;

  const canvas = document.getElementById("graficoStatus");

  if (graficoStatus) {
    graficoStatus.destroy();
  }

  graficoStatus = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Ativos", "Inativos"],
      datasets: [
        {
          label: "Status dos alunos",
          data: [ativos, inativos]
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

function carregarAniversariantes(alunos) {
  const div = document.getElementById("aniversariantesMes");
  const mesAtual = new Date().getMonth() + 1;

  const aniversariantes = alunos.filter(aluno => {
    if (!aluno.data_nascimento) return false;

    const partes = aluno.data_nascimento.split("-");
    const mesNascimento = Number(partes[1]);

    return mesNascimento === mesAtual;
  });

  if (aniversariantes.length === 0) {
    div.innerHTML = "<p>Nenhum aniversariante neste mês.</p>";
    return;
  }

  div.innerHTML = "";

  aniversariantes.forEach(aluno => {
    div.innerHTML += `
      <p>
        🎂 <strong>${aluno.nome}</strong>
        - ${formatarData(aluno.data_nascimento)}
      </p>
    `;
  });
}

function carregarUltimasAvaliacoes(avaliacoes, alunos) {
  const div = document.getElementById("ultimasAvaliacoes");

  if (avaliacoes.length === 0) {
    div.innerHTML = "<p>Nenhuma avaliação cadastrada.</p>";
    return;
  }

  div.innerHTML = "";

  avaliacoes
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 5)
    .forEach(avaliacao => {
      const aluno = alunos.find(a => a.id === avaliacao.aluno_id);

      div.innerHTML += `
        <p>
          📊 <strong>${aluno ? aluno.nome : "Aluno"}</strong>
          - ${formatarData(avaliacao.data)}
          - Peso: ${avaliacao.peso || "-"} kg
          - IMC: ${avaliacao.imc || "-"}
        </p>
      `;
    });
}

function formatarData(data) {
  if (!data) return "-";

  const partes = data.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

carregarDashboard();