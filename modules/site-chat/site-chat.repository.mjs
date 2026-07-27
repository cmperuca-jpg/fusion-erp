import {
  executarTransacaoJson,
  lerJsonDuravel,
  salvarJsonDuravel
} from "../core/persistence/durable-json.mjs";

const MENSAGENS_ARQUIVO = "site_chat.json";
const CONVERSAS_ARQUIVO = "site_chat_conversas.json";

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

export async function listarMensagensRepository() {
  return lista(await lerJsonDuravel(MENSAGENS_ARQUIVO, []));
}

export async function listarConversasRepository() {
  return lista(await lerJsonDuravel(CONVERSAS_ARQUIVO, []));
}

export async function gravarMensagemAtomica({ mensagem, resposta = null, conversa }) {
  return executarTransacaoJson(async () => {
    const mensagens = lista(await lerJsonDuravel(MENSAGENS_ARQUIVO, []));
    const conversas = lista(await lerJsonDuravel(CONVERSAS_ARQUIVO, []));

    mensagens.push(mensagem);
    if (resposta) mensagens.push(resposta);

    const indice = conversas.findIndex(item => String(item.conversaId) === String(conversa.conversaId));
    if (indice >= 0) conversas[indice] = { ...conversas[indice], ...conversa };
    else conversas.push(conversa);

    await salvarJsonDuravel(MENSAGENS_ARQUIVO, mensagens);
    await salvarJsonDuravel(CONVERSAS_ARQUIVO, conversas);

    return { mensagens, conversas };
  });
}

export async function atualizarConversaAtomica(conversaId, alterador) {
  return executarTransacaoJson(async () => {
    const conversas = lista(await lerJsonDuravel(CONVERSAS_ARQUIVO, []));
    const indice = conversas.findIndex(item => String(item.conversaId) === String(conversaId));
    const atual = indice >= 0 ? conversas[indice] : { conversaId };
    const nova = await alterador({ ...atual });

    if (indice >= 0) conversas[indice] = nova;
    else conversas.push(nova);

    await salvarJsonDuravel(CONVERSAS_ARQUIVO, conversas);
    return nova;
  });
}

export async function marcarMensagensLidasAtomico(conversaId, leitor = "atendimento") {
  return executarTransacaoJson(async () => {
    const mensagens = lista(await lerJsonDuravel(MENSAGENS_ARQUIVO, []));
    const campo = leitor === "participante" ? "lidoPorParticipante" : "lidoPorAtendimento";
    let alteradas = 0;
    const agora = new Date().toISOString();

    for (const mensagem of mensagens) {
      if (String(mensagem.conversaId) !== String(conversaId) || mensagem[campo]) continue;
      mensagem[campo] = true;
      mensagem.atualizadoEm = agora;
      alteradas += 1;
    }

    if (alteradas) await salvarJsonDuravel(MENSAGENS_ARQUIVO, mensagens);
    return alteradas;
  });
}
