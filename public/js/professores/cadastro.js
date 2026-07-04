const API_PROFESSORES = "/api/professores";

const form = document.getElementById("formProfessor");

iniciarAbas();

const campoCEP = document.getElementById("cep");
const campoCPF = document.getElementById("cpf");
const campoTelefone = document.getElementById("telefone");
const campoWhatsApp = document.getElementById("whatsapp");
const campoFoto = document.getElementById("foto");
const fotoPreview = document.getElementById("fotoPreview");
const fotoTexto = document.getElementById("fotoTexto");
const fotoBase64 = document.getElementById("foto_base64");

if (campoCPF) campoCPF.addEventListener("input", mascaraCPF);

if (campoCEP) {
  campoCEP.addEventListener("input", mascaraCEP);
  campoCEP.addEventListener("blur", buscarCEP);
}

if (campoTelefone) campoTelefone.addEventListener("input", mascaraTelefone);
if (campoWhatsApp) campoWhatsApp.addEventListener("input", mascaraTelefone);

if (campoFoto) {
  campoFoto.addEventListener("change", () => {
    const arquivo = campoFoto.files[0];

    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.onload = () => {
      fotoBase64.value = leitor.result;
      fotoPreview.src = leitor.result;
      fotoPreview.style.display = "block";
      fotoTexto.style.display = "none";
    };

    leitor.readAsDataURL(arquivo);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const professor = {
    nome: valor("nome"),
    cpf: valor("cpf"),
    rg: valor("rg"),
    data_nascimento: valor("data_nascimento"),
    sexo: valor("sexo"),

    telefone: valor("telefone"),
    whatsapp: valor("whatsapp"),
    email: valor("email"),

    cep: valor("cep"),
    endereco: valor("endereco"),
    numero: valor("numero"),
    complemento: valor("complemento"),
    bairro: valor("bairro"),
    cidade: valor("cidade"),
    estado: valor("estado"),

    especialidade: valor("especialidade"),
    cref: valor("cref"),
    modalidade: valor("modalidade"),
    tipo_contrato: valor("tipo_contrato"),
    data_admissao: valor("data_admissao"),
    valor_hora: valor("valor_hora"),
    salario: valor("salario"),

    status: valor("status"),
    foto_base64: valor("foto_base64"),
    observacoes: valor("observacoes")
  };

  const id = valor("professorId");
  const url = id ? `${API_PROFESSORES}/${id}` : API_PROFESSORES;
  const metodo = id ? "PUT" : "POST";

  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(professor)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarAviso("Erro", erro.erro || "Erro ao salvar professor.");
    return;
  }

  mostrarAviso("Sucesso", "Professor salvo com sucesso.");

  setTimeout(() => {
    window.location.href = "/pages/professores/";
  }, 600);
});

function valor(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value : "";
}

async function buscarCEP() {
  const cep = valor("cep").replace(/\D/g, "");

  if (cep.length !== 8) return;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const endereco = await resposta.json();

    if (endereco.erro) {
      mostrarAviso("Aviso", "CEP não encontrado.");
      return;
    }

    document.getElementById("endereco").value = endereco.logradouro || "";
    document.getElementById("bairro").value = endereco.bairro || "";
    document.getElementById("cidade").value = endereco.localidade || "";
    document.getElementById("estado").value = endereco.uf || "";

    document.getElementById("numero").focus();
  } catch {
    mostrarAviso("Erro", "Não foi possível consultar o CEP.");
  }
}

function mascaraCPF(e) {
  let valorCampo = e.target.value.replace(/\D/g, "").substring(0, 11);

  valorCampo = valorCampo.replace(/(\d{3})(\d)/, "$1.$2");
  valorCampo = valorCampo.replace(/(\d{3})(\d)/, "$1.$2");
  valorCampo = valorCampo.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

  e.target.value = valorCampo;
}

function mascaraCEP(e) {
  let valorCampo = e.target.value.replace(/\D/g, "").substring(0, 8);
  valorCampo = valorCampo.replace(/(\d{5})(\d)/, "$1-$2");

  e.target.value = valorCampo;
}

function mascaraTelefone(e) {
  let valorCampo = e.target.value.replace(/\D/g, "").substring(0, 11);

  if (valorCampo.length > 10) {
    valorCampo = valorCampo.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else {
    valorCampo = valorCampo.replace(/^(\d{2})(\d{4})(\d{4}).*/, "($1) $2-$3");
  }

  e.target.value = valorCampo;
}

const parametros = new URLSearchParams(window.location.search);
const professorId = parametros.get("id");

if (professorId) {
  carregarProfessorParaEdicao(professorId);
}

async function carregarProfessorParaEdicao(id) {
  const resposta = await fetch(`${API_PROFESSORES}/${id}`);

  if (!resposta.ok) {
    mostrarAviso("Erro", "Professor não encontrado.");
    window.location.href = "/pages/professores/";
    return;
  }

  const professor = await resposta.json();

  document.getElementById("professorId").value = professor.id || "";

  Object.keys(professor).forEach(campo => {
    const elemento = document.getElementById(campo);

    if (elemento) {
      elemento.value = professor[campo] || "";
    }
  });

  if (professor.foto_base64 && fotoPreview && fotoTexto && fotoBase64) {
    fotoBase64.value = professor.foto_base64;
    fotoPreview.src = professor.foto_base64;
    fotoPreview.style.display = "block";
    fotoTexto.style.display = "none";
  }

  const titulo = document.getElementById("tituloCadastro");

  if (titulo) {
    titulo.textContent = "Editar Professor";
  }
}
