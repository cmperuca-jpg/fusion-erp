import crypto from "crypto";
import { lerJsonDuravel, salvarJsonDuravel, executarTransacaoJson } from "../core/persistence/durable-json.mjs";

async function lerAlunos() {
  try {
    const dados = await lerJsonDuravel("alunos.json", []);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function salvarAlunos(alunos) {
  await salvarJsonDuravel("alunos.json", alunos);
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

async function criarAlunoInterno(aluno) {
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
export async function criarAluno(aluno) {
  return executarTransacaoJson(() => criarAlunoInterno(aluno), { operacaoId: `aluno-criar-${crypto.randomUUID()}` });
}

async function atualizarAlunoInterno(id, dados) {
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
export async function atualizarAluno(id, dados) {
  return executarTransacaoJson(() => atualizarAlunoInterno(id, dados), { operacaoId: `aluno-atualizar-${id}-${Date.now()}` });
}

async function excluirAlunoInterno(id) {
  const alunos = await lerAlunos();
  const filtrados = alunos.filter(aluno => String(aluno.id) !== String(id));

  await salvarAlunos(filtrados);

  return alunos.length !== filtrados.length;
}
export async function excluirAluno(id) {
  return executarTransacaoJson(() => excluirAlunoInterno(id), { operacaoId: `aluno-excluir-${id}-${Date.now()}` });
}
