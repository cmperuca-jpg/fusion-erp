import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pkg from "../package.json" with { type: "json" };

const root = process.cwd();
const required = [
  "modules/importador-access/importador-access.routes.mjs",
  "modules/importador-access/alunos/importador-alunos.service.mjs",
  "modules/importador-access/fotos/importador-fotos.service.mjs",
  "modules/avaliacoes/importacao/importador-avaliacoes.service.mjs",
  "public/pages/migracao-dados/index.html",
  "public/pages/importador-access/index.html",
  "public/pages/importador-fotos/index.html",
  "public/pages/importador-avaliacoes/index.html"
];
const oldFiles = [
  "modules/importador-access/importador-access.service.mjs",
  "modules/importador-access/importador-fotos.service.mjs",
  "modules/importador-access/importador-avaliacoes.service.mjs"
];
const missing = required.filter(file => !fs.existsSync(path.join(root,file)));
const forbidden = oldFiles.filter(file => fs.existsSync(path.join(root,file)));
const routes = fs.readFileSync(path.join(root,"modules/importador-access/importador-access.routes.mjs"),"utf8");
const checks = {
  requiredFiles: missing.length === 0,
  oldServicesRemoved: forbidden.length === 0,
  alunosCanonical: routes.includes('./alunos/importador-alunos.service.mjs'),
  fotosCanonical: routes.includes('./fotos/importador-fotos.service.mjs'),
  avaliacoesCanonical: routes.includes('../avaliacoes/importacao/importador-avaliacoes.service.mjs'),
  statusRoute: routes.includes('router.get("/v3/status"'),
  scriptRegistered: Boolean(pkg.scripts?.["v3:importadores:check"])
};
const failed = Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const result = { ok: failed.length===0, version: pkg.version, canonicalModule:"modules/importador-access", checks, missing, forbidden, failed };
console.log(JSON.stringify(result,null,2));
if (!result.ok) process.exit(1);
