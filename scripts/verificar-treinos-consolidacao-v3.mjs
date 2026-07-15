import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routes = path.join(root, "modules", "treinos", "treinos.routes.mjs");
const source = fs.readFileSync(routes, "utf8");
const mounts = [
  "/exercicios", "/catalogo", "/biblioteca-inteligente", "/modelos",
  "/ciclo", "/consolidacao", "/editor", "/integrado", "/montador", "/operacional"
];
const checks = mounts.map(value => ({ value, ok: source.includes(`router.use(\"${value}\"`) }));
const failed = checks.filter(item => !item.ok);
console.log(JSON.stringify({
  ok: failed.length === 0,
  version: "3.0.0-training-consolidation",
  canonicalApi: "/api/treinos",
  checks,
  failed
}, null, 2));
if (failed.length) process.exit(1);
