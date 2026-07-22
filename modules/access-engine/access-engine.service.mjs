import { dispositivoSchema, simulacaoSchema } from './access-engine.schema.mjs';
import * as repo from './access-engine.repository.mjs';
import * as simulador from './drivers/simulador.driver.mjs';
import { listarDrivers, obterDriver } from './drivers/driver-registry.mjs';
import { mapaLegado } from './drivers/sdk-legacy.adapter.mjs';
import { queueRelease, getAgent, getCommand } from '../access-bridge/access-bridge.service.mjs';


const HENRY_PADRAO = {
  host: process.env.HENRY7X_HOST || '10.0.0.236',
  port: Number(process.env.HENRY7X_PORT || 3000),
  tempoSegundos: Number(process.env.HENRY7X_TEMPO_SEGUNDOS || 5)
};

async function enfileirarLiberacaoRemota({ aluno, dispositivo, direcao = 'entrada', origem = 'access-engine', operadorId = null, motivo = 'liberacao-autorizada' } = {}) {
  const command = await queueRelease({
    agentId: process.env.ACCESS_AGENT_ID || 'academia-01',
    equipmentId: dispositivo?.id || 'catraca-01',
    host: String(dispositivo?.ip || HENRY_PADRAO.host).trim(),
    port: Number(dispositivo?.porta || HENRY_PADRAO.port),
    tempoSegundos: Number(HENRY_PADRAO.tempoSegundos),
    direcao: direcao === 'saida' ? 'saida' : 'ambos',
    alunoId: aluno?.id || aluno?._id || aluno?.alunoId || null,
    alunoNome: aluno?.nome || null,
    operadorId,
    origem,
    motivo,
    ttlSeconds: 30
  });
  return { ok: true, modo: 'access-bridge', status: command.status, commandId: command.id, command };
}

function statusAtivo(valor) {
  const n = repo.normalizar(valor);
  return ['ativo', 'ativa', 'ok', 'liberado', 'adimplente'].includes(n);
}

function statusBloqueado(valor) {
  const n = repo.normalizar(valor);
  return ['bloqueado', 'bloqueada', 'cancelado', 'cancelada', 'inativo', 'inativa', 'suspenso', 'suspensa'].includes(n);
}

function vencida(m = {}) {
  const status = repo.normalizar(m.status || m.situacao || m.estado || '');
  if (['vencida', 'vencido', 'atrasada', 'atrasado', 'em atraso', 'inadimplente'].includes(status)) return true;
  const venc = m.vencimento || m.dataVencimento || m.data_vencimento;
  if (!venc) return false;
  const pago = ['pago', 'paga', 'recebido', 'recebida', 'baixado', 'baixada', 'quitado', 'quitada', 'liquidado', 'liquidada', 'cancelado', 'cancelada', 'isento', 'isenta']
    .includes(repo.normalizar(m.statusPagamento || m.pagamento || m.status || m.situacao || m.estado || ''));
  if (pago) return false;
  const d = new Date(venc);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d < hoje;
}

function chavesAluno(aluno = {}) {
  const textos = [
    aluno.id, aluno._id, aluno.codigo, aluno.alunoId, aluno.aluno_id,
    aluno.matriculaId, aluno.numeroMatricula, aluno.matricula
  ].filter(Boolean).map((v) => String(v));
  const numeros = [
    aluno.cpf, aluno.telefone, aluno.whatsapp, aluno.celular,
    aluno.numeroMatricula, aluno.matricula
  ].map(repo.apenasNumeros).filter(Boolean);

  return {
    textos: new Set([...textos, ...numeros]),
    nome: repo.normalizar(aluno.nome || aluno.nomeCompleto || aluno.alunoNome || aluno.aluno || '')
  };
}

function mensalidadeDoAluno(mensalidade = {}, chaves) {
  const campos = [
    mensalidade.alunoId, mensalidade.aluno_id, mensalidade.pessoaId, mensalidade.clienteId,
    mensalidade.matriculaId, mensalidade.numeroMatricula, mensalidade.matricula,
    mensalidade.codigoAluno, mensalidade.codigo, mensalidade.cpf
  ];

  const bateTexto = campos
    .filter(Boolean)
    .some((v) => chaves.textos.has(String(v)) || chaves.textos.has(repo.apenasNumeros(v)));
  if (bateTexto) return true;

  const nome = repo.normalizar(mensalidade.alunoNome || mensalidade.aluno || mensalidade.nomeAluno || mensalidade.nome || '');
  return Boolean(nome && chaves.nome && nome === chaves.nome);
}

