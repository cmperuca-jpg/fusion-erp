import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { restaurarArquivosNoSupabase, statusPersistencia } from "./supabase-data.service.mjs";

const ROOT_DIR = process.cwd();
const DEFAULT_BUCKET = "fusion-backups";
const DEFAULT_BACKUP_PREFIX = "FusionERP";
const CONFIG_FILE = "backup_config.json";
const MULTIPART_SUFFIX = ".manifest.json";
const DB_SNAPSHOT_NAME = "database/fusion_v3_records.json";
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

function tenantId() {
  return String(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto")
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "academia-piloto";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function limiteParteBytes() {
  const mb = Math.min(45, Math.max(5, Number(process.env.FUSION_BACKUP_PART_MB || 40)));
  return Math.floor(mb * 1024 * 1024);
}

function limiteRestauracaoBytes() {
  const mb = Math.min(1024, Math.max(100, Number(process.env.FUSION_BACKUP_RESTORE_MAX_MB || 250)));
  return Math.floor(mb * 1024 * 1024);
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
    observacao: "Backup dos dados, uploads e snapshot do banco Supabase. Restauração protegida pelo painel administrativo.",
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

async function exportarBancoSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const supabase = supabaseClient();
  const linhas = [];
  const pagina = 1000;
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from(tabela)
      .select("tenant_id,collection,record_id,payload,updated_at")
      .eq("tenant_id", tenantId())
      .order("collection", { ascending: true })
      .order("record_id", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) throw new Error(`Falha ao exportar banco para o backup: ${error.message}`);
    linhas.push(...(data || []));
    if (!data || data.length < pagina) break;
  }
  return {
    sistema: "Fusion ERP",
    tipo: "snapshot-postgresql-v1",
    tabela,
    tenantId: tenantId(),
    criadoEm: new Date().toISOString(),
    totalRegistros: linhas.length,
    registros: linhas
  };
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
  const banco = await exportarBancoSupabase();
  if (banco) entradas.push({ name: DB_SNAPSHOT_NAME, data: JSON.stringify(banco) });
  const manifesto = await montarManifesto(arquivos);
  manifesto.bancoIncluido = Boolean(banco);
  manifesto.totalRegistrosBanco = banco?.totalRegistros || 0;
  manifesto.tenantId = tenantId();
  entradas.push({ name: "backup-manifest.json", data: JSON.stringify(manifesto, null, 2) });
  return { buffer: zipBuffer(entradas), totalArquivos: arquivos.length, totalRegistrosBanco: banco?.totalRegistros || 0 };
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function garantirBucketBackup() {
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET;
  const supabase = supabaseClient();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (!error && data) return bucket;
  const { error: criarErro } = await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 50 * 1024 * 1024 });
  if (criarErro && !/already exists|duplicate/i.test(criarErro.message || "")) throw new Error(criarErro.message);
  return bucket;
}

async function uploadObjetoBackup(supabase, bucket, caminho, dados, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(caminho, dados, {
    contentType,
    upsert: false,
    cacheControl: "0"
  });
  if (error) throw new Error(error.message);
}

