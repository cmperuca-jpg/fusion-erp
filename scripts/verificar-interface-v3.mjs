import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "public/assets/css/fusion-v3-standard.css",
  "public/assets/js/fusion-layout.js",
  "scripts/verificar-interface-v3.mjs"
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
const layout = fs.readFileSync(path.join(root, "public/assets/js/fusion-layout.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/assets/css/fusion-v3-standard.css"), "utf8");
const checks = {
  requiredFiles: missing.length === 0,
  stylesheetLoaded: layout.includes("fusion-v3-standard.css"),
  runtimeNormalizer: layout.includes("padronizarInterface"),
  standardHeader: css.includes(".fusion-standard-header"),
  standardControls: css.includes(".fusion-standard-control"),
  standardTables: css.includes(".fusion-standard-table"),
  mobileRules: css.includes("@media(max-width:640px)")
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: !missing.length && !failed.length, version: "3.0.0-interface-standard-final", checks, missing, failed };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
