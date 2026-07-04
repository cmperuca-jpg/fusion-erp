import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const arquivo = path.resolve("data/avaliacoes.json");

async function garantirArquivo() {
  await fs.mkdir("data", { recursive: true });
  try { await fs.access(arquivo); }
  catch { await fs.writeFile(arquivo, "[]", "utf-8"); }
}

async function lerAvaliacoes() {
  await garantirArquivo();
  const conteudo = await fs.readFile(arquivo, "utf-8");
  try {
    const dados = JSON.parse(conteudo || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function salvarAvaliacoes(avaliacoes) {
  await garantirArquivo();
  await fs.writeFile(arquivo, JSON.stringify(avaliacoes, null, 2), "utf-8");
}

export async function listarAvaliacoes() {
  return await lerAvaliacoes();
}

export async function listarPorAluno(alunoId) {
  const avaliacoes = await lerAvaliacoes();
  return avaliacoes.filter(a => String(a.aluno_id || a.alunoId) === String(alunoId));
}

export async function buscarAvaliacao(id) {
  const avaliacoes = await lerAvaliacoes();
  return avaliacoes.find(a => String(a.id) === String(id)) || null;
}

export async function criarAvaliacao(avaliacao) {
  const avaliacoes = await lerAvaliacoes();
  const agora = new Date().toISOString();
  const nova = {
    id: crypto.randomUUID(),
    criado_em: agora,
    criadoEm: agora,
    atualizado_em: agora,
    atualizadoEm: agora,
    ...avaliacao
  };
  avaliacoes.push(nova);
  await salvarAvaliacoes(avaliacoes);
  return nova;
}

export async function atualizarAvaliacao(id, dados) {
  const avaliacoes = await lerAvaliacoes();
  const index = avaliacoes.findIndex(a => String(a.id) === String(id));
  if (index === -1) return null;
  const agora = new Date().toISOString();
  avaliacoes[index] = {
    ...avaliacoes[index],
    ...dados,
    atualizado_em: agora,
    atualizadoEm: agora
  };
  await salvarAvaliacoes(avaliacoes);
  return avaliacoes[index];
}

export async function excluirAvaliacao(id) {
  const avaliacoes = await lerAvaliacoes();
  const filtradas = avaliacoes.filter(a => String(a.id) !== String(id));
  await salvarAvaliacoes(filtradas);
  return avaliacoes.length !== filtradas.length;
}
