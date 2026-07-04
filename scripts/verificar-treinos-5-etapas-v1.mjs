import fs from 'fs/promises';
import path from 'path';

const raiz = process.cwd();
const obrigatorios = [
  'public/pages/treinos/index.html',
  'public/pages/treinos/index.js',
  'public/pages/treinos/style.css',
  'modules/treinos/treinos.schema.mjs',
  'modules/treinos/treinos.repository.mjs',
  'modules/treinos/treinos.service.mjs',
  'modules/treinos/treinos.routes.mjs'
];

for (const rel of obrigatorios) {
  await fs.access(path.join(raiz, rel));
}

await fs.mkdir(path.join(raiz, 'data'), { recursive: true });
const treinosPath = path.join(raiz, 'data', 'treinos.json');
try {
  await fs.access(treinosPath);
} catch {
  await fs.writeFile(treinosPath, '[]', 'utf-8');
}

const { treinoSchema, normalizarTreino } = await import('../modules/treinos/treinos.schema.mjs');
const teste = normalizarTreino({
  alunoId: 'aluno_teste',
  alunoNome: 'Aluno Teste',
  professorId: 'prof_teste',
  professorNome: 'Professor Teste',
  objetivo: 'Homologação',
  dataInicio: '2026-07-01',
  dataValidade: '2026-08-15',
  exercicios: [{ nome: 'Supino reto', series: '3', repeticoes: '10' }]
});
const resultado = treinoSchema.safeParse(teste);
if (!resultado.success) {
  throw new Error('Schema de treinos não validou o fluxo mínimo: ' + resultado.error.issues.map(i => i.message).join(', '));
}

console.log('Treinos 5 etapas v1 verificado com sucesso.');
console.log('Fluxo validado: alunoId + professorId + objetivo + validade + exercício obrigatório.');
