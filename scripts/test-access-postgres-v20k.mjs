import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const repo = await import('../modules/access-bridge/access-bridge.repository.mjs');
const edge = await import('../modules/access-bridge/access-edge-postgres.service.mjs');
const { obterPostgresPool, encerrarPostgres } = await import('../config/postgres.mjs');

const db = obterPostgresPool({ obrigatorio: true });

const token = 'token-v20k-teste';
const secretHash = crypto.createHash('sha256').update(token).digest('hex');

await repo.saveHeartbeat('agent-test', {
  tenantId: 'tenant-a',
  equipmentId: 'equip-1',
  equipmentIds: ['equip-1'],
  state: 'test'
});
await repo.saveEdgeDeviceCredential({
  agentId: 'agent-test',
  tenantId: 'tenant-a',
  equipmentId: 'equip-1',
  secretHash
});

const agent = await repo.getAgent('agent-test');
assert.equal(agent.tenant_id, 'tenant-a');

const command = await repo.createCommand({
  agentId: 'agent-test',
  tenantId: 'tenant-a',
  equipmentId: 'equip-1',
  action: 'release',
  payload: { alunoId: 'aluno-1' },
  expiresAt: new Date(Date.now() + 60000).toISOString()
});
assert.equal(command.status, 'pending');

const claimed = await repo.claimNext('agent-test', ['release']);
assert.equal(claimed?.id, command.id);
assert.equal(claimed?.status, 'processing');

const finished = await repo.finishCommand(command.id, 'agent-test', {
  ok: true,
  result: { liberado: true }
});
assert.equal(finished?.status, 'completed');

const now = new Date().toISOString();
const rows = [
  ['alunos','aluno-1',{id:'aluno-1',nome:'NAO_DEVE_SAIR',ativo:true,status:'ativo',cpf:'000'}],
  ['matriculas','mat-1',{id:'mat-1',alunoId:'aluno-1',status:'ativa'}],
  ['mensalidades','men-1',{id:'men-1',alunoId:'aluno-1',status:'pago',valor:100}],
  ['financeiro','fin-1',{id:'fin-1',alunoId:'aluno-1',status:'pago'}],
  ['usuarios','usr-1',{id:'usr-1',perfil:'Administrador',status:'ativo'}],
  ['professores','prof-1',{id:'prof-1',perfil:'Professor',status:'ativo'}],
  ['access_logs','log-1',{id:'log-1',alunoId:'aluno-1',autorizado:true,criadoEm:now,origem:'biometria-fs80',direcao:'entrada'}]
];
for (const [collection, recordId, payload] of rows) {
  await db.query(
    `insert into public.fusion_v3_records(tenant_id,collection,record_id,payload,updated_at,position)
     values('tenant-a',$1,$2,$3::jsonb,$4::timestamptz,0)`,
    [collection,recordId,JSON.stringify(payload),now]
  );
}

const snap = await edge.pullEdgeSnapshot({
  tenantId: 'tenant-a',
  agentId: 'agent-test',
  full: true
});
assert.equal(snap.ok, true);
assert.equal(snap.records.length, 7);
const aluno = snap.records.find(r => r.collection === 'alunos');
assert.equal(aluno.payload.id, 'aluno-1');
assert.equal(Object.hasOwn(aluno.payload, 'nome'), false);
assert.equal(Object.hasOwn(aluno.payload, 'cpf'), false);

const t0 = new Date();
const first = await edge.pushEdgeEvents({
  tenantId: 'tenant-a',
  agentId: 'agent-test',
  equipmentId: 'equip-1',
  events: [{
    id: 'evt-1', personId: 'aluno-1', personType: 'aluno', role: 'aluno',
    membershipId: 'mat-1', direction: 'entrada', authorized: true,
    physicalConfirmed: true, reason: 'teste', occurredAt: t0.toISOString(),
    localDate: t0.toISOString().slice(0,10), offline: false
  }]
});
assert.equal(first.inserted, 1);
assert.deepEqual(first.accepted, ['evt-1']);

const duplicate = await edge.pushEdgeEvents({
  tenantId: 'tenant-a', agentId: 'agent-test', equipmentId: 'equip-1',
  events: [{
    id: 'evt-1', personId: 'aluno-1', personType: 'aluno', role: 'aluno',
    membershipId: 'mat-1', direction: 'entrada', authorized: true,
    physicalConfirmed: true, reason: 'duplicado', occurredAt: t0.toISOString()
  }]
});
assert.equal(duplicate.inserted, 0);

const t1 = new Date(t0.getTime() + 5000);
const rapid = await edge.pushEdgeEvents({
  tenantId: 'tenant-a', agentId: 'agent-test', equipmentId: 'equip-1',
  events: [{
    id: 'evt-2', personId: 'aluno-1', personType: 'aluno', role: 'aluno',
    membershipId: 'mat-1', direction: 'entrada', authorized: true,
    physicalConfirmed: true, reason: 'releitura', occurredAt: t1.toISOString()
  }]
});
assert.equal(rapid.inserted, 1);

const freq = await db.query(
  `select entry_count from public.fusion_edge_daily_frequency
   where tenant_id='tenant-a' and student_id='aluno-1' and modality='biometria'`
);
assert.equal(Number(freq.rows[0]?.entry_count), 1);

const evt2 = await db.query(
  `select payload from public.fusion_edge_access_events
   where tenant_id='tenant-a' and event_id='evt-2'`
);
assert.equal(evt2.rows[0]?.payload?.frequencyIgnored, true);

const operations = await db.query(
  `select count(*)::int as c from public.fusion_edge_operations where tenant_id='tenant-a'`
);
assert.equal(Number(operations.rows[0].c), 2);

await encerrarPostgres();
console.log('ACCESS_POSTGRES_V20K_OK');
