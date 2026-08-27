import path from "node:path";
import { validarToken, validarTokenPortal } from "../auth/auth.service.mjs";
import { executarComTenant, normalizarTenantId } from "../core/persistence/tenant-context.mjs";
import { validarSessaoSuporteAtiva, registrarAuditoriaSuporte } from "../suporte/suporte.service.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { executarEnforcementBilling } from "./billing-enforcement.middleware.mjs";

const PUBLIC_RULES = [
  ["GET", "/api/health"],
  ["HEAD", "/api/health"],
  ["GET", "/api/v3/architecture/status"],
  ["GET", "/api/v3/persistence/status"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/login-empresa"],
  ["POST", "/api/auth/selecionar-empresa"],
  ["POST", "/api/auth/recuperacao/iniciar"],
  ["POST", "/api/auth/recuperacao/confirmar"],
  ["POST", "/api/auth/recuperacao/redefinir-senha"],
  ["GET", "/api/saas/publico", "prefix"],
  ["GET", "/api/saas/planos"],
  ["POST", "/api/saas/empresas"],
  ["POST", "/api/professores/login"],
  ["POST", "/api/treinos/aluno-login"],
  ["POST", "/api/treinos/aluno-app/ativar"],
  ["POST", "/api/treinos/aluno-app/status"],
  ["POST", "/api/treinos/aluno-app/login"],
  ["POST", "/api/treinos/aluno-app/primeiro-acesso"],
  ["GET", "/api/treinos/aluno-app/me"],
  ["PUT", "/api/treinos/aluno-app/foto"],
  ["POST", "/api/treinos/aluno-app/catraca"],
  ["GET", "/api/treinos/aluno-app/catraca-contador"],
  ["POST", "/api/treinos/aluno-app/pagamentos"],
  ["GET", "/api/treinos/aluno-app/pagamentos", "prefix"],
  ["POST", "/api/treinos/aluno-app/logout"],
  ["POST", "/api/pagamentos-online/webhooks/asaas"],
  ["POST", "/api/pagamentos-online/webhooks/pagbank"],
  ["POST", "/api/pagamentos-online/webhooks/infinitepay"],
  ["POST", "/api/matricula-online"],
  ["GET", "/api/matricula-online/validar-cpf"],
  ["GET", "/api/planos"],
  ["POST", "/api/leads"],
  ["POST", "/api/site-chat"],
  ["POST", "/api/site-chat/mensagens"],
  ["GET", "/api/site-chat/mensagens"],
  ["POST", "/api/aluno-login"],
  ["POST", "/api/access-onboarding/ativar"],
  ["POST", "/api/access-bridge/agent/heartbeat"],
  ["GET", "/api/access-bridge/agent/next"],
  ["POST", "/api/access-bridge/agent/commands", "prefix"],
  ["POST", "/api/access-bridge/agent/biometria/acesso"],
  ["GET", "/api/reconhecimento-facial/terminal", "prefix"],
  ["POST", "/api/reconhecimento-facial/terminal", "prefix"],
  ["GET", "/api/reconhecimento-facial/agent", "prefix"],
  ["POST", "/api/reconhecimento-facial/agent", "prefix"],
  ["GET", "/api/aparencia"],
  ["GET", "/api/emergency-access/alunos", "prefix"],
  ["POST", "/api/emergency-access/comprovante"]
];

const PUBLIC_TENANT_REQUIRED = [
  ["GET", "/api/planos"],
  ["POST", "/api/matricula-online"],
  ["GET", "/api/matricula-online/validar-cpf"],
  ["POST", "/api/leads"],
  ["POST", "/api/site-chat"],
  ["POST", "/api/site-chat/mensagens"],
  ["GET", "/api/site-chat/mensagens"],
  ["GET", "/api/aparencia"]
];

const ADMIN_PREFIXES = [
  "/api/auth/usuarios",
  "/api/auth/perfis",
  "/api/backup",
  "/api/importador-access",
  "/api/access-engine",
  "/api/henry7x",
  "/api/access-bridge",
  "/api/sistema",
  "/api/v3/persistence/migrate",
  "/api/v3/access",
  "/api/aparencia"
];

const RESERVED_PUBLIC_SLUGS = new Set([
  "api", "pages", "assets", "uploads", "downloads", "favicon.ico",
  "manifest.json", "robots.txt", "sw.js", "fusion-sw.js"
]);

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const cacheSitePublico = new Map();
const CACHE_SITE_MS = 60 * 1000;

function pathMatches(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublic(req) {
  return PUBLIC_RULES.some(([method, routePath, match = "exact"]) => {
    if (req.method !== method) return false;
    return match === "prefix" ? pathMatches(req.path, routePath) : req.path === routePath;
  });
}

function publicExigeTenant(req) {
  return PUBLIC_TENANT_REQUIRED.some(([method, routePath, match = "exact"]) => {
    if (req.method !== method) return false;
    return match === "prefix" ? pathMatches(req.path, routePath) : req.path === routePath;
  });
}

function tenantInformado(req) {
  return normalizarTenantId(
    req.headers["x-fusion-tenant"] ||
    req.query?.tenantId ||
    req.query?.tenant ||
    req.body?.tenantId ||
    req.body?.tenant ||
    ""
  );
}

function tenantConflita(req, usuario = {}) {
  const informado = tenantInformado(req);
  const sessao = normalizarTenantId(usuario?.tenantId || "");
  return Boolean(informado && sessao && informado !== sessao);
}

function responderConflitoTenant(res) {
  return res.status(403).json({
    ok: false,
    mensagem: "A sessão pertence a outra empresa. Faça login novamente nesta empresa."
  });
}

function isAdmin(user = {}) {
  const perfil = String(user.perfil || "").toLowerCase();
  const permissions = Array.isArray(user.permissoes) ? user.permissoes : [];
  return perfil === "administrador" || perfil === "admin" || permissions.includes("*");
}

function isPortal(user = {}, tipo = "") {
  if (!user.portal) return false;
  return tipo ? String(user.portalTipo || user.perfil || "").toLowerCase() === tipo : true;
}

function isResponsavelTecnico(user = {}) {
  const perfil = String(user.perfil || "").toLowerCase();
  const permissions = Array.isArray(user.permissoes) ? user.permissoes : [];
  return user.acessoTodosAlunos === true ||
    perfil === "responsavel_tecnico" ||
    perfil === "responsavel-tecnico" ||
    perfil === "responsavel tecnico" ||
    permissions.includes("professores") ||
    permissions.includes("*");
}

function mesmoId(a, b) {
  return String(a || "").trim() && String(a || "").trim() === String(b || "").trim();
}

function alunoIdDaRequisicao(req) {
  return req.query?.alunoId || req.query?.aluno_id || req.body?.alunoId || req.body?.aluno_id || "";
}

function alunoIdNoPath(req) {
  const match = String(req.path || "").match(/^\/api\/alunos\/([^/]+)(?:\/prontuario)?$/);
  return match?.[1] || "";
}

function alunoIdFotoNoPath(req) {
  const match = String(req.path || "").match(/^\/api\/alunos\/([^/]+)\/foto$/);
  return match?.[1] || "";
}

function professorIdFotoNoPath(req) {
  const match = String(req.path || "").match(/^\/api\/professores\/([^/]+)\/foto$/);
  return match?.[1] || "";
}

function portalAlunoPermitido(req, user = {}) {
  if (!isPortal(user, "aluno")) return false;
  const alunoId = String(user.id || "");

  if (req.method === "GET" && alunoIdNoPath(req)) return mesmoId(alunoIdNoPath(req), alunoId);
  if (req.method === "PUT" && alunoIdFotoNoPath(req)) return mesmoId(alunoIdFotoNoPath(req), alunoId);
  if (req.method === "GET" && req.path === "/api/treinos") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/avaliacoes") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/mensalidades") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && pathMatches(req.path, "/api/mensalidades/aluno")) return mesmoId(req.path.split("/").pop(), alunoId);
  if (req.method === "GET" && req.path === "/api/financeiro") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/treinos/aluno-sessao") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/treinos/aluno-catraca-contador") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "POST" && req.path === "/api/treinos/aluno-liberar-catraca") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && pathMatches(req.path, "/api/emergency-access/alunos")) return mesmoId(req.path.split("/")[4], alunoId);
  if (req.method === "POST" && req.path === "/api/emergency-access/comprovante") return mesmoId(alunoIdDaRequisicao(req), alunoId);

  return false;
}

