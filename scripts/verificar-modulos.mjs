import fs from "node:fs";
import path from "node:path";
import {
  OFFICIAL_MODULES,
  LEGACY_OR_CONSOLIDATION_CANDIDATES,
  INFRASTRUCTURE_MODULES,
  CANONICAL_TRAINING
} from "../config/modules.config.mjs";

const dir = path.resolve(process.cwd(), "modules");
const existing = fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
  : [];
const trainingLegacy = CANONICAL_TRAINING.compatibilityModules || [];
const missing = OFFICIAL_MODULES.filter(m => !existing.includes(m));
const consolidationCandidates = existing.filter(m => LEGACY_OR_CONSOLIDATION_CANDIDATES.includes(m));
const legacyCompatibility = trainingLegacy.filter(name => fs.existsSync(path.join(dir, "treinos", "compat", name)));
const infrastructure = existing.filter(m => INFRASTRUCTURE_MODULES.includes(m));
const classified = new Set([
  ...OFFICIAL_MODULES,
  ...LEGACY_OR_CONSOLIDATION_CANDIDATES,
  ...trainingLegacy,
  ...INFRASTRUCTURE_MODULES
]);
const unclassified = existing.filter(m => !classified.has(m));

console.log(JSON.stringify({
  ok: missing.length === 0,
  official: OFFICIAL_MODULES,
  existingCount: existing.length,
  missing,
  consolidationCandidates,
  legacyCompatibility,
  infrastructure,
  unclassified
}, null, 2));
process.exitCode = missing.length ? 1 : 0;
