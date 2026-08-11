import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const RUNTIME_CONFIG_FILE = "access_agent_runtime_config.json";
const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;

function texto(value = "", limit = 1000) {
  return String(value ?? "").trim().slice(0, limit);
}

function normalizarAgentId(value = "") {
  const agentId = normalizarTenantId(value);
  return AGENT_ID_PATTERN.test(agentId) ? agentId : "";
}

function normalizarEquipmentId(value = "") {
  return texto(value, 120).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 80);
}

function listaDe(value = "") {
  return texto(value, 1000).split(",").map(normalizarEquipmentId).filter(Boolean);
}

function caminhoConfigRuntime() {
  return path.join(process.cwd(), "data", RUNTIME_CONFIG_FILE);
}

function lerRuntime() {
  try {
    const raw = fs.readFileSync(caminhoConfigRuntime(), "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function salvarRuntime(config) {
  const file = caminhoConfigRuntime();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function configuracaoBase() {
  const agentId = normalizarAgentId(process.env.ACCESS_AGENT_ID);
  const tenantId = normalizarTenantId(process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || "");
  const equipmentId = normalizarEquipmentId(process.env.ACCESS_EQUIPMENT_ID);
  const equipmentIds = listaDe(process.env.ACCESS_EQUIPMENT_IDS || process.env.ACCESS_EQUIPMENT_ID);
  if (equipmentId && !equipmentIds.includes(equipmentId)) equipmentIds.unshift(equipmentId);
  return {
    agentId,
    tenantId,
    equipmentId,
    equipmentIds,
    driver: texto(process.env.ACCESS_DRIVER || "henry7x", 80),
    equipmentHost: texto(process.env.HENRY7X_HOST || process.env.HENRY_HOST || "10.0.0.236", 120),
    equipmentPort: Number(process.env.HENRY7X_PORT || process.env.HENRY_PORT || 3000),
    pollMs: Math.max(Number(process.env.ACCESS_AGENT_POLL_MS || 1500), 1000)
  };
}

function erroConfiguracao(base) {
  const faltando = [];
  if (!base.agentId) faltando.push("ACCESS_AGENT_ID");
  if (!base.equipmentId) faltando.push("ACCESS_EQUIPMENT_ID");
  return faltando.length ? `${faltando.join(" e ")} devem estar configurados no servidor.` : "";
}

function runtimeCompativel(runtime = {}, base = {}) {
  return runtime?.agentId === base.agentId &&
    runtime?.tenantId === base.tenantId &&
    runtime?.equipmentId === base.equipmentId &&
    texto(runtime?.agentToken, 2000);
}

export function resolverAccessAgentConfig({ criarToken = false } = {}) {
  const base = configuracaoBase();
  const erro = erroConfiguracao(base);
  if (erro) return { ok: false, configurado: false, erro, ...base };

  const envToken = texto(process.env.ACCESS_AGENT_TOKEN, 2000);
  if (envToken) {
    return { ok: true, configurado: true, origem: "env", agentToken: envToken, ...base };
  }

  const runtime = lerRuntime();
  if (runtimeCompativel(runtime, base)) {
    return { ok: true, configurado: true, origem: "runtime", agentToken: runtime.agentToken, ...base };
  }

  if (!criarToken) {
    return {
      ok: false,
      configurado: false,
      erro: "ACCESS_AGENT_TOKEN ausente. Gere o codigo de instalacao para provisionar o agente.",
      ...base
    };
  }

  const agora = new Date().toISOString();
  const novo = {
    agentId: base.agentId,
    tenantId: base.tenantId,
    equipmentId: base.equipmentId,
    equipmentIds: base.equipmentIds,
    agentToken: crypto.randomBytes(36).toString("base64url"),
    criadoEm: agora,
    atualizadoEm: agora
  };
  salvarRuntime(novo);
  return { ok: true, configurado: true, origem: "runtime", agentToken: novo.agentToken, ...base };
}

export function credencialAccessAgentRuntime() {
  const config = resolverAccessAgentConfig({ criarToken: false });
  if (!config.configurado || !config.agentToken) return null;
  return {
    agentId: config.agentId,
    tenantId: config.tenantId,
    equipmentIds: config.equipmentIds,
    token: config.agentToken,
    label: config.origem || "runtime"
  };
}
