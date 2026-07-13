import fs from 'node:fs';

export function readTextFile(path) {
  return fs.readFileSync(path, 'latin1');
}

export function parseKeyValueLoose(text) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const data = {};
  for (const line of lines) {
    const m = line.match(/^([^=:\t]+)\s*[=:\t]\s*(.*)$/);
    if (m) data[m[1].trim()] = m[2].trim();
  }
  return { lines, data };
}

export function inspectBinaryLikeFile(path) {
  const buffer = fs.readFileSync(path);
  return {
    path,
    bytes: buffer.length,
    hexStart: buffer.subarray(0, 128).toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '',
    asciiStart: buffer.subarray(0, 256).toString('latin1').replace(/[\x00-\x1F\x7F-\xFF]/g, '.')
  };
}