async function pendenciaFinanceiraAluno(aluno = {}) {
  const chaves = chavesAluno(aluno);
  const mensalidades = await repo.listarMensalidades();
  const pendencias = mensalidades
    .filter((m) => mensalidadeDoAluno(m, chaves))
    .filter(vencida)
    .sort((a, b) => String(a.vencimento || a.dataVencimento || a.data_vencimento || '').localeCompare(String(b.vencimento || b.dataVencimento || b.data_vencimento || '')));

  return pendencias[0] || null;
}

async function cobrancaDeAtivacaoPendente(aluno = {}, matricula = null) {
  const alunoId = String(aluno.id || aluno._id || '');
  const matriculaId = String(matricula?.id || aluno.matriculaId || '');
  const titulos = await repo.listarFinanceiro();
  return titulos.find((titulo = {}) => {
    const mesmoAluno = alunoId && String(titulo.alunoId || titulo.aluno_id || '') === alunoId;
    const mesmaMatricula = matriculaId && String(titulo.matriculaId || titulo.matricula_id || '') === matriculaId;
    if (!mesmoAluno && !mesmaMatricula) return false;
    const exigeAtivacao = titulo.ativarMatriculaAoReceber === true || repo.normalizar(titulo.origem).includes('reativacao');
    if (!exigeAtivacao) return false;
    const situacao = repo.normalizar(titulo.status || titulo.situacao || 'aberto');
    return !['pago', 'paga', 'recebido', 'recebida', 'baixado', 'baixada', 'quitado', 'quitada', 'cancelado', 'cancelada', 'estornado', 'estornada'].includes(situacao);
  }) || null;
}

function bloqueioManualAluno(aluno = {}, matricula = null) {
  if (aluno.bloqueado === true || aluno.bloqueioCheckin === true) return true;
  if (matricula?.bloqueada === true || matricula?.bloqueioCheckin === true) return true;
  if (statusBloqueado(aluno.situacao)) return true;
  if (!matricula && statusBloqueado(aluno.matriculaStatus)) return true;

  // Registros importados podem conservar ativo=false mesmo depois de uma
  // reativação paga. Nesse conflito, status=ativo + matrícula ativa é a fonte
  // mais recente; um false legado isolado não deve bloquear a catraca.
  if (aluno.ativo === false) {
    const cadastroAtivo = statusAtivo(aluno.status);
    const matriculaAtiva = statusAtivo(matricula?.status || aluno.statusMatricula || aluno.matriculaStatus);
    return !(cadastroAtivo && matriculaAtiva);
  }
  return false;
}

async function obterDispositivoOuPadrao(id) {
  if (id) {
    const encontrado = await repo.obterDispositivo(id);
    if (encontrado) return encontrado;
  }

  const lista = await repo.listarDispositivos();
  const henry = lista.find((d = {}) =>
    repo.normalizar(d.driver) === 'henry7x' ||
    (repo.normalizar(d.fabricante) === 'henry' && repo.normalizar(d.modelo).includes('7x'))
  );
  if (henry) return henry;

  return await repo.salvarDispositivo({
    id: id || 'disp_henry7x_01',
    nome: 'Catraca Henry 7X',
    fabricante: 'Henry',
    modelo: '7X',
    driver: 'henry7x',
    ip: HENRY_PADRAO.host,
    porta: String(HENRY_PADRAO.port),
    sentido: 'entrada_saida',
    status: 'ativo'
  });
}

export async function listarDriversDisponiveis() {
  return { ok: true, drivers: listarDrivers(), legado: mapaLegado() };
}

export async function listarDispositivos() {
  const lista = await repo.listarDispositivos();
  if (lista.length) return lista;
  return [await repo.salvarDispositivo({ nome: 'Catraca Simulador 01', fabricante: 'Simulador', modelo: 'Genérico', driver: 'simulador' })];
}

export async function salvarDispositivo(payload = {}) {
  const r = dispositivoSchema.safeParse(payload);
  if (!r.success) throw new Error(r.error.issues.map(i => i.message).join(', '));
  return await repo.salvarDispositivo(r.data);
}

export async function listarLogs(filtros = {}) {
  let logs = await repo.listarLogs();
  const limite = Number(filtros.limite || filtros.limit || 100);
  return logs.slice(0, Number.isFinite(limite) ? limite : 100);
}

export async function dashboard() {
  const [dispositivos, logs, presentes] = await Promise.all([listarDispositivos(), repo.listarLogs(), repo.listarPresentes()]);
  const hoje = new Date().toISOString().slice(0, 10);
  const logsHoje = logs.filter(l => String(l.criadoEm || '').startsWith(hoje));
  return {
    ok: true,
    resumo: {
      dispositivos: dispositivos.length,
      online: dispositivos.filter(d => repo.normalizar(d.status) === 'ativo').length,
      pessoasDentro: presentes.length,
      acessosHoje: logsHoje.length,
      liberadosHoje: logsHoje.filter(l => l.autorizado).length,
      bloqueadosHoje: logsHoje.filter(l => !l.autorizado).length
    },
    dispositivos,
    presentes,
    ultimosLogs: logs.slice(0, 20)
  };
}

