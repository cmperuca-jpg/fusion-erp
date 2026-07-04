import fs from 'fs';

const obrigatorios = [
  'backend/routes/bi.avaliacoes-treinos-rankings.routes.mjs',
  'backend/services/bi.avaliacoes.service.mjs',
  'backend/services/bi.treinos.service.mjs',
  'backend/services/bi.rankings.service.mjs',
  'backend/repositories/bi.avaliacoes.repository.mjs',
  'backend/repositories/bi.treinos.repository.mjs',
  'backend/repositories/bi.rankings.repository.mjs',
  'frontend/pages/bi-avaliacoes-treinos-rankings.html',
  'frontend/js/bi-avaliacoes-treinos-rankings.js',
  'frontend/css/bi-avaliacoes-treinos-rankings.css',
];

const ausentes = obrigatorios.filter((arquivo) => !fs.existsSync(arquivo));
if (ausentes.length) {
  console.error('Arquivos ausentes:');
  ausentes.forEach((arquivo) => console.error(`- ${arquivo}`));
  process.exit(1);
}
console.log('BI Fase 3 Parte 3: estrutura básica OK.');
