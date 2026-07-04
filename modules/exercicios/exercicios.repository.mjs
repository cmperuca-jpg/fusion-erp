import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const arquivo = path.resolve("data/exercicios.json");

async function garantirArquivo() {
  await fs.mkdir("data", { recursive: true });

  try {
    await fs.access(arquivo);
  } catch {
    await fs.writeFile(arquivo, "[]");
  }
}

async function lerExercicios() {
  await garantirArquivo();

  const conteudo = await fs.readFile(arquivo, "utf-8");

  return JSON.parse(conteudo);
}

async function salvarExercicios(exercicios) {
  await garantirArquivo();

  await fs.writeFile(
    arquivo,
    JSON.stringify(exercicios, null, 2)
  );
}

export async function listarExercicios() {
  return await lerExercicios();
}

export async function buscarExercicio(id) {
  const exercicios = await lerExercicios();

  return exercicios.find(exercicio => exercicio.id === id);
}

export async function criarExercicio(exercicio) {
  const exercicios = await lerExercicios();

  const nomeJaExiste = exercicios.some(item =>
    item.nome &&
    exercicio.nome &&
    item.nome.trim().toLowerCase() === exercicio.nome.trim().toLowerCase()
  );

  if (nomeJaExiste) {
    throw new Error("Já existe um exercício com este nome.");
  }

  const novo = {
    id: crypto.randomUUID(),
    criado_em: new Date().toISOString(),
    ...exercicio
  };

  exercicios.push(novo);

  await salvarExercicios(exercicios);

  return novo;
}

export async function atualizarExercicio(id, dados) {
  const exercicios = await lerExercicios();

  const index = exercicios.findIndex(exercicio => exercicio.id === id);

  if (index === -1) {
    return null;
  }

  if (dados.nome) {
    const duplicado = exercicios.some(item =>
      item.id !== id &&
      item.nome &&
      item.nome.trim().toLowerCase() === dados.nome.trim().toLowerCase()
    );

    if (duplicado) {
      throw new Error("Já existe um exercício com este nome.");
    }
  }

  exercicios[index] = {
    ...exercicios[index],
    ...dados,
    atualizado_em: new Date().toISOString()
  };

  await salvarExercicios(exercicios);

  return exercicios[index];
}

export async function excluirExercicio(id) {
  const exercicios = await lerExercicios();

  const filtrados = exercicios.filter(exercicio => exercicio.id !== id);

  await salvarExercicios(filtrados);

  return exercicios.length !== filtrados.length;
}