if (typeof carregarLayout === "function") carregarLayout("Turmas");

const API_URL = "/api/turmas";

const elementos = {
  tabela: document.getElementById("tabelaTurmas"),
  campoBusca: document.getElementById("campoBusca"),
  filtroStatus: document.getElementById("filtroStatus"),
  modal: document.getElementById("modalTurma"),
  form: document.getElementById("formTurma"),
  modalTitulo: document.getElementById("modalTitulo"),
  btnNovaTurma: document.getElementById("btnNovaTurma"),
  btnFecharModal: document.getElementById("btnFecharModal"),
  btnCancelar: document.getElementById("btnCancelar"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiAtivas: document.getElementById("kpiAtivas"),
  kpiInativas: document.getElementById("kpiInativas"),
  kpiVagas: document.getElementById("kpiVagas")
};

const campos = [
  "turmaId",
  "nome",
  "modalidade",
  "professor",
  "sala",
  "diasSemana",
  "horario",
  "capacidade",
  "alunosMatriculados",
  "status",
  "observacoes"
];

function valorCampo(id) {
  return document.getElementById(id).value;
}

function definirCampo(id, valor) {
  document.getElementById(id).value = valor ?? "";
}

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opcoes
  });

  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok || json.ok === false || json.sucesso === false) {
    throw new Error(json.mensagem || json.erro || "Erro ao processar solicitação.");
  }

  if (Array.isArray(json)) return json;
  return json.dados ?? json.turmas ?? json.turma ?? json.data ?? json;
}

function abrirModal(turma = null) {
  elementos.form.reset();
  elementos.modalTitulo.textContent = turma ? "Editar Turma" : "Nova Turma";

  definirCampo("turmaId", turma?.id || "");
  definirCampo("nome", turma?.nome || "");
  definirCampo("modalidade", turma?.modalidade || "");
  definirCampo("professor", turma?.professor || "");
  definirCampo("sala", turma?.sala || "");
  definirCampo("diasSemana", turma?.diasSemana || "");
  definirCampo("horario", turma?.horario || "");
  definirCampo("capacidade", turma?.capacidade || "");
  definirCampo("alunosMatriculados", turma?.alunosMatriculados || 0);
  definirCampo("status", turma?.status || "Ativa");
  definirCampo("observacoes", turma?.observacoes || "");

  elementos.modal.classList.add("aberto");
}

function fecharModal() {
  elementos.modal.classList.remove("aberto");
}

function dadosDoFormulario() {
  return {
    nome: valorCampo("nome"),
    modalidade: valorCampo("modalidade"),
    professor: valorCampo("professor"),
    sala: valorCampo("sala"),
    diasSemana: valorCampo("diasSemana"),
    horario: valorCampo("horario"),
    capacidade: Number(valorCampo("capacidade")),
    alunosMatriculados: Number(valorCampo("alunosMatriculados")),
    status: valorCampo("status"),
    observacoes: valorCampo("observacoes")
  };
}

async function carregarResumo() {
  const resumo = await requisicao(`${API_URL}/resumo`);
  elementos.kpiTotal.textContent = resumo.total;
  elementos.kpiAtivas.textContent = resumo.ativas;
  elementos.kpiInativas.textContent = resumo.inativas;
  elementos.kpiVagas.textContent = resumo.vagas;
}

function renderizarTurmas(turmas) {
  if (!turmas.length) {
    elementos.tabela.innerHTML = `
      <tr>
        <td colspan="8">Nenhuma turma encontrada.</td>
      </tr>
    `;
    return;
  }

  elementos.tabela.innerHTML = turmas.map((turma) => {
    const vagas = Number(turma.capacidade || 0) - Number(turma.alunosMatriculados || 0);
    const classeStatus = turma.status === "Ativa" ? "ativa" : "inativa";

    return `
      <tr>
        <td><strong>${turma.nome}</strong><br><small>${turma.sala || "Sem local"}</small></td>
        <td>${turma.modalidade}</td>
        <td>${turma.professor}</td>
        <td>${turma.diasSemana}</td>
        <td>${turma.horario}</td>
        <td>${Math.max(vagas, 0)} / ${turma.capacidade}</td>
        <td><span class="badge ${classeStatus}">${turma.status}</span></td>
        <td>
          <div class="acoes">
            <button class="btn-secondary" onclick="editarTurma(${turma.id})">Editar</button>
            <button class="btn-danger" onclick="excluirTurma(${turma.id})">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function carregarTurmas() {
  const params = new URLSearchParams({
    busca: elementos.campoBusca.value,
    status: elementos.filtroStatus.value
  });

  const turmas = await requisicao(`${API_URL}?${params.toString()}`);
  renderizarTurmas(turmas);
  await carregarResumo();
}

async function editarTurma(id) {
  const turma = await requisicao(`${API_URL}/${id}`);
  abrirModal(turma);
}

async function excluirTurma(id) {
  const confirmar = confirm("Deseja excluir esta turma?");
  if (!confirmar) return;

  await requisicao(`${API_URL}/${id}`, { method: "DELETE" });
  await carregarTurmas();
}

window.editarTurma = editarTurma;
window.excluirTurma = excluirTurma;

elementos.btnNovaTurma.addEventListener("click", () => abrirModal());
elementos.btnFecharModal.addEventListener("click", fecharModal);
elementos.btnCancelar.addEventListener("click", fecharModal);
elementos.campoBusca.addEventListener("input", carregarTurmas);
elementos.filtroStatus.addEventListener("change", carregarTurmas);

elementos.form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const id = valorCampo("turmaId");
  const dados = dadosDoFormulario();

  if (id) {
    await requisicao(`${API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados)
    });
  } else {
    await requisicao(API_URL, {
      method: "POST",
      body: JSON.stringify(dados)
    });
  }

  fecharModal();
  await carregarTurmas();
});

carregarTurmas().catch((erro) => {
  elementos.tabela.innerHTML = `
    <tr>
      <td colspan="8">${erro.message}</td>
    </tr>
  `;
});
