import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import zlib from "zlib";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const DEFAULT_BUCKET = "fusion-backups";
const DEFAULT_BACKUP_PREFIX = "FusionERP";
const CONFIG_FILE = "backup_config.json";

function dataDir() {
  return path.resolve(ROOT_DIR, "data");
}

function backupConfigPath() {
  return path.resolve(dataDir(), CONFIG_FILE);
}

function limparNomeArquivo(valor, fallback = DEFAULT_BACKUP_PREFIX) {
  const bruto = String(valor || fallback).trim() || fallback;
  return bruto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 80) || fallback;
}

function dataPartes(date = new Date()) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  const hora = String(date.getHours()).padStart(2, "0");
  const minuto = String(date.getMinutes()).padStart(2, "0");
  const segundo = String(date.getSeconds()).padStart(2, "0");
  return {
    ano, mes, dia, hora, minuto, segundo,
    data: `${ano}-${mes}-${dia}`,
    horaCompleta: `${hora}-${minuto}-${segundo}`,
    iso: date.toISOString().replace(/[:.]/g, "-")
  };
}

function configPadrao() {
  const nomeEmpresa = process.env.FUSION_BACKUP_EMPRESA || process.env.FUSION_ACADEMIA_NOME || process.env.BACKUP_NAME_PREFIX || DEFAULT_BACKUP_PREFIX;
  return {
    empresa: nomeEmpresa,
    prefixo: process.env.BACKUP_NAME_PREFIX || nomeEmpresa || DEFAULT_BACKUP_PREFIX,
    template: process.env.BACKUP_FILE_TEMPLATE || "{prefixo}_Backup_{data}_{hora}.zip",
    pastaSupabase: process.env.SUPABASE_BACKUP_FOLDER || "backups",
    atualizadoEm: null
  };
}

export async function lerConfiguracaoBackup() {
  const padrao = configPadrao();
  try {
    const arquivo = backupConfigPath();
    const bruto = await fsp.readFile(arquivo, "utf-8");
    const salvo = bruto.trim() ? JSON.parse(bruto) : {};
    return { ...padrao, ...salvo };
  } catch {
    return padrao;
  }
}

export async function salvarConfiguracaoBackup(dados = {}) {
  const atual = await lerConfiguracaoBackup();
  const config = {
    ...atual,
    empresa: String(dados.empresa ?? atual.empresa ?? DEFAULT_BACKUP_PREFIX).trim() || DEFAULT_BACKUP_PREFIX,
    prefixo: String(dados.prefixo ?? dados.nome ?? atual.prefixo ?? atual.empresa ?? DEFAULT_BACKUP_PREFIX).trim() || DEFAULT_BACKUP_PREFIX,
    template: String(dados.template ?? atual.template ?? "{prefixo}_Backup_{data}_{hora}.zip").trim() || "{prefixo}_Backup_{data}_{hora}.zip",
    pastaSupabase: String(dados.pastaSupabase ?? atual.pastaSupabase ?? "backups").trim() || "backups",
    atualizadoEm: new Date().toISOString()
  };
  await fsp.mkdir(dataDir(), { recursive: true });
  await fsp.writeFile(backupConfigPath(), JSON.stringify(config, null, 2), "utf-8");
  return { ok: true, config, exemplo: gerarNomeBackup(config) };
}

function gerarNomeBackup(config = {}, date = new Date()) {
  const partes = dataPartes(date);
  const empresa = limparNomeArquivo(config.empresa || DEFAULT_BACKUP_PREFIX);
  const prefixo = limparNomeArquivo(config.prefixo || empresa || DEFAULT_BACKUP_PREFIX);
  let template = String(config.template || "{prefixo}_Backup_{data}_{hora}.zip");
  if (!/\.zip$/i.test(template)) template += ".zip";
  const nome = template
    .replaceAll("{empresa}", empresa)
    .replaceAll("{prefixo}", prefixo)
    .replaceAll("{data}", partes.data)
    .replaceAll("{hora}", partes.horaCompleta)
    .replaceAll("{ano}", String(partes.ano))
    .replaceAll("{mes}", partes.mes)
    .replaceAll("{dia}", partes.dia)
    .replaceAll("{iso}", partes.iso);
  return limparNomeArquivo(nome.replace(/\.zip$/i, "")) + ".zip";
}

function uploadsDir() {
  return path.resolve(ROOT_DIR, "uploads");
}

