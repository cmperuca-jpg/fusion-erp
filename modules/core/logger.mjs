function serialize(meta) { try { return meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""; } catch { return ""; } }
export const logger = Object.freeze({
  info(message, meta = {}) { console.log(`[Fusion V3][INFO] ${message}${serialize(meta)}`); },
  warn(message, meta = {}) { console.warn(`[Fusion V3][WARN] ${message}${serialize(meta)}`); },
  error(message, meta = {}) { console.error(`[Fusion V3][ERROR] ${message}${serialize(meta)}`); }
});
