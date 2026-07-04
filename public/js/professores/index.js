const API_PROFESSORES = "/api/professores";
const tabela = document.getElementById("tabelaProfessores");

let professoresOriginal = [];

async function carregarProfessores() {
  const resposta = await fetch(API_PROFESSORES);
  professoresOriginal = await resposta.json();

  renderizarProfessores(professoresOriginal);
}

function renderizarProfessores(professores) {
  tabela.innerHTML = "";

  if (professores.length === 0) {
    tabela.innerHTML = `<tr><td colspan="7">Nenhum professor encontrado.</td></tr>`;
    return;
  }

  professores.forEach(professor => {
    tabela.innerHTML += `
      <tr>
        <td>${professor.nome || ""}</td>
        <td>${professor.cpf || ""}</td>
        <td>${professor.telefone || ""}</td>
        <td>${professor.especialidade || ""}</td>
        <td>${professor.cidade || ""}</td>
        <td>${professor.status || ""}</td>
        <td>
          <a href="/pages/professores/cadastro.html?id=${professor.id}">
            <button>Editar</button>
          </a>

          <a href="/pages/professores/ficha.html?id=${professor.id}">
            <button>Ficha</button>
          </a>

          <button onclick="excluirProfessor('${professor.id}')">Excluir</button>
        </td>
      </tr>
    `;
  });
}

function aplicarFiltros() {
  const nome = valor("filtroNome").toLowerCase();
  const cpf = valor("filtroCpf").replace(/\D/g, "");
  const telefone = valor("filtroTelefone").replace(/\D/g, "");
  const especialidade = valor("filtroEspecialidade").toLowerCase();
  const cidade = valor("filtroCidade").toLowerCase();
  const status = valor("filtroStatus");

  const filtrados = professoresOriginal.filter(professor => {
    return (
      (!nome || (professor.nome || "").toLowerCase().includes(nome)) &&
      (!cpf || (professor.cpf || "").replace(/\D/g, "").includes(cpf)) &&
      (!telefone || (professor.telefone || "").replace(/\D/g, "").includes(telefone)) &&
      (!especialidade || (professor.especialidade || "").toLowerCase().includes(especialidade)) &&
      (!cidade || (professor.cidade || "").toLowerCase().includes(cidade)) &&
      (!status || professor.status === status)
    );
  });

  renderizarProfessores(filtrados);
}

function limparFiltros() {
  document.getElementById("filtroNome").value = "";
  document.getElementById("filtroCpf").value = "";
  document.getElementById("filtroTelefone").value = "";
  document.getElementById("filtroEspecialidade").value = "";
  document.getElementById("filtroCidade").value = "";
  document.getElementById("filtroStatus").value = "";

  renderizarProfessores(professoresOriginal);
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

async function excluirProfessor(id) {
  mostrarModal(
    "Excluir professor",
    "Deseja realmente excluir este professor?",
    async () => {
      const resposta = await fetch(`${API_PROFESSORES}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir professor.");
        return;
      }

      mostrarAviso("Sucesso", "Professor excluído com sucesso.");
      carregarProfessores();
    }
  );
}

window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.excluirProfessor = excluirProfessor;

carregarProfessores();
