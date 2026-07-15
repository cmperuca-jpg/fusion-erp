import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { CANONICAL_TRAINING } from "../../../config/modules.config.mjs";

const router = Router();
const ROOT = process.cwd();

function exists(relativePath) {
  return fs.existsSync(path.resolve(ROOT, relativePath));
}

router.get("/status", (_req, res) => {
  const checks = [
    { type: "module", value: CANONICAL_TRAINING.module, ok: exists(`modules/${CANONICAL_TRAINING.module}`) },
    { type: "routes", value: CANONICAL_TRAINING.api, ok: exists("modules/treinos/treinos.routes.mjs") },
    { type: "admin-page", value: CANONICAL_TRAINING.pages.admin, ok: exists("public/pages/treinos/index.html") },
    { type: "student-page", value: CANONICAL_TRAINING.pages.aluno, ok: exists("public/pages/aluno-treinos/index.html") }
  ];

  const legacy = CANONICAL_TRAINING.legacyModules.map((name) => ({
    module: name,
    exists: exists(`modules/${name}`),
    status: "compatibilidade-legada"
  }));

  res.json({
    ok: checks.every((item) => item.ok),
    version: "3.0.0-training-map",
    canonical: CANONICAL_TRAINING,
    checks,
    legacy,
    removalAuthorized: false,
    message: "Módulos antigos foram classificados, mas não removidos."
  });
});

export default router;
