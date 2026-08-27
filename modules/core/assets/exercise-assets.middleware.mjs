import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const MAP_FILE = path.join(ROOT, "config", "exercise-assets-map.json");

let cache = { mtimeMs: -1, aliases: {} };

function carregarAliases() {
  try {
    const stat = fs.statSync(MAP_FILE);
    if (stat.mtimeMs === cache.mtimeMs) return cache.aliases;

    const parsed = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
    const configured = parsed?.aliases && typeof parsed.aliases === "object" ? parsed.aliases : {};
    const canonicalToFlash = {};

    for (const [source, target] of Object.entries(configured)) {
      if (!String(source).startsWith("/assets/exercicios/flash/")) continue;
      const absolute = path.resolve(PUBLIC_DIR, `.${source}`);
      if (absolute.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(absolute)) {
        canonicalToFlash[target] = source;
      }
    }

    const aliases = {};
    for (const [source, target] of Object.entries(configured)) {
      const flash = canonicalToFlash[target];
      if (flash) aliases[source] = flash;
    }
    for (const [canonical, flash] of Object.entries(canonicalToFlash)) {
      aliases[canonical] = flash;
      aliases[flash] = flash;
    }

    cache = { mtimeMs: stat.mtimeMs, aliases };
  } catch {
    cache = { mtimeMs: -1, aliases: {} };
  }

  return cache.aliases;
}

function decodeSafe(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function exerciseAssetCompatibility(req, res, next) {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  if (!req.path.startsWith("/assets/exercises/") && !req.path.startsWith("/assets/exercicios/")) return next();

  const aliases = carregarAliases();
  const target = aliases[decodeSafe(req.path)];
  if (!target) return next();

  const absolute = path.resolve(PUBLIC_DIR, `.${target}`);
  if (!absolute.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(absolute)) return next();

  res.setHeader("X-Fusion-Asset-Alias", target);
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  return res.sendFile(absolute);
}

export function exerciseAssetStatus() {
  const aliases = carregarAliases();
  return { ok: true, aliasCount: Object.keys(aliases).length };
}
