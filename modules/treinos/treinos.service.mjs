import { treinoSchema, treinoUpdateSchema, normalizarTreino } from "./treinos.schema.mjs";
import {
  listarTreinos,
  buscarTreino,
  criarTreino,
  atualizarTreino,
  excluirTreino
} from "./treinos.repository.mjs";

function erroValidacao(resultado) {
  return resultado.error.issues.map((item) => item.message).join(", ");
}

function texto(v) {
  return String(v || "").trim();
}

function normalizarStatus(status) {
  return texto(status || "ativo").toLowerCase();
}

function statusCalculado(treino = {}) {
  const status = normalizarStatus(treino.status);
  if (["cancelado", "inativo", "arquivado"].includes(status)) return "cancelado";
  const validade = texto(treino.dataValidade || treino.data_validade);
  if (validade && validade < new Date().toISOString().slice(0, 10)) return "vencido";
  return "ativo";
}

function filtrar(lista, filtros = {}) {
  let saida = [...lista];
  const alunoId = texto(filtros.alunoId || filtros.aluno_id);
  const professorId = texto(filtros.professorId || filtros.professor_id);
  const status = texto(filtros.status).toLowerCase();
  const busca = texto(filtros.busca || filtros.q).toLowerCase();

  if (alunoId) saida = saida.filter((t) => texto(t.alunoId || t.aluno_id) === alunoId);
  if (professorId) saida = saida.filter((t) => texto(t.professorId || t.professor_id) === professorId);
  if (status) saida = saida.filter((t) => statusCalculado(t) === status);
  if (busca) {
    saida = saida.filter((t) => [
      t.alunoNome,
      t.professorNome,
      t.objetivo,
      t.nome,
      t.observacoes,
      ...(Array.isArray(t.exercicios) ? t.exercicios.map((ex) => `${ex.nome} ${ex.grupoMuscular}`) : [])
    ].join(" ").toLowerCase().includes(busca));
  }

  return saida.sort((a, b) => texto(b.criadoEm || b.dataInicio).localeCompare(texto(a.criadoEm || a.dataInicio)));
}

export async function listar(filtros = {}) {
  const lista = await listarTreinos();
  return filtrar(lista, filtros).map((treino) => ({ ...treino, statusCalculado: statusCalculado(treino) }));
}

export async function buscar(id) {
  const treino = await buscarTreino(id);
  return treino ? { ...treino, statusCalculado: statusCalculado(treino) } : null;
}

export async function criar(dados) {
  const normalizado = normalizarTreino(dados);
  const resultado = treinoSchema.safeParse(normalizado);
  if (!resultado.success) throw new Error(erroValidacao(resultado));
  return await criarTreino(resultado.data);
}

export async function atualizar(id, dados) {
  const anterior = await buscarTreino(id);
  if (!anterior) return null;
  const normalizado = normalizarTreino({ ...anterior, ...dados, id });
  const resultado = treinoUpdateSchema.safeParse(normalizado);
  if (!resultado.success) throw new Error(erroValidacao(resultado));
  return await atualizarTreino(id, resultado.data);
}

export async function excluir(id, usuario = "sistema") {
  return await excluirTreino(id, usuario);
}
