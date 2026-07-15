import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const MAP = path.join(ROOT, "config", "exercise-assets-map.json");
const required = [
  "scripts/consolidar-gifs-v3.mjs",
  "scripts/verificar-gifs-v3.mjs",
  "modules/core/assets/exercise-assets.middleware.mjs",
  "config/exercise-assets-map.json"
];
const missing = required.filter(f => !fsSync.existsSync(path.join(ROOT, f)));
let invalidTargets = [];
let aliasCount = 0;
if (fsSync.existsSync(MAP)) {
  const parsed = JSON.parse(await fs.readFile(MAP, "utf8"));
  const aliases = parsed.aliases || {};
  aliasCount = Object.keys(aliases).length;
  invalidTargets = [...new Set(Object.values(aliases))].filter(url => !fsSync.existsSync(path.resolve(PUBLIC, `.${url}`)));
}
async function list(dir) {
  if (!fsSync.existsSync(dir)) return [];
  const out=[];
  for (const e of await fs.readdir(dir,{withFileTypes:true})) {
    const f=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...await list(f)); else if(/\.(gif|webp|png|jpe?g)$/i.test(e.name)) out.push(f);
  }
  return out;
}
const files=(await Promise.all([path.join(PUBLIC,"assets/exercises"),path.join(PUBLIC,"assets/exercicios")].map(list))).flat();
const hashes=new Map();
for(const f of files){const h=crypto.createHash("sha256").update(await fs.readFile(f)).digest("hex");hashes.set(h,(hashes.get(h)||0)+1)}
const remainingDuplicateGroups=[...hashes.values()].filter(n=>n>1).length;
const result={ok:missing.length===0&&invalidTargets.length===0,version:"3.0.0-assets-dedup",aliasCount,filesPresent:files.length,remainingDuplicateGroups,missing,invalidTargets};
console.log(JSON.stringify(result,null,2));
if(!result.ok) process.exitCode=1;
