import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const IMPORT_DIR = path.join(DATA_DIR, 'imports');
const BIBLIOTECA_JSON = path.join(DATA_DIR, 'exercicios_biblioteca.json');
const DEST_REL_DIR = 'assets/exercises/IMPORTADOS_FLASH';
const DEST_DIR = path.join(ROOT, 'public', DEST_REL_DIR);

function log(msg){ console.log(`[biblioteca-flash] ${msg}`); }
function norm(v){ return String(v || '').trim(); }
function onlyDigits(v){ return String(v || '').match(/\d+/)?.[0] || ''; }
function pad4(v){ return String(v || '').padStart(4, '0'); }
function normalizarNomeArquivo(v){
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function existe(arquivo){
  try { await fs.access(arquivo); return true; } catch { return false; }
}

async function lerJson(arquivo, padrao = []){
  if (!(await existe(arquivo))) return padrao;
  try {
    const raw = await fs.readFile(arquivo, 'utf8');
    if (!raw.trim()) return padrao;
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(arquivo, dados){
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

async function listarRecursivo(dir){
  const out = [];
  const itens = await fs.readdir(dir, { withFileTypes: true });
  for (const item of itens) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...await listarRecursivo(full));
    else out.push(full);
  }
  return out;
}

function localizarZip(){
  const arg = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : '';
  const candidatos = [
    arg,
    path.join(ROOT, 'Flash.zip'),
    path.join(IMPORT_DIR, 'Flash.zip'),
    path.join(ROOT, 'imports', 'Flash.zip')
  ].filter(Boolean);
  for (const z of candidatos) if (fssync.existsSync(z)) return z;
  return '';
}

async function extrairZip(zipPath, destino){
  await fs.rm(destino, { recursive: true, force: true });
  await fs.mkdir(destino, { recursive: true });

  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Expand-Archive -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(destino)} -Force`
    ], { stdio: 'inherit' });
    return;
  }

  execFileSync('unzip', ['-q', zipPath, '-d', destino], { stdio: 'inherit' });
}

function montarRegistro({ numero, nomeArquivo, destinoRel, existente }){
  const agora = new Date().toISOString();
  const id = `FLASH_${pad4(numero)}`;
  const nomeBase = `Flash ${pad4(numero)}`;
  const midia = `/${destinoRel.replace(/\\/g, '/')}`;
  return {
    ...(existente || {}),
    id: existente?.id || id,
    bibliotecaId: existente?.bibliotecaId || existente?.id || id,
    bibliotecaKey: existente?.bibliotecaKey || `flash:${pad4(numero)}`,
    nome: existente?.nome && !String(existente.nome).startsWith('Flash ') ? existente.nome : nomeBase,
    grupo: existente?.grupo || existente?.grupoMuscular || 'IMPORTADOS_FLASH',
    grupoMuscular: existente?.grupoMuscular || existente?.grupo || 'IMPORTADOS_FLASH',
    folder: 'IMPORTADOS_FLASH',
    pasta: 'IMPORTADOS_FLASH',
    arquivo: nomeArquivo,
    midia,
    image: midia,
    imagem: midia,
    imagemUrl: midia,
    videoUrl: existente?.videoUrl || '',
    tipo: 'imagem',
    tipoMidia: 'imagem',
    equipamento: existente?.equipamento || '',
    nivel: existente?.nivel || '',
    sinonimos: Array.isArray(existente?.sinonimos) ? existente.sinonimos : [nomeBase, numero, `gif ${numero}`],
    ativo: existente?.ativo !== false,
    origem: 'flash_zip',
    origemArquivo: `Flash/${numero}.gif`,
    criadoEm: existente?.criadoEm || agora,
    atualizadoEm: agora
  };
}

async function main(){
  const zip = localizarZip();
  if (!zip) {
    console.error('\nFlash.zip não encontrado. Coloque o arquivo em um destes locais:');
    console.error('  Flash.zip');
    console.error('  data/imports/Flash.zip');
    console.error('  imports/Flash.zip');
    console.error('\nOu execute: node scripts/importar-flash-biblioteca.mjs caminho\\para\\Flash.zip');
    process.exit(1);
  }

  log(`ZIP encontrado: ${zip}`);
  const temp = path.join(os.tmpdir(), `fusion_flash_${Date.now()}`);
  await extrairZip(zip, temp);

  const arquivos = await listarRecursivo(temp);
  const gifs = arquivos
    .filter(a => /\.gif$/i.test(a))
    .map(full => {
      const base = path.basename(full);
      const numero = onlyDigits(base) || onlyDigits(path.relative(temp, full));
      return { full, base, numero };
    })
    .filter(x => x.numero)
    .sort((a,b) => Number(a.numero) - Number(b.numero));

  await fs.mkdir(DEST_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  const biblioteca = await lerJson(BIBLIOTECA_JSON, []);
  const porId = new Map(biblioteca.map(x => [String(x.bibliotecaId || x.id || ''), x]));
  const porKey = new Map(biblioteca.map(x => [String(x.bibliotecaKey || ''), x]));

  let novos = 0;
  let atualizados = 0;
  const registros = [];

  for (const gif of gifs) {
    const numero4 = pad4(gif.numero);
    const nomeArquivo = normalizarNomeArquivo(`FLASH_${numero4}.gif`);
    const destinoAbs = path.join(DEST_DIR, nomeArquivo);
    const destinoRel = path.posix.join(DEST_REL_DIR, nomeArquivo);
    await fs.copyFile(gif.full, destinoAbs);

    const id = `FLASH_${numero4}`;
    const key = `flash:${numero4}`;
    const existente = porId.get(id) || porKey.get(key) || null;
    if (existente) atualizados += 1; else novos += 1;
    registros.push(montarRegistro({ numero: numero4, nomeArquivo, destinoRel, existente }));
  }

  const idsFlash = new Set(registros.map(r => String(r.bibliotecaId || r.id)));
  const preservados = biblioteca.filter(x => !idsFlash.has(String(x.bibliotecaId || x.id || '')));
  const final = [...preservados, ...registros].sort((a,b) => {
    const ga = String(a.grupoMuscular || a.grupo || '');
    const gb = String(b.grupoMuscular || b.grupo || '');
    if (ga !== gb) return ga.localeCompare(gb, 'pt-BR');
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true });
  });

  await salvarJson(BIBLIOTECA_JSON, final);
  await fs.rm(temp, { recursive: true, force: true });

  log(`GIFs encontrados: ${gifs.length}`);
  log(`Novos registros: ${novos}`);
  log(`Registros atualizados: ${atualizados}`);
  log(`Biblioteca total: ${final.length}`);
  log(`Mídias copiadas para: public/${DEST_REL_DIR}`);
  log('Concluído. Reinicie o servidor e clique em Atualizar biblioteca no Treinos V3.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