function portalProfessorPermitido(req, user = {}) {
  const tipo = String(user.portalTipo || user.perfil || "").toLowerCase();
  const portalProfessor = isPortal(user, "professor") ||
    (user.portal === true && [
      "responsavel_tecnico",
      "responsavel-tecnico",
      "responsavel tecnico"
    ].includes(tipo));
  if (!portalProfessor) return false;
  const tecnico = isResponsavelTecnico(user);

  if (req.method === "GET" && req.path === "/api/professores/sessao") return true;
  // PROFESSOR AGENDA PORTAL SECURITY 20260826
  if (req.method === "GET" && req.path === "/api/agenda-avaliacoes") return true;

  // PROFESSOR PONTO PORTAL SECURITY 20260826
  const pontoProfessorMatch = String(req.path || "").match(/^\/api\/professores\/([^/]+)\/ponto(?:\/|$)/i);
  if (req.method === "GET" && pontoProfessorMatch) return mesmoId(pontoProfessorMatch[1], user.id);

  if (pathMatches(req.path, "/api/treinos/biblioteca")) {
    if (req.method === "GET" && req.path === "/api/treinos/biblioteca") return true;
    if (["PUT", "PATCH", "DELETE"].includes(req.method)) return tecnico;
    return false;
  }

  if (pathMatches(req.path, "/api/professores")) {
    if (req.method === "GET" && req.path === "/api/professores") return tecnico;
    if (req.method === "PUT" && /\/status$/i.test(req.path)) return tecnico;
    if (req.method === "PUT" && professorIdFotoNoPath(req)) return mesmoId(professorIdFotoNoPath(req), user.id);
    return false;
  }

  // PROFESSOR PORTAL GET AGENDA AVALIACOES 20260826
  // O portal do professor pode apenas CONSULTAR a agenda de avaliacoes.
  // A rota /api/agenda-avaliacoes aplica o professorId da sessao do portal,
  // portanto o professor recebe somente os agendamentos vinculados a ele.
  if (req.method === "GET" && pathMatches(req.path, "/api/agenda-avaliacoes")) return true;

  if (pathMatches(req.path, "/api/alunos")) return req.method === "GET";
  if (pathMatches(req.path, "/api/avaliacoes")) return ["GET", "POST", "PUT", "DELETE"].includes(req.method);
  if (pathMatches(req.path, "/api/treinos")) return ["GET", "POST", "PUT"].includes(req.method);

  return false;
}

