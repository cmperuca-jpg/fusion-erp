import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "modules/core/access/access.routes.mjs",
  "modules/access-engine/access-engine.routes.mjs",
  "modules/access-engine/access-engine.service.mjs",
  "modules/henry7x/henry7x.routes.mjs",
  "modules/henry7x/henry7x.service.mjs",
  "modules/biometria/biometria.routes.mjs",
  "modules/biometria/biometria.service.mjs",
  "scripts/fusion-access-agent.mjs",
  "public/pages/access-engine/index.html",
  "public/assets/js/fusion-layout.js"
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
const server = fs.readFileSync(path.join(root, "server.mjs"), "utf8");
const route = fs.readFileSync(path.join(root, "modules/core/access/access.routes.mjs"), "utf8");
const layout = fs.readFileSync(path.join(root, "public/assets/js/fusion-layout.js"), "utf8");
const checks = {
  requiredFiles: missing.length === 0,
  canonicalMounted: server.includes('app.use("/api/v3/access", accessV3Routes)'),
  statusRoute: route.includes('router.get("/status"'),
  liberarRoute: route.includes('router.post("/catraca/liberar"'),
  biometriaStart: route.includes('router.post("/biometria/iniciar"'),
  biometriaStop: route.includes('router.post("/biometria/parar"'),
  layoutUsesCanonicalApi: layout.includes('/api/v3/access/catraca/liberar')
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  version: "3.0.0-acesso-final",
  canonicalApi: "/api/v3/access",
  compatibilityApis: ["/api/access-engine", "/api/henry7x", "/api/biometria", "/api/access-bridge"],
  checks,
  missing,
  failed
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