async function executarAvaliacao({ aluno, identificador = '', dispositivoId = '', direcao = 'entrada', origem = 'simulador' } = {}) {
  const dispositivo = await obterDispositivoOuPadrao(dispositivoId || 'disp_henry7x_01');
  const matricula = aluno ? await repo.buscarMatriculaAtualDoAluno(aluno) : null;

  let autorizado = true;
  let motivo = 'Acesso liberado';
  const statusMatricula = matricula?.status || aluno?.statusMatricula || aluno?.matriculaStatus || '';

  if (!aluno) {
    autorizado = false;
    motivo = 'Aluno não encontrado';
  } else if (statusBloqueado(aluno.status) || statusBloqueado(statusMatricula)) {
    autorizado = false;
    motivo = 'Aluno ou matrícula bloqueada';
  } else if (!statusAtivo(statusMatricula || aluno.status || 'Ativa')) {
    autorizado = false;
    motivo = 'Matrícula pendente, cancelada ou inativa';
  }

  if (autorizado && aluno && bloqueioManualAluno(aluno, matricula)) {
    autorizado = false;
    motivo = 'Aluno ou matricula bloqueada';
  }

  if (autorizado && aluno) {
    const ativacaoPendente = await cobrancaDeAtivacaoPendente(aluno, matricula);
    if (ativacaoPendente) {
      autorizado = false;
      motivo = 'Pagamento de ativação ou reativação pendente';
    }
  }

  if (autorizado && aluno) {
    const pendencia = await pendenciaFinanceiraAluno(aluno);
    if (pendencia) {
      autorizado = false;
      motivo = `Pagamento em atraso${pendencia.vencimento ? ` desde ${pendencia.vencimento}` : ''}`;
    }
  }

  if (autorizado && aluno && matricula && aluno.ativo === false && statusAtivo(aluno.status) && statusAtivo(matricula.status)) {
    const regularizado = await repo.regularizarAlunoComMatriculaAtiva(aluno.id || aluno._id, matricula);
    if (regularizado) aluno = regularizado;
  }

  const driverInfo = obterDriver(dispositivo?.driver || 'henry7x');
  let driver = simulador;
  if (driverInfo.id !== 'simulador') {
    driver = await import(`./drivers/${driverInfo.id}.driver.mjs`).catch(() => simulador);
  }

  const comando = autorizado
    ? await driver.liberar({ aluno, dispositivo, direcao })
    : await driver.bloquear({ aluno, dispositivo, motivo, direcao });

  let catraca = null;
  if (autorizado && aluno) {
    try {
      catraca = await enfileirarLiberacaoRemota({ aluno, dispositivo, direcao, origem });
      if (catraca?.ok === false) throw new Error(catraca?.erro || 'Não foi possível criar o comando remoto.');
    } catch (erroCatraca) {
      autorizado = false;
      motivo = `Acesso aprovado, mas o comando não foi enfileirado: ${erroCatraca.message}`;
      catraca = { ok: false, erro: erroCatraca.message };
    }
  }

  const log = await repo.registrarLog({
    autorizado,
    motivo,
    direcao,
    origem,
    identificador,
    alunoId: aluno?.id || null,
    alunoNome: aluno?.nome || '',
    numeroMatricula: aluno?.numeroMatricula || '',
    matriculaId: matricula?.id || aluno?.matriculaId || '',
    dispositivoId: dispositivo?.id || '',
    dispositivoNome: dispositivo?.nome || '',
    driver: dispositivo?.driver || 'henry7x',
    fabricante: dispositivo?.fabricante || driverInfo.fabricante,
    protocolo: driverInfo.protocolo,
    comando,
    catraca
  });

  if (autorizado && aluno) await repo.marcarPresenca({ aluno, direcao, logId: log.id });
  return { ok: true, autorizado, motivo, aluno, matricula, dispositivo, driver: driverInfo, comando, catraca, log };
}

export async function avaliarAcessoAluno({ aluno, dispositivoId = 'disp_henry7x_01', direcao = 'entrada', origem = 'access-engine' } = {}) {
  return executarAvaliacao({
    aluno,
    identificador: String(aluno?.id || ''),
    dispositivoId,
    direcao: direcao === 'saida' ? 'saida' : 'entrada',
    origem
  });
}

export async function avaliarAcesso(payload = {}) {
  const r = simulacaoSchema.safeParse(payload);
  if (!r.success) throw new Error(r.error.issues.map(i => i.message).join(', '));
  const dados = r.data;
  const aluno = await repo.buscarAlunoPorIdentificador(dados.identificador);
  return executarAvaliacao({ aluno, ...dados });
}

