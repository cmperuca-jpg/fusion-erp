import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "modules/security/api-security.middleware.mjs",
  "modules/auth/auth.service.mjs",
  "modules/auth/auth.routes.mjs",
  "public/assets/js/fusion-auth.js"
];
const missing = [];
for (const file of required) {
  try { await fs.access(path.join(root, file)); } catch { missing.push(file); }
}
const middleware = await fs.readFile(path.join(root, required[0]), "utf8");
const auth = await fs.readFile(path.join(root, required[1]), "utf8");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const checks = {
  requiredFiles: missing.length === 0,
  bcrypt: auth.includes('from "bcrypt"') && auth.includes("senhaBcrypt"),
  legacyMigration: auth.includes("senhaHashLegado") && auth.includes("delete usuario.senhaHash"),
  atomicUserWrite: auth.includes(".tmp-${process.pid}-${Date.now()}") && auth.includes("fs.rename"),
  rateLimitFailuresOnly: middleware.includes('res.once("finish"') && middleware.includes("state.count += 1"),
  retryAfterHeader: middleware.includes('res.setHeader("Retry-After"'),
  apiProtection: middleware.includes("export async function apiSecurity"),
  scriptRegistered: Boolean(pkg.scripts?.["v3:seguranca-final:check"])
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, version: pkg.version, checks, missing, failed };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
