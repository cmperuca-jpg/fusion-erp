import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FREQUENCIA_FILE = path.join(DATA_DIR, "frequencia.json");

async function garantirArquivo() {
  try {
    await fs.access(FREQUENCIA_FILE);
  } catch {
    await fs.mkdir(path.dirname(FREQUENCIA_FILE), { recursive: true });
    await fs.writeFile(FREQUENCIA_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

export async function listarFrequencias() {
  await garantirArquivo();
  const raw = await fs.readFile(FREQUENCIA_FILE, "utf8");
  if (!raw.trim()) return [];
  try {
    const dados = JSON.parse(raw);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export async function salvarFrequencias(lista = []) {
  await fs.mkdir(path.dirname(FREQUENCIA_FILE), { recursive: true });
  await fs.writeFile(FREQUENCIA_FILE, JSON.stringify(Array.isArray(lista) ? lista : [], null, 2), "utf8");
}
