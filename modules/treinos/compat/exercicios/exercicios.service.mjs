import { exercicioSchema, exercicioUpdateSchema } from "./exercicios.schema.mjs";

import {
  listarExercicios,
  buscarExercicio,
  criarExercicio,
  atualizarExercicio,
  excluirExercicio
} from "./exercicios.repository.mjs";

export async function listar() {
  return await listarExercicios();
}

export async function buscar(id) {
  return await buscarExercicio(id);
}

export async function criar(dados) {
  const resultado = exercicioSchema.safeParse(dados);

  if (!resultado.success) {
    throw new Error(
      resultado.error.issues.map(item => item.message).join(", ")
    );
  }

  return await criarExercicio(resultado.data);
}

export async function atualizar(id, dados) {
  const resultado = exercicioUpdateSchema.safeParse(dados);

  if (!resultado.success) {
    throw new Error(
      resultado.error.issues.map(item => item.message).join(", ")
    );
  }

  return await atualizarExercicio(id, resultado.data);
}

export async function excluir(id) {
  return await excluirExercicio(id);
}