import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ARQUIVO = path.join(DATA_DIR, 'professores.json');

async function garantirArquivo() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(ARQUIVO); }
  catch { await fs.writeFile(ARQUIVO, '[]', 'utf-8'); }
}

async function ler() {
  await garantirArquivo();
  const raw = await fs.readFile(ARQUIVO, 'utf-8').catch(() => '[]');
  try {
    const dados = raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(dados) ? dados : [];
  } catch { return []; }
}

async function salvar(lista) {
  await garantirArquivo();
  await fs.writeFile(ARQUIVO, JSON.stringify(lista, null, 2), 'utf-8');
}

export function limparCpf(valor) { return String(valor || '').replace(/\D/g, ''); }
function normalizar(valor) { return String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function hashSenha(senha, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(senha || ''), salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
export function verificarSenha(senha, hashSalvo = '') {
  const [salt, hash] = String(hashSalvo || '').split(':');
  if (!salt || !hash) return false;
  const novo = hashSenha(senha, salt).split(':')[1];
  try { return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(novo)); }
  catch { return false; }
}
export function gerarHashSenha(senha) { return hashSenha(senha); }

export async function listarProfessores() { return await ler(); }

export async function buscarProfessorPorId(id) {
  const lista = await ler();
  return lista.find(p => String(p.id) === String(id));
}

export async function buscarProfessorPorCpf(cpf) {
  const alvo = limparCpf(cpf);
  if (!alvo) return null;
  const lista = await ler();
  return lista.find(p => limparCpf(p.cpf) === alvo) || null;
}

export async function buscarProfessorPorEmail(email) {
  const alvo = normalizar(email);
  if (!alvo) return null;
  const lista = await ler();
  return lista.find(p => normalizar(p.email) === alvo) || null;
}

export async function buscarProfessorPorIdentificador(identificador) {
  const alvo = normalizar(identificador);
  const alvoNumeros = limparCpf(identificador);
  if (!alvo && !alvoNumeros) return null;

  const lista = await ler();
  return lista.find((p = {}) => {
    const textos = [
      p.login, p.email, p.nome, p.cref, p.id
    ].map(normalizar).filter(Boolean);

    const numeros = [
      p.cpf, p.telefone, p.whatsapp, p.celular
    ].map(limparCpf).filter(Boolean);

    return textos.includes(alvo) ||
      textos.some(v => v.includes(alvo) || alvo.includes(v)) ||
      Boolean(alvoNumeros && numeros.includes(alvoNumeros));
  }) || null;
}

export async function criarProfessor(dados) {
  const lista = await ler();
  const cpf = limparCpf(dados.cpf);
  if (cpf && lista.some(p => limparCpf(p.cpf) === cpf)) throw new Error('Já existe professor cadastrado com este CPF.');
  const professor = {
    id: dados.id || crypto.randomUUID(),
    status: dados.status || 'Ativo',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...dados,
    cpf: cpf || dados.cpf || '',
    senhaHash: dados.senha ? gerarHashSenha(dados.senha) : (dados.senhaHash || '')
  };
  delete professor.senha;
  lista.push(professor);
  await salvar(lista);
  return professor;
}

export async function atualizarProfessor(id, dados) {
  const lista = await ler();
  const idx = lista.findIndex(p => String(p.id) === String(id));
  if (idx < 0) return null;
  const cpf = limparCpf(dados.cpf ?? lista[idx].cpf);
  if (cpf && lista.some((p, i) => i !== idx && limparCpf(p.cpf) === cpf)) throw new Error('Já existe outro professor cadastrado com este CPF.');
  const novosDados = { ...dados };
  if (novosDados.senha) {
    novosDados.senhaHash = gerarHashSenha(novosDados.senha);
    delete novosDados.senha;
  }
  lista[idx] = { ...lista[idx], ...novosDados, cpf, atualizadoEm: new Date().toISOString() };
  await salvar(lista);
  return lista[idx];
}

export async function excluirProfessor(id) {
  const lista = await ler();
  const idx = lista.findIndex(p => String(p.id) === String(id));
  if (idx < 0) return null;
  const removido = lista[idx];
  lista.splice(idx, 1);
  await salvar(lista);
  return removido;
}


export async function alterarStatusProfessor(id, status) {
  const lista = await ler();
  const idx = lista.findIndex(p => String(p.id) === String(id));
  if (idx < 0) return null;
  const statusNormalizado = String(status || '').trim().toLowerCase();
  const novoStatus = ['ativo', 'desbloqueado'].includes(statusNormalizado) ? 'Ativo' : 'Bloqueado';
  lista[idx] = {
    ...lista[idx],
    status: novoStatus,
    bloqueado: novoStatus === 'Bloqueado',
    atualizadoEm: new Date().toISOString()
  };
  await salvar(lista);
  return lista[idx];
}
