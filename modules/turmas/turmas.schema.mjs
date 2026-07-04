import { z } from "zod";

export const turmaSchema = z.object({
  nome: z.string().min(2, "Nome da turma obrigatório"),
  modalidade: z.string().optional(),
  professor_id: z.string().optional(),

  dias_semana: z.string().optional(),
  hora_inicio: z.string().optional(),
  hora_fim: z.string().optional(),

  capacidade: z.string().optional(),
  sala_local: z.string().optional(),

  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),

  status: z.string().default("ativa"),
  observacoes: z.string().optional()
});

export const turmaUpdateSchema = turmaSchema.partial();
