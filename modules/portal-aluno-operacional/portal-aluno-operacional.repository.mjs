import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COMERCIAL_DIR = path.join(DATA_DIR, "comercial");

const FILES = {
  alunos: path.join(DATA_DIR, "alunos.json"),
  contratos: path.join(COMERCIAL_DIR, "contratos.json"),
  servicosContratados: path.join(COMERCIAL_DIR, "servicos_contratados.json"),
  frequencia: path.join(DATA_DIR, "frequencia.json"),
  treinos: path.join(DATA_DIR, "treinos.json"),
  avaliacoes: path.join(DATA_DIR, "avaliacoes.json"),
  mensalidades: path.join(DATA_DIR, "mensalidades.json"),
  financeiro: path.join(DATA_DIR, "financeiro.json")
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

export async function carregarBasePortalAluno() {
  return {
    alunos: await lerJson(FILES.alunos, []),
    contratos: await lerJson(FILES.contratos, []),
    servicosContratados: await lerJson(FILES.servicosContratados, []),
    frequencia: await lerJson(FILES.frequencia, []),
    treinos: await lerJson(FILES.treinos, []),
    avaliacoes: await lerJson(FILES.avaliacoes, []),
    mensalidades: await lerJson(FILES.mensalidades, []),
    financeiro: await lerJson(FILES.financeiro, [])
  };
}
