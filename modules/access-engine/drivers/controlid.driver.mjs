import { criarRespostaNaoImplementado } from './sdk-legacy.adapter.mjs';

const FABRICANTE = 'controlid';

export async function status({ dispositivo } = {}) {
  return criarRespostaNaoImplementado({ fabricante: FABRICANTE, dispositivo, acao: 'status' });
}

export async function liberar({ aluno, dispositivo, direcao = 'entrada' } = {}) {
  return {
    ...criarRespostaNaoImplementado({ fabricante: FABRICANTE, dispositivo, acao: 'liberar' }),
    alunoId: aluno?.id || null,
    direcao
  };
}

export async function bloquear({ aluno, dispositivo, motivo = 'Acesso bloqueado', direcao = 'entrada' } = {}) {
  return {
    ...criarRespostaNaoImplementado({ fabricante: FABRICANTE, dispositivo, acao: 'bloquear' }),
    alunoId: aluno?.id || null,
    motivo,
    direcao
  };
}
