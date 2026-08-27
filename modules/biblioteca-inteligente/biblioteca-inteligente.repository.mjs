import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
export const EXERCISES_ROOT = path.join(PUBLIC_DIR, 'assets', 'exercises');
export const BIBLIOTECA_FILE = path.join(DATA_DIR, 'exercicios_biblioteca.json');
export const LOG_FILE = path.join(DATA_DIR, 'biblioteca_inteligente_logs.json');

export const MEDIA_EXTS = new Set(['.gif','.png','.jpg','.jpeg','.webp','.svg','.mp4','.webm','.mov']);
export const VIDEO_EXTS = new Set(['.mp4','.webm','.mov']);

export async function garantirArquivo(arquivo, padrao = []) {
  try { await fs.access(arquivo); }
  catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), 'utf8');
  }
}

export async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  try {
    const raw = await fs.readFile(arquivo, 'utf8');
    if (!raw.trim()) return padrao;
    return JSON.parse(raw);
  } catch { return padrao; }
}

export async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

export async function listarBiblioteca() {
  const dados = await lerJson(BIBLIOTECA_FILE, []);
  return Array.isArray(dados) ? dados : [];
}

export async function salvarBiblioteca(lista = []) {
  await salvarJson(BIBLIOTECA_FILE, Array.isArray(lista) ? lista : []);
}

export async function listarLogs() {
  const dados = await lerJson(LOG_FILE, []);
  return Array.isArray(dados) ? dados : [];
}

export async function registrarLog(item = {}) {
  const logs = await listarLogs();
  logs.unshift({ id: `log_${Date.now()}_${Math.random().toString(16).slice(2,8)}`, criadoEm: new Date().toISOString(), ...item });
  await salvarJson(LOG_FILE, logs.slice(0, 500));
}

export function publicUrlFromPath(absPath) {
  const rel = path.relative(EXERCISES_ROOT, absPath).split(path.sep).join('/');
  return '/assets/exercises/' + rel.split('/').map(encodeURIComponent).join('/');
}

async function walk(dir, out = []) {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile() && MEDIA_EXTS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

export async function escanearMidias() {
  const arquivos = await walk(EXERCISES_ROOT, []);
  const itens = [];
  for (const arquivo of arquivos) {
    const stat = await fs.stat(arquivo).catch(() => null);
    const ext = path.extname(arquivo).toLowerCase();
    const rel = path.relative(EXERCISES_ROOT, arquivo).split(path.sep).join('/');
    const partes = rel.split('/');
    const nomeArquivo = partes.pop();
    const grupo = partes[0] || 'GERAL';
    const base = nomeArquivo.replace(/\.[^.]+$/, '');
    itens.push({
      rel,
      url: publicUrlFromPath(arquivo),
      grupo,
      nomeArquivo,
      nomeBase: base,
      ext: ext.replace('.', ''),
      tipo: VIDEO_EXTS.has(ext) ? 'video' : 'imagem',
      size: stat?.size || 0,
      mtimeMs: stat?.mtimeMs || 0
    });
  }
  return itens.sort((a,b) => a.rel.localeCompare(b.rel, 'pt-BR'));
}
