import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'henry7x.json');
const LOG_DIR = path.join(DATA_DIR, 'henry7x');
const LOG_FILE = path.join(LOG_DIR, 'logs.json');

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ equipamentos: [], logs: [] }, null, 2));
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}

export function readDb() { ensure(); return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
export function writeDb(db) { ensure(); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); return db; }

export function readLogs() {
  ensure();
  try {
    const dados = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export function writeLogs(logs) {
  ensure();
  fs.writeFileSync(LOG_FILE, JSON.stringify((logs || []).slice(0, 1000), null, 2));
}

export function salvarEquipamento(equipamento) {
  const db = readDb();
  const id = equipamento.id || `henry-${Date.now()}`;
  const item = { id, fabricante: 'Henry', modelo: '7x', driver: 'henry7x', ...equipamento };
  db.equipamentos = db.equipamentos.filter(e => e.id !== id).concat(item);
  writeDb(db);
  return item;
}

export function addLog(log) {
  const entry = { id: `log-${Date.now()}-${Math.floor(Math.random() * 1000000)}`, at: new Date().toISOString(), ...log };

  const logs = readLogs();
  logs.unshift(entry);
  writeLogs(logs);

  const db = readDb();
  db.logs = Array.isArray(db.logs) ? db.logs : [];
  db.logs.unshift(entry);
  db.logs = db.logs.slice(0, 500);
  writeDb(db);

  return entry;
}
