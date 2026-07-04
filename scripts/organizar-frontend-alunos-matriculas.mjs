import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const backupDir = path.join(root, 'backup_legado', 'frontend_alunos_matriculas');

const arquivosLegados = [
  'public/js/alunos.js',
  'public/js/alunos-cadastro.js',
  'public/js/alunos-ficha.js',
  'public/js/alunos-lista.js',
  'public/js/alunos-cadastro(2).js',
  'public/js/alunos-lista(1).js',
  'public/js/matriculas.js'
];

async function existe(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function moverSeExistir(rel) {
  const origem = path.join(root, rel);
  if (!(await existe(origem))) return { rel, movido: false, motivo: 'não encontrado' };
  const destino = path.join(backupDir, rel);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.rename(origem, destino);
  return { rel, movido: true, destino: path.relative(root, destino) };
}

const resultados = [];
for (const rel of arquivosLegados) resultados.push(await moverSeExistir(rel));

console.log('Organização concluída. Arquivos legados foram movidos para backup, quando encontrados.');
for (const r of resultados) {
  console.log(`${r.movido ? 'MOVIDO ' : 'IGNORADO'} ${r.rel}${r.destino ? ' -> ' + r.destino : ' (' + r.motivo + ')'}`);
}
console.log('\nArquivos ativos mantidos:');
console.log('- public/pages/alunos/index.html');
console.log('- public/pages/alunos/index.js');
console.log('- public/pages/alunos/style.css');
console.log('- public/pages/alunos/prontuario.html');
console.log('- public/pages/alunos/prontuario.js');
console.log('- public/pages/alunos/prontuario.css');
console.log('- public/js/matriculas/index.js');
console.log('- public/js/matriculas/cadastro.js');
console.log('- public/js/matriculas/ficha.js');
