import crypto from 'node:crypto';
import { obterPostgresPool, tabelaRegistrosSql } from '../../config/postgres.mjs';

const COLLECTIONS = [
  'alunos',
  'matriculas',
  'mensalidades',
  'financeiro',
  'usuarios',
  'professores',
  'access_logs'
];

function text(value = '') {
  return String(value ?? '').trim();
}

function onlyDefined(object = {}) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null)
  );
}

function payloadEdge(collection, payload = {}, recordId = '') {
  const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  switch (collection) {
    case 'alunos':
      return onlyDefined({
        id: p.id || recordId,
        ativo: p.ativo,
        status: p.status,
        situacao: p.situacao,
        bloqueado: p.bloqueado,
        bloqueioCheckin: p.bloqueioCheckin,
        motivoBloqueio: p.motivoBloqueio,
        matriculaId: p.matriculaId,
        statusMatricula: p.statusMatricula,
        matriculaStatus: p.matriculaStatus,
        emAtraso: p.emAtraso,
        inadimplente: p.inadimplente,
        proximoVencimento: p.proximoVencimento
      });
    case 'matriculas':
      return onlyDefined({
        id: p.id || recordId,
        alunoId: p.alunoId || p.aluno_id,
        status: p.status,
        bloqueada: p.bloqueada,
        bloqueioCheckin: p.bloqueioCheckin,
        motivoBloqueio: p.motivoBloqueio,
        statusPagamento: p.statusPagamento,
        proximoVencimento: p.proximoVencimento,
        ultimoPagamentoEm: p.ultimoPagamentoEm,
        atualizadoEm: p.atualizadoEm || p.atualizado_em,
        criadoEm: p.criadoEm || p.criado_em,
        dataMatricula: p.dataMatricula || p.data_matricula
      });
    case 'mensalidades':
      return onlyDefined({
        id: p.id || recordId,
        alunoId: p.alunoId || p.aluno_id,
        matriculaId: p.matriculaId,
        status: p.status,
        situacao: p.situacao,
        estado: p.estado,
        statusPagamento: p.statusPagamento,
        pagamento: p.pagamento,
        origem: p.origem,
        competencia: p.competencia,
        programada: p.programada,
        emitida: p.emitida,
        vencimento: p.vencimento || p.dataVencimento,
        valor: p.valor,
        total: p.total,
        valorOriginal: p.valorOriginal,
        valorPago: p.valorPago,
        valorQuitado: p.valorQuitado,
        valorRecebido: p.valorRecebido,
        valorRestante: p.valorRestante,
        saldoRestante: p.saldoRestante,
        atualizadoEm: p.atualizadoEm || p.atualizado_em,
        criadoEm: p.criadoEm || p.criado_em
      });
    case 'financeiro':
      return onlyDefined({
        id: p.id || recordId,
        alunoId: p.alunoId || p.aluno_id,
        matriculaId: p.matriculaId || p.matricula_id,
        ativarMatriculaAoReceber: p.ativarMatriculaAoReceber,
        origem: p.origem,
        status: p.status,
        situacao: p.situacao,
        valor: p.valor,
        saldo: p.saldo,
        valorRestante: p.valorRestante
      });
    case 'usuarios':
    case 'professores':
      return onlyDefined({
        id: p.id || recordId,
        perfil: p.perfil,
        status: p.status,
        ativo: p.ativo,
        bloqueado: p.bloqueado,
        bloqueioCheckin: p.bloqueioCheckin,
        motivoBloqueio: p.motivoBloqueio
      });
    case 'access_logs':
      return onlyDefined({
        id: p.id || recordId,
        alunoId: p.alunoId,
        autorizado: p.autorizado,
        criadoEm: p.criadoEm,
        origem: p.origem,
        direcao: p.direcao
      });
    default:
      return {};
  }
}

