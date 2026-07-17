import crypto from "crypto";
import { listarPlanos, salvarPlanos, buscarPlanoPorId } from "./planos.repository.mjs";

function texto(valor) { return String(valor ?? "").trim(); }
function numero(valor, padrao = 0) { const n = Number(valor); return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao; }
function bool(valor, padrao = false) {
  if (valor === undefined || valor === null || valor === "") return padrao;
  if (typeof valor === "boolean") return valor;
  return ["true", "1", "sim", "s", "yes"].includes(String(valor).toLowerCase());
}
function lista(valor) {
  if (Array.isArray(valor)) return valor.map(texto).filter(Boolean);
  return texto(valor).split(",").map((v) => v.trim()).filter(Boolean);
}
function tipoPlano(valor) {
  const t = texto(valor || "Mensal");
  const n = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("pre")) return "Pré-pago";
  if (n.includes("diar")) return "Diarista";
  if (n.includes("semes")) return "Semestral";
  if (n.includes("anual")) return "Anual";
  return "Mensal";
}
function mesesPorTipo(tipo) {
  if (tipo === "Semestral") return 6;
  if (tipo === "Anual") return 12;
  if (tipo === "Mensal") return 1;
  return 0;
}
function validarPayload(payload = {}) {
  const nome = texto(payload.nome);
  if (!nome) throw new Error("O nome do plano é obrigatório.");

  const tipo = tipoPlano(payload.tipoPlano || payload.tipo);
  const recorrenciaMeses = numero(payload.recorrenciaMeses ?? payload.fidelidadeMeses ?? mesesPorTipo(tipo), mesesPorTipo(tipo));
  const cobraMatricula = payload.cobraMatricula !== undefined ? bool(payload.cobraMatricula) : !["Pré-pago", "Diarista"].includes(tipo);
  const geraMensalidade = payload.geraMensalidade !== undefined ? bool(payload.geraMensalidade) : ["Mensal", "Semestral", "Anual"].includes(tipo);

  return {
    nome,
    tipo,
    tipoPlano: tipo,
    descricao: texto(payload.descricao),
    valorMatricula: numero(payload.valorMatricula ?? payload.valorBaseMatricula ?? payload.taxaMatricula ?? 0),
    valorMensal: numero(payload.valorMensal ?? 0),
    taxaMatricula: numero(payload.taxaMatricula ?? payload.valorMatricula ?? 0),
    cobraMatricula,
    geraMensalidade,
    recorrenciaMeses,
    renovacaoAutomatica: bool(payload.renovacaoAutomatica, tipo === "Mensal"),
    bloquearAoVencer: bool(payload.bloquearAoVencer, ["Semestral", "Anual", "Pré-pago", "Diarista"].includes(tipo)),
    permiteServicosExtras: bool(payload.permiteServicosExtras, true),
    fidelidadeMeses: numero(payload.fidelidadeMeses ?? recorrenciaMeses, recorrenciaMeses),
    descontoPercentual: numero(payload.descontoPercentual, 0),
    multaAtrasoPercentual: numero(payload.multaAtrasoPercentual, 0),
    limiteSemanal: numero(payload.limiteSemanal, 0),
    modalidadesIncluidas: lista(payload.modalidadesIncluidas),
    horariosPermitidos: texto(payload.horariosPermitidos) || "Livre",
    status: texto(payload.status) || "Ativo"
  };
}
export async function obterPlanos(filtros = {}) {
  let planos = await listarPlanos();
  const termo = texto(filtros.q || filtros.busca).toLowerCase();
  const status = texto(filtros.status);
  const tipo = texto(filtros.tipo || filtros.tipoPlano);
  planos = planos.map((p) => ({ ...validarPayload(p), id: p.id, criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm }));
  if (termo) planos = planos.filter((p) => [p.nome,p.tipo,p.descricao,p.horariosPermitidos,...(p.modalidadesIncluidas||[])].join(" ").toLowerCase().includes(termo));
  if (status && status !== "Todos") planos = planos.filter((p) => p.status === status);
  if (tipo && tipo !== "Todos") planos = planos.filter((p) => p.tipo === tipo || p.tipoPlano === tipo);
  return planos;
}
export async function criarPlano(payload) {
  const planos = await listarPlanos();
  const novo = { id: crypto.randomUUID(), ...validarPayload(payload), criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() };
  planos.push(novo); await salvarPlanos(planos); return novo;
}
export async function atualizarPlano(id, payload) {
  const planos = await listarPlanos();
  const i = planos.findIndex((p) => String(p.id) === String(id));
  if (i === -1) throw new Error("Plano não encontrado.");
  planos[i] = { ...planos[i], ...validarPayload(payload), atualizadoEm: new Date().toISOString() };
  await salvarPlanos(planos); return planos[i];
}
export async function removerPlano(id) {
  const planos = await listarPlanos(); const existe = await buscarPlanoPorId(id);
  if (!existe) throw new Error("Plano não encontrado.");
  await salvarPlanos(planos.filter((p) => String(p.id) !== String(id))); return { removido: true };
}
export async function obterResumoPlanos() {
  const planos = await obterPlanos(); const ativos = planos.filter((p) => p.status === "Ativo");
  return { total: planos.length, ativos: ativos.length, inativos: planos.length - ativos.length, receitaBaseMatriculas: ativos.reduce((t,p)=>t+numero(p.valorMatricula),0) };
}
