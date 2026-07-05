import { z } from "zod";

const textoOpcional = z.string().optional().or(z.literal(""));
const dataOpcional = z.string().optional().or(z.literal(""));

export const exercicioTreinoSchema = z.object({
  id: textoOpcional,
  exercicioId: textoOpcional,
  exercicio_id: textoOpcional,
  nome: z.string().min(1, "Nome do exercício obrigatório"),
  grupoMuscular: textoOpcional,
  ordem: z.number().optional().or(z.string().optional()).or(z.literal("")),
  series: z.string().min(1, "Séries obrigatórias"),
  repeticoes: z.string().min(1, "Repetições obrigatórias"),
  carga: textoOpcional,
  descanso: textoOpcional,
  cadencia: textoOpcional,
  tempo: textoOpcional,
  observacoes: textoOpcional,
  obs: textoOpcional
});

export const treinoSchema = z.object({
  id: textoOpcional,

  alunoId: z.string().min(1, "Aluno obrigatório"),
  aluno_id: textoOpcional,
  alunoNome: textoOpcional,

  professorId: z.string().min(1, "Professor obrigatório"),
  professor_id: textoOpcional,
  professorNome: textoOpcional,

  nome: textoOpcional,
  objetivo: z.string().min(1, "Objetivo obrigatório"),
  nivel: textoOpcional,
  divisao: textoOpcional,
  status: z.string().optional().default("ativo"),

  dataInicio: z.string().min(1, "Data de início obrigatória"),
  data_inicio: dataOpcional,
  dataValidade: z.string().min(1, "Data de validade obrigatória"),
  data_validade: dataOpcional,

  observacoes: textoOpcional,
  origem: textoOpcional,
  versaoOrigemId: textoOpcional,

  exercicios: z.array(exercicioTreinoSchema).min(1, "Informe ao menos um exercício")
});

export const treinoUpdateSchema = treinoSchema.partial().extend({
  exercicios: z.array(exercicioTreinoSchema).optional()
});

export function normalizarTreino(dados = {}) {
  const alunoId = String(dados.alunoId || dados.aluno_id || "").trim();
  const professorId = String(dados.professorId || dados.professor_id || "").trim();
  const dataInicio = String(dados.dataInicio || dados.data_inicio || "").trim();
  const dataValidade = String(dados.dataValidade || dados.data_validade || "").trim();

  const exercicios = Array.isArray(dados.exercicios)
    ? dados.exercicios.map((ex, index) => ({
        id: ex.id || ex.exercicioId || ex.exercicio_id || `ex_${Date.now()}_${index}`,
        exercicioId: ex.exercicioId || ex.exercicio_id || ex.id || "",
        nome: String(ex.nome || ex.exercicio || "").trim(),
        grupoMuscular: ex.grupoMuscular || ex.grupo_muscular || "",
        ordem: ex.ordem ?? index + 1,
        series: String(ex.series || "").trim(),
        repeticoes: String(ex.repeticoes || ex.reps || "").trim(),
        carga: String(ex.carga || "").trim(),
        descanso: String(ex.descanso || "").trim(),
        cadencia: String(ex.cadencia || "").trim(),
        tempo: String(ex.tempo || "").trim(),
        observacoes: String(ex.observacoes || ex.obs || "").trim(),
        obs: String(ex.obs || ex.observacoes || "").trim()
      }))
    : [];

  return {
    ...dados,
    alunoId,
    aluno_id: alunoId,
    alunoNome: dados.alunoNome || dados.aluno || "",
    professorId,
    professor_id: professorId,
    professorNome: dados.professorNome || dados.professor || "",
    nome: dados.nome || `Treino ${dados.objetivo || "do aluno"}`,
    objetivo: String(dados.objetivo || "").trim(),
    status: String(dados.status || "ativo").toLowerCase(),
    dataInicio,
    data_inicio: dataInicio,
    dataValidade,
    data_validade: dataValidade,
    exercicios
  };
}
