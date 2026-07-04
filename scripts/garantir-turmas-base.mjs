import fs from 'fs/promises';
import path from 'path';

const arquivo = path.resolve(process.cwd(), 'data', 'turmas.json');

const turmasBase = [
  {
    id: 100,
    nome: 'Musculação Livre',
    modalidade: 'Musculação',
    professor: 'Professor de salão',
    sala: 'Musculação',
    diasSemana: 'Segunda a Sábado',
    horario: 'Livre conforme funcionamento',
    capacidade: 80,
    alunosMatriculados: 0,
    status: 'Ativa',
    observacoes: 'Turma base para planos de musculação com acesso livre.',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 101,
    nome: 'Natação Adulto Manhã',
    modalidade: 'Natação',
    professor: 'Carlos Henrique',
    sala: 'Piscina 1',
    diasSemana: 'Segunda, Quarta e Sexta',
    horario: '07:00 às 08:00',
    capacidade: 20,
    alunosMatriculados: 14,
    status: 'Ativa',
    observacoes: 'Turma regular de adaptação e condicionamento.',
    criadoEm: '2026-06-01T10:00:00.000Z',
    atualizadoEm: '2026-06-01T10:00:00.000Z'
  },
  {
    id: 102,
    nome: 'Funcional Noite',
    modalidade: 'Funcional',
    professor: 'Ana Paula',
    sala: 'Sala Funcional',
    diasSemana: 'Terça e Quinta',
    horario: '19:00 às 20:00',
    capacidade: 25,
    alunosMatriculados: 21,
    status: 'Ativa',
    observacoes: 'Turma de alta procura.',
    criadoEm: '2026-06-01T10:00:00.000Z',
    atualizadoEm: '2026-06-01T10:00:00.000Z'
  }
];

async function lerJson() {
  try {
    const raw = await fs.readFile(arquivo, 'utf8');
    const json = JSON.parse(raw || '[]');
    return Array.isArray(json) ? json : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function normalizar(valor) {
  return String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const atuais = await lerJson();
let alterou = false;

for (const base of turmasBase) {
  const existe = atuais.some((t) => String(t.id) === String(base.id) || normalizar(t.nome) === normalizar(base.nome));
  if (!existe) {
    atuais.push(base);
    alterou = true;
    console.log(`ADICIONADA turma: ${base.nome}`);
  } else {
    console.log(`MANTIDA turma existente: ${base.nome}`);
  }
}

await fs.mkdir(path.dirname(arquivo), { recursive: true });
await fs.writeFile(arquivo, JSON.stringify(atuais, null, 2), 'utf8');

console.log(alterou ? 'Turmas base atualizadas.' : 'Nenhuma alteração necessária.');
