import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../../data/financeiro.json");

async function garantirArquivo() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, "[]", "utf-8");
  }
}

export async function listarLancamentos() {
  await garantirArquivo();
  const conteudo = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(conteudo || "[]");
}

export async function salvarLancamentos(lancamentos) {
  await garantirArquivo();
  await fs.writeFile(DATA_PATH, JSON.stringify(lancamentos, null, 2), "utf-8");
  return lancamentos;
}

export async function buscarLancamentoPorId(id) {
  const lancamentos = await listarLancamentos();
  return lancamentos.find((item) => String(item.id) === String(id)) || null;
}