function portalPermitido(req, user = {}) {
  return portalAlunoPermitido(req, user) || portalProfessorPermitido(req, user);
}

function clientKey(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function extrairToken(authorization = "") {
  const valor = String(authorization || "").trim();
  if (!valor) return "";
  if (valor.toLowerCase().startsWith("bearer ")) return valor.slice(7).trim();
  return valor;
}

async function autenticarSessao(req) {
  const authorization = req.headers.authorization || "";
  try {
    const usuario = await validarToken(authorization);
    return { ...usuario, origemSessao: "painel" };
  } catch (erroPainel) {
    const token = extrairToken(authorization);
    if (!token) throw erroPainel;
    try {
      const portal = validarTokenPortal(token);
      return {
        id: portal.sub,
        nome: portal.nome || "",
        perfil: portal.perfil || portal.tipo,
        permissoes: Array.isArray(portal.permissoes) ? portal.permissoes : [],
        portal: true,
        portalTipo: portal.tipo,
        acessoTodosAlunos: isResponsavelTecnico(portal),
        origemSessao: "portal",
        tenantId: portal.tenantId || ""
      };
    } catch {
      throw erroPainel;
    }
  }
}

function slugDaRotaPublica(pathname = "") {
  const rota = String(pathname || "").split("?")[0];

  if (rota === "/") return { tipo: "fusion" };

  const match = rota.match(/^\/([a-z0-9][a-z0-9_-]{1,79})(?:\/(matricula))?\/?$/i);
  if (!match) return null;

  const slug = normalizarTenantId(match[1]);
  if (!slug || RESERVED_PUBLIC_SLUGS.has(slug)) return null;

  return {
    tipo: match[2] === "matricula" ? "matricula" : "academia",
    slug
  };
}

async function tenantPublicoPorSlug(slug = "") {
  const normalizado = normalizarTenantId(slug);
  if (!normalizado) return null;

  const agora = Date.now();
  const cache = cacheSitePublico.get(normalizado);
  if (cache && agora - cache.em < CACHE_SITE_MS) return cache.valor;

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status")
    .or(`tenant_id.eq.${normalizado},slug.eq.${normalizado}`)
    .limit(2);

  if (error) throw error;

  const ativos = (data || []).filter(item =>
    ["active", "trial"].includes(String(item.status || "").toLowerCase())
  );

  const valor = ativos.length === 1 ? ativos[0] : null;
  cacheSitePublico.set(normalizado, { em: agora, valor });
  return valor;
}

async function servirRotaPublica(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) return false;

  const rota = slugDaRotaPublica(req.path);
  if (!rota) return false;

  res.setHeader("Cache-Control", "no-store");

  if (rota.tipo === "fusion") {
    res.sendFile(path.resolve(process.cwd(), "public/pages/comecar/index.html"));
    return true;
  }

  const tenant = await tenantPublicoPorSlug(rota.slug);
  if (!tenant) return false;

  res.setHeader("X-Fusion-Tenant", normalizarTenantId(tenant.tenant_id));
  res.setHeader("X-Fusion-Academia-Slug", String(tenant.slug || rota.slug));

  const arquivo = rota.tipo === "matricula"
    ? "public/pages/matricula-online/index.html"
    : "public/pages/promocao/index.html";

  res.sendFile(path.resolve(process.cwd(), arquivo));
  return true;
}

