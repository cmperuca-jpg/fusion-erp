import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const ALUNOS_FILE = path.join(DATA_DIR, 'alunos.json');
const PROFESSORES_FILE = path.join(DATA_DIR, 'professores.json');
const TREINOS_INTEGRADOS_FILE = path.join(DATA_DIR, 'treinos_integrados.json');
const TREINOS_LEGADO_FILE = path.join(DATA_DIR, 'treinos.json');

const ALUNO_ALVO = 'marcos andre';
const PROFESSOR_ALVO = 'marcos andre de souza';

function normalizar(v = '') {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function lerJson(file, padrao = []) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    if (!raw.trim()) return padrao;
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(file, dados) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(dados, null, 2), 'utf8');
}

function idAluno(a = {}) {
  return String(a.id || a._id || a.alunoId || a.aluno_id || '').trim();
}

function idProfessor(p = {}) {
  return String(p.id || p._id || p.professorId || p.professor_id || '').trim();
}

function nomeAluno(a = {}) {
  return String(a.nome || a.aluno || a.name || a.nomeCompleto || '').trim();
}

function nomeProfessor(p = {}) {
  return String(p.nome || p.professor || p.name || p.nomeCompleto || '').trim();
}

function encontrarPorNome(lista, alvo, nomeFn) {
  const nAlvo = normalizar(alvo);
  return lista.find(item => {
    const n = normalizar(nomeFn(item));
    return n === nAlvo || n.includes(nAlvo) || nAlvo.includes(n);
  }) || null;
}

function atualizarTreinos(lista, alunoId, alunoNome, professorId, professorNome) {
  let alterados = 0;
  const nova = lista.map(t => {
    const pertence = String(t.alunoId || t.aluno_id || '') === String(alunoId) || normalizar(t.aluno || t.alunoNome) === normalizar(alunoNome);
    if (!pertence) return t;
    alterados += 1;
    return {
      ...t,
      alunoId,
      aluno: t.aluno || alunoNome,
      alunoNome: t.alunoNome || alunoNome,
      professorId,
      professor: professorNome,
      professorNome,
      atualizadoEm: new Date().toISOString()
    };
  });
  return { nova, alterados };
}

const alunos = await lerJson(ALUNOS_FILE, []);
const professores = await lerJson(PROFESSORES_FILE, []);

const aluno = encontrarPorNome(alunos, ALUNO_ALVO, nomeAluno);
const professor = encontrarPorNome(professores, PROFESSOR_ALVO, nomeProfessor);

if (!aluno) {
  console.error(`Aluno não encontrado: ${ALUNO_ALVO}`);
  process.exit(1);
}
if (!professor) {
  console.error(`Professor não encontrado: ${PROFESSOR_ALVO}`);
  process.exit(1);
}

const alunoId = idAluno(aluno);
const professorId = idProfessor(professor);
const alunoNome = nomeAluno(aluno);
const professorNome = nomeProfessor(professor);

if (!alunoId) {
  console.error('Aluno encontrado, mas sem ID.');
  process.exit(1);
}
if (!professorId) {
  console.error('Professor encontrado, mas sem ID.');
  process.exit(1);
}

const alunosAtualizados = alunos.map(a => {
  if (idAluno(a) !== alunoId) return a;
  return {
    ...a,
    professorId,
    professor_id: professorId,
    professorResponsavelId: professorId,
    professorNome,
    professor_responsavel: professorNome,
    professor_responsavel_nome: professorNome,
    atualizadoEm: new Date().toISOString()
  };
});

await salvarJson(ALUNOS_FILE, alunosAtualizados);

const treinosIntegrados = await lerJson(TREINOS_INTEGRADOS_FILE, []);
const r1 = atualizarTreinos(treinosIntegrados, alunoId, alunoNome, professorId, professorNome);
await salvarJson(TREINOS_INTEGRADOS_FILE, r1.nova);

const treinosLegado = await lerJson(TREINOS_LEGADO_FILE, []);
const r2 = atualizarTreinos(treinosLegado, alunoId, alunoNome, professorId, professorNome);
await salvarJson(TREINOS_LEGADO_FILE, r2.nova);

console.log(JSON.stringify({
  ok: true,
  aluno: { id: alunoId, nome: alunoNome },
  professor: { id: professorId, nome: professorNome },
  treinosIntegradosAtualizados: r1.alterados,
  treinosLegadoAtualizados: r2.alterados
}, null, 2));
