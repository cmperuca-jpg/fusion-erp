import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "modules/alunos/alunos.routes.mjs",
  "modules/alunos/alunos.service.mjs",
  "modules/alunos/alunos.repository.mjs",
  "modules/alunos/alunos.schema.mjs",
  "public/pages/alunos/index.html",
  "public/pages/alunos/index.js",
  "public/pages/alunos/prontuario.html",
  "public/pages/alunos/prontuario.js"
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
const server = fs.readFileSync(path.join(root, "server.mjs"), "utf8");
const repository = fs.readFileSync(path.join(root, "modules/alunos/alunos.repository.mjs"), "utf8");
const professor = fs.readFileSync(path.join(root, "public/pages/professor-painel/index.js"), "utf8");
const checks = {
  requiredFiles: missing.length === 0,
  cadastroRedirect: server.includes('["/pages/alunos/cadastro.html", "/pages/alunos/index.html"]'),
  fichaRedirect: server.includes('["/pages/alunos/ficha.html", "/pages/alunos/prontuario.html"]'),
  queryPreserved: server.includes('req.originalUrl.slice(req.originalUrl.indexOf("?"))'),
  repositoryProtectsId: repository.includes("id: alunos[index].id"),
  repositoryTimestamps: repository.includes("atualizadoEm: agora"),
  professorUsesProntuario: professor.includes("/pages/alunos/prontuario.html") && !professor.includes("/pages/alunos/ficha.html")
};
const failed = Object.entries(checks).filter(([,ok]) => !ok).map(([name]) => name);
const result = { ok: missing.length === 0 && failed.length === 0, version: "3.0.0-alunos-final", checks, missing, failed };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
