import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const EXERCICIOS_FILE = path.join(DATA_DIR, "treinos_exercicios.json");
const TREINOS_FILE = path.join(DATA_DIR, "treinos_prescritos.json");

async function garantirArquivo(file, fallback) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try { await fs.access(file); } catch { await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf-8"); }
}

export async function listarBiblioteca() {
  await garantirArquivo(EXERCICIOS_FILE, { grupos: [], objetivos: [], exercicios: [] });
  const raw = await fs.readFile(EXERCICIOS_FILE, "utf-8");
  return JSON.parse(raw || '{"grupos":[],"objetivos":[],"exercicios":[]}');
}

export async function listarTreinos() {
  await garantirArquivo(TREINOS_FILE, []);
  const raw = await fs.readFile(TREINOS_FILE, "utf-8");
  const data = JSON.parse(raw || "[]");
  return Array.isArray(data) ? data : [];
}

export async function salvarTreinos(treinos) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TREINOS_FILE, JSON.stringify(treinos, null, 2), "utf-8");
}
