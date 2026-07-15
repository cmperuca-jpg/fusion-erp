import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "modules/security/api-security.middleware.mjs",
  "modules/auth/auth.service.mjs",
  "public/assets/js/fusion-auth.js"
];

const missing = [];
for (const relative of required) {
  try { await fs.access(path.join(root, relative)); }
  catch { missing.push(relative); }
}

const auth = await fs.readFile(path.join(root, "modules/auth/auth.service.mjs"), "utf8");
const checks = {
  bcrypt: auth.includes("bcrypt"),
  legacyMigration: auth.includes("senhaHashLegado") && auth.includes("senhaBcrypt"),
  jwtConfigured: Boolean(process.env.JWT_SECRET || process.env.FUSION_JWT_SECRET),
  requiredFiles: missing.length === 0
};

const ok = checks.bcrypt && checks.legacyMigration && checks.requiredFiles;
console.log(JSON.stringify({ ok, checks, missing, warning: checks.jwtConfigured ? null : "JWT_SECRET não configurado; aceitável apenas em desenvolvimento local." }, null, 2));
if (!ok) process.exitCode = 1;
