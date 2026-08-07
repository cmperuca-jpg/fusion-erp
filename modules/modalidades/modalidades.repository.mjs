import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQUIVO = "modalidades.json";

function listaSegura(dados) {
  return Array.isArray(dados) ? dados : [];
}

export async function listarModalidades() {
  return listaSegura(await lerJsonDuravel(ARQUIVO, []));
}

export async function salvarModalidades(modalidades) {
  const lista = listaSegura(modalidades);
  await salvarJsonDuravel(ARQUIVO, lista);
  return lista;
}

export async function buscarModalidadePorId(id) {
  const modalidades = await listarModalidades();
  return modalidades.find((item) => String(item.id) === String(id)) || null;
}
