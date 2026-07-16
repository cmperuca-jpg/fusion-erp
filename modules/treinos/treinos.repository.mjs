import { lerColecao, salvarColecao } from "../core/persistence/collection-store.mjs";

export async function listarBiblioteca() {
  return await lerColecao("treinos_exercicios", { grupos: [], objetivos: [], exercicios: [] });
}

export async function listarTreinos() {
  const prescritos = await lerColecao("treinos_prescritos", []);
  if (Array.isArray(prescritos) && prescritos.length) return prescritos;

  // Compatibilidade com treinos criados pelo montador V3 e pelo reset-modelo.
  const integrados = await lerColecao("treinos_integrados", []);
  return Array.isArray(integrados) ? integrados : [];
}

export async function salvarTreinos(treinos) {
  return await salvarColecao("treinos_prescritos", Array.isArray(treinos) ? treinos : []);
}