export function loginRateLimit(req, res, next) {
  const key = clientKey(req);
  const now = Date.now();
  let current = loginAttempts.get(key);

  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    current = { count: 0, startedAt: now };
    loginAttempts.set(key, current);
  }

  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - current.startedAt)) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      ok: false,
      mensagem: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
    });
  }

  res.once("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      loginAttempts.delete(key);
      return;
    }
    const state = loginAttempts.get(key) || { count: 0, startedAt: Date.now() };
    state.count += 1;
    loginAttempts.set(key, state);
  });

  return next();
}

export function clearLoginRateLimit(req) {
  loginAttempts.delete(clientKey(req));
}


function destinoCanonicoPublico(pathname = "") {
  const rota = String(pathname || "").split("?")[0].replace(/\/+/g, "/");

  if (/^\/(?:pages\/)?comecar(?:\/index\.html)?\/?$/i.test(rota)) {
    return "/";
  }

  const comecarTenant = rota.match(
    /^\/(?:pages\/)?comecar\/([a-z0-9][a-z0-9_-]{1,79})(?:\/index\.html)?\/?$/i
  );
  if (comecarTenant) {
    const slug = normalizarTenantId(comecarTenant[1]);
    if (slug && !RESERVED_PUBLIC_SLUGS.has(slug)) return `/${slug}`;
  }

  if (/^\/pages\/promocao(?:\/index\.html)?\/?$/i.test(rota)) {
    return "/";
  }

  if (/^\/pages\/matricula-online(?:\/index\.html)?\/?$/i.test(rota)) {
    return "/";
  }

  return "";
}

