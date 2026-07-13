export async function liberar({ aluno, dispositivo, direcao = 'entrada', tempoLiberacao = 5 }) {
  return {
    ok: true,
    driver: 'simulador',
    liberado: true,
    tempoLiberacao,
    direcao,
    mensagem: `Simulador liberou ${direcao} para ${aluno?.nome || 'aluno'}.`,
    dispositivo: dispositivo?.nome || 'Catraca Simulador'
  };
}

export async function bloquear({ motivo = 'Acesso bloqueado', dispositivo }) {
  return {
    ok: true,
    driver: 'simulador',
    liberado: false,
    mensagem: motivo,
    dispositivo: dispositivo?.nome || 'Catraca Simulador'
  };
}
