import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacy = path.join(root, 'public', 'js', 'avaliacoes.js');
const oficial = path.join(root, 'public', 'pages', 'avaliacoes', 'index.html');

if (!fs.existsSync(oficial)) {
  console.error('Página oficial não encontrada:', oficial);
  process.exit(1);
}

if (fs.existsSync(legacy)) {
  fs.writeFileSync(legacy, `// Avaliação legada desativada.
// Página oficial: /pages/avaliacoes/index.html
window.FusionAvaliacaoLegado = { oficial: '/pages/avaliacoes/index.html' };
`, 'utf8');
  console.log('Legado neutralizado:', legacy);
} else {
  console.log('Nenhum legado public/js/avaliacoes.js encontrado.');
}

console.log('Avaliação oficial preservada em public/pages/avaliacoes/.');