function redirecionarCanonicoPublico(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) return false;

  const destinoRota = destinoCanonicoPublico(req.path);
  if (!destinoRota) return false;

  res.setHeader("Cache-Control", "no-store");
  res.redirect(308, destinoRota);
  return true;
}

export async function securityHeaders(req, res, next) {
  if (redirecionarCanonicoPublico(req, res)) return;

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  try {
    if (await servirRotaPublica(req, res)) return;
  } catch (error) {
    console.error(`[Site público] Falha ao resolver academia: ${error.message}`);
    if (!res.headersSent) {
      return res.status(503).send("Não foi possível carregar o site da academia.");
    }
    return;
  }

  return next();
}

export async function apiSecurity(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  if (req.method === "OPTIONS") return next();

  if (isPublic(req)) {
    const authorization = req.headers.authorization || "";

    if (authorization) {
      try {
        const usuario = await autenticarSessao(req);
        if (usuario?.tenantId) {
          if (tenantConflita(req, usuario)) return responderConflitoTenant(res);
          req.usuario = usuario;
          res.setHeader("X-Fusion-Tenant", normalizarTenantId(usuario.tenantId));
          return executarComTenant(usuario.tenantId, () => executarEnforcementBilling(req, res, next));
        }
      } catch {}
    }

    const tenantPublico = tenantInformado(req);

    if (tenantPublico) {
      res.setHeader("X-Fusion-Tenant", tenantPublico);
      return executarComTenant(tenantPublico, () => executarEnforcementBilling(req, res, next));
    }

    if (publicExigeTenant(req)) {
      return res.status(400).json({
        ok: false,
        codigo: "FUSION_TENANT_REQUIRED",
        mensagem: "Academia não identificada. Acesse o site pelo endereço público da academia."
      });
    }

    return next();
  }

  try {
    req.usuario = await autenticarSessao(req);
  } catch (error) {
    return res.status(error.status || 401).json({
      ok: false,
      mensagem: error.message || "Autenticacao necessaria."
    });
  }

  if (tenantConflita(req, req.usuario)) {
    return responderConflitoTenant(res);
  }

  if (req.usuario?.supportAccess) {
    try {
      await validarSessaoSuporteAtiva(req.usuario);
    } catch (error) {
      return res.status(error.status || 401).json({
        ok: false,
        mensagem: error.message || "Sessão de suporte inválida."
      });
    }

    res.once("finish", () => {
      registrarAuditoriaSuporte(req.usuario, req, res.statusCode).catch(error => {
        console.warn(`[Suporte] Falha ao registrar auditoria: ${error.message}`);
      });
    });
  }

  if (isPortal(req.usuario) && !portalPermitido(req, req.usuario)) {
    return res.status(403).json({
      ok: false,
      mensagem: "Este portal nao tem acesso a esta operacao."
    });
  }

  if (ADMIN_PREFIXES.some(prefix => pathMatches(req.path, prefix)) && !isAdmin(req.usuario)) {
    return res.status(403).json({
      ok: false,
      mensagem: "Esta operacao exige perfil de administrador."
    });
  }

  if (!req.usuario?.tenantId) {
    return res.status(401).json({
      ok: false,
      mensagem: "Sessão sem empresa vinculada. Faça login novamente."
    });
  }

  res.setHeader("X-Fusion-Tenant", normalizarTenantId(req.usuario.tenantId));
  return executarComTenant(req.usuario.tenantId, () => executarEnforcementBilling(req, res, next));
}
