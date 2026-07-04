import fs from 'fs/promises';
import path from 'path';
const ROOT = process.cwd();
const targets = [
  'public/pages/alunos/index.html',
  'public/pages/professores/index.html',
  'public/pages/avaliacoes/index.html',
  'public/pages/treinos/index.html'
];
const script = '<script src="/assets/js/fusion-ciclo-professor-aluno.js"></script>';
for (const rel of targets) {
  const file = path.join(ROOT, rel);
  let html;
  try { html = await fs.readFile(file, 'utf8'); } catch { continue; }
  if (!html.includes('/assets/js/fusion-ciclo-professor-aluno.js')) {
    html = html.replace('</body>', `  ${script}\n</body>`);
    await fs.writeFile(file, html, 'utf8');
    console.log(`Atualizado: ${rel}`);
  } else {
    console.log(`Já estava atualizado: ${rel}`);
  }
}
console.log('Ciclo Professor -> Aluno -> Avaliação -> Treino instalado.');