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
  "scripts/fusion-access-agent.mjs"
];
const checks = required.map(file => ({ file, ok: fs.existsSync(path.join(root, file)) }));
const server = fs.readFileSync(path.join(root, "server.mjs"), "utf8");
const routeMounted = server.includes('app.use("/api/v3/access", accessV3Routes)');
const failed = checks.filter(item => !item.ok);
const result = {
  ok: failed.length === 0 && routeMounted,
  version: "3.0.0-access-consolidation",
  canonicalApi: "/api/v3/access",
  routeMounted,
  checks,
  policy: {
    physicalExecution: "fusion-access-agent",
    biometricPort: 3041,
    directHenryRoutes: "compatibility-only"
  },
  failed
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
