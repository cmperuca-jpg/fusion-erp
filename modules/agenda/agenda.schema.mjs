import { z } from "zod";

export const agendaSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  tipo: z.string().optional(),
  data: z.string().min(1, "Data obrigatória"),
  hora_inicio: z.string().min(1, "Hora inicial obrigatória"),
  hora_fim: z.string().optional(),

  aluno_id: z.string().optional(),
  professor_id: z.string().optional(),

  local: z.string().optional(),
  status: z.string().default("agendado"),
  recorrencia: z.string().optional(),
  observacoes: z.string().optional()
});

export const agendaUpdateSchema = agendaSchema.partial();