async function enviarBufferBackup({ supabase, bucket, pasta, nome, buffer, totalArquivos, totalRegistrosBanco }) {
  const limite = limiteParteBytes();
  if (buffer.length <= limite) {
    const caminho = `${pasta}/${nome}`;
    await uploadObjetoBackup(supabase, bucket, caminho, buffer, "application/zip");
    return { caminho, tipo: "zip", partes: 1 };
  }

  const base = limparNomeArquivo(nome.replace(/\.zip$/i, ""));
  const prefixoPartes = `${pasta}/${base}`;
  const partes = [];
  const enviados = [];
  try {
    const totalPartes = Math.ceil(buffer.length / limite);
    for (let indice = 0; indice < totalPartes; indice += 1) {
      const inicio = indice * limite;
      const parte = buffer.subarray(inicio, Math.min(buffer.length, inicio + limite));
      const parteNome = `parte-${String(indice + 1).padStart(3, "0")}-de-${String(totalPartes).padStart(3, "0")}.bin`;
      const caminho = `${prefixoPartes}/${parteNome}`;
      await uploadObjetoBackup(supabase, bucket, caminho, parte, "application/octet-stream");
      enviados.push(caminho);
      partes.push({ ordem: indice + 1, nome: parteNome, caminho, bytes: parte.length, sha256: sha256(parte) });
    }
    const manifesto = {
      sistema: "Fusion ERP",
      tipo: "fusion-backup-multipart-v1",
      nome,
      tenantId: tenantId(),
      criadoEm: new Date().toISOString(),
      bytes: buffer.length,
      sha256: sha256(buffer),
      totalArquivos,
      totalRegistrosBanco,
      totalPartes: partes.length,
      partes
    };
    const caminhoManifesto = `${pasta}/${base}${MULTIPART_SUFFIX}`;
    await uploadObjetoBackup(supabase, bucket, caminhoManifesto, Buffer.from(JSON.stringify(manifesto, null, 2)), "application/json");
    return { caminho: caminhoManifesto, tipo: "multipart", partes: partes.length, manifesto };
  } catch (erro) {
    if (enviados.length) await supabase.storage.from(bucket).remove(enviados).catch(() => {});
    throw erro;
  }
}

export async function criarBackupLocal() {
  const config = await lerConfiguracaoBackup();
  const nome = gerarNomeBackup(config);
  const { buffer, totalArquivos, totalRegistrosBanco } = await montarZip();
  await fsp.mkdir(backupLocalDir(), { recursive: true });
  const destino = path.join(backupLocalDir(), nome);
  await fsp.writeFile(destino, buffer);
  return { ok: true, destino, nome, bytes: buffer.length, totalArquivos, totalRegistrosBanco, criadoEm: new Date().toISOString() };
}

export async function enviarBackupSupabase(opcoes = {}) {
  const bucket = await garantirBucketBackup();
  const config = await lerConfiguracaoBackup();
  const nome = gerarNomeBackup(config, new Date(), opcoes.sufixo || "");
  const { buffer, totalArquivos, totalRegistrosBanco } = await montarZip();
  const supabase = supabaseClient();
  const pasta = String(config.pastaSupabase || "backups").replace(/^\/+|\/+$/g, "") || "backups";
  const envio = await enviarBufferBackup({ supabase, bucket, pasta, nome, buffer, totalArquivos, totalRegistrosBanco });
  ultimoErroAutomatico = "";
  return {
    ok: true, bucket, caminho: envio.caminho, nome, bytes: buffer.length, totalArquivos,
    totalRegistrosBanco, tipo: envio.tipo, partes: envio.partes, criadoEm: new Date().toISOString()
  };
}

