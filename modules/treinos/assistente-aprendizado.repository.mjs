import crypto from "node:crypto";
import {
  lerColecao,
  salvarColecoesAtomicas
} from "../core/persistence/collection-store.mjs";

const COLECOES = Object.freeze({
  execucoes: "treinos_assistente_execucoes",
  sugestoes: "treinos_assistente_sugestoes",
  revisoes: "treinos_assistente_revisoes",
  exemplos: "treinos_assistente_exemplos_aprovados"
});

let filaEscrita = Promise.resolve();

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function limitar(listaAtual, maximo = 10000) {
  return lista(listaAtual).slice(0, maximo);
}

async function lerTudo() {
  const [
    execucoes,
    sugestoes,
    revisoes,
    exemplos
  ] = await Promise.all([
    lerColecao(COLECOES.execucoes, []),
    lerColecao(COLECOES.sugestoes, []),
    lerColecao(COLECOES.revisoes, []),
    lerColecao(COLECOES.exemplos, [])
  ]);

  return {
    execucoes: lista(execucoes),
    sugestoes: lista(sugestoes),
    revisoes: lista(revisoes),
    exemplos: lista(exemplos)
  };
}

function serializarEscrita(fn) {
  const proxima = filaEscrita.then(fn, fn);
  filaEscrita = proxima.catch(() => {});
  return proxima;
}

export async function listarAprendizado() {
  return await lerTudo();
}

export async function registrarGeracaoAtomica(
  execucao,
  sugestao
) {
  return await serializarEscrita(async () => {
    const atual = await lerTudo();

    const execucoes = limitar([
      execucao,
      ...atual.execucoes
    ]);

    const sugestoes = limitar([
      sugestao,
      ...atual.sugestoes
    ]);

    await salvarColecoesAtomicas(
      {
        [COLECOES.execucoes]: execucoes,
        [COLECOES.sugestoes]: sugestoes
      },
      {
        operacaoId:
          `assistente-geracao-${execucao.id || crypto.randomUUID()}`
      }
    );

    return { execucao, sugestao };
  });
}

export async function registrarRevisaoRegistro(revisao) {
  return await serializarEscrita(async () => {
    const atual = await lerTudo();

    const revisoes = limitar([
      revisao,
      ...atual.revisoes
    ]);

    await salvarColecoesAtomicas(
      {
        [COLECOES.revisoes]: revisoes
      },
      {
        operacaoId:
          `assistente-revisao-${revisao.id || crypto.randomUUID()}`
      }
    );

    return revisao;
  });
}

/* assistente-aprovacao-idempotente-v1 */

export async function registrarExemploAprovadoRegistro(exemplo) {
  return await serializarEscrita(async () => {
    const atual =
      await lerTudo();

    const treinoVersaoId =
      String(
        exemplo?.treinoVersaoId ||
        ""
      );

    const sugestaoId =
      String(
        exemplo?.sugestaoId ||
        ""
      );

    const alunoId =
      String(
        exemplo?.alunoId ||
        ""
      );

    /*
     * Repetir a mesma chamada não cria outro exemplo.
     */
    const existenteMesmaVersao =
      atual.exemplos.find(
        item =>
          treinoVersaoId &&
          String(
            item?.treinoVersaoId ||
            ""
          ) === treinoVersaoId
      );

    if (existenteMesmaVersao) {
      return {
        ...existenteMesmaVersao,
        jaExistia: true
      };
    }

    /*
     * Uma mesma sugestão não pode alimentar dois
     * exemplos aprovados em versões diferentes.
     */
    const existenteMesmaSugestao =
      atual.exemplos.find(
        item =>
          sugestaoId &&
          alunoId &&
          String(
            item?.sugestaoId ||
            ""
          ) === sugestaoId &&
          String(
            item?.alunoId ||
            ""
          ) === alunoId
      );

    if (existenteMesmaSugestao) {
      const erro = new Error(
        "Esta sugestão já foi aprovada em outra versão de treino."
      );

      erro.statusCode = 409;
      erro.code =
        "SUGESTAO_JA_APROVADA_EM_OUTRA_VERSAO";

      throw erro;
    }

    const exemplos = limitar([
      exemplo,
      ...atual.exemplos
    ]);

    await salvarColecoesAtomicas(
      {
        [COLECOES.exemplos]:
          exemplos
      },
      {
        operacaoId:
          `assistente-aprovacao-${exemplo.id || crypto.randomUUID()}`
      }
    );

    return exemplo;
  });
}
