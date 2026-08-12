import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { executarComTenant, normalizarTenantId } from "../core/persistence/tenant-context.mjs";
import { processarBillingFusion } from "./billing.service.mjs";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

let timer = null;
let executando = false;
let ultimoStatus = {
  ativo: false,
  executando: false,
  intervaloMs: DEFAULT_INTERVAL_MS,
  ultimaExecucaoEm: null,
  proximaExecucaoEm: null,
  tenants: 0,
  alterados: 0,
  falhas: 0,
  ultimoErro: ""
};

function envAtivo(valor) {
  return ["1", "true", "sim", "yes", "on"].includes(String(valor || "").trim().toLowerCase());
}

function intervaloSeguro(valor) {
  const n = Number(valor || DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.round(n));
}

async function listarTenants() {
  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,status")
    .in("status", ["active", "trial", "suspended"])
    .order("tenant_id", { ascending: true });
  if (error) throw new Error(`Falha ao listar tenants para billing: ${error.message}`);
  return [...new Set((data || []).map(item => normalizarTenantId(item.tenant_id)).filter(Boolean))];
}

export async function processarBillingTodosTenants(opcoes = {}) {
  const tenantIds = Array.isArray(opcoes.tenantIds) && opcoes.tenantIds.length
    ? [...new Set(opcoes.tenantIds.map(normalizarTenantId).filter(Boolean))]
    : await listarTenants();

  const resultados = [];
  for (const tenantId of tenantIds) {
    try {
      const resultado = await executarComTenant(tenantId, () => processarBillingFusion({
        dataReferencia: opcoes.dataReferencia,
        diasTolerancia: opcoes.diasTolerancia
      }, { id: "billing-scheduler", nome: "Billing Scheduler", perfil: "sistema" }));
      resultados.push({ tenantId, ok: true, alterado: Boolean(resultado.alterado), acao: resultado.acao, status: resultado.assinatura?.status || "sem_assinatura" });
    } catch (error) {
      resultados.push({ tenantId, ok: false, alterado: false, erro: String(error?.message || error).slice(0, 300) });
    }
  }

  return {
    ok: resultados.every(item => item.ok),
    tenants: tenantIds.length,
    alterados: resultados.filter(item => item.alterado).length,
    falhas: resultados.filter(item => !item.ok).length,
    resultados
  };
}

async function executarCiclo(intervaloMs) {
  if (executando) return;
  executando = true;
  ultimoStatus.executando = true;
  try {
    const resumo = await processarBillingTodosTenants();
    ultimoStatus = {
      ...ultimoStatus,
      executando: false,
      ultimaExecucaoEm: new Date().toISOString(),
      proximaExecucaoEm: new Date(Date.now() + intervaloMs).toISOString(),
      tenants: resumo.tenants,
      alterados: resumo.alterados,
      falhas: resumo.falhas,
      ultimoErro: resumo.ok ? "" : `${resumo.falhas} tenant(s) com falha.`
    };
  } catch (error) {
    ultimoStatus = {
      ...ultimoStatus,
      executando: false,
      ultimaExecucaoEm: new Date().toISOString(),
      proximaExecucaoEm: new Date(Date.now() + intervaloMs).toISOString(),
      ultimoErro: String(error?.message || error).slice(0, 300)
    };
    console.error(`[Billing SaaS] Agendador: ${ultimoStatus.ultimoErro}`);
  } finally {
    executando = false;
  }
}

export function iniciarAgendadorBillingFusion(opcoes = {}) {
  if (timer) return statusAgendadorBillingFusion();
  const ativo = opcoes.ativo ?? envAtivo(process.env.FUSION_BILLING_AUTO);
  const intervaloMs = intervaloSeguro(opcoes.intervaloMs ?? process.env.FUSION_BILLING_INTERVAL_MS);
  ultimoStatus = { ...ultimoStatus, ativo: Boolean(ativo), intervaloMs };
  if (!ativo) return statusAgendadorBillingFusion();

  const inicial = setTimeout(() => executarCiclo(intervaloMs), 3000);
  inicial.unref?.();
  timer = setInterval(() => executarCiclo(intervaloMs), intervaloMs);
  timer.unref?.();
  ultimoStatus.proximaExecucaoEm = new Date(Date.now() + 3000).toISOString();
  return statusAgendadorBillingFusion();
}

export function pararAgendadorBillingFusion() {
  if (timer) clearInterval(timer);
  timer = null;
  ultimoStatus = { ...ultimoStatus, ativo: false, executando: false, proximaExecucaoEm: null };
  return statusAgendadorBillingFusion();
}

export function statusAgendadorBillingFusion() {
  return { ...ultimoStatus, executando };
}
