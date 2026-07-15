import fs from "node:fs";
import path from "node:path";
import { CANONICAL_TRAINING } from "../config/modules.config.mjs";

const root = process.cwd();
const required = [
  "modules/treinos/treinos.routes.mjs",
  "modules/treinos/treinos.service.mjs",
  "modules/treinos/treinos.repository.mjs",
  "modules/treinos/treinos.schema.mjs",
  "public/pages/treinos/index.html",
  "public/pages/aluno-treinos/index.html"
];
const checks = required.map(file => ({ file, ok: fs.existsSync(path.join(root, file)) }));
const legacy = (CANONICAL_TRAINING.compatibilityModules || []).map(name => ({ name, exists: fs.existsSync(path.join(root, "modules", "treinos", "compat", name)) }));
const failed = checks.filter(item => !item.ok);
const result = { ok: failed.length === 0, canonical: CANONICAL_TRAINING, checks, legacy, failed };
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
