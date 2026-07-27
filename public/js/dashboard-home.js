let graficoPlanos = null;
let graficoStatus = null;

function fetchDashboard(url, opcoes = {}) {
  if (window.FusionAuth?.fetchAuth) return window.FusionAuth.fetchAuth(url, opcoes);
  return fetch(url, opcoes);
}

async function buscarJSON(url) {
  const resposta = await fetchDashboard(url);
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(json.erro || json.mensagem || `Erro ao consultar ${url}`);
  return json;
}

function comoLista(retorno, chave) {
  if (Array.isArray(retorno)) return retorno;
  if (retorno && Array.isArray(retorno[chave])) return retorno[chave];
  if (retorno && Array.isArray(retorno.dados)) return retorno.dados;
  return [];
}

async function carregarDashboard() {
  try {
    const [bi, alunosRaw, avaliacoesRaw] = await Promise.all([
      buscarJSON("/api/bi/executivo"),
      buscarJSON("/api/alunos"),
      buscarJSON("/api/avaliacoes")
    ]);

    const alunos = comoLista(alunosRaw, "alunos");
    const avaliacoes = comoLista(avaliacoesRaw, "avaliacoes");

    carregarCards(bi, avaliacoes);
    carregarGraficos(bi);
    carregarAniversariantes(alunos);
    carregarUltimasAvaliacoes(avaliacoes, alunos);
  } catch (erro) {
    console.error("Falha ao carregar Dashboard:", erro);
    const mensagem = document.getElementById("dashboardErro");
    if (mensagem) mensagem.textContent = erro.message || "Não foi possível carregar os indicadores.";
  }
}

function definirTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor;
}

function carregarCards(bi = {}, avaliacoes = []) {
  const kpis = bi.kpis || {};
  const totalAlunos = Number(kpis.totalAlunos || 0);
  const alunosAtivos = Number(kpis.alunosAtivos || 0);
  const alunosInativos = Math.max(0, totalAlunos - alunosAtivos);

  // Os indicadores acadêmicos vêm do mesmo serviço usado pelo BI.
  definirTexto("totalAtivos", alunosAtivos);
  definirTexto("totalInativos", alunosInativos);
  definirTexto("totalAlunos", totalAlunos);
  definirTexto("totalAvaliacoes", avaliacoes.length);

  // Compatibilidade com a página nova do Dashboard, caso estes IDs existam.
  definirTexto("kpiAlunos", alunosAtivos);
  definirTexto("kpiMatriculasAtivas", Number(kpis.matriculasAtivas || 0));
  definirTexto("kpiPresentesHoje", Number(kpis.presentesHoje || 0));
}

function carregarGraficos(bi = {}) {
  const graficos = bi.graficos || {};
  carregarGraficoPlanos(graficos.alunosPorPlano || []);
  carregarGraficoStatus(graficos.alunosPorStatus || [], bi.kpis || {});
}

function carregarGraficoPlanos(itens = []) {
  const canvas = document.getElementById("graficoPlanos");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = itens.map(item => item.nome || "Sem plano");
  const dados = itens.map(item => Number(item.valor || 0));

  if (graficoPlanos) graficoPlanos.destroy();

  graficoPlanos = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{ label: "Alunos por plano", data: dados }]
    }
  });
}

function carregarGraficoStatus(itens = [], kpis = {}) {
  const canvas = document.getElementById("graficoStatus");
  if (!canvas || typeof Chart === "undefined") return;

  // Para não voltar a contar status no navegador, Ativos usa o KPI do BI.
  // Os demais cadastros são apresentados como Inativos/sem matrícula ativa.
  const ativos = Number(kpis.alunosAtivos || 0);
  const total = Number(kpis.totalAlunos || 0);
  const inativos = Math.max(0, total - ativos);

  if (graficoStatus) graficoStatus.destroy();

  graficoStatus = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Ativos", "Inativos"],
      datasets: [{ label: "Status dos alunos", data: [ativos, inativos] }]
    },
    options: {
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function carregarAniversariantes(alunos = []) {
  const div = document.getElementById("aniversariantesMes");
  if (!div) return;

  const mesAtual = new Date().getMonth() + 1;
  const aniversariantes = alunos.filter(aluno => {
    const data = aluno.data_nascimento || aluno.dataNascimento || aluno.nascimento || "";
    if (!data) return false;
    const partes = String(data).slice(0, 10).split("-");
    return Number(partes[1]) === mesAtual;
  });

  if (!aniversariantes.length) {
    div.innerHTML = "<p>Nenhum aniversariante neste mês.</p>";
    return;
  }

  div.innerHTML = aniversariantes.map(aluno => {
    const data = aluno.data_nascimento || aluno.dataNascimento || aluno.nascimento || "";
    return `<p>🎂 <strong>${escaparHtml(aluno.nome || "Aluno")}</strong> - ${formatarData(data)}</p>`;
  }).join("");
}

function carregarUltimasAvaliacoes(avaliacoes = [], alunos = []) {
  const div = document.getElementById("ultimasAvaliacoes");
  if (!div) return;

  if (!avaliacoes.length) {
    div.innerHTML = "<p>Nenhuma avaliação cadastrada.</p>";
    return;
  }

  div.innerHTML = [...avaliacoes]
    .sort((a, b) => new Date(b.data || b.criadoEm || 0) - new Date(a.data || a.criadoEm || 0))
    .slice(0, 5)
    .map(avaliacao => {
      const id = avaliacao.aluno_id || avaliacao.alunoId;
      const aluno = alunos.find(item => String(item.id) === String(id));
      return `<p>📊 <strong>${escaparHtml(aluno?.nome || avaliacao.alunoNome || "Aluno")}</strong> - ${formatarData(avaliacao.data || avaliacao.criadoEm)} - Peso: ${escaparHtml(avaliacao.peso || "-")} kg - IMC: ${escaparHtml(avaliacao.imc || "-")}</p>`;
    })
    .join("");
}

function formatarData(data) {
  const iso = String(data || "").slice(0, 10);
  const partes = iso.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "-";
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

carregarDashboard();
