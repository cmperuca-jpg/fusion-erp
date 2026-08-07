import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

function texto(valor) { return String(valor ?? "").trim(); }
function emailNormalizado(valor) { return texto(valor).toLowerCase(); }

export async function localizarTenantPorEmail(email) {
  const normalizado = emailNormalizado(email);
  if (!normalizado) return null;
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,profile,status")
    .eq("email_normalized", normalizado)
    .maybeSingle();
  if (error) throw new Error(`Falha ao localizar empresa do usuário: ${error.message}`);
  return data ? { ...data, tenant_id: normalizarTenantId(data.tenant_id) } : null;
}

export async function validarEmailDisponivel(email, { tenantId = "", userId = "" } = {}) {
  const normalizado = emailNormalizado(email);
  if (!normalizado) return true;
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id")
    .eq("email_normalized", normalizado)
    .maybeSingle();
  if (error) throw new Error(`Falha ao validar disponibilidade do e-mail: ${error.message}`);
  if (!data) return true;
  const mesmoUsuario = normalizarTenantId(data.tenant_id) === normalizarTenantId(tenantId) && String(data.user_id) === String(userId || "");
  if (mesmoUsuario) return true;
  const conflito = Object.assign(new Error("Este e-mail já está vinculado a outro usuário ou empresa."), { status: 409 });
  throw conflito;
}

export async function sincronizarIndiceUsuario(usuario = {}, tenantId = "") {
  const email = emailNormalizado(usuario.email);
  const tenant = normalizarTenantId(tenantId);
  if (!email || !tenant || !usuario.id) return;
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data: existente, error: consultaErro } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id")
    .eq("email_normalized", email)
    .maybeSingle();
  if (consultaErro) throw new Error(`Falha ao validar índice de login: ${consultaErro.message}`);
  if (existente && (String(existente.tenant_id) !== tenant || String(existente.user_id) !== String(usuario.id))) {
    const conflito = Object.assign(new Error("Este e-mail já está vinculado a outro usuário ou empresa."), { status: 409 });
    throw conflito;
  }

  const { error } = await supabase.from("fusion_tenant_login_index").upsert({
    email_normalized: email,
    tenant_id: tenant,
    user_id: String(usuario.id),
    profile: texto(usuario.perfil),
    status: texto(usuario.status || "ativo").toLowerCase(),
    updated_at: new Date().toISOString()
  }, { onConflict: "email_normalized" });
  if (error) throw new Error(`Falha ao atualizar índice de login: ${error.message}`);
}

export async function removerIndiceUsuario(usuario = {}) {
  const email = emailNormalizado(usuario.email);
  if (!email) return;
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { error } = await supabase.from("fusion_tenant_login_index").delete().eq("email_normalized", email);
  if (error) throw new Error(`Falha ao remover índice de login: ${error.message}`);
}

export async function localizarAcessoPorEmpresaCodigo(empresa = "", codigo = "") {
  const empresaTexto = texto(empresa);
  const codigoTexto = texto(codigo).toUpperCase();
  if (!empresaTexto || !codigoTexto) return null;

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const slug = normalizarTenantId(empresaTexto.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  let tenant = null;
  if (slug) {
    const { data, error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
      .maybeSingle();
    if (error) throw new Error(`Falha ao localizar academia: ${error.message}`);
    tenant = data || null;
  }

  if (!tenant) {
    const { data, error } = await supabase
      .from("fusion_tenants")
      .select("tenant_id,slug,name,status")
      .ilike("name", empresaTexto)
      .limit(2);
    if (error) throw new Error(`Falha ao localizar academia: ${error.message}`);
    if (Array.isArray(data) && data.length === 1) tenant = data[0];
  }

  if (!tenant?.tenant_id) return null;
  if (!["active", "trial"].includes(String(tenant.status || "").toLowerCase())) return null;

  const { data: indice, error: indiceErro } = await supabase
    .from("fusion_tenant_login_index")
    .select("tenant_id,user_id,profile,status,access_code")
    .eq("tenant_id", tenant.tenant_id)
    .eq("access_code", codigoTexto)
    .maybeSingle();
  if (indiceErro) throw new Error(`Falha ao validar código de acesso: ${indiceErro.message}`);
  if (!indice) return null;

  return {
    ...indice,
    tenant_id: normalizarTenantId(indice.tenant_id),
    tenant_name: tenant.name,
    tenant_slug: tenant.slug
  };
}
