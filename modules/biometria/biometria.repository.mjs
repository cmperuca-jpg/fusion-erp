import fs from "node:fs/promises";
import path from "node:path";

const DATA_FILE = path.resolve(process.cwd(), "data", "biometrias.json");

async function garantirArquivo() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

export async function listarBiometrias() {
  await garantirArquivo();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const lista = raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export async function salvarBiometrias(lista) {
  await garantirArquivo();
  const temporario = `${DATA_FILE}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporario, `${JSON.stringify(lista, null, 2)}\n`, "utf8");
  await fs.rename(temporario, DATA_FILE);
}

export async function buscarPorAlunoId(alunoId) {
  const lista = await listarBiometrias();
  return lista.find((item) => String(item.alunoId) === String(alunoId)) || null;
}
