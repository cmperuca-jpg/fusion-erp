import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../../data/agenda.json");

async function garantirArquivo() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, "[]", "utf-8");
  }
}

export async function listarAulas() {
  await garantirArquivo();
  const conteudo = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(conteudo || "[]");
}

export async function salvarAulas(aulas) {
  await garantirArquivo();
  await fs.writeFile(DATA_PATH, JSON.stringify(aulas, null, 2), "utf-8");
  return aulas;
}

export async function buscarAulaPorId(id) {
  const aulas = await listarAulas();
  return aulas.find((aula) => String(aula.id) === String(id)) || null;
}
