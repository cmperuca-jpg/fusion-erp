const API_AGENDA = "/api/agenda";
const API_ALUNOS = "/api/alunos";
const API_PROFESSORES = "/api/professores";

let agendaOriginal = [];
let alunos = [];
let professores = [];

async function carregarTudo() {
  const [agendaRes, alunosRes, professoresRes] = await Promise.all([
    fetch(API_AGENDA),
    fetch(API_ALUNOS),
    fetch(API_PROFESSORES)
  ]);

  agendaOriginal = await agendaRes.json();
  alunos = await alunosRes.json();
  professores = await professoresRes.json();

  renderizarAgenda(agendaOriginal);
}

function renderizarAgenda(lista) {
  const tabela = document.getElementById("tabelaAgenda");
  tabela.innerHTML = "";

  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="8">Nenhum agendamento encontrado.</td></tr>`;
    return;
  }

  lista
    .sort((a, b) => `${a.data} ${a.hora_inicio}`.localeCompare(`${b.data} ${b.hora_inicio}`))
    .forEach(item => {
      const aluno = alunos.find(a => a.id === item.aluno_id);
      const professor = professores.find(p => p.id === item.professor_id);

      tabela.innerHTML += `
        <tr>
          <td>${formatarData(item.data)}</td>
          <td>${item.hora_inicio || "-"} ${item.hora_fim ? "às " + item.hora_fim : ""}</td>
          <td>${item.titulo || ""}</td>
          <td>${item.tipo || ""}</td>
          <td>${aluno ? aluno.nome : "-"}</td>
          <td>${professor ? professor.nome : "-"}</td>
          <td>${item.status || ""}</td>
          <td>
            <a href="/pages/agenda/cadastro.html?id=${item.id}">
              <button>Editar</button>
            </a>

            <a href="/pages/agenda/ficha.html?id=${item.id}">
              <button>Ficha</button>
            </a>

            <button onclick="excluirAgendamento('${item.id}')">Excluir</button>
          </td>
        </tr>
      `;
    });
}

function aplicarFiltros() {
  const data = valor("filtroData");
  const tipo = valor("filtroTipo");
  const status = valor("filtroStatus");

  const filtrados = agendaOriginal.filter(item => {
    return (
      (!data || item.data === data) &&
      (!tipo || item.tipo === tipo) &&
      (!status || item.status === status)
    );
  });

  renderizarAgenda(filtrados);
}

function limparFiltros() {
  document.getElementById("filtroData").value = "";
  document.getElementById("filtroTipo").value = "";
  document.getElementById("filtroStatus").value = "";

  renderizarAgenda(agendaOriginal);
}

function excluirAgendamento(id) {
  mostrarModal(
    "Excluir agendamento",
    "Deseja realmente excluir este agendamento?",
    async () => {
      const resposta = await fetch(`${API_AGENDA}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir agendamento.");
        return;
      }

      mostrarAviso("Sucesso", "Agendamento excluído com sucesso.");
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
window.excluirAgendamento = excluirAgendamento;

carregarTudo();
