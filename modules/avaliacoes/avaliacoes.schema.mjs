import { z } from "zod";

const opcionalTexto = z.union([z.string(), z.number()]).optional().transform(v => v === undefined || v === null ? "" : String(v));

const baseAvaliacaoShape = {
  aluno_id: z.string().min(1, "Aluno obrigatório"),
  alunoId: z.string().optional().or(z.literal("")),
  alunoNome: opcionalTexto,
  professor_id: z.string().optional().or(z.literal("")),
  professorId: z.string().optional().or(z.literal("")),
  professorNome: opcionalTexto,
  data: opcionalTexto,
  hora: opcionalTexto,
  objetivo: opcionalTexto,
  observacoes: opcionalTexto,
  parq: z.array(z.any()).optional(),
  fotos: z.record(z.string(), z.any()).optional()
};

export const avaliacaoSchema = z.object(baseAvaliacaoShape).passthrough();
export const avaliacaoUpdateSchema = z.object({
  ...baseAvaliacaoShape,
  aluno_id: z.string().optional().or(z.literal(""))
}).partial().passthrough();
