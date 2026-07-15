import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

export const APP_CONFIG = Object.freeze({
  name: "Fusion ERP",
  version: "3.0.0-base",
  architectureVersion: 1,
  environment: process.env.NODE_ENV || "development",
  projectRoot: PROJECT_ROOT,
  publicDir: path.join(PROJECT_ROOT, "public"),
  dataDir: path.join(PROJECT_ROOT, "data"),
  uploadsDir: path.join(PROJECT_ROOT, "uploads"),
  docsDir: path.join(PROJECT_ROOT, "docs"),
  isProduction: (process.env.NODE_ENV || "development") === "production",
  isRender: Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL)
});
