import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const files = {
  alunos: path.join(DATA_DIR, 'alunos.json'),
  planos: path.join(DATA_DIR, 'planos.json'),
  matriculas: path.join(DATA_DIR, 'matriculas.json'),
  mensalidades: path.join(DATA_DIR, 'mensalidades.json'),
  financeiro: path.join(DATA_DIR, 'financeiro.json')
};

async function readJson(file, fallback = []) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const data = raw.trim() ? JSON.parse(raw) : fallback;
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

function texto(...values) {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s && s !== '-') return s;
  }
  return '';
}

const [alunos, planos, matriculas, mensalidades, financeiro] = await Promise.all([
  readJson(files.alunos, []),
  readJson(files.planos, []),
  readJson(files.matriculas, []),
  readJson(files.mensalidades, []),
  readJson(files.financeiro, [])
]);

let mensalidadesCorrigidas = 0;
let financeiroCorrigido = 0;

for (const m of mensalidades) {
  const aluno = alunos.find(a => String(a.id || a._id || '') === String(m.alunoId || '')) || null;
  const matricula = matriculas.find(mat =>
    String(mat.id || '') === String(m.matriculaId || '') ||
    (m.alunoId && String(mat.alunoId || '') === String(m.alunoId))
  ) || null;
  const fin = financeiro.find(f =>
    String(f.mensalidadeId || '') === String(m.id || '') ||
    String(f.id || '') === String(m.lancamentoFinanceiroId || '')
  ) || null;
  const plano = planos.find(p => String(p.id || p._id || '') === String(m.planoId || matricula?.planoId || fin?.planoId || '')) || null;

  const alunoNome = texto(m.alunoNome, m.aluno, aluno?.nome, aluno?.name, matricula?.aluno, matricula?.alunoNome, fin?.alunoFornecedor, fin?.pessoa, fin?.pessoaFornecedor);
  const planoNome = texto(m.planoNome, m.plano, plano?.nome, plano?.name, matricula?.plano, matricula?.planoNome, fin?.plano, fin?.planoNome);

  let mudou = false;
  if (alunoNome && (!m.alunoNome || m.alunoNome === '-')) { m.alunoNome = alunoNome; mudou = true; }
  if (alunoNome && (!m.aluno || m.aluno === '-')) { m.aluno = alunoNome; mudou = true; }
  if (planoNome && (!m.planoNome || m.planoNome === '-')) { m.planoNome = planoNome; mudou = true; }
  if (planoNome && (!m.plano || m.plano === '-')) { m.plano = planoNome; mudou = true; }
  if (matricula?.id && !m.matriculaId) { m.matriculaId = matricula.id; mudou = true; }
  if (matricula?.planoId && !m.planoId) { m.planoId = matricula.planoId; mudou = true; }
  if (mudou) mensalidadesCorrigidas++;
}

for (const f of financeiro) {
  const mensalidade = mensalidades.find(m => String(m.id || '') === String(f.mensalidadeId || '')) || null;
  const aluno = alunos.find(a => String(a.id || a._id || '') === String(f.alunoId || mensalidade?.alunoId || '')) || null;
  const matricula = matriculas.find(mat =>
    String(mat.id || '') === String(f.matriculaId || mensalidade?.matriculaId || '') ||
    ((f.alunoId || mensalidade?.alunoId) && String(mat.alunoId || '') === String(f.alunoId || mensalidade?.alunoId))
  ) || null;
  const plano = planos.find(p => String(p.id || p._id || '') === String(f.planoId || mensalidade?.planoId || matricula?.planoId || '')) || null;

  const alunoNome = texto(f.alunoFornecedor, f.pessoa, f.pessoaFornecedor, mensalidade?.alunoNome, mensalidade?.aluno, aluno?.nome, aluno?.name, matricula?.aluno);
  const planoNome = texto(f.plano, f.planoNome, mensalidade?.planoNome, mensalidade?.plano, plano?.nome, matricula?.plano);

  let mudou = false;
  if (alunoNome && (!f.alunoFornecedor || f.alunoFornecedor === '-')) { f.alunoFornecedor = alunoNome; mudou = true; }
  if (alunoNome && (!f.pessoa || f.pessoa === '-')) { f.pessoa = alunoNome; mudou = true; }
  if (alunoNome && (!f.pessoaFornecedor || f.pessoaFornecedor === '-')) { f.pessoaFornecedor = alunoNome; mudou = true; }
  if (planoNome && (!f.plano || f.plano === '-')) { f.plano = planoNome; mudou = true; }
  if (matricula?.id && !f.matriculaId) { f.matriculaId = matricula.id; mudou = true; }
  if (matricula?.planoId && !f.planoId) { f.planoId = matricula.planoId; mudou = true; }
  if (mudou) financeiroCorrigido++;
}

await writeJson(files.mensalidades, mensalidades);
await writeJson(files.financeiro, financeiro);

console.log('Correção de nomes e vínculos concluída:');
console.log(JSON.stringify({ mensalidades: mensalidadesCorrigidas, financeiro: financeiroCorrigido }, null, 2));
