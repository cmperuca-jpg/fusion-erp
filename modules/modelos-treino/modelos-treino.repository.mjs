import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const arquivo = path.resolve("data/modelos-treino.json");

async function garantirArquivo() {
  await fs.mkdir("data", { recursive: true });

  try {
    await fs.access(arquivo);
  } catch {
    await fs.writeFile(arquivo, "[]");
  }
}

async function lerModelos() {
  await garantirArquivo();

  const conteudo = await fs.readFile(arquivo, "utf8");

  return JSON.parse(conteudo);
}

async function salvarModelos(modelos) {
  await garantirArquivo();

  await fs.writeFile(
    arquivo,
    JSON.stringify(modelos, null, 2)
  );
}

export async function listarModelos() {
  return await lerModelos();
}

export async function buscarModelo(id) {
  const modelos = await lerModelos();

  return modelos.find(modelo => modelo.id === id);
}

export async function criarModelo(dados) {
  const modelos = await lerModelos();

  const nomeJaExiste = modelos.some(item =>
    item.nome &&
    dados.nome &&
    item.nome.trim().toLowerCase() === dados.nome.trim().toLowerCase()
  );

  if (nomeJaExiste) {
    throw new Error("Já existe um modelo de treino com este nome.");
  }

  const modelo = {
    id: crypto.randomUUID(),
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...dados
  };

  modelos.push(modelo);

  await salvarModelos(modelos);

  return modelo;
}

export async function atualizarModelo(id, dados) {
  const modelos = await lerModelos();

  const indice = modelos.findIndex(modelo => modelo.id === id);

  if (indice === -1) return null;

  if (dados.nome) {
    const duplicado = modelos.some(item =>
      item.id !== id &&
      item.nome &&
      item.nome.trim().toLowerCase() === dados.nome.trim().toLowerCase()
    );

    if (duplicado) {
      throw new Error("Já existe um modelo de treino com este nome.");
    }
  }

  modelos[indice] = {
    ...modelos[indice],
    ...dados,
    atualizado_em: new Date().toISOString()
  };

  await salvarModelos(modelos);

  return modelos[indice];
}

export async function excluirModelo(id) {
  const modelos = await lerModelos();

  const novos = modelos.filter(modelo => modelo.id !== id);

  if (novos.length === modelos.length) {
    return false;
  }

  await salvarModelos(novos);

  return true;
}
