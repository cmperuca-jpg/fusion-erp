import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const backupDir = path.join(root, 'backups', `layout-unico-v2-${Date.now()}`);

const arquivos = [
  ['public/assets/js/fusion-layout.js', 'public/assets/js/fusion-layout.js'],
  ['public/assets/css/fusion-app.css', 'public/assets/css/fusion-app.css'],
  ['public/components/sidebar.html', 'public/components/sidebar.html']
];

async function existe(p) { try { await fs.access(p); return true; } catch { return false; } }
async function backup(rel) {
  const abs = path.join(root, rel);
  if (!(await existe(abs))) return;
  const dest = path.join(backupDir, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(abs, dest);
}
async function copiar(srcRel, destRel) {
  const src = path.join(root, srcRel);
  const dest = path.join(root, destRel);
  await backup(destRel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function garantirFusionLayoutNoHtml(rel) {
  const abs = path.join(root, rel);
  if (!(await existe(abs))) return false;
  await backup(rel);
  let html = await fs.readFile(abs, 'utf8');

  // Remove chamadas antigas que montavam outro layout/menu.
  html = html.replace(/\s*<script\s+src=["']\/js\/layout\.js["']><\/script>/gi, '');
  html = html.replace(/\s*<script\s+src=["']\/js\/dashboard\.js["']><\/script>/gi, '');
  html = html.replace(/\s*<link\s+rel=["']stylesheet["']\s+href=["']\/css\/layout\.css["']\s*\/?\s*>/gi, '');

  // Garante CSS global.
  if (!html.includes('/assets/css/fusion-app.css')) {
    html = html.replace(/<\/head>/i, '  <link rel="stylesheet" href="/assets/css/fusion-app.css">\n</head>');
  }

  // Garante JS global uma única vez.
  html = html.replace(/\s*<script\s+src=["']\/assets\/js\/fusion-layout\.js["']><\/script>/gi, '');
  html = html.replace(/<\/body>/i, '  <script src="/assets/js/fusion-layout.js"></script>\n</body>');

  await fs.writeFile(abs, html, 'utf8');
  return true;
}

async function listarHtml(dir) {
  const saida = [];
  async function walk(d) {
    let itens = [];
    try { itens = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const item of itens) {
      const p = path.join(d, item.name);
      if (item.isDirectory()) await walk(p);
      else if (item.isFile() && item.name.toLowerCase().endsWith('.html')) saida.push(path.relative(root, p).replaceAll('\\\\','/').replaceAll('\\','/'));
    }
  }
  await walk(dir);
  return saida;
}

await fs.mkdir(backupDir, { recursive: true });
for (const [src, dest] of arquivos) await copiar(src, dest);

const htmls = await listarHtml(path.join(root, 'public', 'pages'));
let atualizados = 0;
for (const rel of htmls) {
  if (await garantirFusionLayoutNoHtml(rel)) atualizados++;
}

console.log('Layout único aplicado com segurança.');
console.log(JSON.stringify({ backup: path.relative(root, backupDir), htmlsAtualizados: atualizados }, null, 2));
