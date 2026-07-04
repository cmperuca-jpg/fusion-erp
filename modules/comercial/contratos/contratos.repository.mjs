import { lerJson, salvarJson } from "../base.repository.mjs";
const ARQUIVO = "comercial_contratos.json";
export async function listarTodosContratos() { return lerJson(ARQUIVO, []); }
export async function salvarTodosContratos(lista) { await salvarJson(ARQUIVO, lista); return lista; }
export async function buscarContrato(id) { return (await listarTodosContratos()).find(c => String(c.id) === String(id)) || null; }
