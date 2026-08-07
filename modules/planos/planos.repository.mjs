import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQUIVO = "planos.json";

function listaSegura(dados) {
  return Array.isArray(dados) ? dados : [];
}

export async function listarPlanos() {
  return listaSegura(await lerJsonDuravel(ARQUIVO, []));
}

export async function salvarPlanos(planos) {
  const lista = listaSegura(planos);
  await salvarJsonDuravel(ARQUIVO, lista);
  return lista;
}

export async function buscarPlanoPorId(id) {
  const planos = await listarPlanos();
  return planos.find((item) => String(item.id) === String(id)) || null;
}
