const API = "/api/exercicios";
const tabela = document.getElementById("tabelaExercicios");
const form = document.getElementById("formExercicio");

let exerciciosOriginal = [];

const campoImagem = document.getElementById("imagem");
const imagemPreview = document.getElementById("imagemPreview");
const imagemTexto = document.getElementById("imagemTexto");
const imagemBase64 = document.getElementById("imagem_base64");

campoImagem.addEventListener("change", () => {
  const arquivo = campoImagem.files[0];

  if (!arquivo) return;

  const leitor = new FileReader();

  leitor.onload = () => {
    imagemBase64.value = leitor.result;
    imagemPreview.src = leitor.result;
    imagemPreview.style.display = "block";
    imagemTexto.style.display = "none";
  };

  leitor.readAsDataURL(arquivo);
});

async function carregarExercicios() {
  const resposta = await fetch(API);
  exerciciosOriginal = await resposta.json();

  renderizarExercicios(exerciciosOriginal);
}

function renderizarExercicios(exercicios) {
  tabela.innerHTML = "";

  exercicios.forEach(exercicio => {
    tabela.innerHTML += `
      <tr>
        <td>${exercicio.nome || ""}</td>
        <td>${exercicio.grupo_muscular || ""}</td>
        <td>${exercicio.equipamento || ""}</td>
        <td>${exercicio.dificuldade || ""}</td>
        <td>${exercicio.tipo || ""}</td>
        <td>${exercicio.status || ""}</td>
        <td>
  <button onclick="editarExercicio('${exercicio.id}')">Editar</button>

  <button onclick="window.location='/pages/exercicios/ficha.html?id=${exercicio.id}'">
    Ficha
  </button>

  <button onclick="excluirExercicio('${exercicio.id}')">Excluir</button>
</td>
      </tr>
    `;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const exercicio = {
    nome: valor("nome"),
    grupo_muscular: valor("grupo_muscular"),
    equipamento: valor("equipamento"),
    dificuldade: valor("dificuldade"),
    tipo: valor("tipo"),
    descricao: valor("descricao"),
    execucao: valor("execucao"),
    musculos_envolvidos: valor("musculos_envolvidos"),
    video_url: valor("video_url"),
    imagem_base64: valor("imagem_base64"),
    status: valor("status")
  };

  const id = valor("exercicioId");
  const url = id ? `${API}/${id}` : API;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exercicio)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar exercício.");
    return;
  }

  mostrarAviso("Sucesso", "Exercício salvo com sucesso.");
  limparFormulario();
  carregarExercicios();
});

function editarExercicio(id) {
  const exercicio = exerciciosOriginal.find(item => item.id === id);

  if (!exercicio) return;

  document.getElementById("exercicioId").value = exercicio.id || "";
  document.getElementById("nome").value = exercicio.nome || "";
  document.getElementById("grupo_muscular").value = exercicio.grupo_muscular || "";
  document.getElementById("equipamento").value = exercicio.equipamento || "";
  document.getElementById("dificuldade").value = exercicio.dificuldade || "";
  document.getElementById("tipo").value = exercicio.tipo || "";
  document.getElementById("descricao").value = exercicio.descricao || "";
  document.getElementById("execucao").value = exercicio.execucao || "";
  document.getElementById("musculos_envolvidos").value = exercicio.musculos_envolvidos || "";
  document.getElementById("video_url").value = exercicio.video_url || "";
  document.getElementById("status").value = exercicio.status || "ativo";
  document.getElementById("imagem_base64").value = exercicio.imagem_base64 || "";

  if (exercicio.imagem_base64) {
    imagemPreview.src = exercicio.imagem_base64;
    imagemPreview.style.display = "block";
    imagemTexto.style.display = "none";
  } else {
    imagemPreview.src = "";
    imagemPreview.style.display = "none";
    imagemTexto.style.display = "block";
  }

  document.getElementById("tituloFormulario").textContent = "Editar Exercício";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirExercicio(id) {
  mostrarModal(
    "Excluir exercício",
    "Deseja realmente excluir este exercício?",
    async () => {
      const resposta = await fetch(`${API}/${id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) {
        mostrarAviso("Erro", "Erro ao excluir exercício.");
        return;
      }

      mostrarAviso("Sucesso", "Exercício excluído com sucesso.");
      carregarExercicios();
    }
  );
}

function aplicarFiltros() {
  const nome = valor("filtroNome").toLowerCase();
  const grupo = valor("filtroGrupo");
  const dificuldade = valor("filtroDificuldade");

  const filtrados = exerciciosOriginal.filter(exercicio => {
    return (
      (!nome || (exercicio.nome || "").toLowerCase().includes(nome)) &&
      (!grupo || exercicio.grupo_muscular === grupo) &&
      (!dificuldade || exercicio.dificuldade === dificuldade)
    );
  });

  renderizarExercicios(filtrados);
}

function limparFiltros() {
  document.getElementById("filtroNome").value = "";
  document.getElementById("filtroGrupo").value = "";
  document.getElementById("filtroDificuldade").value = "";

  renderizarExercicios(exerciciosOriginal);
}

function limparFormulario() {
  form.reset();

  document.getElementById("exercicioId").value = "";
  document.getElementById("imagem_base64").value = "";
  document.getElementById("tituloFormulario").textContent = "Novo Exercício";

  imagemPreview.src = "";
  imagemPreview.style.display = "none";
  imagemTexto.style.display = "block";
}

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

window.editarExercicio = editarExercicio;
window.excluirExercicio = excluirExercicio;
window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.limparFormulario = limparFormulario;

carregarExercicios();