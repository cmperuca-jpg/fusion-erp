import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "../../..");
const PUBLIC = path.join(ROOT, "public");
const MAP_FILE = path.join(ROOT, "config", "exercise-assets-map.json");

let cache = { mtimeMs: -1, aliases: {} };
function loadAliases() {
  try {
    const stat = fs.statSync(MAP_FILE);
    if (stat.mtimeMs === cache.mtimeMs) return cache.aliases;
    const parsed = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
    cache = { mtimeMs: stat.mtimeMs, aliases: parsed?.aliases || {} };
  } catch {
    cache = { mtimeMs: -1, aliases: {} };
  }
  return cache.aliases;
}
function decodeSafe(value) { try { return decodeURIComponent(value); } catch { return value; } }

export function exerciseAssetCompatibility(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  if (!req.path.startsWith('/assets/exercises/') && !req.path.startsWith('/assets/exercicios/')) return next();
  const aliases = loadAliases();
  const target = aliases[decodeSafe(req.path)];
  if (!target) return next();
  const absolute = path.resolve(PUBLIC, `.${target}`);
  if (!absolute.startsWith(PUBLIC + path.sep) || !fs.existsSync(absolute)) return next();
  res.setHeader('X-Fusion-Asset-Alias', target);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(absolute);
}

export function exerciseAssetStatus() {
  const aliases = loadAliases();
  return { ok: true, mapFile: 'config/exercise-assets-map.json', aliasCount: Object.keys(aliases).length };
}
