import { validarToken, validarTokenPortal } from "../auth/auth.service.mjs";

const PUBLIC_RULES = [
  ["GET", "/api/health"],
  ["GET", "/api/v3/architecture/status"],
  ["GET", "/api/v3/persistence/status"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/professores/login"],
  ["POST", "/api/treinos/aluno-login"],
  ["POST", "/api/matricula-online"],
  ["GET", "/api/matricula-online/validar-cpf"],
  ["GET", "/api/planos"],
  ["POST", "/api/leads"],
  ["POST", "/api/site-chat"],
  ["POST", "/api/site-chat/mensagens"],
  ["GET", "/api/site-chat/mensagens"],
  ["POST", "/api/aluno-login"],
  ["POST", "/api/access-onboarding/ativar"],
  ["GET", "/api/reconhecimento-facial/terminal", "prefix"],
  ["POST", "/api/reconhecimento-facial/terminal", "prefix"],
  ["GET", "/api/reconhecimento-facial/agent", "prefix"],
  ["POST", "/api/reconhecimento-facial/agent", "prefix"],
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

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function pathMatches(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublic(req) {
  return PUBLIC_RULES.some(([method, routePath, match = "exact"]) => {
    if (req.method !== method) return false;
    return match === "prefix" ? pathMatches(req.path, routePath) : req.path === routePath;
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

function portalAlunoPermitido(req, user = {}) {
  if (!isPortal(user, "aluno")) return false;
  const alunoId = String(user.id || "");

  if (req.method === "GET" && alunoIdNoPath(req)) return mesmoId(alunoIdNoPath(req), alunoId);
  if (req.method === "GET" && req.path === "/api/treinos") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/avaliacoes") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/mensalidades") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && pathMatches(req.path, "/api/mensalidades/aluno")) return mesmoId(req.path.split("/").pop(), alunoId);
  if (req.method === "GET" && req.path === "/api/financeiro") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/treinos/aluno-sessao") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "GET" && req.path === "/api/treinos/aluno-catraca-contador") return mesmoId(alunoIdDaRequisicao(req), alunoId);
  if (req.method === "POST" && req.path === "/api/treinos/aluno-liberar-catraca") return mesmoId(alunoIdDaRequisicao(req), alunoId);

  return false;
}

function portalProfessorPermitido(req, user = {}) {
  if (!isPortal(user, "professor")) return false;
  const tecnico = isResponsavelTecnico(user);

  if (req.method === "GET" && req.path === "/api/professores/sessao") return true;
  if (req.method === "GET" && req.path === "/api/treinos/biblioteca") return true;

  if (pathMatches(req.path, "/api/professores")) {
    if (req.method === "GET" && req.path === "/api/professores") return tecnico;
    if (req.method === "PUT" && /\/status$/i.test(req.path)) return tecnico;
    return false;
  }

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
        origemSessao: "portal"
      };
    } catch {
      throw erroPainel;
    }
  }
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

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
}

export async function apiSecurity(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  if (req.method === "OPTIONS" || isPublic(req)) return next();

  try {
    req.usuario = await autenticarSessao(req);
  } catch (error) {
    return res.status(error.status || 401).json({
      ok: false,
      mensagem: error.message || "Autenticacao necessaria."
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

  return next();
}
