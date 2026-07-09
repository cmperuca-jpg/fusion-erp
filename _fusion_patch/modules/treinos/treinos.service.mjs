import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { listarBiblioteca, listarTreinos, salvarTreinos } from "./treinos.repository.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");

async function lerJsonSeguro(arquivo, fallback) {
  try {
    const bruto = await fs.readFile(arquivo, "utf-8");
    return bruto.trim() ? JSON.parse(bruto) : fallback;
  } catch {
    return fallback;
  }
}

function listaDePessoas(dados, chave) {
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.dados)) return dados.dados;
  if (Array.isArray(dados?.[chave])) return dados[chave];
  if (Array.isArray(dados?.items)) return dados.items;
  if (dados?.dados && Array.isArray(dados.dados.itens)) return dados.dados.itens;
  return [];
}

function somenteDigitos(valor) {
  return String(valor || "").replace(/\D+/g, "");
}

function idPessoa(pessoa) {
  return String(pessoa?.id ?? pessoa?.codigo ?? pessoa?.alunoId ?? pessoa?.matriculaId ?? pessoa?.cpf ?? "");
}

function nomePessoa(pessoa) {
  return pessoa?.nome || pessoa?.nomeCompleto || pessoa?.alunoNome || pessoa?.name || "Aluno";
}

function dataNascimentoSenha(pessoa) {
  const raw = pessoa?.dataNascimento || pessoa?.nascimento || pessoa?.data_nascimento || "";
  const digitos = somenteDigitos(raw);
  if (digitos.length >= 8) return digitos.slice(0, 8);
  return "";
}

async function listarAlunosSistema() {
  const candidatos = [
    path.join(DATA_DIR, "alunos.json"),
    path.join(DATA_DIR, "alunos", "alunos.json"),
    path.join(DATA_DIR, "matriculas", "alunos.json")
  ];
  for (const arquivo of candidatos) {
    const dados = await lerJsonSeguro(arquivo, null);
    const lista = listaDePessoas(dados, "alunos");
    if (lista.length) return lista;
  }
  return [];
}

function loginCombina(aluno, login) {
  const l = String(login || "").trim().toLowerCase();
  const ld = somenteDigitos(l);
  const campos = [
    aluno?.email, aluno?.login, aluno?.usuario, aluno?.matricula, aluno?.codigo, aluno?.id, aluno?.alunoId, aluno?.cpf, aluno?.telefone, aluno?.celular
  ].filter(Boolean).map(v => String(v).trim().toLowerCase());
  if (campos.includes(l)) return true;
  if (ld) {
    return [aluno?.cpf, aluno?.telefone, aluno?.celular, aluno?.matricula, aluno?.codigo, aluno?.id, aluno?.alunoId]
      .some(v => somenteDigitos(v) === ld);
  }
  return false;
}

function senhaCombina(aluno, senha) {
  const s = String(senha || "").trim();
  const sd = somenteDigitos(s);
  const senhaCadastrada = aluno?.senhaAluno || aluno?.senha || aluno?.password || aluno?.senhaPortal || aluno?.portalSenha;
  if (senhaCadastrada && String(senhaCadastrada) === s) return true;

  const cpf = somenteDigitos(aluno?.cpf);
  if (cpf && (sd === cpf || sd === cpf.slice(-4))) return true;

  const nascimento = dataNascimentoSenha(aluno);
  if (nascimento && sd === nascimento) return true;

  return false;
}

export async function autenticarAlunoTreino({ login, senha } = {}) {
  if (!login || !senha) {
    const erro = new Error("Informe login e senha do aluno.");
    erro.statusCode = 400;
    throw erro;
  }

  const alunos = await listarAlunosSistema();
  const aluno = alunos.find((item) => loginCombina(item, login));
  if (!aluno || !senhaCombina(aluno, senha)) {
    const erro = new Error("Login ou senha inválidos.");
    erro.statusCode = 401;
    throw erro;
  }

  const alunoId = idPessoa(aluno);
  return {
    alunoId,
    alunoNome: nomePessoa(aluno),
    token: Buffer.from(`${alunoId}:${Date.now()}`).toString("base64"),
    mensagem: "Aluno autenticado com sucesso."
  };
}


export async function obterBiblioteca() {
  const biblioteca = await listarBiblioteca();
  biblioteca.grupos = Array.isArray(biblioteca.grupos) ? biblioteca.grupos : [];
  biblioteca.objetivos = Array.isArray(biblioteca.objetivos) ? biblioteca.objetivos : [];
  biblioteca.exercicios = Array.isArray(biblioteca.exercicios) ? biblioteca.exercicios.map((ex) => ({
    ...ex,
    foto: ex.foto || ex.gif || `/assets/exercicios/flash/${String(ex.codigo || ex.id || "").padStart(3, "0")}.gif`
  })) : [];
  return biblioteca;
}

export async function obterTreinos(filtros = {}) {
  const treinos = await listarTreinos();
  const alunoId = filtros.alunoId ? String(filtros.alunoId) : "";
  if (!alunoId) return treinos;
  return treinos.filter((t) => String(t.alunoId || "") === alunoId);
}

export async function criarTreino(payload) {
  if (!payload?.alunoId || !payload?.alunoNome) {
    const erro = new Error("Selecione um aluno antes de salvar o treino.");
    erro.statusCode = 400;
    throw erro;
  }
  if (!payload?.professorId || !payload?.professorNome) {
    const erro = new Error("Selecione o professor responsável antes de salvar o treino.");
    erro.statusCode = 400;
    throw erro;
  }

  const divisoes = Array.isArray(payload.divisoes) ? payload.divisoes.map((divisao) => ({
    nome: divisao.nome || "A",
    itens: Array.isArray(divisao.itens) ? divisao.itens.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nome: item.nome,
      descricao: item.descricao || "",
      musculos: item.musculos || "",
      grupoId: item.grupoId || "",
      grupo: item.grupo || "",
      foto: item.foto || item.gif || "",
      gif: item.gif || item.foto || "",
      series: item.series || "",
      repeticoes: item.repeticoes || "",
      carga: item.carga || "",
      descanso: item.descanso || "",
      metodo: item.metodo || "Convencional",
      cadencia: item.cadencia || "",
      obs: item.obs || ""
    })) : []
  })) : [];

  const treinos = await listarTreinos();
  const agora = new Date().toISOString();
  const treino = {
    id: payload.id || `treino_${Date.now()}`,
    alunoId: String(payload.alunoId),
    alunoNome: payload.alunoNome,
    professorId: String(payload.professorId),
    professorNome: payload.professorNome,
    objetivo: payload.objetivo || "",
    validade: payload.validade || "",
    observacoes: payload.observacoes || "",
    divisoes,
    criadoEm: payload.criadoEm || agora,
    dataPrescricao: payload.dataPrescricao || agora.slice(0, 10),
    atualizadoEm: agora,
    ativo: payload.ativo !== false
  };

  const restantes = treinos.filter((t) => String(t.alunoId || "") !== String(treino.alunoId) || t.ativo === false);
  restantes.unshift(treino);
  await salvarTreinos(restantes);
  return treino;
}

export async function removerTreino(id) {
  const treinos = await listarTreinos();
  const filtrados = treinos.filter((t) => String(t.id) !== String(id));
  await salvarTreinos(filtrados);
  return { removido: filtrados.length !== treinos.length };
}
