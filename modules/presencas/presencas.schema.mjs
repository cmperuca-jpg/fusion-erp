import { z } from "zod";

export const presencaSchema = z.object({
  aluno_id: z.string().min(1, "Aluno obrigatório"),
  turma_id: z.string().optional(),
  professor_id: z.string().optional(),
  matricula_id: z.string().optional(),

  data: z.string().min(1, "Data obrigatória"),
  hora_entrada: z.string().min(1, "Hora de entrada obrigatória"),
  hora_saida: z.string().optional(),

  tipo: z.string().default("manual"),
  status: z.string().default("presente"),
  responsavel: z.string().optional(),
  observacoes: z.string().optional()
});

export const presencaUpdateSchema = presencaSchema.partial();
