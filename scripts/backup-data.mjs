import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const origem = path.join(root, "data");
const isRender = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);
const persistentRoot = process.env.FUSION_PERSISTENT_DIR || "/var/data/fusion";
const backupRoot = isRender ? path.join(persistentRoot, "backups", "data") : path.join(root, "backups", "data");

function dataHoraArquivo() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function listarArquivosRecursivo(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const itens = [];

  function percorrer(dir) {
    for (const nome of fs.readdirSync(dir)) {
      const absoluto = path.join(dir, nome);
      const relativo = path.relative(baseDir, absoluto).replace(/\\/g, "/");
      const stat = fs.statSync(absoluto);

      if (stat.isDirectory()) percorrer(absoluto);
      else itens.push({ arquivo: relativo, bytes: stat.size, modificadoEm: stat.mtime.toISOString() });
    }
  }

  percorrer(baseDir);
  return itens.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
}

async function main() {
  await fsp.mkdir(origem, { recursive: true });
  await fsp.mkdir(backupRoot, { recursive: true });

  const destino = path.join(backupRoot, `data-${dataHoraArquivo()}-manual-script`);
  await fsp.cp(origem, destino, { recursive: true, force: false, errorOnExist: true });

  const arquivos = listarArquivosRecursivo(destino);
  const manifest = {
    ok: true,
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    tipo: "backup-data-json",
    origem,
    destino,
    render: isRender,
    totalArquivos: arquivos.length,
    totalBytes: arquivos.reduce((total, item) => total + item.bytes, 0),
    criadoEm: new Date().toISOString(),
    arquivos
  };

  await fsp.writeFile(path.join(destino, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  console.log(JSON.stringify({ ok: true, mensagem: "Backup criado", destino, totalArquivos: arquivos.length }, null, 2));
}

main().catch((erro) => {
  console.error(JSON.stringify({ ok: false, mensagem: erro.message }, null, 2));
  process.exit(1);
});
