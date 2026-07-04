import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "../../data/modalidades.json");

async function garantirArquivo() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

export async function listarModalidades() {
  await garantirArquivo();
  const conteudo = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(conteudo || "[]");
}

export async function salvarModalidades(modalidades) {
  await garantirArquivo();
  await fs.writeFile(DATA_FILE, JSON.stringify(modalidades, null, 2), "utf8");
}

export async function buscarModalidadePorId(id) {
  const modalidades = await listarModalidades();
  return modalidades.find((item) => item.id === id) || null;
}
