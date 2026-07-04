import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public", "assets", "js", "fusion-layout.js");
const BACKUP_DIR = path.join(ROOT, "backups", `layout-login-publico-${Date.now()}`);
const PATCH_FILE = path.join(ROOT, "public", "assets", "js", "fusion-layout.js");

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function main() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  if (await exists(PATCH_FILE)) {
    await fs.copyFile(PATCH_FILE, path.join(BACKUP_DIR, "fusion-layout.js.bak"));
  }

  const origem = path.join(ROOT, "_fusion_patch", "public", "assets", "js", "fusion-layout.js");
  const fallback = path.join(ROOT, "public", "assets", "js", "fusion-layout.js");

  let conteudo;
  try {
    conteudo = await fs.readFile(origem, "utf-8");
  } catch {
    conteudo = await fs.readFile(fallback, "utf-8");
  }

  if (!conteudo.includes("function isPublicPage")) {
    conteudo = conteudo.replace('(function () {', `(function () {\n  function isPublicPage(pathname) {\n    const path = String(pathname || "").toLowerCase();\n    const publicPrefixes = ["/pages/login/", "/pages/login/index.html", "/login/", "/login/index.html"];\n    return publicPrefixes.some((prefix) => path === prefix || path.startsWith(prefix));\n  }`);
  }

  conteudo = conteudo.replace(
    /function init\(\) \{\s*const moduleName = moduleFromPath\(location\.pathname\);/,
    `function init() {\n    if (isPublicPage(location.pathname)) {\n      document.body.classList.add("fusion-layout-public");\n      return;\n    }\n    const moduleName = moduleFromPath(location.pathname);`
  );

  conteudo = conteudo.replace(
    "window.FusionLayout = { init, moduleFromPath };",
    "window.FusionLayout = { init, moduleFromPath, isPublicPage };"
  );

  await fs.writeFile(PATCH_FILE, conteudo, "utf-8");

  console.log("Correção aplicada: login e páginas públicas não recebem menu/topbar global.");
  console.log(`Backup criado em: ${BACKUP_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
