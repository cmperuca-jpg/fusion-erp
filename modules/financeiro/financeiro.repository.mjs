import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

export async function listarLancamentos() {
  return lerJsonDuravel("financeiro.json", []);
}

export async function salvarLancamentos(lancamentos) {
  await salvarJsonDuravel("financeiro.json", lancamentos);
  return lancamentos;
}

export async function buscarLancamentoPorId(id) {
  const lancamentos = await listarLancamentos();
  return lancamentos.find((item) => String(item.id) === String(id)) || null;
}
