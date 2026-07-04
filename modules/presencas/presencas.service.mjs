import { presencaSchema, presencaUpdateSchema } from "./presencas.schema.mjs";

import {
  listarPresencas,
  buscarPresenca,
  criarPresenca,
  atualizarPresenca,
  excluirPresenca
} from "./presencas.repository.mjs";

export async function listar(filtros = {}) {
  const presencas = await listarPresencas();

  return presencas.filter(presenca => {
    return (
      (!filtros.aluno_id || presenca.aluno_id === filtros.aluno_id) &&
      (!filtros.turma_id || presenca.turma_id === filtros.turma_id) &&
      (!filtros.professor_id || presenca.professor_id === filtros.professor_id) &&
      (!filtros.data || presenca.data === filtros.data) &&
      (!filtros.status || presenca.status === filtros.status)
    );
  });
}

export async function buscar(id) {
  return await buscarPresenca(id);
}

export async function criar(dados) {
  const resultado = presencaSchema.safeParse(dados);

  if (!resultado.success) {
    throw new Error(
      resultado.error.issues.map(item => item.message).join(", ")
    );
  }

  return await criarPresenca(resultado.data);
}

export async function atualizar(id, dados) {
  const resultado = presencaUpdateSchema.safeParse(dados);

  if (!resultado.success) {
    throw new Error(
      resultado.error.issues.map(item => item.message).join(", ")
    );
  }

  return await atualizarPresenca(id, resultado.data);
}

export async function excluir(id) {
  return await excluirPresenca(id);
}
