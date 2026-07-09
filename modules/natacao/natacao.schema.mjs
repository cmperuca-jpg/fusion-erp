import { z } from "zod";

export const natacaoResultadoSchema = z.object({
  alunoId: z.string().min(1).optional(),
  aluno: z.string().optional(),
  tempoMs: z.number().optional(),
  tempo: z.string().optional(),
  parciais: z.array(z.any()).optional()
}).passthrough();

export const natacaoSessaoSchema = z.object({
  professorId: z.string().optional(),
  professor: z.string().optional(),
  distancia: z.string().default("Livre"),
  estilo: z.string().default("Livre"),
  piscina: z.string().optional(),
  observacao: z.string().optional(),
  resultados: z.array(natacaoResultadoSchema).optional()
}).passthrough();
