import fs from 'fs/promises';
import path from 'path';

const raiz = process.cwd();
const destino = path.join(raiz, 'public', 'assets', 'js', 'fusion-layout.js');
const origem = path.join(raiz, 'public', 'assets', 'js', 'fusion-layout.js');

async function existe(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

const backup = destino + '.bak-menu-bi-v5-' + Date.now();
if (await existe(destino)) await fs.copyFile(destino, backup);
await fs.copyFile(origem, destino);
console.log('Menu global corrigido com rotas reais de BI:');
console.log('- /pages/bi/index.html');
console.log('- /pages/bi-financeiro/index.html');
console.log('- /pages/bi-academia-operacional/index.html');
console.log('- /pages/bi-academia/index.html');
console.log('Backup anterior:', backup);
