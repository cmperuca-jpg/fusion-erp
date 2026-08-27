import {
  lerJsonDuravel,
  salvarJsonDuravel,
  executarTransacaoJson
} from "../core/persistence/durable-json.mjs";

const COLECAO = "agenda_avaliacoes.json";

export async function listarAgendaAvaliacoes() {
  const dados = await lerJsonDuravel(COLECAO, []);
  return Array.isArray(dados) ? dados : [];
}

export async function alterarAgendaAvaliacoes(executor) {
  return executarTransacaoJson(async () => {
    const dados = await lerJsonDuravel(COLECAO, []);
    const lista = Array.isArray(dados) ? [...dados] : [];
    const resultado = await executor(lista);
    await salvarJsonDuravel(COLECAO, lista);
    return resultado;
  });
}
