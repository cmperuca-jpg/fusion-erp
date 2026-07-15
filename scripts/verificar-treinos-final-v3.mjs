import fs from "node:fs";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };

const root = process.cwd();
const names = [
  "biblioteca-inteligente", "exercicios", "exercicios-biblioteca", "modelos-treino",
  "treinos-ciclo", "treinos-consolidacao", "treinos-editor", "treinos-integrado",
  "treinos-montador", "treinos-operacional"
];
const compatRoot = path.join(root, "modules", "treinos", "compat");
const missingCompat = names.filter(name => !fs.existsSync(path.join(compatRoot, name)));
const oldTopLevel = names.filter(name => fs.existsSync(path.join(root, "modules", name)));
const routesFile = path.join(root, "modules", "treinos", "treinos.routes.mjs");
const routes = fs.readFileSync(routesFile, "utf8");
const invalidImports = names.filter(name => routes.includes(`../${name}/`));
const validImports = names.filter(name => routes.includes(`./compat/${name}/`));
const ok = !missingCompat.length && !oldTopLevel.length && !invalidImports.length && validImports.length === names.length;
console.log(JSON.stringify({
  ok,
  version: pkg.version,
  canonicalModule: "modules/treinos",
  compatibilityRoot: "modules/treinos/compat",
  movedModules: names.length,
  missingCompat,
  oldTopLevel,
  invalidImports,
  validImports: validImports.length,
  failed: [...missingCompat, ...oldTopLevel, ...invalidImports]
}, null, 2));
process.exitCode = ok ? 0 : 1;
