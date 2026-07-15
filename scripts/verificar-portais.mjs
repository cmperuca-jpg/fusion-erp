import fs from "node:fs";
import path from "node:path";
import { CANONICAL_PORTALS } from "../config/modules.config.mjs";

const root = process.cwd();
const server = fs.readFileSync(path.join(root, "server.mjs"), "utf8");
const toFile = (url) => path.join(root, "public", url.replace(/^\/pages\//, "pages/"));
const checks = [];

for (const [portal, cfg] of Object.entries(CANONICAL_PORTALS)) {
  checks.push({ portal, type: "canonical-page", value: cfg.page, ok: fs.existsSync(toFile(cfg.page)) });
  if (cfg.loginPage) checks.push({ portal, type: "login-page", value: cfg.loginPage, ok: fs.existsSync(toFile(cfg.loginPage)) });
  for (const legacy of cfg.legacyPages) {
    const normalized = legacy.replace(/index\.html$/, "");
    checks.push({ portal, type: "redirect", value: legacy, ok: server.includes(`["${normalized}", "${cfg.page}"]`) });
  }
}

const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ ok: failed.length === 0, canonical: CANONICAL_PORTALS, checks, failed }, null, 2));
if (failed.length) process.exitCode = 1;
