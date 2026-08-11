import fs from "node:fs/promises";
import path from "node:path";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

function texto(v = "") {
  return String(v ?? "").trim();
}

function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function validarTenant(tenantId = "") {
  const tenant = normalizarTenantId(tenantId);
  if (!tenant) throw erro("Academia não identificada.", 400);
  return tenant;
}

export async function obterStatusImplantacao(tenantId = "") {
  const tenant = validarTenant(tenantId);
  const supabase = obterSupabaseAdmin({ obrigatorio: true });

  const { data, error } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status,settings,created_at,updated_at")
    .eq("tenant_id", tenant)
    .maybeSingle();

  if (error) throw erro(`Falha ao consultar implantação: ${error.message}`, 500);
  if (!data) throw erro("Academia não encontrada.", 404);

  const settings = data.settings && typeof data.settings === "object" ? data.settings : {};
  return {
    tenantId: tenant,
    slug: data.slug,
    nome: data.name,
    statusAcademia: data.status,
    onboardingStatus: texto(settings.onboarding_status || "completed"),
    iniciadoEm: settings.onboarding_started_at || data.created_at || null,
    concluidoEm: settings.onboarding_completed_at || null
  };
}

export async function concluirImplantacao({ tenantId, usuarioId } = {}) {
  const tenant = validarTenant(tenantId);
  const userId = texto(usuarioId);
  if (!userId) throw erro("Administrador não identificado.", 401);

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase.rpc("fusion_complete_tenant_onboarding_v1", {
    p_tenant_id: tenant,
    p_user_id: userId
  });

  if (error) throw erro(`Não foi possível concluir a implantação: ${error.message}`, 400);
  return data || { ok: true, tenant_id: tenant, onboarding_status: "completed" };
}

async function limparArquivosTenant(tenant) {
  const candidatos = [
    path.resolve(process.cwd(), "uploads", "aparencia", tenant),
    path.resolve(process.cwd(), "uploads", "tenants", tenant)
  ];

  const removidos = [];
  const falhas = [];

  for (const diretorio of candidatos) {
    try {
      await fs.rm(diretorio, { recursive: true, force: true });
      removidos.push(diretorio);
    } catch (error) {
      falhas.push({ diretorio, erro: error.message });
    }
  }

  return { removidos, falhas };
}

export async function cancelarImplantacao({
  tenantId,
  usuarioId,
  confirmacao
} = {}) {
  const tenant = validarTenant(tenantId);
  const userId = texto(usuarioId);

  if (tenant === "academia-piloto") {
    throw erro("A academia-piloto é protegida e não pode ser removida por este fluxo.", 403);
  }

  if (!userId) throw erro("Administrador não identificado.", 401);

  if (texto(confirmacao).toUpperCase() !== "CANCELAR IMPLANTACAO") {
    throw erro("Confirmação de cancelamento inválida.", 400);
  }

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase.rpc("fusion_cancel_provisional_tenant_v1", {
    p_tenant_id: tenant,
    p_user_id: userId
  });

  if (error) {
    const mensagem = String(error.message || "");
    if (/somente uma implantação pendente/i.test(mensagem)) {
      throw erro("Esta academia já concluiu a implantação e não pode ser apagada por este botão.", 409);
    }
    throw erro(`Não foi possível cancelar a implantação: ${mensagem}`, 400);
  }

  const arquivos = await limparArquivosTenant(tenant);

  return {
    ...(data || {}),
    ok: true,
    tenantId: tenant,
    arquivos
  };
}
