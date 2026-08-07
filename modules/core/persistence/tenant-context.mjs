import { AsyncLocalStorage } from "node:async_hooks";

const contextoTenant = new AsyncLocalStorage();

function normalizarTenant(valor = "") {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function tenantPadrao() {
  return normalizarTenant(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto") || "academia-piloto";
}

export function tenantAtual() {
  return normalizarTenant(contextoTenant.getStore()?.tenantId) || tenantPadrao();
}

export function executarComTenant(tenantId, executor) {
  const normalizado = normalizarTenant(tenantId);
  if (!normalizado) throw new Error("Tenant não informado.");
  return contextoTenant.run({ tenantId: normalizado }, executor);
}

export function normalizarTenantId(valor = "") {
  return normalizarTenant(valor);
}
