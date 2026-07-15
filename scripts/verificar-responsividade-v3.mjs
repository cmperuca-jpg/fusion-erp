import fs from "node:fs";

const required = [
  "public/assets/css/fusion-v3-responsive.css",
  "public/assets/js/fusion-layout.js",
  "scripts/verificar-responsividade-v3.mjs"
];
const missing = required.filter((file) => !fs.existsSync(file));
const css = fs.readFileSync("public/assets/css/fusion-v3-responsive.css", "utf8");
const js = fs.readFileSync("public/assets/js/fusion-layout.js", "utf8");
const checks = {
  requiredFiles: missing.length === 0,
  viewportFit: js.includes("viewport-fit=cover"),
  dynamicViewport: js.includes("--fusion-v3-vh") && css.includes("--fusion-v3-vh"),
  responsiveTables: js.includes("prepararTabelasResponsivas") && css.includes("fusion-responsive-table"),
  modalLock: js.includes("sincronizarBloqueioModal") && css.includes("fusion-modal-open"),
  mobileMenu: css.includes("fusion-menu-open") || fs.readFileSync("public/assets/css/fusion-v3-layout.css", "utf8").includes("fusion-menu-open"),
  safeArea: css.includes("safe-area-inset-bottom"),
  smallScreens: css.includes("max-width:420px")
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, version: "3.0.0-responsive-final", checks, missing, failed };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
