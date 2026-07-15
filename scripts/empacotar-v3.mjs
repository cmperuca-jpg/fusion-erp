import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist");
const STAGE = path.join(OUT_DIR, "fusion-erp");
const ZIP = path.join(OUT_DIR, "FusionERP_V3_DISTRIBUICAO_LIMPA.zip");

const EXCLUDED_DIRS = new Set([
  ".git", ".github", "node_modules", "dist", "coverage", "backups",
  "uploads", "logs", "tmp", "temp", ".cache", ".vscode"
]);
const EXCLUDED_FILES = new Set([".env", "Thumbs.db", ".DS_Store"]);
const EXCLUDED_EXT = new Set([".log", ".tmp", ".bak", ".old", ".orig", ".zip"]);

function deveIgnorar(rel, dirent) {
  const partes = rel.split(/[\\/]/).filter(Boolean);
  if (partes.some(p => EXCLUDED_DIRS.has(p))) return true;
  if (!dirent.isDirectory()) {
    if (EXCLUDED_FILES.has(dirent.name)) return true;
    if (EXCLUDED_EXT.has(path.extname(dirent.name).toLowerCase())) return true;
    if (/^npm-debug\.log/i.test(dirent.name)) return true;
  }
  return false;
}

async function copiarDiretorio(origem, destino, relBase = "") {
  await fs.mkdir(destino, { recursive: true });
  const entradas = await fs.readdir(origem, { withFileTypes: true });
  for (const entrada of entradas) {
    const rel = path.join(relBase, entrada.name);
    if (deveIgnorar(rel, entrada)) continue;
    const src = path.join(origem, entrada.name);
    const dst = path.join(destino, entrada.name);
    if (entrada.isDirectory()) await copiarDiretorio(src, dst, rel);
    else if (entrada.isFile()) await fs.copyFile(src, dst);
  }
}

async function compactarWindows() {
  const comando = `Compress-Archive -LiteralPath '${STAGE.replace(/'/g, "''")}' -DestinationPath '${ZIP.replace(/'/g, "''")}' -Force`;
  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", comando], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
}

async function compactarUnix() {
  await execFileAsync("zip", ["-qr", ZIP, "fusion-erp"], { cwd: OUT_DIR, maxBuffer: 20 * 1024 * 1024 });
}

async function contar(dir) {
  let arquivos = 0, bytes = 0;
  for (const entrada of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      const r = await contar(full); arquivos += r.arquivos; bytes += r.bytes;
    } else if (entrada.isFile()) {
      arquivos += 1; bytes += (await fs.stat(full)).size;
    }
  }
  return { arquivos, bytes };
}

await fs.rm(OUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUT_DIR, { recursive: true });
await copiarDiretorio(ROOT, STAGE);
if (fsSync.existsSync(ZIP)) await fs.rm(ZIP, { force: true });
if (os.platform() === "win32") await compactarWindows(); else await compactarUnix();
const resumo = await contar(STAGE);
const zipBytes = (await fs.stat(ZIP)).size;
console.log(JSON.stringify({ ok: true, arquivo: ZIP, arquivos: resumo.arquivos, tamanhoDescompactadoMB: Number((resumo.bytes/1024/1024).toFixed(2)), tamanhoZipMB: Number((zipBytes/1024/1024).toFixed(2)) }, null, 2));
