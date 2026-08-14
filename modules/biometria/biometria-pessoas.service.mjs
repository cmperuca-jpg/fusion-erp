import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";

const TIPOS = new Set(["aluno", "professor", "usuario"]);

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function normalizar(valor = "") {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function bool(valor) {
  return valor === true ||
    ["1", "true", "sim", "yes", "on"].includes(normalizar(valor));
}

function perfilUsuario(valor = "") {
  const p = normalizar(valor);
  if (["administrador", "admin"].includes(p)) return { codigo: "admin", rotulo: "Administrador" };
  if (["professor", "responsavel_tecnico", "instrutor"].includes(p)) return { codigo: "professor", rotulo: "Professor" };
  if (["recepcao", "recepcionista"].includes(p)) return { codigo: "recepcao", rotulo: "Recepção" };
  if (["gerente", "gestor"].includes(p)) return { codigo: "gerente", rotulo: "Gerente" };
  return null;
}

function statusBloqueado(registro = {}) {
  const status = normalizar(registro.status || registro.situacao);
  return bool(registro.bloqueado) ||
    bool(registro.bloqueioCheckin) ||
    ["bloqueado", "bloqueada", "cancelado", "cancelada", "suspenso", "suspensa"].includes(status);
}

function statusAtivo(registro = {}) {
  if (registro.ativo === false) return false;
  const status = normalizar(registro.status || registro.situacao || "ativo");
  return !["inativo", "inativa", "cancelado", "cancelada", "suspenso", "suspensa"].includes(status);
}

function nomePessoa(registro = {}, fallback = "Pessoa") {
  return texto(
    registro.nome ||
    registro.nomeCompleto ||
    registro.alunoNome ||
    registro.name ||
    fallback
  );
}

function itemSeguro(registro = {}, tipoPessoa = "aluno") {
  const id = texto(registro.id || registro._id || registro.codigo);
  if (!id) return null;

  let perfil = { codigo: "aluno", rotulo: "Aluno" };
  if (tipoPessoa === "professor") {
    perfil = { codigo: "professor", rotulo: "Professor" };
  } else if (tipoPessoa === "usuario") {
    perfil = perfilUsuario(registro.perfil || registro.funcao || registro.role);
    if (!perfil) return null;
  }

  const bloqueado = statusBloqueado(registro);
  const ativo = statusAtivo(registro);

  return {
    id,
    tipoPessoa,
    nome: nomePessoa(registro),
    perfil: perfil.codigo,
    perfilRotulo: perfil.rotulo,
    status: texto(registro.status || registro.situacao || (ativo ? "Ativo" : "Inativo")),
    ativo,
    bloqueado,
    acessoLiberavel: ativo && !bloqueado,
    avisoAcesso: bloqueado
      ? "A digital pode permanecer cadastrada, mas o acesso está bloqueado."
      : !ativo
        ? "A digital pode permanecer cadastrada. O acesso volta quando a pessoa for reativada."
        : perfil.codigo === "aluno"
          ? "Acesso sujeito às regras da matrícula e ao limite diário."
          : "Equipe ativa: sem limite diário de entradas. Bloqueio explícito continua valendo."
  };
}

async function carregarColecoes() {
  const [alunos, professores, usuarios] = await Promise.all([
    lerJsonDuravel("alunos.json", []),
    lerJsonDuravel("professores.json", []),
    lerJsonDuravel("usuarios.json", [])
  ]);

  return {
    aluno: Array.isArray(alunos) ? alunos : [],
    professor: Array.isArray(professores) ? professores : [],
    usuario: Array.isArray(usuarios) ? usuarios : []
  };
}

function normalizarTipo(tipo = "") {
  const valor = normalizar(tipo);
  if (valor === "equipe" || valor === "funcionario" || valor === "funcionarios") return "usuario";
  return valor;
}

export async function listarPessoasBiometria({ tipo = "", busca = "" } = {}) {
  const colecoes = await carregarColecoes();
  const tipoFiltro = normalizarTipo(tipo);
  const buscaNormalizada = normalizar(busca);

  const tipos = tipoFiltro && TIPOS.has(tipoFiltro)
    ? [tipoFiltro]
    : ["aluno", "professor", "usuario"];

  const saida = [];

  for (const tipoPessoa of tipos) {
    for (const registro of colecoes[tipoPessoa]) {
      const item = itemSeguro(registro, tipoPessoa);
      if (!item) continue;

      if (buscaNormalizada) {
        const alvo = normalizar(`${item.nome} ${item.perfilRotulo} ${item.status}`);
        if (!alvo.includes(buscaNormalizada)) continue;
      }

      saida.push(item);
    }
  }

  return saida.sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
  );
}

export async function obterPessoaBiometria(tipo, id) {
  const tipoPessoa = normalizarTipo(tipo);
  if (!TIPOS.has(tipoPessoa)) {
    const erro = new Error("Tipo de pessoa inválido.");
    erro.status = 400;
    throw erro;
  }

  const alvo = texto(id);
  if (!alvo) {
    const erro = new Error("Pessoa não informada.");
    erro.status = 400;
    throw erro;
  }

  const colecoes = await carregarColecoes();

  // Segurança contra colisão de IDs entre cadastros. O template local usa o
  // próprio ID da pessoa, portanto ele deve identificar uma única entidade.
  const ocorrencias = [];
  for (const tipoCandidato of ["aluno", "professor", "usuario"]) {
    const registro = colecoes[tipoCandidato].find(item =>
      texto(item.id || item._id || item.codigo) === alvo
    );
    if (registro) ocorrencias.push({ tipoPessoa: tipoCandidato, registro });
  }

  if (ocorrencias.length > 1) {
    const erro = new Error("Este cadastro possui identificador ambíguo. Corrija o cadastro antes de registrar a digital.");
    erro.status = 409;
    throw erro;
  }

  const encontrado = ocorrencias.find(item => item.tipoPessoa === tipoPessoa);
  if (!encontrado) {
    const erro = new Error("Pessoa não encontrada.");
    erro.status = 404;
    throw erro;
  }

  const pessoa = itemSeguro(encontrado.registro, tipoPessoa);
  if (!pessoa) {
    const erro = new Error("Este perfil não está habilitado para acesso biométrico.");
    erro.status = 409;
    throw erro;
  }

  return pessoa;
}
