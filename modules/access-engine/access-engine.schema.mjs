import { z } from 'zod';

const texto = z.string().optional().or(z.literal(''));

export const dispositivoSchema = z.object({
  id: texto,
  nome: z.string().min(2, 'Nome do equipamento obrigatório'),
  fabricante: texto.default('Simulador'),
  modelo: texto.default('Genérico'),
  driver: texto.default('simulador'),
  ip: texto,
  porta: texto,
  sentido: texto.default('entrada_saida'),
  status: texto.default('ativo')
});

export const simulacaoSchema = z.object({
  identificador: z.string().min(1, 'Informe matrícula, CPF, cartão, RFID ou nome do aluno.'),
  dispositivoId: texto,
  direcao: texto.default('entrada'),
  origem: texto.default('simulador')
});
