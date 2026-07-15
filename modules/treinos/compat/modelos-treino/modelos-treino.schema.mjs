import { z } from "zod";

const exercicioModeloSchema = z.object({
  exercicio_id: z.string(),
  ordem: z.number(),
  series: z.number().optional(),
  repeticoes: z.string().optional(),
  carga: z.string().optional(),
  descanso: z.string().optional(),
  cadencia: z.string().optional(),
  observacoes: z.string().optional()
});

export const modeloTreinoSchema = z.object({
  nome: z.string().min(2, "Nome do modelo obrigatório"),
  objetivo: z.string().optional(),
  categoria: z.string().optional(),
  nivel: z.string().optional(),
  status: z.string().default("ativo"),
  descricao: z.string().optional(),
  exercicios: z.array(exercicioModeloSchema).default([])
});

export const modeloTreinoUpdateSchema = modeloTreinoSchema.partial();