export async function eventoHenry7x(payload = {}) {
  const identificador = payload.codigo || payload.cartao || payload.rfid || payload.tag || payload.matricula || payload.cpf || payload.identificador || '';
  const dispositivoId = payload.dispositivoId || payload.equipamentoId || payload.terminal || payload.ip || '';
  const direcao = payload.direcao || payload.sentido || 'entrada';

  const resultado = await avaliarAcesso({
    identificador,
    dispositivoId,
    direcao,
    origem: 'henry7x'
  });

  const driver = await import('./drivers/henry7x.driver.mjs');
  return driver.formatarRespostaPonte(resultado);
}

export async function statusHenry7x(query = {}) {
  const dispositivo = await obterDispositivoOuPadrao(query.dispositivoId || query.equipamentoId || '');
  const driver = await import('./drivers/henry7x.driver.mjs');
  return await driver.status({ dispositivo });
}


export async function testarTcpHenry7x(payload = {}) {
  const dispositivo = await obterDispositivoOuPadrao(payload.dispositivoId || payload.equipamentoId || 'disp_henry7x_01');
  const driver = await import('./drivers/henry7x.driver.mjs');
  const resultado = await driver.testarDispositivo({
    dispositivo: {
      ...dispositivo,
      ip: payload.ip || dispositivo.ip || '10.0.0.236',
      porta: payload.porta || dispositivo.porta || 3000
    },
    timeoutMs: payload.timeoutMs || 3500
  });
  await repo.registrarLog({
    autorizado: Boolean(resultado.conectado),
    motivo: resultado.mensagem,
    origem: 'henry7x_tcp_test',
    identificador: `${resultado.ip}:${resultado.porta}`,
    dispositivoId: dispositivo.id,
    dispositivoNome: dispositivo.nome,
    driver: 'henry7x',
    fabricante: 'Henry',
    protocolo: 'tcp/ip',
    comando: resultado
  });
  return resultado;
}

export async function diagnosticoRedeHenry7x(payload = {}) {
  const dispositivo = await obterDispositivoOuPadrao(payload.dispositivoId || payload.equipamentoId || 'disp_henry7x_01');
  const driver = await import('./drivers/henry7x.driver.mjs');
  const portas = Array.isArray(payload.portas) && payload.portas.length ? payload.portas : [3000, 80, 8080, 1001, 4370];
  const resultado = await driver.diagnosticoRede({
    dispositivo: {
      ...dispositivo,
      ip: payload.ip || dispositivo.ip || '10.0.0.236',
      porta: payload.porta || dispositivo.porta || 3000
    },
    portas,
    timeoutMs: payload.timeoutMs || 1800
  });
  await repo.registrarLog({
    autorizado: resultado.portasAbertas.length > 0,
    motivo: resultado.mensagem,
    origem: 'henry7x_diagnostico_rede',
    identificador: resultado.ip,
    dispositivoId: dispositivo.id,
    dispositivoNome: dispositivo.nome,
    driver: 'henry7x',
    fabricante: 'Henry',
    protocolo: 'tcp/ip',
    comando: resultado
  });
  return resultado;
}


export async function statusAgenteAcesso() {
  const agentId = process.env.ACCESS_AGENT_ID || 'academia-01';
  const agent = await getAgent(agentId);
  const ultimoContato = agent?.updatedAt || agent?.lastSeenAt || agent?.last_seen_at || null;
  const idadeMs = ultimoContato ? Date.now() - new Date(ultimoContato).getTime() : null;
  return {
    ok: true,
    agentId,
    online: Number.isFinite(idadeMs) && idadeMs <= 15000,
    ultimoContato,
    estado: agent?.state || agent?.status || 'offline',
    agent: agent || null
  };
}

export async function liberarRemoto(payload = {}) {
  const dispositivo = await obterDispositivoOuPadrao(payload.dispositivoId || 'disp_henry7x_01');
  const catraca = await enfileirarLiberacaoRemota({
    aluno: { id: payload.alunoId || null, nome: payload.alunoNome || 'Liberação manual' },
    dispositivo,
    direcao: payload.direcao || 'entrada',
    origem: payload.origem || 'painel-access-engine',
    operadorId: payload.operadorId || null,
    motivo: payload.motivo || 'liberacao-manual'
  });
  return { ok: true, mensagem: 'Comando enviado ao agente local.', catraca };
}

export async function consultarComandoRemoto(id) {
  const command = await getCommand(id);
  if (!command) {
    const erro = new Error('Comando não encontrado');
    erro.status = 404;
    throw erro;
  }
  return { ok: true, command };
}
