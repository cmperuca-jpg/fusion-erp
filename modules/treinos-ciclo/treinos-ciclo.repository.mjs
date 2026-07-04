import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");

const FILES = {
  treinos: path.join(DATA_DIR, "treinos_integrados.json"),
  execucoes: path.join(DATA_DIR, "treinos_execucoes.json"),
  ciclos: path.join(DATA_DIR, "treinos_ciclos.json"),
  alunos: path.join(DATA_DIR, "alunos.json"),
  avaliacoes: path.join(DATA_DIR, "avaliacoes.json"),
  frequencia: path.join(DATA_DIR, "frequencia.json")
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

export async function carregarBaseCiclo() {
  return {
    treinos: await lerJson(FILES.treinos, []),
    execucoes: await lerJson(FILES.execucoes, []),
    ciclos: await lerJson(FILES.ciclos, []),
    alunos: await lerJson(FILES.alunos, []),
    avaliacoes: await lerJson(FILES.avaliacoes, []),
    frequencia: await lerJson(FILES.frequencia, [])
  };
}

export async function salvarTreinos(lista = []) { await salvarJson(FILES.treinos, lista); }
export async function salvarCiclos(lista = []) { await salvarJson(FILES.ciclos, lista); }
