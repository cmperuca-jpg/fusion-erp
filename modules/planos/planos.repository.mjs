import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "../../data/planos.json");

async function garantirArquivo() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

export async function listarPlanos() {
  await garantirArquivo();
  const conteudo = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(conteudo || "[]");
}

export async function salvarPlanos(planos) {
  await garantirArquivo();
  await fs.writeFile(DATA_FILE, JSON.stringify(planos, null, 2), "utf8");
}

export async function buscarPlanoPorId(id) {
  const planos = await listarPlanos();
  return planos.find((item) => item.id === id) || null;
}
