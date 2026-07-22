import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const FREQUENCIA_COLLECTION = "frequencia.json";

export async function listarFrequencias() {
  const dados = await lerJsonDuravel(FREQUENCIA_COLLECTION, []);
  return Array.isArray(dados) ? dados : [];
}

export async function salvarFrequencias(lista = []) {
  await salvarJsonDuravel(FREQUENCIA_COLLECTION, Array.isArray(lista) ? lista : []);
}
