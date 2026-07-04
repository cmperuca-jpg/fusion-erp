import { z } from 'zod';

const texto = z.string().optional().or(z.literal(''));
const listaTexto = z.array(z.string()).optional().default([]);

export const professorSchema = z.object({
  nome: z.string().min(3, 'Nome obrigatório'),
  cpf: texto,
  rg: texto,
  cref: texto,
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: texto,
  whatsapp: texto,
  dataNascimento: texto,
  especialidade: texto,
  especialidades: listaTexto,
  modalidades: listaTexto,
  diasTrabalho: listaTexto,
  horarioInicio: texto,
  horarioFim: texto,
  tipoContrato: texto,
  valorHora: z.number().optional().or(z.string().optional()).or(z.literal('')),
  banco: texto,
  agencia: texto,
  conta: texto,
  chavePix: texto,
  endereco: texto,
  observacoes: texto,
  documentos: z.array(z.object({ nome: texto, tipo: texto, arquivo_base64: texto })).optional().default([]),
  status: z.string().optional().default('Ativo'),
  senha: texto
});

export const professorUpdateSchema = professorSchema.partial();
