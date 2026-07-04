import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function agoraISO(){ return new Date().toISOString(); }
function statusTexto(v){ return String(v || '').trim().toLowerCase(); }
function estaPago(status){ return ['pago','recebido','quitado','baixado'].includes(statusTexto(status)); }
function estaCancelado(status){ return ['cancelado','cancelada','estornado','estornada'].includes(statusTexto(status)); }
function podeCancelar(item = {}){ return !estaPago(item.status) && !estaCancelado(item.status); }
function id(v){ return String(v || ''); }

async function lerJson(nome, padrao){
  const file = path.join(DATA_DIR, nome);
  try {
    const txt = await fs.readFile(file, 'utf8');
    if (!txt.trim()) return padrao;
    return JSON.parse(txt) ?? padrao;
  } catch (e) {
    if (e?.code === 'ENOENT') return padrao;
    throw e;
  }
}

async function salvarJson(nome, dados){
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, nome), JSON.stringify(dados, null, 2), 'utf8');
}

const alunos = await lerJson('alunos.json', []);
const idsAlunos = new Set((Array.isArray(alunos) ? alunos : []).map(a => id(a.id)));
const agora = agoraISO();
const resumo = { matriculas: 0, mensalidades: 0, financeiro: 0, recebimentos: 0, checkins: 0 };

const matriculas = await lerJson('matriculas.json', []);
if (Array.isArray(matriculas)) {
  for (const m of matriculas) {
    if (!m.alunoId || idsAlunos.has(id(m.alunoId))) continue;
    if (estaCancelado(m.status) || ['encerrada','encerrado'].includes(statusTexto(m.status))) continue;
    m.status = 'Cancelada';
    m.canceladaEm = agora;
    m.encerradaEm = m.encerradaEm || agora;
    m.renovacaoAutomatica = false;
    m.gerarMensalidadeAutomatica = false;
    m.motivoCancelamento = 'Aluno não existe mais em alunos.json.';
    m.atualizadoEm = agora;
    resumo.matriculas++;
  }
  await salvarJson('matriculas.json', matriculas);
}

const mensalidades = await lerJson('mensalidades.json', []);
if (Array.isArray(mensalidades)) {
  for (const m of mensalidades) {
    if (!m.alunoId || idsAlunos.has(id(m.alunoId))) continue;
    if (!podeCancelar(m)) continue;
    m.status = 'cancelado';
    m.canceladoEm = agora;
    m.canceladaEm = agora;
    m.canceladoPor = 'script';
    m.motivoCancelamento = 'Cancelada por aluno excluído/orfão.';
    m.valorRestante = 0;
    m.saldoRestante = 0;
    m.atualizadoEm = agora;
    resumo.mensalidades++;
  }
  await salvarJson('mensalidades.json', mensalidades);
}

const financeiro = await lerJson('financeiro.json', []);
if (Array.isArray(financeiro)) {
  for (const f of financeiro) {
    if (!f.alunoId || idsAlunos.has(id(f.alunoId))) continue;
    if (!podeCancelar(f)) continue;
    f.status = 'Cancelado';
    f.canceladoEm = agora;
    f.canceladoPor = 'script';
    f.motivoCancelamento = 'Cancelado por aluno excluído/orfão.';
    f.valorRestante = 0;
    f.saldoRestante = 0;
    f.atualizadoEm = agora;
    resumo.financeiro++;
  }
  await salvarJson('financeiro.json', financeiro);
}

const recebimentos = await lerJson('recebimentos.json', []);
if (Array.isArray(recebimentos)) {
  for (const r of recebimentos) {
    if (!r.alunoId || idsAlunos.has(id(r.alunoId))) continue;
    if (!podeCancelar(r)) continue;
    r.status = 'cancelado';
    r.canceladoEm = agora;
    r.canceladoPor = 'script';
    r.motivoCancelamento = 'Cancelado por aluno excluído/orfão.';
    r.valorRestante = 0;
    r.atualizadoEm = agora;
    resumo.recebimentos++;
  }
  await salvarJson('recebimentos.json', recebimentos);
}

const checkins = await lerJson('checkins.json', []);
if (Array.isArray(checkins)) {
  for (const c of checkins) {
    if (!c.alunoId || idsAlunos.has(id(c.alunoId))) continue;
    c.status = 'Bloqueado';
    c.motivoBloqueio = 'Aluno excluído/orfão.';
    c.atualizadoEm = agora;
    resumo.checkins++;
  }
  await salvarJson('checkins.json', checkins);
}

console.log('Correção de vínculos órfãos concluída:');
console.log(JSON.stringify(resumo, null, 2));
