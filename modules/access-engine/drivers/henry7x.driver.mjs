import net from 'node:net';

const FABRICANTE = 'Henry';
const MODELO = '7x';
const DRIVER = 'henry7x';

function agora() { return new Date().toISOString(); }
function numPorta(porta, padrao = 3000) {
  const n = Number(porta || padrao);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : padrao;
}
function texto(valor, padrao = '') { return String(valor ?? padrao).trim(); }

function respostaBase({ dispositivo, acao, direcao = 'entrada' } = {}) {
  return {
    ok: true,
    fabricante: FABRICANTE,
    modelo: MODELO,
    driver: DRIVER,
    acao,
    direcao,
    dispositivoId: dispositivo?.id || '',
    dispositivoNome: dispositivo?.nome || '',
    ip: texto(dispositivo?.ip),
    porta: numPorta(dispositivo?.porta),
    modo: 'tcp_ip_diagnostico',
    timestamp: agora()
  };
}

export async function testarTcp({ ip, porta = 3000, timeoutMs = 3500 } = {}) {
  const host = texto(ip);
  const port = numPorta(porta);
  const inicio = Date.now();

  if (!host) {
    return { ok: false, conectado: false, ip: host, porta: port, tempoMs: 0, mensagem: 'IP não informado.' };
  }

  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let finalizado = false;

    function finalizar(resultado) {
      if (finalizado) return;
      finalizado = true;
      try { socket.destroy(); } catch {}
      resolve({
        ok: true,
        ip: host,
        porta: port,
        tempoMs: Date.now() - inicio,
        timestamp: agora(),
        ...resultado
      });
    }

    socket.setTimeout(Number(timeoutMs) || 3500);
    socket.once('connect', () => finalizar({ conectado: true, mensagem: `Conexão TCP aberta com ${host}:${port}.` }));
    socket.once('timeout', () => finalizar({ conectado: false, erro: 'timeout', mensagem: `Sem resposta TCP em ${host}:${port}.` }));
    socket.once('error', (erro) => finalizar({ conectado: false, erro: erro.code || erro.message, mensagem: `Falha TCP em ${host}:${port}: ${erro.message}` }));
    socket.connect(port, host);
  });
}

export async function testarDispositivo({ dispositivo, timeoutMs = 3500 } = {}) {
  const ip = texto(dispositivo?.ip || '10.0.0.236');
  const porta = numPorta(dispositivo?.porta || 3000);
  const tcp = await testarTcp({ ip, porta, timeoutMs });
  return {
    ...respostaBase({ dispositivo, acao: 'tcp-test' }),
    ...tcp,
    protocoloIdentificado: false,
    observacao: tcp.conectado
      ? 'A porta TCP respondeu. Próxima etapa: mapear protocolo Henry ou ponte oficial Henry/SCA.'
      : 'A porta não respondeu. Confirme se o programa Henry está aberto e se a catraca aparece ONLINE.'
  };
}

export async function diagnosticoRede({ dispositivo, portas = [3000, 80, 8080, 1001, 4370], timeoutMs = 1800 } = {}) {
  const ip = texto(dispositivo?.ip || '10.0.0.236');
  const resultados = [];
  for (const porta of portas) {
    resultados.push(await testarTcp({ ip, porta, timeoutMs }));
  }
  return {
    ...respostaBase({ dispositivo, acao: 'diagnostico-rede' }),
    ip,
    portasTestadas: resultados,
    portasAbertas: resultados.filter(r => r.conectado).map(r => r.porta),
    mensagem: resultados.some(r => r.conectado)
      ? 'Diagnóstico concluído. Há pelo menos uma porta TCP respondendo.'
      : 'Nenhuma porta testada respondeu. Confirme IP, cabo/rede, firewall e programa Henry online.'
  };
}

export async function status({ dispositivo } = {}) {
  const temConfig = Boolean(dispositivo?.ip && dispositivo?.porta);
  return {
    ...respostaBase({ dispositivo, acao: 'status' }),
    conectado: false,
    configurado: temConfig,
    mensagem: temConfig
      ? 'Driver Henry 7x configurado. Use /tcp-test para validar a conexão TCP real.'
      : 'Driver Henry 7x sem IP/porta. Configure 10.0.0.236:3000 para o teste físico.'
  };
}

export async function liberar({ aluno, dispositivo, direcao = 'entrada' } = {}) {
  return {
    ...respostaBase({ dispositivo, acao: 'liberar', direcao }),
    autorizado: true,
    liberar: true,
    bloquear: false,
    tempoLiberacaoMs: 5000,
    alunoId: aluno?.id || null,
    alunoNome: aluno?.nome || '',
    comando: 'LIBERAR_GIRO_LOGICO',
    mensagem: 'Acesso autorizado pelo Fusion Access Engine. Comando físico ainda depende do protocolo Henry.'
  };
}

export async function bloquear({ aluno, dispositivo, motivo = 'Acesso bloqueado', direcao = 'entrada' } = {}) {
  return {
    ...respostaBase({ dispositivo, acao: 'bloquear', direcao }),
    autorizado: false,
    liberar: false,
    bloquear: true,
    alunoId: aluno?.id || null,
    alunoNome: aluno?.nome || '',
    comando: 'NEGAR_GIRO_LOGICO',
    motivo,
    mensagem: motivo
  };
}

export function formatarRespostaPonte(resultado = {}) {
  const autorizado = Boolean(resultado.autorizado);
  return {
    ok: true,
    protocolo: 'fusion-henry7x-http-bridge-v1',
    autorizado,
    liberar: autorizado,
    bloquear: !autorizado,
    comando: autorizado ? 'LIBERAR_GIRO_LOGICO' : 'NEGAR_GIRO_LOGICO',
    tempoLiberacaoMs: autorizado ? 5000 : 0,
    beep: autorizado ? 'curto' : 'longo',
    mensagemDisplay: autorizado ? 'ACESSO LIBERADO' : 'ACESSO BLOQUEADO',
    motivo: resultado.motivo || '',
    aluno: resultado.aluno ? {
      id: resultado.aluno.id || '',
      nome: resultado.aluno.nome || '',
      matricula: resultado.aluno.numeroMatricula || resultado.aluno.matriculaId || ''
    } : null,
    logId: resultado.log?.id || '',
    criadoEm: agora()
  };
}
