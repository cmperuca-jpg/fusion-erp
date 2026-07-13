import { z } from "zod";

const opcionalTexto = z.string().optional().or(z.literal(""));

export const alunoSchema = z.object({
  nome: z.string().min(3, "Nome obrigatório"),

  cpf: opcionalTexto,
  rg: opcionalTexto,
  data_nascimento: opcionalTexto,
  sexo: opcionalTexto,
  estado_civil: opcionalTexto,
  nacionalidade: opcionalTexto,
  profissao: opcionalTexto,

  cep: opcionalTexto,
  endereco: opcionalTexto,
  numero: opcionalTexto,
  complemento: opcionalTexto,
  bairro: opcionalTexto,
  cidade: opcionalTexto,
  estado: opcionalTexto,

  telefone: opcionalTexto,
  whatsapp: opcionalTexto,
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  contato_emergencia: opcionalTexto,
  responsavel: opcionalTexto,

  tipo_sanguineo: opcionalTexto,
  alergias: opcionalTexto,
  restricoes_medicas: opcionalTexto,
  medicamentos: opcionalTexto,
  lesoes: opcionalTexto,

  plano: opcionalTexto,
  planoId: opcionalTexto,
  valorMensal: z.number().optional().or(z.string().optional()).or(z.literal("")),
  taxaMatricula: z.number().optional().or(z.string().optional()).or(z.literal("")),
  matriculaId: opcionalTexto,
  numeroMatricula: opcionalTexto,
  statusMatricula: opcionalTexto,
  professor_responsavel: opcionalTexto,
  professorId: opcionalTexto,
  professorNome: opcionalTexto,
  data_matricula: opcionalTexto,
  objetivo: opcionalTexto,
  status: z.string().optional().default("inativo"),

  foto: opcionalTexto,
  foto_base64: opcionalTexto,

  documentos: z.array(
    z.object({
      nome: opcionalTexto,
      tipo: opcionalTexto,
      arquivo: opcionalTexto,
      arquivo_base64: opcionalTexto
    })
  ).optional(),

  possuiBiometria: z.boolean().optional(),
  biometriaId: opcionalTexto,
  biometriaStatus: opcionalTexto,
  biometriaCadastradaEm: opcionalTexto,
  biometriaAtualizadaEm: opcionalTexto,

  observacoes: opcionalTexto
});

export const alunoUpdateSchema = alunoSchema.partial();
