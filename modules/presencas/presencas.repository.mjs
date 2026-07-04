import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const arquivo = path.resolve("data/presencas.json");

async function garantirArquivo() {
  await fs.mkdir("data", { recursive: true });

  try {
    await fs.access(arquivo);
  } catch {
    await fs.writeFile(arquivo, "[]");
  }
}

async function lerPresencas() {
  await garantirArquivo();
  const conteudo = await fs.readFile(arquivo, "utf8");
  return JSON.parse(conteudo);
}

async function salvarPresencas(presencas) {
  await garantirArquivo();
  await fs.writeFile(arquivo, JSON.stringify(presencas, null, 2));
}

export async function listarPresencas() {
  return await lerPresencas();
}

export async function buscarPresenca(id) {
  const presencas = await lerPresencas();
  return presencas.find(presenca => presenca.id === id);
}

export async function criarPresenca(dados) {
  const presencas = await lerPresencas();

  const duplicadaHoje = presencas.some(item =>
    item.aluno_id === dados.aluno_id &&
    item.data === dados.data &&
    item.status === "presente" &&
    !item.hora_saida
  );

  if (duplicadaHoje) {
    throw new Error("Este aluno já possui check-in aberto hoje.");
  }

  const presenca = {
    id: crypto.randomUUID(),
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...dados
  };

  presencas.push(presenca);
  await salvarPresencas(presencas);

  return presenca;
}

export async function atualizarPresenca(id, dados) {
  const presencas = await lerPresencas();
  const index = presencas.findIndex(presenca => presenca.id === id);

  if (index === -1) return null;

  presencas[index] = {
    ...presencas[index],
    ...dados,
    atualizado_em: new Date().toISOString()
  };

  await salvarPresencas(presencas);

  return presencas[index];
}

export async function excluirPresenca(id) {
  const presencas = await lerPresencas();
  const filtradas = presencas.filter(presenca => presenca.id !== id);

  await salvarPresencas(filtradas);

  return presencas.length !== filtradas.length;
}
