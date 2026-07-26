import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const ignored = new Set([
  "node_modules", ".git", ".github", "dist", "backups", "uploads", "logs",
  "data", "coverage", "tmp", "temp", ".cache", ".vscode"
]);
const ignoredFiles = [
  /^scripts\/instalar-/,
  /^scripts\/homologar-ativacao-sincronizada-261l\.mjs$/
];
const files = [];
function deveIgnorarArquivo(file) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  return ignoredFiles.some(pattern => pattern.test(rel));
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(mjs|js)$/.test(entry.name) && !deveIgnorarArquivo(full)) files.push(full);
  }
}
walk(root);
const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push({ file: path.relative(root, file), error: (result.stderr || result.stdout).trim() });
}
console.log(JSON.stringify({ ok: failures.length === 0, checked: files.length, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
