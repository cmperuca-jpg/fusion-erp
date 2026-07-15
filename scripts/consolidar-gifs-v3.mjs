import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const PUBLIC = path.join(ROOT, "public");
const ROOTS = [
  path.join(PUBLIC, "assets", "exercises"),
  path.join(PUBLIC, "assets", "exercicios")
];
const MAP_FILE = path.join(ROOT, "config", "exercise-assets-map.json");
const REPORT_FILE = path.join(ROOT, "docs", "RELATORIO_GIFS_V3.json");
const DRY_RUN = process.argv.includes("--dry-run");

function toPosix(v) { return v.split(path.sep).join("/"); }
function publicUrl(file) { return `/${toPosix(path.relative(PUBLIC, file))}`; }
function score(file) {
  const rel = toPosix(path.relative(PUBLIC, file));
  if (/^assets\/exercises\/(?!IMPORTADOS_FLASH\/)[^/]+\//i.test(rel)) return 0;
  if (/^assets\/exercises\/IMPORTADOS_FLASH\//i.test(rel)) return 1;
  if (/^assets\/exercicios\/flash\//i.test(rel)) return 2;
  return 3;
}
async function listFiles(dir) {
  const out = [];
  if (!fsSync.existsSync(dir)) return out;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else if (/\.(gif|webp|png|jpe?g)$/i.test(entry.name)) out.push(full);
  }
  return out;
}
async function sha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(file));
  return hash.digest("hex");
}
async function removeEmptyDirs(dir) {
  if (!fsSync.existsSync(dir)) return;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await removeEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== ROOTS[0] && dir !== ROOTS[1] && (await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
}

const files = (await Promise.all(ROOTS.map(listFiles))).flat();
const byHash = new Map();
for (const file of files) {
  const hash = await sha256(file);
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(file);
}

const aliases = {};
const removals = [];
let bytesSaved = 0;
let duplicateGroups = 0;
for (const group of byHash.values()) {
  if (group.length < 2) continue;
  duplicateGroups += 1;
  const ordered = [...group].sort((a, b) => score(a) - score(b) || publicUrl(a).localeCompare(publicUrl(b), "pt-BR"));
  const canonical = ordered[0];
  const canonicalUrl = publicUrl(canonical);
  for (const duplicate of ordered.slice(1)) {
    const oldUrl = publicUrl(duplicate);
    aliases[decodeURIComponent(oldUrl)] = decodeURIComponent(canonicalUrl);
    removals.push({ oldUrl, canonicalUrl, file: duplicate });
    bytesSaved += (await fs.stat(duplicate)).size;
  }
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  canonicalRoot: "/assets/exercises",
  aliasCount: Object.keys(aliases).length,
  aliases
};
await fs.mkdir(path.dirname(MAP_FILE), { recursive: true });
await fs.writeFile(MAP_FILE, JSON.stringify(manifest, null, 2), "utf8");

if (!DRY_RUN) {
  for (const item of removals) await fs.rm(item.file, { force: true });
  for (const dir of ROOTS) await removeEmptyDirs(dir);
}

const report = {
  ok: true,
  dryRun: DRY_RUN,
  scannedFiles: files.length,
  uniqueContents: byHash.size,
  duplicateGroups,
  removedFiles: DRY_RUN ? 0 : removals.length,
  removableFiles: removals.length,
  bytesSaved: DRY_RUN ? 0 : bytesSaved,
  potentialBytesSaved: bytesSaved,
  mapFile: toPosix(path.relative(ROOT, MAP_FILE))
};
await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
