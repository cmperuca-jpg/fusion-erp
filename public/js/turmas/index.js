const API_TURMAS = "/api/turmas";
const API_PROFESSORES = "/api/professores";

let turmasOriginal = [];
let professores = [];

async function carregarTudo() {
  const [turmasRes, professoresRes] = await Promise.all([
    fetch(API_TURMAS),
    fetch(API_PROFESSORES)
  ]);

  turmasOriginal = await turmasRes.json();
  professores = await professoresRes.json();

  renderizarTurmas(turmasOriginal);
}

function renderizarTurmas(turmas) {
  const tabela = document.getElementById("tabelaTurmas");
  tabela.innerHTML = "";

  if (turmas.length === 0) {
    tabela.innerHTML = `<tr><td colspan="8">Nenhuma turma encontrada.</td></tr>`;
    return;
  }

  turmas.forEach(turma => {
    const professor = professores.find(p => p.id === turma.professor_id);

    tabela.innerHTML += `
      <tr>
        <td>${turma.nome || ""}</td>
        <td>${turma.modalidade || ""}</td>
        <td>${professor ? professor.nome : "-"}</td>
        <td>${turma.dias_semana || ""}</td>
        <td>${turma.hora_inicio || "-"} ${turma.hora_fim ? "às " + turma.hora_fim : ""}</td>
        <td>${turma.capacidade || ""}</td>
        <td>${turma.status || ""}</td>
        <td>
          <a href="/pages/turmas/cadastro.html?id=${turma.id}">
            <button>Editar</button>
          </a>

          <a href="/pages/turmas/ficha.html?id=${turma.id}">
            <button>Ficha</button>
          </a>

          <button onclick="excluirTurma('${turma.id}')">Excluir</button>
        </td>
      </tr>
    `;
  });
}

function aplicarFiltros() {
  const nome = valor("filtroNome").toLowerCase();
  const modalidade = valor("filtroModalidade");
  const status = valor("filtroStatus");

  const filtradas = turmasOriginal.filter(turma => {
    return (
      (!nome || (turma.nome || "").toLowerCase().includes(nome)) &&
      (!modalidade || turma.modalidade === modalidade) &&
      (!status || turma.status === status)
    );
  });

  renderizarTurmas(filtradas);
}

function limparFiltros() {
  document.getElementById("filtroNome").value = "";
  document.getElementById("filtroModalidade").value = "";
  document.getElementById("filtroStatus").value = "";

  renderizarTurmas(turmasOriginal);
}

function excluirTurma(id) {
  mostrarModal(
    "Excluir turma",
    "Deseja realmente excluir esta turma?",
    async () => {
      const resposta = await fetch(`${API_TURMAS}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir turma.");
        return;
      }

      mostrarAviso("Sucesso", "Turma excluída com sucesso.");
      carregarTudo();
    }
  );
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.excluirTurma = excluirTurma;

carregarTudo();
