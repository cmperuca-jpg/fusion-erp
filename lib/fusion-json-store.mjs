import { promises as fs } from 'fs';
import path from 'path';
import { lerJsonDuravel, salvarJsonDuravel } from '../modules/core/persistence/durable-json.mjs';

export const DB_DIR = path.resolve(process.cwd(), 'data');

export async function ensureDir(dir = DB_DIR) {
  await fs.mkdir(dir, { recursive: true });
}

export function dbFile(name) {
  const clean = String(name || '').replace(/[^a-z0-9_.-]/gi, '');
  return path.join(DB_DIR, clean.endsWith('.json') ? clean : `${clean}.json`);
}

export async function readJson(name, fallback = []) {
  return lerJsonDuravel(name, fallback);
}

export async function writeJson(name, data) {
  return salvarJsonDuravel(name, data);
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
