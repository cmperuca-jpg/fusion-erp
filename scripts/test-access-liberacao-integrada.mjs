import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NODE_ENV = 'development';
process.env.FUSION_DATABASE_PROVIDER = 'json';
process.env.FUSION_JSON_FALLBACK = 'true';
process.env.FUSION_TENANT_ID = 'academia-piloto';
process.env.ACCESS_AGENT_ID = 'academia-piloto-agent-01';
process.env.ACCESS_AGENT_TENANT_ID = 'academia-piloto';
process.env.ACCESS_EQUIPMENT_ID = 'catraca-piloto-01';
process.env.ACCESS_EQUIPMENT_IDS = 'catraca-piloto-01';
process.env.ACCESS_AGENT_TOKEN = `tok_${crypto.randomBytes(24).toString('hex')}`;
process.env.ACCESS_AGENT_REQUIRE_EQUIPMENT_HEADER = 'true';
process.env.ACCESS_AGENT_MAX_CLOCK_SKEW_MS = '300000';

const raiz = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-access-release-'));
const data = path.join(temporario, 'data');
await fs.mkdir(data, { recursive: true });

async function escrever(nome, valor) {
  await fs.writeFile(path.join(data, `${nome}.json`), JSON.stringify(valor, null, 2), 'utf8');
}

await escrever('alunos', [{
  id: 'aluno-integrado-01',
  nome: 'Aluno Integrado',
  cpf: '12345678901',
  numeroMatricula: 'MAT-INT-01',
  matriculaId: 'mat-integrada-01',
  status: 'Ativo',
  ativo: true
}]);
await escrever('matriculas', [{
  id: 'mat-integrada-01',
  alunoId: 'aluno-integrado-01',
  numero: 'MAT-INT-01',
  status: 'Ativa',
  dataMatricula: '2026-08-01',
  atualizadoEm: '2026-08-01T12:00:00.000Z'
}]);
await escrever('mensalidades', []);
await escrever('financeiro', []);
await escrever('access_dispositivos', [{
  id: 'catraca-piloto-01',
  nome: 'Catraca Piloto Henry 7X',
  fabricante: 'Henry',
  modelo: '7X',
  driver: 'henry7x',
  ip: '10.0.0.236',
  porta: '3000',
  sentido: 'entrada_saida',
  status: 'ativo'
}]);

process.chdir(temporario);

const {
  validateAgent,
  claimNext,
  finishCommand,
  saveHeartbeat,
  getCommand
} = await import('../modules/access-bridge/access-bridge.service.mjs');
const {
  avaliarAcesso,
  liberarRemoto,
  obterEstadoEntradaSaidaAluno,
  statusAgenteAcesso
} = await import('../modules/access-engine/access-engine.service.mjs');
const { executarComTenant } = await import('../modules/core/persistence/tenant-context.mjs');

function req(headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: name => lower[String(name).toLowerCase()] || '' };
}

function agentHeaders(overrides = {}) {
  return {
    'x-agent-id': process.env.ACCESS_AGENT_ID,
    'x-agent-token': process.env.ACCESS_AGENT_TOKEN,
    'x-agent-tenant-id': process.env.ACCESS_AGENT_TENANT_ID,
    'x-agent-equipment-id': process.env.ACCESS_EQUIPMENT_ID,
    'x-agent-timestamp': new Date().toISOString(),
    'x-agent-nonce': crypto.randomUUID(),
    ...overrides
  };
}

