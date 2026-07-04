import { avaliacaoSchema, avaliacaoUpdateSchema } from "./avaliacoes.schema.mjs";
import {
  listarAvaliacoes,
  listarPorAluno,
  buscarAvaliacao,
  criarAvaliacao,
  atualizarAvaliacao,
  excluirAvaliacao
} from "./avaliacoes.repository.mjs";

function mensagemValidacao(resultado) {
  return resultado.error.issues.map(item => item.message).join(", ");
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v ?? "").trim(); }
function numero(v) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function arred(v, casas = 2) { return Number(v || 0).toFixed(casas); }

function normalizar(dados = {}) {
  const d = { ...dados };
  d.aluno_id = texto(d.aluno_id || d.alunoId);
  d.professor_id = texto(d.professor_id || d.professorId);
  d.data = texto(d.data) || hojeISO();
  const peso = numero(d.peso);
  const altura = numero(d.altura);
  const gordura = numero(d.percentual_gordura);
  if (peso > 0 && altura > 0 && !texto(d.imc)) d.imc = arred(peso / (altura * altura), 2);
  if (peso > 0 && gordura > 0) {
    const massaGorda = peso * (gordura / 100);
    if (!texto(d.massa_gorda)) d.massa_gorda = arred(massaGorda, 2);
    if (!texto(d.massa_magra)) d.massa_magra = arred(peso - massaGorda, 2);
  }
  const cintura = numero(d.rcq_cintura || d.cintura);
  const quadril = numero(d.rcq_quadril || d.quadril);
  if (cintura > 0 && quadril > 0 && !texto(d.rcq)) d.rcq = arred(cintura / quadril, 2);
  if (peso > 0 && !texto(d.tmb)) d.tmb = String(Math.round(22 * peso));
  return d;
}

export async function listar(alunoId) {
  if (alunoId) return await listarPorAluno(alunoId);
  return await listarAvaliacoes();
}

export async function buscar(id) {
  return await buscarAvaliacao(id);
}

export async function criar(dados) {
  const normalizado = normalizar(dados);
  const resultado = avaliacaoSchema.safeParse(normalizado);
  if (!resultado.success) throw new Error(mensagemValidacao(resultado));
  return await criarAvaliacao(resultado.data);
}

export async function atualizar(id, dados) {
  const normalizado = normalizar(dados);
  const resultado = avaliacaoUpdateSchema.safeParse(normalizado);
  if (!resultado.success) throw new Error(mensagemValidacao(resultado));
  return await atualizarAvaliacao(id, resultado.data);
}

export async function excluir(id) {
  return await excluirAvaliacao(id);
}
