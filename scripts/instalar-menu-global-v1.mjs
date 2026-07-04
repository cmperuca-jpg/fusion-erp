import fs from 'fs/promises';
import path from 'path';

const raiz = process.cwd();
const css = path.join(raiz, 'public/assets/css/fusion-app.css');

async function existe(arquivo) {
  try { await fs.access(arquivo); return true; } catch { return false; }
}

async function main() {
  if (!(await existe(css))) {
    console.log('Arquivo public/assets/css/fusion-app.css não encontrado. Extraia o ZIP na raiz do projeto.');
    process.exit(1);
  }
  console.log('Menu global padronizado em public/assets/css/fusion-app.css');
  console.log('Reinicie o servidor com: npm start');
}

main();
