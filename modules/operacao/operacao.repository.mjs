import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COMERCIAL_DIR = path.join(DATA_DIR, "comercial");

const FILES = {
  alunos: path.join(DATA_DIR, "alunos.json"),
  professores: path.join(DATA_DIR, "professores.json"),
  turmas: path.join(DATA_DIR, "turmas.json"),
  presencas: path.join(DATA_DIR, "presencas.json"),
  checkins: path.join(DATA_DIR, "checkins.json"),
  contratos: path.join(COMERCIAL_DIR, "contratos.json"),
  servicosContratados: path.join(COMERCIAL_DIR, "servicos_contratados.json")
};

async function garantirArquivo(arquivo, padrao = []) {
  try {
    await fs.access(arquivo);
  } catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), "utf8");
  }
}

export async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const raw = await fs.readFile(arquivo, "utf8");
  if (!raw.trim()) return padrao;
  try {
    const dados = JSON.parse(raw);
    return dados ?? padrao;
  } catch {
    return padrao;
  }
}

export async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf8");
}

export async function carregarBaseOperacao() {
  const [
    alunos,
    professores,
    turmas,
    presencas,
    checkins,
    contratos,
    servicosContratados
  ] = await Promise.all([
    lerJson(FILES.alunos, []),
    lerJson(FILES.professores, []),
    lerJson(FILES.turmas, []),
    lerJson(FILES.presencas, []),
    lerJson(FILES.checkins, []),
    lerJson(FILES.contratos, []),
    lerJson(FILES.servicosContratados, [])
  ]);

  return { alunos, professores, turmas, presencas, checkins, contratos, servicosContratados };
}

export async function salvarPresencas(presencas) {
  await salvarJson(FILES.presencas, Array.isArray(presencas) ? presencas : []);
}

export async function salvarCheckins(checkins) {
  await salvarJson(FILES.checkins, Array.isArray(checkins) ? checkins : []);
}

export const arquivosOperacao = FILES;
