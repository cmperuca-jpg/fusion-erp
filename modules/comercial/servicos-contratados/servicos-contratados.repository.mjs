import { lerJson, salvarJson } from "../base.repository.mjs";
const ARQUIVO = "comercial_servicos_contratados.json";
export async function listarTodosServicosContratados() { return lerJson(ARQUIVO, []); }
export async function salvarTodosServicosContratados(lista) { await salvarJson(ARQUIVO, lista); return lista; }
export async function buscarServicoContratado(id) { return (await listarTodosServicosContratados()).find(s => String(s.id) === String(id)) || null; }
