import crypto from "node:crypto";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { gerarTokenSuporte } from "../auth/auth.service.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

function texto(v = "") { return String(v ?? "").trim(); }
function email(v = "") { return texto(v).toLowerCase(); }
function erro(message, status = 400) { return Object.assign(new Error(message), { status }); }

function minutosSessao() {
  const bruto = Number(process.env.FUSION_SUPPORT_SESSION_MINUTES || 30);
  if (!Number.isFinite(bruto)) return 30;
  return Math.min(Math.max(Math.round(bruto), 10), 120);
}

export async function obterOperadorSuporte(usuario = {}) {
  const mail = email(usuario.email);
  if (!mail) return null;
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_support_operators")
    .select("email_normalized,name,role,status")
    .eq("email_normalized", mail)
    .maybeSingle();
  if (error) throw erro(`Falha ao validar operador de suporte: ${error.message}`, 500);
  if (!data || data.status !== "active") return null;
  return data;
}

export async function exigirOperadorSuporte(usuario = {}) {
  const operador = await obterOperadorSuporte(usuario);
  if (!operador) throw erro("Este usuário não pertence à equipe de suporte do Fusion.", 403);
  return operador;
}

export async function listarClientesSuporte(usuario = {}) {
  await exigirOperadorSuporte(usuario);
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status,plan_code,trial_ends_at,created_at")
    .order("name", { ascending: true });
  if (error) throw erro(`Falha ao listar academias: ${error.message}`, 500);
  return Array.isArray(data) ? data : [];
}

export async function iniciarSessaoSuporte(usuario = {}, payload = {}, contexto = {}) {
  const operador = await exigirOperadorSuporte(usuario);
  const targetTenantId = normalizarTenantId(payload.tenantId || payload.tenant || "");
  const reason = texto(payload.motivo || payload.reason);
  if (!targetTenantId) throw erro("Selecione a academia que receberá o suporte.");
  if (reason.length < 5) throw erro("Informe o motivo do acesso de suporte.");

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data: tenant, error: tenantError } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status")
    .eq("tenant_id", targetTenantId)
    .maybeSingle();
  if (tenantError) throw erro(`Falha ao localizar academia: ${tenantError.message}`, 500);
  if (!tenant) throw erro("Academia não encontrada.", 404);

  const homeTenantId = normalizarTenantId(usuario.tenantId || "");
  if (!homeTenantId) throw erro("A conta de suporte não possui empresa de origem.", 401);

  const sessionId = `sup_${crypto.randomUUID()}`;
  const ttl = minutosSessao();
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + ttl * 60_000);

  const row = {
    session_id: sessionId,
    operator_email: operador.email_normalized,
    operator_user_id: String(usuario.id || ""),
    home_tenant_id: homeTenantId,
    target_tenant_id: tenant.tenant_id,
    reason,
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    source_ip: texto(contexto.ip),
    user_agent: texto(contexto.userAgent).slice(0, 500)
  };

  const { error: insertError } = await supabase.from("fusion_support_sessions").insert(row);
  if (insertError) throw erro(`Falha ao iniciar sessão de suporte: ${insertError.message}`, 500);

  const token = gerarTokenSuporte(usuario, {
    sessionId,
    homeTenantId,
    targetTenantId: tenant.tenant_id,
    targetTenantName: tenant.name,
    reason,
    supportRole: operador.role,
    expiresInMinutes: ttl
  });

  return {
    ok: true,
    token,
    tenantId: tenant.tenant_id,
    academia: { nome: tenant.name, slug: tenant.slug, status: tenant.status },
    suporte: {
      sessionId,
      motivo: reason,
      operador: operador.name || usuario.nome || usuario.email,
      email: operador.email_normalized,
      role: operador.role,
      iniciadoEm: startedAt.toISOString(),
      expiraEm: expiresAt.toISOString()
    },
    usuario: {
      ...usuario,
      perfil: "Administrador",
      perfilOriginal: "Administrador",
      permissoes: ["*"],
      tenantId: tenant.tenant_id,
      academiaNome: tenant.name,
      supportAccess: true,
      supportSessionId: sessionId,
      supportHomeTenantId: homeTenantId,
      supportReason: reason,
      supportRole: operador.role
    }
  };
}

export async function validarSessaoSuporteAtiva(usuario = {}) {
  if (!usuario.supportAccess || !usuario.supportSessionId) return null;

  const operador = await exigirOperadorSuporte(usuario);
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_support_sessions")
    .select("session_id,operator_email,home_tenant_id,target_tenant_id,reason,started_at,expires_at,ended_at")
    .eq("session_id", usuario.supportSessionId)
    .maybeSingle();
  if (error) throw erro(`Falha ao validar sessão de suporte: ${error.message}`, 500);
  if (!data) throw erro("Sessão de suporte não encontrada.", 401);
  if (data.ended_at) throw erro("Sessão de suporte já foi encerrada.", 401);
  if (new Date(data.expires_at).getTime() <= Date.now()) throw erro("Sessão de suporte expirada.", 401);
  if (email(data.operator_email) !== email(operador.email_normalized)) throw erro("Operador de suporte incompatível.", 403);
  if (normalizarTenantId(data.target_tenant_id) !== normalizarTenantId(usuario.tenantId)) throw erro("Tenant da sessão de suporte incompatível.", 403);

  return data;
}

export async function encerrarSessaoSuporte(usuario = {}) {
  const sessao = await validarSessaoSuporteAtiva(usuario);
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { error } = await supabase
    .from("fusion_support_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("session_id", sessao.session_id)
    .is("ended_at", null);
  if (error) throw erro(`Falha ao encerrar sessão de suporte: ${error.message}`, 500);
  return { ok: true, sessionId: sessao.session_id };
}

export async function registrarAuditoriaSuporte(usuario = {}, req = {}, statusCode = 0) {
  if (!usuario.supportAccess || !usuario.supportSessionId) return;
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  await supabase.from("fusion_support_audit").insert({
    session_id: usuario.supportSessionId,
    operator_email: email(usuario.email),
    target_tenant_id: normalizarTenantId(usuario.tenantId),
    method: texto(req.method || ""),
    path: texto(req.originalUrl || req.path || "").slice(0, 1000),
    status_code: Number(statusCode || 0),
    metadata: {
      ip: texto(req.ip || req.socket?.remoteAddress || ""),
      userAgent: texto(req.headers?.["user-agent"] || "").slice(0, 500)
    }
  });
}
