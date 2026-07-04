import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COMERCIAL_DIR = path.join(DATA_DIR, "comercial");

const FILES = {
  professores: path.join(DATA_DIR, "professores.json"),
  alunos: path.join(DATA_DIR, "alunos.json"),
  contratos: path.join(COMERCIAL_DIR, "contratos.json"),
  servicosContratados: path.join(COMERCIAL_DIR, "servicos_contratados.json"),
  frequencia: path.join(DATA_DIR, "frequencia.json"),
  checkins: path.join(DATA_DIR, "checkins.json"),
  treinos: path.join(DATA_DIR, "treinos.json"),
  treinosIntegrados: path.join(DATA_DIR, "treinos_integrados.json"),
  execucoes: path.join(DATA_DIR, "treinos_execucoes.json"),
  avaliacoes: path.join(DATA_DIR, "avaliacoes.json")
};

async function garantirArquivo(arquivo, padrao = []) {
  try { await fs.access(arquivo); }
  catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), "utf8");
  }
}

export async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const raw = await fs.readFile(arquivo, "utf8");
  if (!raw.trim()) return padrao;
  try { return JSON.parse(raw) ?? padrao; } catch { return padrao; }
}

export async function carregarBasePortalProfessor() {
  const treinosBase = await lerJson(FILES.treinos, []);
  const treinosIntegrados = await lerJson(FILES.treinosIntegrados, []);
  const mapaTreinos = new Map();
  for (const treino of [...treinosIntegrados, ...treinosBase]) {
    if (treino?.id) mapaTreinos.set(String(treino.id), treino);
  }

  return {
    professores: await lerJson(FILES.professores, []),
    alunos: await lerJson(FILES.alunos, []),
    contratos: await lerJson(FILES.contratos, []),
    servicosContratados: await lerJson(FILES.servicosContratados, []),
    frequencia: await lerJson(FILES.frequencia, []),
    checkins: await lerJson(FILES.checkins, []),
    treinos: [...mapaTreinos.values()],
    execucoes: await lerJson(FILES.execucoes, []),
    avaliacoes: await lerJson(FILES.avaliacoes, [])
  };
}
