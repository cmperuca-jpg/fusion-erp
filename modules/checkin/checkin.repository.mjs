import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const CHECKIN_COLLECTION = "checkin.json";

export async function listarCheckins() {
  const dados = await lerJsonDuravel(CHECKIN_COLLECTION, []);
  return Array.isArray(dados) ? dados : [];
}

export async function salvarCheckins(checkins) {
  const lista = Array.isArray(checkins) ? checkins : [];
  await salvarJsonDuravel(CHECKIN_COLLECTION, lista);
  return lista;
}

export async function buscarCheckinPorId(id) {
  const checkins = await listarCheckins();
  return checkins.find((item) => String(item.id) === String(id)) || null;
}
