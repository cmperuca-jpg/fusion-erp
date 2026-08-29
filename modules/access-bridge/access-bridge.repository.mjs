import { DATABASE_CONFIG } from '../../config/database.config.mjs';
import { obterPostgresPool } from '../../config/postgres.mjs';
import { readJson, writeJson, makeId, isoDate } from '../../lib/fusion-json-store.mjs';

const FILE = 'access_bridge_commands.json';
const usePostgres = DATABASE_CONFIG.provider === 'postgres';
const useSupabase = DATABASE_CONFIG.provider === 'supabase' &&
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let supabasePromise = null;

async function supabaseClient() {
  if (!useSupabase) return null;
  supabasePromise ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
  );
  return supabasePromise;
}

function postgres() {
  return usePostgres ? obterPostgresPool({ obrigatorio: true }) : null;
}

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id ?? row.agentId,
    tenantId: row.tenant_id ?? row.tenantId,
    equipmentId: row.equipment_id ?? row.equipmentId,
    action: row.action,
    payload: row.payload || {},
    status: row.status,
    createdAt: row.created_at ?? row.createdAt,
    expiresAt: row.expires_at ?? row.expiresAt,
    claimedAt: row.claimed_at ?? row.claimedAt ?? null,
    finishedAt: row.finished_at ?? row.finishedAt ?? null,
    result: row.result ?? null,
    error: row.error ?? null
  };
}

export async function createCommand(input) {
  if (!input?.agentId) throw new Error('agentId obrigatorio para comando de acesso.');
  if (!input?.tenantId) throw new Error('tenantId obrigatorio para comando de acesso.');
  if (!input?.equipmentId) throw new Error('equipmentId obrigatorio para comando de acesso.');

  const command = {
    id: makeId('cmd'),
    agentId: input.agentId,
    tenantId: input.tenantId,
    equipmentId: input.equipmentId,
    action: input.action || 'release',
    payload: input.payload || {},
    status: 'pending',
    createdAt: isoDate(),
    expiresAt: input.expiresAt || new Date(Date.now() + 30_000).toISOString(),
    claimedAt: null,
    finishedAt: null,
    result: null,
    error: null
  };

  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      `INSERT INTO public.access_bridge_commands
        (id,agent_id,tenant_id,equipment_id,action,payload,status,created_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::timestamptz,$9::timestamptz)
       RETURNING *`,
      [
        command.id, command.agentId, command.tenantId, command.equipmentId,
        command.action, JSON.stringify(command.payload), command.status,
        command.createdAt, command.expiresAt
      ]
    );
    return normalize(rows[0]);
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands').insert({
      id: command.id, agent_id: command.agentId, tenant_id: command.tenantId,
      equipment_id: command.equipmentId, action: command.action,
      payload: command.payload, status: command.status,
      created_at: command.createdAt, expires_at: command.expiresAt
    }).select().single();
    if (error) throw error;
    return normalize(data);
  }

  const rows = await readJson(FILE, []);
  rows.push(command);
  await writeJson(FILE, rows.slice(-2000));
  return command;
}