export async function listarBackupsSupabase() {
  const bucket = await garantirBucketBackup();
  const supabase = supabaseClient();
  const config = await lerConfiguracaoBackup();
  const pasta = String(config.pastaSupabase || "backups").replace(/^\/+|\/+$/g, "") || "backups";
  const { data, error } = await supabase.storage.from(bucket).list(pasta, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(error.message);
  const backups = (data || [])
    .filter(item => /\.zip$/i.test(item.name || "") || String(item.name || "").endsWith(MULTIPART_SUFFIX))
    .map(item => {
      const multipart = String(item.name || "").endsWith(MULTIPART_SUFFIX);
      return {
        ...item,
        tipo: multipart ? "multipart" : "zip",
        caminho: `${pasta}/${item.name}`,
        nomeExibicao: multipart ? item.name.replace(MULTIPART_SUFFIX, ".zip (dividido)") : item.name
      };
    });
  return { ok: true, bucket, pasta, backups };
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
    if (nome.includes("..") || nome.startsWith("/") || !/^(?:(?:data|uploads)\/|database\/fusion_v3_records\.json$|backup-manifest\.json$)/.test(nome)) {
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
    if (totalExtraido > limiteRestauracaoBytes()) throw new Error("Backup excede o limite configurado para restauração.");
    entradas.push({ nome, dados });
  }
  return entradas;
}

async function baixarObjetoBackup(supabase, bucket, caminho) {
  const { data, error } = await supabase.storage.from(bucket).download(caminho);
  if (error) throw new Error(error.message);
  return Buffer.from(await data.arrayBuffer());
}

async function baixarBackupSelecionado(supabase, bucket, alvo, pasta) {
  if (/\.zip$/i.test(alvo)) return baixarObjetoBackup(supabase, bucket, alvo);
  const dadosManifesto = await baixarObjetoBackup(supabase, bucket, alvo);
  let manifesto;
  try { manifesto = JSON.parse(dadosManifesto.toString("utf8")); }
  catch { throw new Error("Manifesto do backup dividido está inválido."); }
  if (manifesto?.tipo !== "fusion-backup-multipart-v1" || !Array.isArray(manifesto.partes) || !manifesto.partes.length) {
    throw new Error("Manifesto do backup dividido não é reconhecido.");
  }
  if (manifesto.tenantId && manifesto.tenantId !== tenantId()) throw new Error("O backup pertence a outra academia.");
  const baseAlvo = alvo.slice(0, -MULTIPART_SUFFIX.length);
  const prefixoSeguro = `${baseAlvo}/`;
  const partes = [...manifesto.partes].sort((a, b) => Number(a.ordem) - Number(b.ordem));
  if (partes.length !== Number(manifesto.totalPartes)) throw new Error("Quantidade de partes do backup não confere.");
  const buffers = [];
  let bytes = 0;
  for (let indice = 0; indice < partes.length; indice += 1) {
    const parte = partes[indice];
    const caminho = String(parte.caminho || "");
    if (Number(parte.ordem) !== indice + 1 || !caminho.startsWith(prefixoSeguro) || caminho.includes("..") || !/\.bin$/i.test(caminho)) {
      throw new Error("Caminho de parte inválido no manifesto do backup.");
    }
    const bufferParte = await baixarObjetoBackup(supabase, bucket, caminho);
    if (bufferParte.length !== Number(parte.bytes) || sha256(bufferParte) !== parte.sha256) {
      throw new Error(`A parte ${indice + 1} do backup está incompleta ou corrompida.`);
    }
    bytes += bufferParte.length;
    if (bytes > limiteRestauracaoBytes()) throw new Error("Backup excede o limite configurado para restauração.");
    buffers.push(bufferParte);
  }
  const completo = Buffer.concat(buffers);
  if (completo.length !== Number(manifesto.bytes) || sha256(completo) !== manifesto.sha256) {
    throw new Error("A verificação de integridade do backup dividido falhou.");
  }
  return completo;
}

function colecoesDosArquivosJson(entradas) {
  const colecoes = {};
  for (const entrada of entradas.filter(item => /^data\/[^/]+\.json$/i.test(item.nome))) {
    const nome = path.basename(entrada.nome, ".json").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const dados = JSON.parse(entrada.dados.toString("utf8"));
    colecoes[nome] = Array.isArray(dados) ? dados : [{ id: "__document__", __fusion_document__: dados }];
  }
  return colecoes;
}

async function restaurarBancoSupabase(entradas) {
  const supabase = supabaseClient();
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const snapshotEntrada = entradas.find(item => item.nome === DB_SNAPSHOT_NAME);
  let colecoes = {};
  if (snapshotEntrada) {
    let snapshot;
    try { snapshot = JSON.parse(snapshotEntrada.dados.toString("utf8")); }
    catch { throw new Error("Snapshot do banco dentro do backup está inválido."); }
    if (snapshot?.tipo !== "snapshot-postgresql-v1" || !Array.isArray(snapshot.registros)) throw new Error("Snapshot do banco não é reconhecido.");
    if (snapshot.tenantId && snapshot.tenantId !== tenantId()) throw new Error("O snapshot pertence a outra academia.");
    for (const linha of snapshot.registros) {
      const nome = String(linha.collection || "");
      if (!/^[a-z0-9_-]+$/.test(nome) || !linha.payload || typeof linha.payload !== "object") throw new Error("Registro inválido no snapshot do banco.");
      (colecoes[nome] ||= []).push(linha.payload);
    }
  } else {
    colecoes = colecoesDosArquivosJson(entradas);
  }
  if (!Object.keys(colecoes).length) throw new Error("O backup não contém coleções válidas para restaurar.");

  const pagina = 1000;
  for (let inicio = 0; ; inicio += pagina) {
    const { data: atuais, error: atuaisErro } = await supabase
      .from(tabela).select("collection").eq("tenant_id", tenantId()).range(inicio, inicio + pagina - 1);
    if (atuaisErro) throw new Error(`Falha ao preparar restauração do banco: ${atuaisErro.message}`);
    for (const linha of atuais || []) {
      const nome = String(linha.collection || "");
      if (/^[a-z0-9_-]+$/.test(nome) && !Object.hasOwn(colecoes, nome)) colecoes[nome] = [];
    }
    if (!atuais || atuais.length < pagina) break;
  }

  const operacaoId = `restore-backup-${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("fusion_replace_collections", {
    p_tenant_id: tenantId(), p_collections: colecoes, p_operation_id: operacaoId
  });
  if (error) throw new Error(`Falha na restauração transacional do banco: ${error.message}`);
  return { ok: true, operacaoId, colecoes: Object.keys(colecoes).length, resultado: data };
}

async function arquivosAtuais(baseDir, prefixoRelativo) {
  return listarArquivos(baseDir, prefixoRelativo);
}

function validarEntradasRestauracao(entradas) {
  const permitidas = entradas.filter(e => /^(data|uploads)\//.test(e.nome));
  if (!entradas.some(item => item.nome === DB_SNAPSHOT_NAME)) {
    const criticos = ["data/alunos.json", "data/matriculas.json", "data/financeiro.json", "data/mensalidades.json"];
    for (const nome of criticos) {
      if (!permitidas.some(e => e.nome === nome)) throw new Error(`Backup antigo incompleto: ${nome} não foi encontrado.`);
    }
  }
  for (const entrada of permitidas.filter(e => e.nome.startsWith("data/") && e.nome.endsWith(".json"))) {
    try { JSON.parse(entrada.dados.toString("utf8")); }
    catch { throw new Error(`JSON inválido no backup: ${entrada.nome}`); }
  }
  return permitidas;
}

async function aplicarEntradasRestauracao(entradas) {
  const permitidas = validarEntradasRestauracao(entradas);
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
  const formatoValido = /\.zip$/i.test(alvo) || alvo.endsWith(MULTIPART_SUFFIX);
  if (!alvo.startsWith(`${pasta}/`) || !formatoValido || alvo.includes("..")) {
    const erro = new Error("Caminho de backup inválido.");
    erro.status = 400;
    throw erro;
  }

  const backupSeguranca = await enviarBackupSupabase({ sufixo: "antes-restauracao" });
  const bucket = await garantirBucketBackup();
  const supabase = supabaseClient();
  const buffer = await baixarBackupSelecionado(supabase, bucket, alvo, pasta);
  const entradas = extrairZipSeguro(buffer);
  validarEntradasRestauracao(entradas);
  const banco = await restaurarBancoSupabase(entradas);
  const totalRestaurados = await aplicarEntradasRestauracao(entradas);
  const persistencia = await restaurarArquivosNoSupabase();
  return {
    ok: true,
    mensagem: "Backup restaurado e sincronizado com o Supabase.",
    backupRestaurado: alvo,
    backupSeguranca: backupSeguranca.caminho,
    totalRestaurados,
    banco,
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
    supabaseConfigurado: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    bucket: process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET,
    config: await lerConfiguracaoBackup(),
    persistencia: statusPersistencia(),
    automatico: statusBackupAutomatico()
  };
}
