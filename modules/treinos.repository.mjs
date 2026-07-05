import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const ARQUIVO_TREINOS = path.join(DATA_DIR, "treinos.json");
const ARQUIVO_AUDITORIA = path.join(DATA_DIR, "auditoria_treinos.json");

async function garantirArquivo(arquivo, padrao = []) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  try {
    await fs.access(arquivo);
  } catch {
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), "utf-8");
  }
}

async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  try {
    const texto = await fs.readFile(arquivo, "utf-8");
    if (!texto.trim()) return padrao;
    const dados = JSON.parse(texto);
    return Array.isArray(dados) ? dados : padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(arquivo, dados) {
  await garantirArquivo(arquivo, []);
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf-8");
}

function novoId(prefixo = "tre") {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function mesmoId(a, b) {
  return String(a || "") === String(b || "");
}

export async function listarTreinos() {
  return await lerJson(ARQUIVO_TREINOS, []);
}

export async function buscarTreino(id) {
  const treinos = await listarTreinos();
  return treinos.find((treino) => mesmoId(treino.id, id)) || null;
}

export async function criarTreino(dados) {
  const treinos = await listarTreinos();
  const agora = new Date().toISOString();
  const novo = {
    id: dados.id || novoId("tre"),
    criadoEm: agora,
    atualizadoEm: agora,
    versao: 1,
    historico: [
      {
        id: novoId("hist_tre"),
        acao: "criacao",
        descricao: "Treino criado.",
        usuario: dados.usuario || "sistema",
        criadoEm: agora
      }
    ],
    ...dados
  };

  treinos.push(novo);
  await salvarJson(ARQUIVO_TREINOS, treinos);
  await registrarAuditoria({ tipo: "treino_criado", treinoId: novo.id, alunoId: novo.alunoId, professorId: novo.professorId, usuario: dados.usuario });
  return novo;
}

export async function atualizarTreino(id, dados) {
  const treinos = await listarTreinos();
  const index = treinos.findIndex((treino) => mesmoId(treino.id, id));
  if (index === -1) return null;

  const anterior = treinos[index];
  const agora = new Date().toISOString();
  const historico = Array.isArray(anterior.historico) ? anterior.historico : [];

  treinos[index] = {
    ...anterior,
    ...dados,
    id: anterior.id,
    criadoEm: anterior.criadoEm,
    versao: Number(anterior.versao || 1) + 1,
    atualizadoEm: agora,
    historico: [
      ...historico,
      {
        id: novoId("hist_tre"),
        acao: "edicao",
        descricao: "Treino atualizado.",
        usuario: dados.usuario || "sistema",
        criadoEm: agora
      }
    ]
  };

  await salvarJson(ARQUIVO_TREINOS, treinos);
  await registrarAuditoria({ tipo: "treino_atualizado", treinoId: anterior.id, alunoId: treinos[index].alunoId, professorId: treinos[index].professorId, usuario: dados.usuario });
  return treinos[index];
}

export async function excluirTreino(id, usuario = "sistema") {
  const treinos = await listarTreinos();
  const treino = treinos.find((item) => mesmoId(item.id, id));
  const filtrados = treinos.filter((item) => !mesmoId(item.id, id));
  await salvarJson(ARQUIVO_TREINOS, filtrados);
  if (treino) {
    await registrarAuditoria({ tipo: "treino_excluido", treinoId: treino.id, alunoId: treino.alunoId, professorId: treino.professorId, usuario });
  }
  return treinos.length !== filtrados.length;
}

export async function registrarAuditoria(evento = {}) {
  const auditoria = await lerJson(ARQUIVO_AUDITORIA, []);
  auditoria.unshift({
    id: novoId("aud_tre"),
    ...evento,
    criadoEm: new Date().toISOString()
  });
  await salvarJson(ARQUIVO_AUDITORIA, auditoria.slice(0, 5000));
}