function backupLocalDir() {
  return path.resolve(ROOT_DIR, "backups");
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function crc32(buf) {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function dosTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

async function listarArquivos(baseDir, prefixo) {
  const out = [];
  async function walk(dir) {
    let itens = [];
    try { itens = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const item of itens) {
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(abs);
      } else if (item.isFile()) {
        const rel = path.relative(baseDir, abs).split(path.sep).join("/");
        out.push({ abs, name: `${prefixo}/${rel}` });
      }
    }
  }
  await walk(baseDir);
  return out;
}

async function montarManifesto(arquivos) {
  return {
    sistema: "Fusion ERP",
    tipo: "backup-json-storage",
    criadoEm: new Date().toISOString(),
    arquivos: arquivos.map(a => a.name),
    totalArquivos: arquivos.length,
    observacao: "Backup da pasta data e uploads. Restauração deve ser feita com o sistema parado.",
    nomeConfiguravel: true
  };
}

function zipBuffer(entradas) {
  const locais = [];
  const centrais = [];
  let offset = 0;

  for (const entrada of entradas) {
    const nome = Buffer.from(entrada.name, "utf8");
    const dados = Buffer.isBuffer(entrada.data) ? entrada.data : Buffer.from(String(entrada.data || ""));
    const comprimido = zlib.deflateRawSync(dados, { level: 9 });
    const crc = crc32(dados);
    const dt = dosTime(new Date(entrada.mtime || Date.now()));

    const localHeader = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(dt.time), u16(dt.day),
      u32(crc), u32(comprimido.length), u32(dados.length), u16(nome.length), u16(0), nome
    ]);
    locais.push(localHeader, comprimido);

    const centralHeader = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(dt.time), u16(dt.day),
      u32(crc), u32(comprimido.length), u32(dados.length), u16(nome.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nome
    ]);
    centrais.push(centralHeader);
    offset += localHeader.length + comprimido.length;
  }

  const centralSize = centrais.reduce((n, b) => n + b.length, 0);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entradas.length), u16(entradas.length),
    u32(centralSize), u32(offset), u16(0)
  ]);
  return Buffer.concat([...locais, ...centrais, end]);
}

async function montarZip() {
  const arquivos = [
    ...(await listarArquivos(dataDir(), "data")),
    ...(await listarArquivos(uploadsDir(), "uploads"))
  ];
  const entradas = [];
  for (const arq of arquivos) {
    const stat = await fsp.stat(arq.abs);
    entradas.push({ name: arq.name, data: await fsp.readFile(arq.abs), mtime: stat.mtime });
  }
  entradas.push({ name: "backup-manifest.json", data: JSON.stringify(await montarManifesto(arquivos), null, 2) });
  return { buffer: zipBuffer(entradas), totalArquivos: arquivos.length };
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function criarBackupLocal() {
  const config = await lerConfiguracaoBackup();
  const nome = gerarNomeBackup(config);
  const { buffer, totalArquivos } = await montarZip();
  await fsp.mkdir(backupLocalDir(), { recursive: true });
  const destino = path.join(backupLocalDir(), nome);
  await fsp.writeFile(destino, buffer);
  return { ok: true, destino, nome, bytes: buffer.length, totalArquivos, criadoEm: new Date().toISOString() };
}

export async function enviarBackupSupabase() {
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET;
  const config = await lerConfiguracaoBackup();
  const nome = gerarNomeBackup(config);
  const { buffer, totalArquivos } = await montarZip();
  const supabase = supabaseClient();
  const pasta = String(config.pastaSupabase || "backups").replace(/^\/+|\/+$/g, "") || "backups";
  const caminho = `${pasta}/${nome}`;
  const { error } = await supabase.storage.from(bucket).upload(caminho, buffer, {
    contentType: "application/zip",
    upsert: false
  });
  if (error) throw new Error(error.message);
  return { ok: true, bucket, caminho, nome, bytes: buffer.length, totalArquivos, criadoEm: new Date().toISOString() };
}

export async function listarBackupsSupabase() {
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET;
  const supabase = supabaseClient();
  const config = await lerConfiguracaoBackup();
  const pasta = String(config.pastaSupabase || "backups").replace(/^\/+|\/+$/g, "") || "backups";
  const { data, error } = await supabase.storage.from(bucket).list(pasta, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(error.message);
  return { ok: true, bucket, backups: data || [] };
}

export async function statusBackup() {
  return {
    ok: true,
    dataDir: dataDir(),
    uploadsDir: uploadsDir(),
    supabaseConfigurado: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
    bucket: process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET,
    config: await lerConfiguracaoBackup()
  };
}
