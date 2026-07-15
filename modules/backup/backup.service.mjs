import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import zlib from "zlib";
import { createClient } from "@supabase/supabase-js";
import { restaurarArquivosNoSupabase, statusPersistencia } from "./supabase-data.service.mjs";

const ROOT_DIR = process.cwd();
const DEFAULT_BUCKET = "fusion-backups";
const DEFAULT_BACKUP_PREFIX = "FusionERP";
const CONFIG_FILE = "backup_config.json";
let backupAutomaticoTimer = null;
let ultimoBackupAutomatico = null;
let ultimoErroAutomatico = "";

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

function gerarNomeBackup(config = {}, date = new Date(), sufixo = "") {
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
  const base = limparNomeArquivo(nome.replace(/\.zip$/i, ""));
  const final = sufixo ? `${base}_${limparNomeArquivo(sufixo, "seguranca")}` : base;
  return `${final}.zip`;
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

async function garantirBucketBackup() {
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET;
  const supabase = supabaseClient();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (!error && data) return bucket;
  const { error: criarErro } = await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 104857600 });
  if (criarErro && !/already exists|duplicate/i.test(criarErro.message || "")) throw new Error(criarErro.message);
  return bucket;
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

export async function enviarBackupSupabase(opcoes = {}) {
  const bucket = await garantirBucketBackup();
  const config = await lerConfiguracaoBackup();
  const nome = gerarNomeBackup(config, new Date(), opcoes.sufixo || "");
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
  const bucket = await garantirBucketBackup();
  const supabase = supabaseClient();
  const config = await lerConfiguracaoBackup();
  const pasta = String(config.pastaSupabase || "backups").replace(/^\/+|\/+$/g, "") || "backups";
  const { data, error } = await supabase.storage.from(bucket).list(pasta, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(error.message);
  return { ok: true, bucket, pasta, backups: (data || []).filter(item => /\.zip$/i.test(item.name || "")).map(item => ({ ...item, caminho: `${pasta}/${item.name}` })) };
}

function extrairZipSeguro(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new Error("Arquivo de backup inválido ou vazio.");
  let eocd = -1;
  const inicioBusca = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= inicioBusca; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Estrutura ZIP inválida: diretório central não encontrado.");
  const total = buffer.readUInt16LE(eocd + 10);
  const offsetCentral = buffer.readUInt32LE(eocd + 16);
  const entradas = [];
  let pos = offsetCentral;
  let totalExtraido = 0;
  for (let indice = 0; indice < total; indice += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error("Diretório central do backup está corrompido.");
    const flags = buffer.readUInt16LE(pos + 8);
    const metodo = buffer.readUInt16LE(pos + 10);
    const tamanhoComprimido = buffer.readUInt32LE(pos + 20);
    const tamanhoOriginal = buffer.readUInt32LE(pos + 24);
    const nomeLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const comentarioLen = buffer.readUInt16LE(pos + 32);
    const offsetLocal = buffer.readUInt32LE(pos + 42);
    const nome = buffer.subarray(pos + 46, pos + 46 + nomeLen).toString("utf8").replace(/\\/g, "/");
    pos += 46 + nomeLen + extraLen + comentarioLen;
    if (flags & 1) throw new Error("Backup criptografado não é suportado.");
    if (!nome || nome.endsWith("/")) continue;
    if (nome.includes("..") || nome.startsWith("/") || !/^(?:(?:data|uploads)\/|backup-manifest\.json$)/.test(nome)) {
      throw new Error(`Arquivo não permitido dentro do backup: ${nome}`);
    }
    if (offsetLocal + 30 > buffer.length || buffer.readUInt32LE(offsetLocal) !== 0x04034b50) throw new Error(`Entrada inválida: ${nome}`);
    const nomeLocalLen = buffer.readUInt16LE(offsetLocal + 26);
    const extraLocalLen = buffer.readUInt16LE(offsetLocal + 28);
    const inicioDados = offsetLocal + 30 + nomeLocalLen + extraLocalLen;
    const fimDados = inicioDados + tamanhoComprimido;
    if (fimDados > buffer.length) throw new Error(`Conteúdo truncado: ${nome}`);
    const comprimido = buffer.subarray(inicioDados, fimDados);
    let dados;
    if (metodo === 0) dados = Buffer.from(comprimido);
    else if (metodo === 8) dados = zlib.inflateRawSync(comprimido);
    else throw new Error(`Método de compactação não suportado em ${nome}.`);
    if (dados.length !== tamanhoOriginal) throw new Error(`Tamanho inválido após extrair ${nome}.`);
    totalExtraido += dados.length;
    if (totalExtraido > 250 * 1024 * 1024) throw new Error("Backup excede o limite de restauração de 250 MB.");
    entradas.push({ nome, dados });
  }
  return entradas;
}

async function arquivosAtuais(baseDir, prefixoRelativo) {
  return listarArquivos(baseDir, prefixoRelativo);
}

async function aplicarEntradasRestauracao(entradas) {
  const permitidas = entradas.filter(e => /^(data|uploads)\//.test(e.nome));
  const criticos = ["data/alunos.json", "data/matriculas.json", "data/financeiro.json", "data/mensalidades.json"];
  for (const nome of criticos) {
    if (!permitidas.some(e => e.nome === nome)) throw new Error(`Backup incompleto: ${nome} não foi encontrado.`);
  }
  for (const entrada of permitidas.filter(e => e.nome.startsWith("data/") && e.nome.endsWith(".json"))) {
    try { JSON.parse(entrada.dados.toString("utf8")); }
    catch { throw new Error(`JSON inválido no backup: ${entrada.nome}`); }
  }

  const nomesBackup = new Set(permitidas.map(e => e.nome));
  const atuais = [
    ...(await arquivosAtuais(dataDir(), "data")),
    ...(await arquivosAtuais(uploadsDir(), "uploads"))
  ];
  for (const arquivo of atuais) {
    if (!nomesBackup.has(arquivo.name)) await fsp.rm(arquivo.abs, { force: true });
  }
  for (const entrada of permitidas) {
    const base = entrada.nome.startsWith("data/") ? dataDir() : uploadsDir();
    const interno = entrada.nome.replace(/^(data|uploads)\//, "");
    const destino = path.resolve(base, interno);
    if (!destino.startsWith(`${base}${path.sep}`)) throw new Error(`Destino inseguro: ${entrada.nome}`);
    await fsp.mkdir(path.dirname(destino), { recursive: true });
    const temporario = `${destino}.restore-${Date.now()}`;
    await fsp.writeFile(temporario, entrada.dados);
    await fsp.rename(temporario, destino);
  }
  return permitidas.length;
}

export async function restaurarBackupSupabase(caminho = "", confirmacao = "") {
  if (String(confirmacao).trim().toUpperCase() !== "RESTAURAR") {
    const erro = new Error("Confirmação inválida. Digite RESTAURAR para continuar.");
    erro.status = 400;
    throw erro;
  }
  const config = await lerConfiguracaoBackup();
  const pasta = String(config.pastaSupabase || "backups").replace(/^\/+|\/+$/g, "") || "backups";
  const alvo = String(caminho || "").replace(/^\/+/, "");
  if (!alvo.startsWith(`${pasta}/`) || !/\.zip$/i.test(alvo) || alvo.includes("..")) {
    const erro = new Error("Caminho de backup inválido.");
    erro.status = 400;
    throw erro;
  }

  const backupSeguranca = await enviarBackupSupabase({ sufixo: "antes-restauracao" });
  const bucket = await garantirBucketBackup();
  const { data, error } = await supabaseClient().storage.from(bucket).download(alvo);
  if (error) throw new Error(error.message);
  const buffer = Buffer.from(await data.arrayBuffer());
  const entradas = extrairZipSeguro(buffer);
  const totalRestaurados = await aplicarEntradasRestauracao(entradas);
  const persistencia = await restaurarArquivosNoSupabase();
  return {
    ok: true,
    mensagem: "Backup restaurado e sincronizado com o Supabase.",
    backupRestaurado: alvo,
    backupSeguranca: backupSeguranca.caminho,
    totalRestaurados,
    persistencia,
    restauradoEm: new Date().toISOString()
  };
}

async function executarBackupAutomatico() {
  try {
    ultimoBackupAutomatico = await enviarBackupSupabase({ sufixo: "automatico" });
    ultimoErroAutomatico = "";
  } catch (erro) {
    ultimoErroAutomatico = erro.message || String(erro);
    console.error(`[Backup automático] ${ultimoErroAutomatico}`);
  }
}

export function iniciarBackupAutomatico() {
  const ativo = !["0", "false", "nao", "não"].includes(String(process.env.FUSION_BACKUP_AUTO || "true").toLowerCase());
  if (!ativo || backupAutomaticoTimer || !process.env.SUPABASE_URL) return statusBackupAutomatico();
  const intervalo = Math.max(15 * 60 * 1000, Number(process.env.FUSION_BACKUP_AUTO_MS || 6 * 60 * 60 * 1000));
  const primeiro = setTimeout(executarBackupAutomatico, Math.min(60 * 1000, Math.floor(intervalo / 4)));
  primeiro.unref?.();
  backupAutomaticoTimer = setInterval(executarBackupAutomatico, intervalo);
  backupAutomaticoTimer.unref?.();
  return statusBackupAutomatico();
}

export function statusBackupAutomatico() {
  return {
    ativo: Boolean(backupAutomaticoTimer),
    intervaloMs: Math.max(15 * 60 * 1000, Number(process.env.FUSION_BACKUP_AUTO_MS || 6 * 60 * 60 * 1000)),
    ultimoBackup: ultimoBackupAutomatico,
    ultimoErro: ultimoErroAutomatico
  };
}

export async function statusBackup() {
  return {
    ok: true,
    dataDir: dataDir(),
    uploadsDir: uploadsDir(),
    supabaseConfigurado: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
    bucket: process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET,
    config: await lerConfiguracaoBackup(),
    persistencia: statusPersistencia(),
    automatico: statusBackupAutomatico()
  };
}
