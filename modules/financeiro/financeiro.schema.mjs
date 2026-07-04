import { z } from "zod";

export const financeiroSchema = z.object({
  tipo: z.string().default("receber"),
  descricao: z.string().min(2, "Descrição obrigatória"),

  aluno_id: z.string().optional(),
  matricula_id: z.string().optional(),

  categoria: z.string().optional(),
  competencia: z.string().optional(),
  data_vencimento: z.string().optional(),
  data_pagamento: z.string().optional(),

  valor: z.string().optional(),
  valor_pago: z.string().optional(),
  forma_pagamento: z.string().optional(),

  status: z.string().default("pendente"),
  observacoes: z.string().optional()
});

export const financeiroUpdateSchema = financeiroSchema.partial();
