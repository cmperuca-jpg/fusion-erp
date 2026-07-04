const API_PROFESSORES = "/api/professores";

iniciarAbas();

const parametros = new URLSearchParams(window.location.search);
const professorId = parametros.get("id");

if (!professorId) {
  alert("Professor não informado.");
  window.location.href = "/pages/professores/";
}

carregarFicha();

async function carregarFicha() {
  const resposta = await fetch(`${API_PROFESSORES}/${professorId}`);

  if (!resposta.ok) {
    alert("Professor não encontrado.");
    window.location.href = "/pages/professores/";
    return;
  }

  const professor = await resposta.json();

  document.getElementById("nomeProfessor").textContent = professor.nome || "Professor";

  preencher("cpf", professor.cpf);
  preencher("rg", professor.rg);
  preencher("data_nascimento", professor.data_nascimento);
  preencher("sexo", professor.sexo);
  preencher("status", professor.status);

  preencher("telefone", professor.telefone);
  preencher("whatsapp", professor.whatsapp);
  preencher("email", professor.email);

  preencher("cep", professor.cep);
  preencher("endereco", professor.endereco);
  preencher("numero", professor.numero);
  preencher("complemento", professor.complemento);
  preencher("bairro", professor.bairro);
  preencher("cidade", professor.cidade);
  preencher("estado", professor.estado);

  preencher("especialidade", professor.especialidade);
  preencher("cref", professor.cref);
  preencher("modalidade", professor.modalidade);
  preencher("tipo_contrato", professor.tipo_contrato);
  preencher("data_admissao", professor.data_admissao);
  preencher("valor_hora", professor.valor_hora);
  preencher("salario", professor.salario);

  document.getElementById("observacoes").textContent = professor.observacoes || "-";

  if (professor.foto_base64) {
    const fotoPreview = document.getElementById("fotoPreview");
    const fotoTexto = document.getElementById("fotoTexto");

    fotoPreview.src = professor.foto_base64;
    fotoPreview.style.display = "block";
    fotoTexto.style.display = "none";
  }

  document.getElementById("btnEditar").onclick = () => {
    window.location.href = `/pages/professores/cadastro.html?id=${professor.id}`;
  };
}

function preencher(id, valorCampo) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valorCampo || "-";
  }
}
