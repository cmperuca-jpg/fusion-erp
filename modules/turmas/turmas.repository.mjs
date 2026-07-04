import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../../data/turmas.json");

async function garantirArquivo() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, "[]", "utf8");
  }
}

export async function listarTurmas() {
  await garantirArquivo();
  const conteudo = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(conteudo || "[]");
}

export async function salvarTurmas(turmas) {
  await garantirArquivo();
  await fs.writeFile(DATA_PATH, JSON.stringify(turmas, null, 2), "utf8");
}

export async function buscarTurmaPorId(id) {
  const turmas = await listarTurmas();
  return turmas.find((turma) => String(turma.id) === String(id));
}

export async function criarTurma(dados) {
  const turmas = await listarTurmas();
  const novaTurma = {
    id: Date.now(),
    status: "Ativa",
    alunosMatriculados: 0,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...dados
  };

  turmas.push(novaTurma);
  await salvarTurmas(turmas);
  return novaTurma;
}

export async function atualizarTurma(id, dados) {
  const turmas = await listarTurmas();
  const index = turmas.findIndex((turma) => String(turma.id) === String(id));

  if (index === -1) return null;

  turmas[index] = {
    ...turmas[index],
    ...dados,
    atualizadoEm: new Date().toISOString()
  };

  await salvarTurmas(turmas);
  return turmas[index];
}

export async function excluirTurma(id) {
  const turmas = await listarTurmas();
  const filtradas = turmas.filter((turma) => String(turma.id) !== String(id));

  if (filtradas.length === turmas.length) return false;

  await salvarTurmas(filtradas);
  return true;
}
