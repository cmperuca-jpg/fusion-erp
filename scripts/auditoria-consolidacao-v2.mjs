import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ignorar = new Set(['node_modules', '.git']);

function walk(dir, out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignorar.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const arquivos = walk(ROOT);
const html = arquivos.filter(f => f.endsWith('.html'));
const js = arquivos.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
const css = arquivos.filter(f => f.endsWith('.css'));
const backups = arquivos.filter(f => /backup|copia|copy/i.test(f));
const paginas = html.filter(f => f.includes(`${path.sep}public${path.sep}pages${path.sep}`));

const relatorio = {
  geradoEm: new Date().toISOString(),
  raiz: ROOT,
  totais: {
    arquivos: arquivos.length,
    html: html.length,
    javascript: js.length,
    css: css.length,
    possiveisBackups: backups.length,
    paginasPublicas: paginas.length
  },
  paginasPublicas: paginas.map(f => path.relative(ROOT, f)).sort(),
  possiveisBackups: backups.slice(0, 300).map(f => path.relative(ROOT, f)).sort()
};

const destino = path.join(ROOT, 'docs', 'auditoria-consolidacao-v2.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(relatorio, null, 2));
console.log(JSON.stringify(relatorio.totais, null, 2));
console.log(`Relatório salvo em ${path.relative(ROOT, destino)}`);
