export const SECURITY_CONFIG = Object.freeze({
  jwtSecretConfigured: Boolean(process.env.JWT_SECRET || process.env.FUSION_JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  corsOrigins: String(process.env.CORS_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean),
  requireApiAuthentication: String(process.env.FUSION_REQUIRE_API_AUTH || "true").toLowerCase() !== "false",
  passwordAlgorithm: "bcrypt",
  minimumPasswordLength: Number(process.env.FUSION_MIN_PASSWORD_LENGTH || 8)
});

export function securityWarnings() {
  const warnings = [];
  if (!SECURITY_CONFIG.jwtSecretConfigured) warnings.push("JWT_SECRET não configurado; não usar segredo padrão em produção.");
  if (process.env.NODE_ENV === "production" && !SECURITY_CONFIG.corsOrigins.length) warnings.push("CORS_ORIGINS não configurado em produção.");
  return warnings;
}
