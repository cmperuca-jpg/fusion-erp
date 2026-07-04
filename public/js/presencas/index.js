const API_PRESENCAS = "/api/presencas";
const API_ALUNOS = "/api/alunos";
const API_TURMAS = "/api/turmas";

let presencasOriginal = [];
let alunos = [];
let turmas = [];

async function carregarTudo() {
  const [presencasRes, alunosRes, turmasRes] = await Promise.all([
    fetch(API_PRESENCAS),
    fetch(API_ALUNOS),
    fetch(API_TURMAS)
  ]);

  presencasOriginal = await presencasRes.json();
  alunos = await alunosRes.json();
  turmas = await turmasRes.json();

  carregarCards();
  renderizarPresencas(presencasOriginal);
}

function carregarCards() {
  const hoje = new Date().toISOString().slice(0, 10);

  const hojeLista = presencasOriginal.filter(p => p.data === hoje);
  const abertos = hojeLista.filter(p => p.status === "presente" && !p.hora_saida);

  document.getElementById("totalPresentesHoje").textContent = hojeLista.length;
  document.getElementById("totalAbertos").textContent = abertos.length;
  document.getElementById("totalRegistros").textContent = presencasOriginal.length;
}

function renderizarPresencas(presencas) {
  const tabela = document.getElementById("tabelaPresencas");
  tabela.innerHTML = "";

  if (presencas.length === 0) {
    tabela.innerHTML = `<tr><td colspan="7">Nenhuma presença encontrada.</td></tr>`;
    return;
  }

  presencas
    .sort((a, b) => `${b.data} ${b.hora_entrada}`.localeCompare(`${a.data} ${a.hora_entrada}`))
    .forEach(presenca => {
      const aluno = alunos.find(a => a.id === presenca.aluno_id);
      const turma = turmas.find(t => t.id === presenca.turma_id);

      tabela.innerHTML += `
        <tr>
          <td>${formatarData(presenca.data)}</td>
          <td>${aluno ? aluno.nome : "-"}</td>
          <td>${turma ? turma.nome : "-"}</td>
          <td>${presenca.hora_entrada || "-"}</td>
          <td>${presenca.hora_saida || "-"}</td>
          <td>${presenca.status || ""}</td>
          <td>
            <a href="/pages/presencas/cadastro.html?id=${presenca.id}">
              <button>Editar</button>
            </a>

            <a href="/pages/presencas/ficha.html?id=${presenca.id}">
              <button>Ficha</button>
            </a>

            <button onclick="registrarSaida('${presenca.id}')">Saída</button>
            <button onclick="excluirPresenca('${presenca.id}')">Excluir</button>
          </td>
        </tr>
      `;
    });
}

function aplicarFiltros() {
  const data = valor("filtroData");
  const alunoFiltro = valor("filtroAluno").toLowerCase();
  const turmaFiltro = valor("filtroTurma").toLowerCase();
  const status = valor("filtroStatus");

  const filtradas = presencasOriginal.filter(presenca => {
    const aluno = alunos.find(a => a.id === presenca.aluno_id);
    const turma = turmas.find(t => t.id === presenca.turma_id);

    return (
      (!data || presenca.data === data) &&
      (!alunoFiltro || (aluno?.nome || "").toLowerCase().includes(alunoFiltro)) &&
      (!turmaFiltro || (turma?.nome || "").toLowerCase().includes(turmaFiltro)) &&
      (!status || presenca.status === status)
    );
  });

  renderizarPresencas(filtradas);
}

function limparFiltros() {
  document.getElementById("filtroData").value = "";
  document.getElementById("filtroAluno").value = "";
  document.getElementById("filtroTurma").value = "";
  document.getElementById("filtroStatus").value = "";

  renderizarPresencas(presencasOriginal);
}

function registrarSaida(id) {
  const presenca = presencasOriginal.find(p => p.id === id);

  if (!presenca) return;

  const agora = new Date();
  const hora = String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0");

  mostrarModal(
    "Registrar saída",
    "Deseja registrar a saída deste aluno agora?",
    async () => {
      const resposta = await fetch(`${API_PRESENCAS}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hora_saida: hora,
          status: "saida"
        })
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao registrar saída.");
        return;
      }

      mostrarAviso("Sucesso", "Saída registrada com sucesso.");
      carregarTudo();
    }
  );
}

function excluirPresenca(id) {
  mostrarModal(
    "Excluir presença",
    "Deseja realmente excluir este registro?",
    async () => {
      const resposta = await fetch(`${API_PRESENCAS}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir presença.");
        return;
      }

      mostrarAviso("Sucesso", "Registro excluído com sucesso.");
      carregarTudo();
    }
  );
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

function formatarData(data) {
  if (!data) return "-";
  const partes = data.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.registrarSaida = registrarSaida;
window.excluirPresenca = excluirPresenca;

carregarTudo();