try {
  const avaliacao = await executarComTenant('academia-piloto', () => avaliarAcesso({
    identificador: 'MAT-INT-01',
    dispositivoId: 'catraca-piloto-01',
    direcao: 'entrada',
    origem: 'dashboard-entrada-rapida'
  }));

  assert.equal(avaliacao.ok, true);
  assert.equal(avaliacao.autorizado, true);
  assert.equal(avaliacao.catraca?.ok, true);
  assert.equal(avaliacao.catraca?.command?.tenantId, 'academia-piloto');
  assert.equal(avaliacao.catraca?.command?.equipmentId, 'catraca-piloto-01');
  assert.equal(avaliacao.catraca?.command?.payload?.host, '10.0.0.236');
  assert.equal(avaliacao.catraca?.command?.payload?.port, 3000);

  await assert.rejects(
    () => validateAgent(req(agentHeaders({ 'x-agent-equipment-id': 'catraca-outra' }))),
    error => error.status === 401 && /Equipamento do agente/.test(error.message)
  );

  const agent = await validateAgent(req(agentHeaders()));
  await saveHeartbeat(agent.agentId, {
    state: 'polling',
    tenantId: agent.tenantId,
    equipmentId: agent.equipmentId
  });

  const status = await statusAgenteAcesso();
  assert.equal(status.online, true);
  assert.equal(status.agentId, 'academia-piloto-agent-01');

  const claimed = await claimNext(agent.agentId);
  assert.equal(claimed?.id, avaliacao.catraca.commandId);
  assert.equal(claimed?.status, 'processing');
  assert.equal(await claimNext('outro-agent'), null);

  const finished = await finishCommand(claimed.id, agent.agentId, {
    ok: true,
    result: {
      liberado: true,
      driver: 'henry7x',
      origem: 'agente-simulado',
      equipamentoId: agent.equipmentId
    }
  });
  assert.equal(finished.status, 'completed');
  assert.equal(finished.result?.liberado, true);

  const final = await getCommand(claimed.id);
  assert.equal(final.status, 'completed');
  assert.equal(final.tenantId, 'academia-piloto');
  assert.equal(final.equipmentId, 'catraca-piloto-01');

  const logs = JSON.parse(await fs.readFile(path.join(data, 'access_logs.json'), 'utf8'));
  const presentes = JSON.parse(await fs.readFile(path.join(data, 'access_pessoas_presentes.json'), 'utf8'));
  assert.equal(logs[0]?.autorizado, true);
  assert.equal(logs[0]?.catraca?.commandId, claimed.id);
  assert.equal(presentes.some(item => item.alunoId === 'aluno-integrado-01'), true);

  const estadoAposEntrada = await executarComTenant(
    'academia-piloto',
    () => obterEstadoEntradaSaidaAluno('aluno-integrado-01')
  );

  assert.equal(estadoAposEntrada.presente, true);
  assert.equal(estadoAposEntrada.proximaDirecao, 'saida');

  // Mesmo que o cadastro fique bloqueado depois da entrada,
  // a saida fisica precisa continuar permitida.
  const alunosAntesSaida = JSON.parse(
    await fs.readFile(path.join(data, 'alunos.json'), 'utf8')
  );

  alunosAntesSaida[0] = {
    ...alunosAntesSaida[0],
    status: 'Bloqueado',
    bloqueado: true
  };

  await fs.writeFile(
    path.join(data, 'alunos.json'),
    JSON.stringify(alunosAntesSaida, null, 2),
    'utf8'
  );

  const saidaAutomatica = await executarComTenant(
    'academia-piloto',
    () => liberarRemoto({
      alunoId: 'aluno-integrado-01',
      alunoNome: 'Aluno Integrado',
      direcao: 'auto',
      origem: 'biometria-fs80'
    })
  );

  assert.equal(saidaAutomatica.autorizado, true);
  assert.equal(saidaAutomatica.direcao, 'saida');
  assert.equal(saidaAutomatica.presenteAntes, true);
  assert.equal(saidaAutomatica.presenteDepois, false);
  assert.equal(saidaAutomatica.proximaDirecao, 'entrada');

  const checkinsDepoisSaida = JSON.parse(
    await fs.readFile(path.join(data, 'checkin.json'), 'utf8')
  );

  const checkinsAluno = checkinsDepoisSaida.filter(
    item => item.alunoId === 'aluno-integrado-01'
  );

  assert.equal(checkinsAluno.length, 1);
  assert.ok(checkinsAluno[0]?.horaEntrada);
  assert.ok(checkinsAluno[0]?.horaSaida);

  const frontendCheckin = await fs.readFile(
    path.join(raiz, 'public/pages/checkin/checkin.js'),
    'utf8'
  );

  assert.equal(
    frontendCheckin.includes('/api/henry7x/liberar'),
    false
  );

  assert.equal(
    frontendCheckin.includes('/api/access-engine/liberar-remoto'),
    true
  );

  await assert.rejects(
    () => executarComTenant('outra-academia', () => liberarRemoto({ alunoId: 'aluno-integrado-01' })),
    error => error.status === 403 && /catraca fisica/.test(error.message)
  );

  console.log(JSON.stringify({
    ok: true,
    commandId: claimed.id,
    status: final.status,
    agentOnline: status.online,
    tenantId: final.tenantId,
    equipmentId: final.equipmentId
  }, null, 2));
} finally {
  process.chdir(raiz);
  await fs.rm(temporario, { recursive: true, force: true });
}
