import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COMERCIAL_DIR = path.join(DATA_DIR, "comercial");

const FILES = {
  turmas: path.join(DATA_DIR, "turmas.json"),
  alunos: path.join(DATA_DIR, "alunos.json"),
  professores: path.join(DATA_DIR, "professores.json"),
  contratos: path.join(COMERCIAL_DIR, "contratos.json"),
  servicosContratados: path.join(COMERCIAL_DIR, "servicos_contratados.json"),
  frequencia: path.join(DATA_DIR, "frequencia.json"),
  agendaOperacional: path.join(DATA_DIR, "agenda_operacional.json")
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

export async function carregarBaseAgendaOperacional() {
  return {
    turmas: await lerJson(FILES.turmas, []),
    alunos: await lerJson(FILES.alunos, []),
    professores: await lerJson(FILES.professores, []),
    contratos: await lerJson(FILES.contratos, []),
    servicosContratados: await lerJson(FILES.servicosContratados, []),
    frequencia: await lerJson(FILES.frequencia, []),
    agendaOperacional: await lerJson(FILES.agendaOperacional, [])
  };
}

export async function salvarAgendaOperacional(lista = []) {
  await salvarJson(FILES.agendaOperacional, Array.isArray(lista) ? lista : []);
}
