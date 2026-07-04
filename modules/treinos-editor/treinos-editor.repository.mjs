import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");

const FILES = {
  treinosIntegrados: path.join(DATA_DIR, "treinos_integrados.json"),
  biblioteca: path.join(DATA_DIR, "exercicios_biblioteca.json"),
  alunos: path.join(DATA_DIR, "alunos.json"),
  professores: path.join(DATA_DIR, "professores.json")
};

async function garantirArquivo(arquivo, padrao = []) {
  try { await fs.access(arquivo); }
  catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), "utf8");
  }
}

export async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const raw = await fs.readFile(arquivo, "utf8");
  if (!raw.trim()) return padrao;
  try { return JSON.parse(raw) ?? padrao; } catch { return padrao; }
}

export async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf8");
}

export async function carregarBaseEditor() {
  return {
    treinos: await lerJson(FILES.treinosIntegrados, []),
    biblioteca: await lerJson(FILES.biblioteca, []),
    alunos: await lerJson(FILES.alunos, []),
    professores: await lerJson(FILES.professores, [])
  };
}

export async function salvarTreinos(lista = []) {
  await salvarJson(FILES.treinosIntegrados, Array.isArray(lista) ? lista : []);
}
