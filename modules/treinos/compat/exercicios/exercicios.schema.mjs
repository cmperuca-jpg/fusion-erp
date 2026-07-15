import { z } from "zod";

export const exercicioSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  grupo_muscular: z.string().optional(),
  equipamento: z.string().optional(),
  dificuldade: z.string().optional(),
  tipo: z.string().optional(),
  descricao: z.string().optional(),
  execucao: z.string().optional(),
  musculos_envolvidos: z.string().optional(),
  video_url: z.string().optional(),
  imagem_base64: z.string().optional(),
  status: z.string().default("ativo")
});

export const exercicioUpdateSchema = exercicioSchema.partial();