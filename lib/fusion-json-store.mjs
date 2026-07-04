import { promises as fs } from 'fs';
import path from 'path';

export const DB_DIR = path.resolve(process.cwd(), 'data');

export async function ensureDir(dir = DB_DIR) {
  await fs.mkdir(dir, { recursive: true });
}

export function dbFile(name) {
  const clean = String(name || '').replace(/[^a-z0-9_.-]/gi, '');
  return path.join(DB_DIR, clean.endsWith('.json') ? clean : `${clean}.json`);
}

export async function readJson(name, fallback = []) {
  await ensureDir();
  const file = dbFile(name);
  try {
    const raw = await fs.readFile(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      await writeJson(name, fallback);
      return fallback;
    }
    throw err;
  }
}

export async function writeJson(name, data) {
  await ensureDir();
  const file = dbFile(name);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
  return data;
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;
}

export function money(value) {
  const n = Number(value || 0);
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function isoDate(date = new Date()) {
  return new Date(date).toISOString();
}
