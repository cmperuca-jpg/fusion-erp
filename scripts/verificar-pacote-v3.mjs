import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const obrigatorios = [
  ".gitignore", ".npmignore", "scripts/empacotar-v3.mjs",
  "scripts/verificar-pacote-v3.mjs", "docs/PACOTE_LIMPO_V3.md"
];
const checks = [];
for (const rel of obrigatorios) {
  try { await fs.access(path.join(root, rel)); checks.push({ file: rel, ok: true }); }
  catch { checks.push({ file: rel, ok: false }); }
}
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
checks.push({ script: "v3:package", ok: Boolean(packageJson.scripts?.["v3:package"]) });
checks.push({ script: "v3:package:check", ok: Boolean(packageJson.scripts?.["v3:package:check"]) });
const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, version: packageJson.version, checks, failed }, null, 2));
if (failed.length) process.exitCode = 1;
