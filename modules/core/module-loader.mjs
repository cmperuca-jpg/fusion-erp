import { OFFICIAL_MODULES } from "../../config/modules.config.mjs";
export function isOfficialModule(name = "") { return OFFICIAL_MODULES.includes(String(name).trim()); }
export function listOfficialModules() { return [...OFFICIAL_MODULES]; }
