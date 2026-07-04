import { z } from "zod";

export const matriculaSchema = z.object({
  aluno_id: z.string().min(1, "Aluno obrigatório"),
  plano_id: z.string().optional().or(z.literal("")),
  turma_id: z.string().optional().or(z.literal("")),

  data_matricula: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),

  plano: z.string().optional(),
  valor: z.string().optional(),
  forma_pagamento: z.string().optional(),

  status: z.string().default("ativa"),
  observacoes: z.string().optional()
});

export const matriculaUpdateSchema = matriculaSchema.partial();
