import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const arquivo = path.resolve("data/alunos.json");

async function garantirArquivo() {
  await fs.mkdir("data", { recursive: true });

  try {
    await fs.access(arquivo);
  } catch {
    await fs.writeFile(arquivo, "[]", "utf-8");
  }
}

async function lerAlunos() {
  await garantirArquivo();

  try {
    const conteudo = await fs.readFile(arquivo, "utf-8");
    const dados = conteudo.trim() ? JSON.parse(conteudo) : [];
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function salvarAlunos(alunos) {
  await garantirArquivo();
  await fs.writeFile(arquivo, JSON.stringify(alunos, null, 2), "utf-8");
}

function limparCpf(valor) {
  return String(valor || "").replace(/\D/g, "");
}

export async function listarAlunos() {
  return await lerAlunos();
}

export async function buscarAlunoPorId(id) {
  const alunos = await lerAlunos();
  return alunos.find(aluno => String(aluno.id) === String(id));
}

export async function criarAluno(aluno) {
  const alunos = await lerAlunos();
  const cpfNovo = limparCpf(aluno.cpf);

  if (cpfNovo) {
    const cpfJaExiste = alunos.some(item => limparCpf(item.cpf) === cpfNovo);

    if (cpfJaExiste) {
      throw new Error("Já existe um aluno cadastrado com este CPF.");
    }
  }

  const novoAluno = {
    id: crypto.randomUUID(),
    status: aluno.status || "inativo",
    criado_em: new Date().toISOString(),
    ...aluno,
    cpf: cpfNovo || aluno.cpf || ""
  };

  alunos.push(novoAluno);
  await salvarAlunos(alunos);

  return novoAluno;
}

export async function atualizarAluno(id, dados) {
  const alunos = await lerAlunos();
  const index = alunos.findIndex(aluno => String(aluno.id) === String(id));

  if (index === -1) {
    return null;
  }

  const cpfNovo = limparCpf(dados.cpf);

  if (cpfNovo) {
    const cpfJaExiste = alunos.some((item, itemIndex) =>
      itemIndex !== index && limparCpf(item.cpf) === cpfNovo
    );

    if (cpfJaExiste) {
      throw new Error("Já existe outro aluno cadastrado com este CPF.");
    }
  }

  alunos[index] = {
    ...alunos[index],
    ...dados,
    cpf: cpfNovo || dados.cpf || alunos[index].cpf || "",
    atualizado_em: new Date().toISOString()
  };

  await salvarAlunos(alunos);

  return alunos[index];
}

export async function excluirAluno(id) {
  const alunos = await lerAlunos();
  const filtrados = alunos.filter(aluno => String(aluno.id) !== String(id));

  await salvarAlunos(filtrados);

  return alunos.length !== filtrados.length;
}