function localDate(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function validDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function pullEdgeSnapshot({
  tenantId,
  agentId,
  since = null,
  full = false
} = {}) {
  const tenant = text(tenantId);
  const agent = text(agentId);
  if (!tenant || !agent) throw new Error('Tenant ou agente Edge ausente.');

  const db = obterPostgresPool({ obrigatorio: true });
  const table = tabelaRegistrosSql();

  let sinceIso = null;
  if (since) {
    const parsed = new Date(since);
    if (!Number.isNaN(parsed.getTime())) sinceIso = parsed.toISOString();
  }

  const deviceResult = await db.query(
    `SELECT timezone
       FROM public.fusion_edge_devices
      WHERE tenant_id=$1 AND agent_id=$2
      LIMIT 1`,
    [tenant, agent]
  );
  const timezone = deviceResult.rows[0]?.timezone || 'America/Maceio';

  const { rows } = await db.query(
    `SELECT collection,record_id,updated_at,payload
       FROM ${table}
      WHERE tenant_id=$1
        AND collection=ANY($2::text[])
        AND ($3::boolean OR $4::timestamptz IS NULL OR updated_at>$4::timestamptz)
      ORDER BY updated_at,collection,record_id`,
    [tenant, COLLECTIONS, Boolean(full || !sinceIso), sinceIso]
  );

  const records = rows.map(row => ({
    collection: row.collection,
    recordId: row.record_id,
    updatedAt: row.updated_at,
    payload: payloadEdge(row.collection, row.payload, row.record_id)
  }));

  const cursor = rows.length
    ? rows[rows.length - 1].updated_at
    : (sinceIso || null);

  await db.query(
    `UPDATE public.fusion_edge_devices
        SET last_seen_at=now(),last_snapshot_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND agent_id=$2`,
    [tenant, agent]
  );

  return {
    ok: true,
    full: Boolean(full || !sinceIso),
    cursor,
    timezone,
    records,
    serverTime: new Date().toISOString()
  };
}

export async function pushEdgeEvents({
  tenantId,
  agentId,
  equipmentId,
  events = []
} = {}) {
  const tenant = text(tenantId);
  const agent = text(agentId);
  const equipment = text(equipmentId);
  if (!tenant || !agent || !equipment) {
    throw new Error('Tenant, agente ou equipamento Edge ausente.');
  }
  if (!Array.isArray(events)) throw new Error('EDGE_EVENTS_INVALID');

  const db = obterPostgresPool({ obrigatorio: true });
  const client = await db.connect();
  const accepted = [];
  let insertedCount = 0;
  const operationId =
    `edge_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`edge:${tenant}:${agent}`]
    );

    const deviceResult = await client.query(
      `SELECT device_id,timezone,details,status
         FROM public.fusion_edge_devices
        WHERE tenant_id=$1 AND agent_id=$2
        FOR UPDATE`,
      [tenant, agent]
    );
    const device = deviceResult.rows[0];
    if (!device) throw new Error('EDGE_DEVICE_NOT_FOUND');
    if (String(device.status || '') !== 'active') throw new Error('EDGE_AUTH_REJECTED');

    const configuredEquipment = text(device.details?.equipmentId);
    if (configuredEquipment && configuredEquipment !== equipment) {
      throw new Error('EDGE_EQUIPMENT_REJECTED');
    }

    for (const raw of events.slice(0, 200)) {
      const event = raw && typeof raw === 'object' ? raw : {};
      const eventId = text(event.id).replace(/[^a-zA-Z0-9_.:@-]/g, '');
      if (!eventId) continue;

      const personId = text(event.personId) || null;
      const membershipId = text(event.membershipId) || null;
      const role = text(event.role).toLowerCase();
      const personType = text(event.personType);
      const reason = text(event.reason).slice(0, 220);
      const direction = event.direction === 'saida' ? 'saida' : 'entrada';
      const authorized = event.authorized === true;
      const physicalConfirmed = event.physicalConfirmed === true;
      const occurred = validDate(event.occurredAt);
      const requestedLocal = text(event.localDate);
      const attendanceDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedLocal)
        ? requestedLocal
        : localDate(device.timezone || 'America/Maceio', occurred);

      let frequencyIgnored = false;
      if (
        authorized &&
        physicalConfirmed &&
        role === 'aluno' &&
        personId &&
        direction === 'entrada'
      ) {
        const prior = await client.query(
          `SELECT 1
             FROM public.fusion_edge_access_events
            WHERE tenant_id=$1
              AND student_id=$2
              AND authorized=true
              AND physical_confirmed=true
              AND direction='entrada'
              AND COALESCE(payload->>'frequencyIgnored','false') <> 'true'
              AND occurred_at < $3::timestamptz
              AND occurred_at >= $3::timestamptz - interval '12 seconds'
            LIMIT 1`,
          [tenant, personId, occurred.toISOString()]
        );
        frequencyIgnored = prior.rowCount > 0;
      }

      const payload = onlyDefined({
        reason,
        role,
        personType,
        far: event.far ?? undefined,
        localDate: attendanceDate,
        offline: event.offline ?? undefined,
        frequencyIgnored: frequencyIgnored ? true : undefined,
        dedupeReason: frequencyIgnored ? 'rapid-reread-12s' : undefined
      });

      const inserted = await client.query(
        `INSERT INTO public.fusion_edge_access_events
          (tenant_id,event_id,operation_id,agent_id,device_id,equipment_id,
           student_id,membership_id,direction,authorized,occurred_at,source,
           physical_confirmed,payload)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,
           'fusion-biometria-local',$12,$13::jsonb)
         ON CONFLICT (tenant_id,event_id) DO NOTHING
         RETURNING event_id`,
        [
          tenant, eventId, operationId, agent, device.device_id, equipment,
          personId, membershipId, direction, authorized, occurred.toISOString(),
          physicalConfirmed, JSON.stringify(payload)
        ]
      );

      accepted.push(eventId);
      if (!inserted.rowCount) continue;

      insertedCount += 1;

      if (
        authorized &&
        physicalConfirmed &&
        role === 'aluno' &&
        personId &&
        direction === 'entrada' &&
        !frequencyIgnored
      ) {
        await client.query(
          `INSERT INTO public.fusion_edge_daily_frequency
            (tenant_id,student_id,attendance_date,modality,membership_id,
             first_entry_at,last_entry_at,entry_count,first_event_id,last_event_id,updated_at)
           VALUES ($1,$2,$3::date,'biometria',$4,$5::timestamptz,$5::timestamptz,1,$6,$6,now())
           ON CONFLICT (tenant_id,student_id,attendance_date,modality)
           DO UPDATE SET
             membership_id=COALESCE(EXCLUDED.membership_id,public.fusion_edge_daily_frequency.membership_id),
             last_entry_at=EXCLUDED.last_entry_at,
             entry_count=public.fusion_edge_daily_frequency.entry_count+1,
             last_event_id=EXCLUDED.last_event_id,
             updated_at=now()`,
          [tenant, personId, attendanceDate, membershipId, occurred.toISOString(), eventId]
        );
      }
    }

    if (insertedCount > 0) {
      await client.query(
        `INSERT INTO public.fusion_edge_operations
          (tenant_id,operation_id,agent_id,event_count,created_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (tenant_id,operation_id) DO NOTHING`,
        [tenant, operationId, agent, insertedCount]
      );
    }

    await client.query(
      `UPDATE public.fusion_edge_devices
          SET last_seen_at=now(),updated_at=now()
        WHERE tenant_id=$1 AND agent_id=$2`,
      [tenant, agent]
    );

    await client.query('COMMIT');

    return {
      ok: true,
      accepted,
      inserted: insertedCount,
      serverTime: new Date().toISOString()
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
