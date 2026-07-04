import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");

export async function garantirDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function lerJson(nomeArquivo, padrao = []) {
  await garantirDataDir();
  const arquivo = path.join(DATA_DIR, nomeArquivo);
  try {
    const raw = await fs.readFile(arquivo, "utf8");
    if (!raw.trim()) return padrao;
    return JSON.parse(raw);
  } catch (erro) {
    if (erro?.code === "ENOENT") {
      await salvarJson(nomeArquivo, padrao);
      return padrao;
    }
    throw erro;
  }
}

export async function salvarJson(nomeArquivo, dados) {
  await garantirDataDir();
  const arquivo = path.join(DATA_DIR, nomeArquivo);
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf8");
}

export function gerarId(prefixo = "id") {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function dinheiro(valor) {
  const n = Number(String(valor ?? 0).replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export function texto(valor) {
  return String(valor ?? "").trim();
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function agoraISO() {
  return new Date().toISOString();
}

export function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
