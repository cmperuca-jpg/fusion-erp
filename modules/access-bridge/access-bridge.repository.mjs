import { readJson, writeJson, makeId, isoDate } from '../../lib/fusion-json-store.mjs';

const FILE = 'access_bridge_commands.json';
const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let supabasePromise = null;

async function supabaseClient() {
  if (!useSupabase) return null;
  supabasePromise ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  );
  return supabasePromise;
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
  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands').insert({
      id: command.id, agent_id: command.agentId, tenant_id: command.tenantId, equipment_id: command.equipmentId,
      action: command.action, payload: command.payload, status: command.status,
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
  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands').update({
      status: patch.status, finished_at: patch.finishedAt, result: patch.result, error: patch.error
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
  const row = rows.find(item => item.id === id && item.agentId === agentId && item.status === 'processing');
  if (!row) return null;
  row.result = result;
  await writeJson(FILE, rows);
  return row;
}

export async function getBiometricStudentStatesForTenant(tenantId) {
  const tenant = String(tenantId || "").trim();
  if (!tenant) return {};
  const actions = ["biometria_exists", "biometria_enroll", "biometria_delete"];
  let rows = [];
  const supabase = await supabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("access_bridge_commands")
      .select("action,payload,result,status,created_at,finished_at")
      .eq("tenant_id", tenant)
      .eq("status", "completed")
      .in("action", actions)
      .limit(5000);
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
  } else {
    rows = (await readJson(FILE, [])).filter((row) =>
      String(row.tenantId || row.tenant_id || "") === tenant &&
      String(row.status || "") === "completed" &&
      actions.includes(String(row.action || ""))
    );
  }

  const when = (row = {}) =>
    String(row.finished_at || row.finishedAt || row.created_at || row.createdAt || "");
  rows.sort((a, b) => when(b).localeCompare(when(a)));

  const out = {};
  for (const row of rows) {
    const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
    const result = row?.result && typeof row.result === "object" ? row.result : {};
    const alunoId = String(payload.alunoId || payload.aluno_id || result.alunoId || "").trim();
    if (!alunoId || Object.prototype.hasOwnProperty.call(out, alunoId)) continue;

    if (row.action === "biometria_enroll") out[alunoId] = true;
    else if (row.action === "biometria_delete") out[alunoId] = false;
    else out[alunoId] = result.existe === true || String(result.existe || "").toLowerCase() === "true";
  }
  return out;
}

export async function getCommand(id) {
  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_commands').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return normalize(data);
  }
  return (await readJson(FILE, [])).find(item => item.id === id) || null;
}

export async function saveHeartbeat(agentId, details = {}) {
  const row = { agent_id: agentId, last_seen_at: isoDate(), status: 'online', details };
  const tenantId = details.tenantId || details.tenant_id || null;
  const equipmentIds = Array.isArray(details.equipmentIds)
    ? details.equipmentIds
    : (details.equipmentId || details.equipment_id ? [details.equipmentId || details.equipment_id] : []);
  if (tenantId) row.tenant_id = tenantId;
  if (equipmentIds.length) row.equipment_ids = equipmentIds;
  const supabase = await supabaseClient();
  if (supabase) {
    const { error } = await supabase.from('access_bridge_agents').upsert(row, { onConflict: 'agent_id' });
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
  const supabase = await supabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('access_bridge_agents').select('*').eq('agent_id', agentId).maybeSingle();
    if (error) throw error;
    return data;
  }
  return (await readJson('access_bridge_agents.json', [])).find(item => item.agent_id === agentId) || null;
}

export async function getAgentForTenant(tenantId) {
  const tenant = String(tenantId || '').trim();
  if (!tenant) return null;

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
    .filter(item => String(item.tenant_id || item.tenantId || item?.details?.tenantId || item?.details?.tenant_id || '').trim() === tenant)
    .sort((a, b) =>
      new Date(b.last_seen_at || b.lastSeenAt || 0).getTime() -
      new Date(a.last_seen_at || a.lastSeenAt || 0).getTime()
    )[0] || null;
}


export async function saveEdgeDeviceCredential({ agentId, tenantId, equipmentId, secretHash } = {}) {
  const safeHash = String(secretHash || '').trim().toLowerCase();
  if (!agentId || !tenantId || !/^[a-f0-9]{64}$/.test(safeHash)) return null;
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
