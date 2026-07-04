import { modeloTreinoSchema, modeloTreinoUpdateSchema } from "./modelos-treino.schema.mjs";

import {
  listarModelos,
  buscarModelo,
  criarModelo,
  atualizarModelo,
  excluirModelo
} from "./modelos-treino.repository.mjs";

export async function listar() {
  return await listarModelos();
}

export async function buscar(id) {
  return await buscarModelo(id);
}

export async function criar(dados) {
  const resultado = modeloTreinoSchema.safeParse(dados);

  if (!resultado.success) {
    throw new Error(
      resultado.error.issues.map(item => item.message).join(", ")
    );
  }

  return await criarModelo(resultado.data);
}

export async function atualizar(id, dados) {
  const resultado = modeloTreinoUpdateSchema.safeParse(dados);

  if (!resultado.success) {
    throw new Error(
      resultado.error.issues.map(item => item.message).join(", ")
    );
  }

  return await atualizarModelo(id, resultado.data);
}

export async function excluir(id) {
  return await excluirModelo(id);
}
