import { lerColecao, salvarColecao } from "../core/persistence/collection-store.mjs";

const COLECAO = "treinos_equipamentos_academia";

export async function lerEquipamentosAcademia() {
  const dados = await lerColecao(COLECAO, {
    schemaVersion: 1,
    selecionados: [],
    atualizadoEm: null,
    atualizadoPor: null
  });

  return dados && typeof dados === "object" && !Array.isArray(dados)
    ? dados
    : {
        schemaVersion: 1,
        selecionados: [],
        atualizadoEm: null,
        atualizadoPor: null
      };
}

export async function salvarEquipamentosAcademia(dados = {}) {
  return await salvarColecao(COLECAO, dados);
}
