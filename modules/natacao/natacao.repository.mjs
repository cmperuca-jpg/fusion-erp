import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SESSOES = "natacao_sessoes.json";
const RECORDES = "natacao_recordes.json";
const ESTATISTICAS = "natacao_estatisticas.json";

async function ler(nome, padrao = []) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, nome);
    try { await fs.access(file); }
    catch { await fs.writeFile(file, JSON.stringify(padrao, null, 2), "utf-8"); }
    const txt = await fs.readFile(file, "utf-8");
    return txt.trim() ? JSON.parse(txt) : padrao;
  } catch {
    return padrao;
  }
}

async function salvar(nome, dados) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, nome), JSON.stringify(dados, null, 2), "utf-8");
}

export async function listarSessoes(limit = 50) {
  const lista = await ler(SESSOES, []);
  return lista.slice(0, Number(limit) || 50);
}

export async function listarTodasSessoes() {
  return await ler(SESSOES, []);
}

export async function listarRecordes() {
  return await ler(RECORDES, []);
}

export async function listarEstatisticas() {
  return await ler(ESTATISTICAS, { atualizadoEm: null, rankings: [], resumo: [] });
}

export async function salvarSessao(sessao) {
  const sessoes = await ler(SESSOES, []);
  const nova = {
    id: sessao.id || crypto.randomUUID(),
    ...sessao,
    criadoEm: sessao.criadoEm || new Date().toISOString()
  };
  sessoes.unshift(nova);
  await salvar(SESSOES, sessoes.slice(0, 5000));
  return nova;
}

export async function salvarRecordes(recordes) {
  await salvar(RECORDES, recordes);
  return recordes;
}

export async function salvarEstatisticas(estatisticas) {
  await salvar(ESTATISTICAS, estatisticas);
  return estatisticas;
}
