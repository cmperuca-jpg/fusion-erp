import crypto from "node:crypto";
import { Router } from "express";
import { validarToken } from "../auth/auth.service.mjs";
import { resolverAccessAgentConfig } from "../access-bridge/access-agent-config.service.mjs";
import { normalizarTenantId, tenantAtual } from "../core/persistence/tenant-context.mjs";

const router = Router();
const codigos = new Map();
const tentativas = new Map();
const DURACAO_MS = 15 * 60 * 1000;

function somenteDigitos(valor) { return String(valor || "").replace(/\D/g, "").slice(0, 8); }
function limpar() {
  const agora = Date.now();
  for (const [codigo, item] of codigos) if (item.expiraEm <= agora || item.usado) codigos.delete(codigo);
  for (const [chave, item] of tentativas) if (item.inicio + 10 * 60 * 1000 <= agora) tentativas.delete(chave);
}
function codigoNovo() {
  for (let i = 0; i < 30; i += 1) {
    const codigo = String(crypto.randomInt(0, 100_000_000)).padStart(8, "0");
    if (!codigos.has(codigo)) return codigo;
  }
  throw new Error("Não foi possível gerar o código de ativação.");
}
async function exigirGestor(req, res, next) {
  try {
    const usuario = await validarToken(req.headers.authorization || "");
    const perfil = String(usuario?.perfil || "").toLowerCase();
    if (!["admin", "administrador", "responsavel_tecnico"].includes(perfil)) {
      return res.status(403).json({ ok: false, mensagem: "Somente o administrador pode gerar o código de instalação." });
    }
    req.usuario = usuario;
    next();
  } catch (erro) {
    res.status(401).json({ ok: false, mensagem: erro.message || "Sessão inválida." });
  }
}

function tenantFisicoConfigurado() {
  return normalizarTenantId(process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || "academia-piloto");
}

function tenantDaRequisicao(req) {
  return normalizarTenantId(req.usuario?.tenantId || req.usuario?.tenant_id || tenantAtual());
}

function exigirTenantProvisionado(req) {
  const tenantId = tenantDaRequisicao(req);
  const tenantConfigurado = tenantFisicoConfigurado();
  if (!tenantId) {
    const erro = new Error("Sessão sem academia vinculada.");
    erro.status = 401;
    throw erro;
  }
  if (!tenantConfigurado || tenantId !== tenantConfigurado) {
    const erro = new Error("Nenhum Fusion Access Agent físico está provisionado para esta academia.");
    erro.status = 403;
    throw erro;
  }
  return tenantId;
}

router.post("/codigo", exigirGestor, (req, res) => {
  try {
    limpar();
    const tenantId = exigirTenantProvisionado(req);
    const config = resolverAccessAgentConfig({ criarToken: true });
    if (!config.configurado) return res.status(503).json({ ok: false, mensagem: config.erro || "O agente ainda nao foi habilitado no servidor." });
    const tenantConfig = normalizarTenantId(config.tenantId || config.config?.tenantId || process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || "");
    if (tenantConfig && tenantConfig !== tenantId) {
      return res.status(403).json({ ok: false, mensagem: "A configuração do agente pertence a outra academia." });
    }
    if (!process.env.ACCESS_AGENT_TOKEN && config.agentToken) process.env.ACCESS_AGENT_TOKEN = config.agentToken;
    if (!process.env.ACCESS_EQUIPMENT_ID && config.equipmentId) process.env.ACCESS_EQUIPMENT_ID = config.equipmentId;
    if (!process.env.ACCESS_EQUIPMENT_IDS && config.equipmentIds?.length) process.env.ACCESS_EQUIPMENT_IDS = config.equipmentIds.join(",");
    if (!process.env.ACCESS_AGENT_ID || !process.env.ACCESS_AGENT_TOKEN || !process.env.ACCESS_EQUIPMENT_ID) return res.status(503).json({ ok: false, mensagem: "O agente ainda não foi habilitado no servidor." });
    const codigo = codigoNovo();
    const expiraEm = Date.now() + DURACAO_MS;
    codigos.set(codigo, { expiraEm, usado: false, tenantId, criadoPor: req.usuario?.id || req.usuario?.email || "admin" });
    res.status(201).json({ ok: true, codigo, expiraEm: new Date(expiraEm).toISOString(), duracaoMinutos: 15 });
  } catch (erro) {
    res.status(erro.status || 500).json({ ok: false, mensagem: erro.message || "Falha ao gerar código de instalação." });
  }
});

router.post("/ativar", (req, res) => {
  limpar();
  const chave = String(req.ip || "local");
  const controle = tentativas.get(chave) || { inicio: Date.now(), total: 0 };
  controle.total += 1; tentativas.set(chave, controle);
  if (controle.total > 12) return res.status(429).json({ ok: false, mensagem: "Muitas tentativas. Aguarde dez minutos." });

  const codigo = somenteDigitos(req.body?.codigo);
  const registro = codigos.get(codigo);
  if (!registro || registro.usado || registro.expiraEm <= Date.now()) {
    return res.status(400).json({ ok: false, mensagem: "Código inválido ou expirado. Gere um novo código no Fusion ERP." });
  }
  const config = resolverAccessAgentConfig({ criarToken: true });
  if (!config.configurado || !config.agentToken) {
    return res.status(503).json({ ok: false, mensagem: config.erro || "O agente ainda nao foi habilitado no servidor." });
  }
  const tenantConfig = normalizarTenantId(config.tenantId || config.config?.tenantId || process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || "");
  if (!tenantConfig || tenantConfig !== normalizarTenantId(registro.tenantId)) {
    return res.status(403).json({ ok: false, mensagem: "O código de instalação não pertence à configuração atual desta academia." });
  }
  if (!process.env.ACCESS_AGENT_TOKEN && config.agentToken) process.env.ACCESS_AGENT_TOKEN = config.agentToken;
  registro.usado = true;
  res.json({
    ok: true,
    configuracao: {
      serverUrl: String(process.env.RENDER_EXTERNAL_URL || process.env.ACCESS_SERVER_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, ""),
      agentId: config.agentId,
      tenantId: config.tenantId,
      agentToken: config.agentToken,
      driver: config.driver,
      equipmentId: config.equipmentId,
      equipmentHost: config.equipmentHost,
      equipmentPort: config.equipmentPort,
      pollMs: config.pollMs
    }
  });
});

export default router;
