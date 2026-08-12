import { obterBillingFusion } from "../saas/billing.service.mjs";
import { normalizarTenantId, tenantAtual } from "../core/persistence/tenant-context.mjs";

const TENANTS_PROTEGIDOS = new Set(["academia-piloto"]);
const ROTAS_ISENTAS = [
  "/api/health",
  "/api/saas/billing/fusion"
];

function envAtivo(valor) {
  return ["1", "true", "sim", "yes", "on"].includes(String(valor || "").trim().toLowerCase());
}

function pathMatches(pathname = "", prefix = "") {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function tenantRequisicao(req = {}) {
  return normalizarTenantId(
    req.usuario?.tenantId ||
    req.headers?.["x-fusion-tenant"] ||
    req.query?.tenantId ||
    req.query?.tenant ||
    req.body?.tenantId ||
    req.body?.tenant ||
    tenantAtual()
  );
}

export function classificarExcecaoEnforcementBilling({
  ativo = envAtivo(process.env.FUSION_BILLING_ENFORCE),
  tenantId = "",
  caminho = "",
  usuario = {}
} = {}) {
  const tenant = normalizarTenantId(tenantId);

  if (!ativo) {
    return { isento: true, motivo: "enforcement_desligado", tenantId: tenant };
  }

  if (!tenant) {
    return { isento: true, motivo: "tenant_nao_identificado", tenantId: "" };
  }

  if (TENANTS_PROTEGIDOS.has(tenant)) {
    return { isento: true, motivo: "tenant_protegido", tenantId: tenant };
  }

  if (usuario?.supportAccess === true) {
    return { isento: true, motivo: "suporte_autorizado", tenantId: tenant };
  }

  if (ROTAS_ISENTAS.some(prefix => pathMatches(String(caminho || ""), prefix))) {
    return { isento: true, motivo: "rota_regularizacao", tenantId: tenant };
  }

  return { isento: false, motivo: "", tenantId: tenant };
}

export async function avaliarEnforcementBilling(req = {}) {
  const tenantId = tenantRequisicao(req);
  const excecao = classificarExcecaoEnforcementBilling({
    tenantId,
    caminho: req.path || "",
    usuario: req.usuario || {}
  });

  if (excecao.isento) {
    return {
      permitido: true,
      enforcement: envAtivo(process.env.FUSION_BILLING_ENFORCE),
      tenantId,
      motivo: excecao.motivo,
      status: ""
    };
  }

  try {
    const billing = await obterBillingFusion();
    const acesso = billing?.politica?.acesso || {};
    const bloqueado = acesso.permitido === false;

    return {
      permitido: !bloqueado,
      enforcement: true,
      tenantId,
      motivo: bloqueado ? String(acesso.motivo || "Assinatura indisponivel.") : "billing_liberado",
      status: String(billing?.assinatura?.status || acesso.status || ""),
      assinaturaConfigurada: Boolean(billing?.assinatura?.id)
    };
  } catch (error) {
    // Fail-open: indisponibilidade interna do billing nao pode derrubar a academia.
    console.warn(`[Billing Enforcement] Falha ao consultar ${tenantId}: ${String(error?.message || error).slice(0, 240)}`);
    return {
      permitido: true,
      enforcement: true,
      tenantId,
      motivo: "falha_consulta_fail_open",
      status: ""
    };
  }
}

export async function executarEnforcementBilling(req, res, next) {
  const decisao = await avaliarEnforcementBilling(req);

  if (decisao.permitido) {
    return next();
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Fusion-Billing-Status", decisao.status || "suspensa");

  return res.status(402).json({
    ok: false,
    codigo: "FUSION_BILLING_SUSPENDED",
    mensagem: "Assinatura Fusion suspensa. Regularize o billing para continuar.",
    billing: {
      tenantId: decisao.tenantId,
      status: decisao.status || "suspensa",
      permitido: false
    }
  });
}