export async function claimNext(agentId, allowedActions = null) {
  const now = new Date().toISOString();
  const actions = Array.isArray(allowedActions)
    ? allowedActions.map(item => String(item || '').trim()).filter(Boolean)
    : [];

  const pg = postgres();
  if (pg) {
    const client = await pg.connect();
    try {
      await client.query('BEGIN');
      const params = [agentId, now];
      let actionSql = '';
      if (actions.length) {
        params.push(actions);
        actionSql = ' AND action = ANY($3::text[])';
      }
      const { rows } = await client.query(
        `SELECT *
           FROM public.access_bridge_commands
          WHERE agent_id=$1
            AND status='pending'
            AND expires_at>$2::timestamptz
            ${actionSql}
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        params
      );
      const row = rows[0];
      if (!row) {
        await client.query('COMMIT');
        return null;
      }
      const updated = await client.query(
        `UPDATE public.access_bridge_commands
            SET status='processing', claimed_at=$2::timestamptz, claimed_by=$1
          WHERE id=$3 AND status='pending'
        RETURNING *`,
        [agentId, now, row.id]
      );
      await client.query('COMMIT');
      return normalize(updated.rows[0]);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  const supabase = await supabaseClient();
  if (supabase) {
    let query = supabase.from('access_bridge_commands')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .gt('expires_at', now);

    if (actions.length) query = query.in('action', actions);

    const { data: rows, error } = await query
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw error;
    const row = rows?.[0];
    if (!row) return null;

    const { data, error: updateError } = await supabase.from('access_bridge_commands')
      .update({ status: 'processing', claimed_at: now })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    return normalize(data);
  }

  const rows = await readJson(FILE, []);
  const row = rows.find(item =>
    item.agentId === agentId &&
    item.status === 'pending' &&
    item.expiresAt > now &&
    (!actions.length || actions.includes(String(item.action || '')))
  );
  if (!row) return null;
  row.status = 'processing';
  row.claimedAt = now;
  await writeJson(FILE, rows);
  return row;
}

export async function finishCommand(id, agentId, outcome) {
  const patch = {
    status: outcome.ok ? 'completed' : 'failed',
    finishedAt: isoDate(),
    result: outcome.result || null,
    error: outcome.error || null
  };

  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      `UPDATE public.access_bridge_commands
          SET status=$1, finished_at=$2::timestamptz,
              result=$3::jsonb, error=$4
        WHERE id=$5 AND agent_id=$6
      RETURNING *`,
      [patch.status, patch.finishedAt, JSON.stringify(patch.result), patch.error, id, agentId]
    );
    return normalize(rows[0]);
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands').update({
      status: patch.status, finished_at: patch.finishedAt,
      result: patch.result, error: patch.error
    }).eq('id', id).eq('agent_id', agentId).select().maybeSingle();
    if (error) throw error;
    return normalize(data);
  }

  const rows = await readJson(FILE, []);
  const row = rows.find(item => item.id === id && item.agentId === agentId);
  if (!row) return null;
  Object.assign(row, patch);
  await writeJson(FILE, rows);
  return row;
}

export async function updateCommandProgress(id, agentId, progress = {}) {
  const safe = progress && typeof progress === 'object' && !Array.isArray(progress)
    ? {
        percentual: Math.max(0, Math.min(99, Number(progress.percentual || 0))),
        etapa: String(progress.etapa || '').slice(0, 80),
        mensagem: String(progress.mensagem || '').slice(0, 220),
        atividade: Math.max(0, Math.min(3, Number(progress.atividade || 0))),
        atualizadoEm: isoDate()
      }
    : {};
  const result = { progress: safe };

  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      `UPDATE public.access_bridge_commands
          SET result=$1::jsonb
        WHERE id=$2 AND agent_id=$3 AND status='processing'
      RETURNING *`,
      [JSON.stringify(result), id, agentId]
    );
    return normalize(rows[0]);
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands')
      .update({ result })
      .eq('id', id)
      .eq('agent_id', agentId)
      .eq('status', 'processing')
      .select()
      .maybeSingle();
    if (error) throw error;
    return normalize(data);
  }

  const rows = await readJson(FILE, []);
  const row = rows.find(item =>
    item.id === id && item.agentId === agentId && item.status === 'processing'
  );
  if (!row) return null;
  row.result = result;
  await writeJson(FILE, rows);
  return row;
}

export async function getBiometricStudentStatesForTenant(tenantId) {
  const tenant = String(tenantId || '').trim();
  if (!tenant) return {};
  const actions = ['biometria_exists', 'biometria_enroll', 'biometria_delete'];
  let rows = [];

  const pg = postgres();
  if (pg) {
    const result = await pg.query(
      `SELECT action,payload,result,status,created_at,finished_at
         FROM public.access_bridge_commands
        WHERE tenant_id=$1
          AND status='completed'
          AND action=ANY($2::text[])
        ORDER BY COALESCE(finished_at,created_at) DESC
        LIMIT 5000`,
      [tenant, actions]
    );
    rows = result.rows;
  } else {
    const supabase = await supabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('access_bridge_commands')
        .select('action,payload,result,status,created_at,finished_at')
        .eq('tenant_id', tenant)
        .eq('status', 'completed')
        .in('action', actions)
        .limit(5000);
      if (error) throw error;
      rows = Array.isArray(data) ? data : [];
    } else {
      rows = (await readJson(FILE, [])).filter(row =>
        String(row.tenantId || row.tenant_id || '') === tenant &&
        String(row.status || '') === 'completed' &&
        actions.includes(String(row.action || ''))
      );
    }
  }

  const when = (row = {}) =>
    String(row.finished_at || row.finishedAt || row.created_at || row.createdAt || '');
  rows.sort((a, b) => when(b).localeCompare(when(a)));

  const out = {};
  for (const row of rows) {
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    const result = row?.result && typeof row.result === 'object' ? row.result : {};
    const alunoId = String(payload.alunoId || payload.aluno_id || result.alunoId || '').trim();
    if (!alunoId || Object.prototype.hasOwnProperty.call(out, alunoId)) continue;

    if (row.action === 'biometria_enroll') out[alunoId] = true;
    else if (row.action === 'biometria_delete') out[alunoId] = false;
    else out[alunoId] =
      result.existe === true || String(result.existe || '').toLowerCase() === 'true';
  }
  return out;
}

export async function getCommand(id) {
  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      'SELECT * FROM public.access_bridge_commands WHERE id=$1 LIMIT 1',
      [id]
    );
    return normalize(rows[0]);
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('access_bridge_commands').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return normalize(data);
  }

  return (await readJson(FILE, [])).find(item => item.id === id) || null;
}

export async function saveHeartbeat(agentId, details = {}) {
  const row = {
    agent_id: agentId,
    last_seen_at: isoDate(),
    status: 'online',
    details
  };
  const tenantId = details.tenantId || details.tenant_id || null;
  const equipmentIds = Array.isArray(details.equipmentIds)
    ? details.equipmentIds
    : (details.equipmentId || details.equipment_id
      ? [details.equipmentId || details.equipment_id]
      : []);
  if (tenantId) row.tenant_id = tenantId;
  if (equipmentIds.length) row.equipment_ids = equipmentIds;

  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      `INSERT INTO public.access_bridge_agents
        (agent_id,last_seen_at,status,details,tenant_id,equipment_ids)
       VALUES ($1,$2::timestamptz,$3,$4::jsonb,COALESCE(NULLIF($5,''),'academia-piloto'),$6::text[])
       ON CONFLICT (agent_id) DO UPDATE SET
         last_seen_at=EXCLUDED.last_seen_at,
         status=EXCLUDED.status,
         details=EXCLUDED.details,
         tenant_id=EXCLUDED.tenant_id,
         equipment_ids=CASE
           WHEN cardinality(EXCLUDED.equipment_ids)>0 THEN EXCLUDED.equipment_ids
           ELSE public.access_bridge_agents.equipment_ids
         END
       RETURNING *`,
      [
        agentId, row.last_seen_at, row.status, JSON.stringify(details),
        tenantId || '', equipmentIds
      ]
    );
    return rows[0];
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { error } = await supabase
      .from('access_bridge_agents')
      .upsert(row, { onConflict: 'agent_id' });
    if (error) throw error;
    return row;
  }

  const agents = await readJson('access_bridge_agents.json', []);
  const found = agents.find(item => item.agent_id === agentId);
  if (found) Object.assign(found, row); else agents.push(row);
  await writeJson('access_bridge_agents.json', agents);
  return row;
}

export async function getAgent(agentId) {
  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      'SELECT * FROM public.access_bridge_agents WHERE agent_id=$1 LIMIT 1',
      [agentId]
    );
    return rows[0] || null;
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('access_bridge_agents').select('*').eq('agent_id', agentId).maybeSingle();
    if (error) throw error;
    return data;
  }

  return (await readJson('access_bridge_agents.json', []))
    .find(item => item.agent_id === agentId) || null;
}

export async function getAgentForTenant(tenantId) {
  const tenant = String(tenantId || '').trim();
  if (!tenant) return null;

  const pg = postgres();
  if (pg) {
    const { rows } = await pg.query(
      `SELECT *
         FROM public.access_bridge_agents
        WHERE tenant_id=$1
        ORDER BY last_seen_at DESC
        LIMIT 1`,
      [tenant]
    );
    return rows[0] || null;
  }

  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_agents')
      .select('*')
      .eq('tenant_id', tenant)
      .order('last_seen_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data?.[0] || null;
  }

  const agents = await readJson('access_bridge_agents.json', []);
  return agents
    .filter(item =>
      String(
        item.tenant_id || item.tenantId ||
        item?.details?.tenantId || item?.details?.tenant_id || ''
      ).trim() === tenant
    )
    .sort((a, b) =>
      new Date(b.last_seen_at || b.lastSeenAt || 0).getTime() -
      new Date(a.last_seen_at || a.lastSeenAt || 0).getTime()
    )[0] || null;
}

export async function saveEdgeDeviceCredential({
  agentId, tenantId, equipmentId, secretHash
} = {}) {
  const safeHash = String(secretHash || '').trim().toLowerCase();
  if (!agentId || !tenantId || !/^[a-f0-9]{64}$/.test(safeHash)) return null;

  const pg = postgres();
  if (pg) {
    const details = {
      equipmentId: equipmentId || undefined,
      source: 'fusion-access-agent',
      biometricOffline: true
    };
    const { rows } = await pg.query(
      `INSERT INTO public.fusion_edge_devices
        (tenant_id,agent_id,device_id,name,secret_hash,timezone,status,last_seen_at,details,created_at,updated_at)
       VALUES ($1,$2,$3,'Fusion Edge',$4,'America/Maceio','active',now(),$5::jsonb,now(),now())
       ON CONFLICT (tenant_id,agent_id) DO UPDATE SET
         secret_hash=EXCLUDED.secret_hash,
         status='active',
         last_seen_at=now(),
         updated_at=now(),
         details=COALESCE(public.fusion_edge_devices.details,'{}'::jsonb) || EXCLUDED.details
       RETURNING *`,
      [tenantId, agentId, `${agentId}-edge`, safeHash, JSON.stringify(details)]
    );
    return rows[0] || null;
  }

  const supabase = await supabaseClient();
  if (!supabase) return null;

  const { data: existing, error: readError } = await supabase
    .from('fusion_edge_devices')
    .select('device_id,name,timezone,details,created_at')
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (readError) throw readError;

  const row = {
    tenant_id: tenantId,
    agent_id: agentId,
    device_id: existing?.device_id || `${agentId}-edge`,
    name: existing?.name || 'Fusion Edge',
    secret_hash: safeHash,
    timezone: existing?.timezone || 'America/Maceio',
    status: 'active',
    last_seen_at: isoDate(),
    updated_at: isoDate(),
    details: {
      ...(existing?.details && typeof existing.details === 'object' ? existing.details : {}),
      equipmentId: equipmentId || undefined,
      source: 'fusion-access-agent',
      biometricOffline: true
    }
  };
  if (existing?.created_at) row.created_at = existing.created_at;

  const { data, error } = await supabase
    .from('fusion_edge_devices')
    .upsert(row, { onConflict: 'tenant_id,agent_id' })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
