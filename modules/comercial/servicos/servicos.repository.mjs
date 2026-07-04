import { lerJson, salvarJson } from "../base.repository.mjs";
const ARQUIVO = "comercial_servicos.json";
export async function listarTodosServicos() { return lerJson(ARQUIVO, []); }
export async function salvarTodosServicos(lista) { await salvarJson(ARQUIVO, lista); return lista; }
export async function buscarServico(id) { return (await listarTodosServicos()).find(s => String(s.id) === String(id)) || null; }
