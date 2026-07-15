import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { lerColecao, salvarColecao, salvarColecoesAtomicas } from "./collection-store.mjs";

const contextoTransacao = new AsyncLocalStorage();
let filaTransacoes = Promise.resolve();

export function colecaoDoArquivo(arquivoOuNome = "") {
  return path.basename(String(arquivoOuNome)).replace(/\.json$/i, "");
}

export async function lerJsonDuravel(arquivoOuNome, padrao = []) {
  const colecao = colecaoDoArquivo(arquivoOuNome);
  const contexto = contextoTransacao.getStore();
  if (contexto?.colecoes.has(colecao)) return contexto.colecoes.get(colecao);
  const dados = await lerColecao(colecao, padrao);
  if (contexto) contexto.colecoes.set(colecao, dados);
  return dados;
}

export function salvarJsonDuravel(arquivoOuNome, dados, opcoes = {}) {
  const colecao = colecaoDoArquivo(arquivoOuNome);
  const contexto = contextoTransacao.getStore();
  if (contexto) {
    contexto.colecoes.set(colecao, dados);
    contexto.alteradas.add(colecao);
    return Promise.resolve(dados);
  }
  return salvarColecao(colecao, dados, opcoes);
}

export function salvarJsonMultiplosAtomico(entradas = {}, opcoes = {}) {
  const colecoes = {};
  for (const [arquivoOuNome, dados] of Object.entries(entradas)) colecoes[colecaoDoArquivo(arquivoOuNome)] = dados;
  const contexto = contextoTransacao.getStore();
  if (contexto) {
    for (const [nome, dados] of Object.entries(colecoes)) {
      contexto.colecoes.set(nome, dados);
      contexto.alteradas.add(nome);
    }
    return Promise.resolve({ ok: true, pendente: true, colecoes: Object.keys(colecoes).length });
  }
  return salvarColecoesAtomicas(colecoes, opcoes);
}

export async function executarTransacaoJson(executor, { operacaoId = crypto.randomUUID() } = {}) {
  if (contextoTransacao.getStore()) return executor();
  const anterior = filaTransacoes;
  let liberar;
  filaTransacoes = new Promise(resolve => { liberar = resolve; });
  await anterior;
  try {
    return await contextoTransacao.run({ colecoes: new Map(), alteradas: new Set(), operacaoId }, async () => {
      const resultado = await executor();
      const contexto = contextoTransacao.getStore();
      const alteradas = Object.fromEntries([...contexto.alteradas].map(nome => [nome, contexto.colecoes.get(nome)]));
      if (contexto.alteradas.size) await salvarColecoesAtomicas(alteradas, { operacaoId });
      return resultado;
    });
  } finally {
    liberar();
  }
}
