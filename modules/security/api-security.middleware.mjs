import { validarToken } from "../auth/auth.service.mjs";

const PUBLIC_RULES = [
  ["GET", "/api/health"],
  ["GET", "/api/v3/architecture/status"],
  ["GET", "/api/v3/persistence/status"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/matricula-online"],
  ["GET", "/api/matricula-online"],
  ["POST", "/api/leads"],
  ["POST", "/api/chat"],
  ["GET", "/api/chat"],
  ["POST", "/api/site-chat"],
  ["GET", "/api/site-chat"],
  ["POST", "/api/treinos/aluno-login"],
  ["POST", "/api/aluno-login"],
  ["POST", "/api/access-onboarding/ativar"],
  ["GET", "/api/reconhecimento-facial/terminal"],
  ["POST", "/api/reconhecimento-facial/terminal"],
  ["GET", "/api/reconhecimento-facial/agent"],
  ["POST", "/api/reconhecimento-facial/agent"],
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
  return PUBLIC_RULES.some(([method, prefix]) => req.method === method && pathMatches(req.path, prefix));
}

function isAdmin(user = {}) {
  const perfil = String(user.perfil || "").toLowerCase();
  const permissions = Array.isArray(user.permissoes) ? user.permissoes : [];
  return perfil === "administrador" || perfil === "admin" || permissions.includes("*");
}

function clientKey(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown");
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
    req.usuario = await validarToken(req.headers.authorization || "");
  } catch (error) {
    return res.status(error.status || 401).json({
      ok: false,
      mensagem: error.message || "Autenticação necessária."
    });
  }

  if (ADMIN_PREFIXES.some(prefix => pathMatches(req.path, prefix)) && !isAdmin(req.usuario)) {
    return res.status(403).json({
      ok: false,
      mensagem: "Esta operação exige perfil de administrador."
    });
  }

  return next();
}
