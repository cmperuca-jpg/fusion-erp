import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizarTenantId } from "../core/persistence/tenant-context.mjs";

const ROOT_DIR = process.cwd();
const DEFAULT_BUCKET = "fusion-backups";
const DEFAULT_BACKUP_PREFIX = "FusionERP";
const MULTIPART_SUFFIX = ".manifest.json";
const DB_SNAPSHOT_NAME = "database/fusion_v3_records.json";
const BACKUP_MANIFEST_NAME = "backup-manifest.json";

let backupAutomaticoTimer = null;
let ultimoBackupAutomatico = null;
let ultimoErroAutomatico = "";

function erro(mensagem, status = 500) {
  return Object.assign(new Error(mensagem), { status });
}

function tenantSeguro(valor = "") {
  const tenant = normalizarTenantId(
    valor ||
    process.env.FUSION_TENANT_ID ||
    process.env.FUSION_ACADEMIA_ID ||
    ""
  );
  if (!tenant) {
    throw erro(
      "Academia não identificada para a operação de backup. O fallback global foi desativado.",
      400
    );
  }
  return tenant;
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw erro("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados.", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
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

function pastaBase(valor = "backups") {
  const limpa = String(valor || "backups")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "")
    .split("/")
    .map(parte => limparNomeArquivo(parte, "backups"))
    .filter(Boolean)
    .join("/");
  return limpa || "backups";
}

function pastaDoTenant(config, tenantId) {
  return `${pastaBase(config?.pastaSupabase || "backups")}/${tenantSeguro(tenantId)}`;
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

async function obterTenant(tenantId) {
  const tenant = tenantSeguro(tenantId);
  const { data, error } = await supabaseClient()
    .from("fusion_tenants")
    .select("tenant_id,slug,name,status,settings")
    .eq("tenant_id", tenant)
    .maybeSingle();

  if (error) throw erro(`Falha ao consultar academia: ${error.message}`, 500);
  if (!data) throw erro("Academia não encontrada.", 404);
  return data;
}

function configPadrao(tenant = {}) {
  const nome = String(tenant.name || tenant.tenant_id || DEFAULT_BACKUP_PREFIX).trim();
  return {
    empresa: nome,
    prefixo: nome,
    template: process.env.BACKUP_FILE_TEMPLATE || "{prefixo}_Backup_{data}_{hora}.zip",
    pastaSupabase: process.env.SUPABASE_BACKUP_FOLDER || "backups",
    atualizadoEm: null
  };
}

export async function lerConfiguracaoBackup(tenantId = "") {
  const tenant = await obterTenant(tenantId);
  const salvo = tenant.settings?.backup && typeof tenant.settings.backup === "object"
    ? tenant.settings.backup
    : {};
  return { ...configPadrao(tenant), ...salvo };
}

export async function salvarConfiguracaoBackup(dados = {}, tenantId = "") {
  const tenant = await obterTenant(tenantId);
  const atual = await lerConfiguracaoBackup(tenant.tenant_id);
  const config = {
    ...atual,
    empresa: String(dados.empresa ?? atual.empresa ?? tenant.name ?? DEFAULT_BACKUP_PREFIX).trim() || DEFAULT_BACKUP_PREFIX,
    prefixo: String(dados.prefixo ?? dados.nome ?? atual.prefixo ?? atual.empresa ?? tenant.name ?? DEFAULT_BACKUP_PREFIX).trim() || DEFAULT_BACKUP_PREFIX,
    template: String(dados.template ?? atual.template ?? "{prefixo}_Backup_{data}_{hora}.zip").trim() || "{prefixo}_Backup_{data}_{hora}.zip",
    pastaSupabase: pastaBase(dados.pastaSupabase ?? atual.pastaSupabase ?? "backups"),
    atualizadoEm: new Date().toISOString()
  };

  const settings = {
    ...(tenant.settings && typeof tenant.settings === "object" ? tenant.settings : {}),
    backup: config
  };

  const { error } = await supabaseClient()
    .from("fusion_tenants")
    .update({ settings, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant.tenant_id);

  if (error) throw erro(`Falha ao salvar configuração de backup: ${error.message}`, 500);

  return {
    ok: true,
    tenantId: tenant.tenant_id,
    config,
    pastaEfetiva: pastaDoTenant(config, tenant.tenant_id),
    exemplo: gerarNomeBackup(config)
  };
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

function backupLocalDir(tenantId) {
  return path.resolve(ROOT_DIR, "backups", tenantSeguro(tenantId));
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

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

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

function zipBuffer(entradas) {
  const locais = [];
  const centrais = [];
  let offset = 0;

  for (const entrada of entradas) {
    const nome = Buffer.from(entrada.name, "utf8");
    const dados = Buffer.isBuffer(entrada.data)
      ? entrada.data
      : Buffer.from(String(entrada.data || ""));
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

async function exportarBancoSupabase(tenantId) {
  const tenant = tenantSeguro(tenantId);
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const linhas = [];
  const pagina = 1000;

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabaseClient()
      .from(tabela)
      .select("tenant_id,collection,record_id,payload,updated_at")
      .eq("tenant_id", tenant)
      .order("collection", { ascending: true })
      .order("record_id", { ascending: true })
      .range(inicio, inicio + pagina - 1);

    if (error) throw erro(`Falha ao exportar banco para o backup: ${error.message}`, 500);
    linhas.push(...(data || []));
    if (!data || data.length < pagina) break;
  }

  return {
    sistema: "Fusion ERP",
    tipo: "snapshot-postgresql-v2-multitenant",
    tabela,
    tenantId: tenant,
    criadoEm: new Date().toISOString(),
    totalRegistros: linhas.length,
    registros: linhas
  };
}

async function montarZip(tenantId) {
  const tenant = tenantSeguro(tenantId);
  const banco = await exportarBancoSupabase(tenant);
  const manifesto = {
    sistema: "Fusion ERP",
    tipo: "backup-saas-tenant-v2",
    tenantId: tenant,
    criadoEm: new Date().toISOString(),
    bancoIncluido: true,
    totalRegistrosBanco: banco.totalRegistros,
    escopo: "Somente dados do tenant autenticado em fusion_v3_records.",
    observacao: "Arquivos globais de data/uploads não são restaurados por este fluxo para impedir vazamento entre academias."
  };

  const entradas = [
    { name: DB_SNAPSHOT_NAME, data: JSON.stringify(banco) },
    { name: BACKUP_MANIFEST_NAME, data: JSON.stringify(manifesto, null, 2) }
  ];

  return {
    buffer: zipBuffer(entradas),
    totalArquivos: entradas.length,
    totalRegistrosBanco: banco.totalRegistros
  };
}

async function garantirBucketBackup() {
  const bucket = process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET;
  const sb = supabaseClient();
  const { data, error } = await sb.storage.getBucket(bucket);
  if (!error && data) return bucket;

  const { error: criarErro } = await sb.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024
  });
  if (criarErro && !/already exists|duplicate/i.test(criarErro.message || "")) {
    throw erro(criarErro.message, 500);
  }
  return bucket;
}

async function uploadObjetoBackup(sb, bucket, caminho, dados, contentType) {
  const { error } = await sb.storage.from(bucket).upload(caminho, dados, {
    contentType,
    upsert: false,
    cacheControl: "0"
  });
  if (error) throw erro(error.message, 500);
}

async function enviarBufferBackup({
  sb, bucket, pasta, nome, buffer, totalArquivos, totalRegistrosBanco, tenantId
}) {
  const limite = limiteParteBytes();

  if (buffer.length <= limite) {
    const caminho = `${pasta}/${nome}`;
    await uploadObjetoBackup(sb, bucket, caminho, buffer, "application/zip");
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

      await uploadObjetoBackup(sb, bucket, caminho, parte, "application/octet-stream");
      enviados.push(caminho);
      partes.push({
        ordem: indice + 1,
        nome: parteNome,
        caminho,
        bytes: parte.length,
        sha256: sha256(parte)
      });
    }

    const manifesto = {
      sistema: "Fusion ERP",
      tipo: "fusion-backup-multipart-v2-multitenant",
      nome,
      tenantId: tenantSeguro(tenantId),
      criadoEm: new Date().toISOString(),
      bytes: buffer.length,
      sha256: sha256(buffer),
      totalArquivos,
      totalRegistrosBanco,
      totalPartes: partes.length,
      partes
    };

    const caminhoManifesto = `${pasta}/${base}${MULTIPART_SUFFIX}`;
    await uploadObjetoBackup(
      sb,
      bucket,
      caminhoManifesto,
      Buffer.from(JSON.stringify(manifesto, null, 2)),
      "application/json"
    );

    return {
      caminho: caminhoManifesto,
      tipo: "multipart",
      partes: partes.length,
      manifesto
    };
  } catch (e) {
    if (enviados.length) await sb.storage.from(bucket).remove(enviados).catch(() => {});
    throw e;
  }
}

export async function criarBackupLocal(tenantId = "") {
  const tenant = tenantSeguro(tenantId);
  const config = await lerConfiguracaoBackup(tenant);
  const nome = gerarNomeBackup(config);
  const { buffer, totalArquivos, totalRegistrosBanco } = await montarZip(tenant);
  const diretorio = backupLocalDir(tenant);

  await fs.mkdir(diretorio, { recursive: true });
  const destino = path.join(diretorio, nome);
  await fs.writeFile(destino, buffer);

  return {
    ok: true,
    tenantId: tenant,
    destino,
    nome,
    bytes: buffer.length,
    totalArquivos,
    totalRegistrosBanco,
    criadoEm: new Date().toISOString()
  };
}

export async function enviarBackupSupabase(opcoes = {}, tenantId = "") {
  const tenant = tenantSeguro(tenantId || opcoes.tenantId);
  const bucket = await garantirBucketBackup();
  const config = await lerConfiguracaoBackup(tenant);
  const nome = gerarNomeBackup(config, new Date(), opcoes.sufixo || "");
  const { buffer, totalArquivos, totalRegistrosBanco } = await montarZip(tenant);
  const sb = supabaseClient();
  const pasta = pastaDoTenant(config, tenant);

  const envio = await enviarBufferBackup({
    sb,
    bucket,
    pasta,
    nome,
    buffer,
    totalArquivos,
    totalRegistrosBanco,
    tenantId: tenant
  });

  ultimoErroAutomatico = "";

  return {
    ok: true,
    tenantId: tenant,
    bucket,
    pasta,
    caminho: envio.caminho,
    nome,
    bytes: buffer.length,
    totalArquivos,
    totalRegistrosBanco,
    tipo: envio.tipo,
    partes: envio.partes,
    criadoEm: new Date().toISOString()
  };
}

export async function listarBackupsSupabase(tenantId = "") {
  const tenant = tenantSeguro(tenantId);
  const bucket = await garantirBucketBackup();
  const sb = supabaseClient();
  const config = await lerConfiguracaoBackup(tenant);
  const pasta = pastaDoTenant(config, tenant);

  const { data, error } = await sb.storage
    .from(bucket)
    .list(pasta, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });

  if (error) throw erro(error.message, 500);

  const backups = (data || [])
    .filter(item =>
      /\.zip$/i.test(item.name || "") ||
      String(item.name || "").endsWith(MULTIPART_SUFFIX)
    )
    .map(item => {
      const multipart = String(item.name || "").endsWith(MULTIPART_SUFFIX);
      return {
        ...item,
        tipo: multipart ? "multipart" : "zip",
        tenantId: tenant,
        caminho: `${pasta}/${item.name}`,
        nomeExibicao: multipart
          ? item.name.replace(MULTIPART_SUFFIX, ".zip (dividido)")
          : item.name
      };
    });

  return { ok: true, tenantId: tenant, bucket, pasta, backups };
}

function extrairZipSeguro(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw erro("Arquivo de backup inválido ou vazio.", 400);
  }

  let eocd = -1;
  const inicioBusca = Math.max(0, buffer.length - 65557);

  for (let i = buffer.length - 22; i >= inicioBusca; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) throw erro("Estrutura ZIP inválida: diretório central não encontrado.", 400);

  const total = buffer.readUInt16LE(eocd + 10);
  const offsetCentral = buffer.readUInt32LE(eocd + 16);
  const entradas = [];
  let pos = offsetCentral;
  let totalExtraido = 0;

  for (let indice = 0; indice < total; indice += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) {
      throw erro("Diretório central do backup está corrompido.", 400);
    }

    const flags = buffer.readUInt16LE(pos + 8);
    const metodo = buffer.readUInt16LE(pos + 10);
    const tamanhoComprimido = buffer.readUInt32LE(pos + 20);
    const tamanhoOriginal = buffer.readUInt32LE(pos + 24);
    const nomeLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const comentarioLen = buffer.readUInt16LE(pos + 32);
    const offsetLocal = buffer.readUInt32LE(pos + 42);
    const nome = buffer
      .subarray(pos + 46, pos + 46 + nomeLen)
      .toString("utf8")
      .replace(/\\/g, "/");

    pos += 46 + nomeLen + extraLen + comentarioLen;

    if (flags & 1) throw erro("Backup criptografado não é suportado.", 400);
    if (!nome || nome.endsWith("/")) continue;

    if (![DB_SNAPSHOT_NAME, BACKUP_MANIFEST_NAME].includes(nome)) {
      throw erro(`Arquivo não permitido dentro do backup SaaS: ${nome}`, 400);
    }

    if (offsetLocal + 30 > buffer.length || buffer.readUInt32LE(offsetLocal) !== 0x04034b50) {
      throw erro(`Entrada inválida: ${nome}`, 400);
    }

    const nomeLocalLen = buffer.readUInt16LE(offsetLocal + 26);
    const extraLocalLen = buffer.readUInt16LE(offsetLocal + 28);
    const inicioDados = offsetLocal + 30 + nomeLocalLen + extraLocalLen;
    const fimDados = inicioDados + tamanhoComprimido;

    if (fimDados > buffer.length) throw erro(`Conteúdo truncado: ${nome}`, 400);

    const comprimido = buffer.subarray(inicioDados, fimDados);
    let dados;

    if (metodo === 0) dados = Buffer.from(comprimido);
    else if (metodo === 8) dados = zlib.inflateRawSync(comprimido);
    else throw erro(`Método de compactação não suportado em ${nome}.`, 400);

    if (dados.length !== tamanhoOriginal) {
      throw erro(`Tamanho inválido após extrair ${nome}.`, 400);
    }

    totalExtraido += dados.length;
    if (totalExtraido > limiteRestauracaoBytes()) {
      throw erro("Backup excede o limite configurado para restauração.", 400);
    }

    entradas.push({ nome, dados });
  }

  return entradas;
}

async function baixarObjetoBackup(sb, bucket, caminho) {
  const { data, error } = await sb.storage.from(bucket).download(caminho);
  if (error) throw erro(error.message, 500);
  return Buffer.from(await data.arrayBuffer());
}

async function baixarBackupSelecionado(sb, bucket, alvo, pasta, tenantId) {
  const tenant = tenantSeguro(tenantId);

  if (/\.zip$/i.test(alvo)) {
    return baixarObjetoBackup(sb, bucket, alvo);
  }

  const dadosManifesto = await baixarObjetoBackup(sb, bucket, alvo);
  let manifesto;

  try {
    manifesto = JSON.parse(dadosManifesto.toString("utf8"));
  } catch {
    throw erro("Manifesto do backup dividido está inválido.", 400);
  }

  if (
    manifesto?.tipo !== "fusion-backup-multipart-v2-multitenant" ||
    !Array.isArray(manifesto.partes) ||
    !manifesto.partes.length
  ) {
    throw erro("Manifesto do backup dividido não é reconhecido.", 400);
  }

  if (tenantSeguro(manifesto.tenantId) !== tenant) {
    throw erro("O backup pertence a outra academia.", 403);
  }

  const baseAlvo = alvo.slice(0, -MULTIPART_SUFFIX.length);
  const prefixoSeguro = `${baseAlvo}/`;
  const partes = [...manifesto.partes].sort((a, b) => Number(a.ordem) - Number(b.ordem));

  if (partes.length !== Number(manifesto.totalPartes)) {
    throw erro("Quantidade de partes do backup não confere.", 400);
  }

  const buffers = [];
  let bytes = 0;

  for (let indice = 0; indice < partes.length; indice += 1) {
    const parte = partes[indice];
    const caminho = String(parte.caminho || "");

    if (
      Number(parte.ordem) !== indice + 1 ||
      !caminho.startsWith(prefixoSeguro) ||
      !caminho.startsWith(`${pasta}/`) ||
      caminho.includes("..") ||
      !/\.bin$/i.test(caminho)
    ) {
      throw erro("Caminho de parte inválido no manifesto do backup.", 400);
    }

    const bufferParte = await baixarObjetoBackup(sb, bucket, caminho);

    if (
      bufferParte.length !== Number(parte.bytes) ||
      sha256(bufferParte) !== parte.sha256
    ) {
      throw erro(`A parte ${indice + 1} do backup está incompleta ou corrompida.`, 400);
    }

    bytes += bufferParte.length;
    if (bytes > limiteRestauracaoBytes()) {
      throw erro("Backup excede o limite configurado para restauração.", 400);
    }

    buffers.push(bufferParte);
  }

  const completo = Buffer.concat(buffers);

  if (
    completo.length !== Number(manifesto.bytes) ||
    sha256(completo) !== manifesto.sha256
  ) {
    throw erro("A verificação de integridade do backup dividido falhou.", 400);
  }

  return completo;
}

function lerJsonEntrada(entradas, nome) {
  const entrada = entradas.find(item => item.nome === nome);
  if (!entrada) throw erro(`Arquivo obrigatório ausente no backup: ${nome}`, 400);

  try {
    return JSON.parse(entrada.dados.toString("utf8"));
  } catch {
    throw erro(`JSON inválido no backup: ${nome}`, 400);
  }
}

function validarEscopoBackup(entradas, tenantId) {
  const tenant = tenantSeguro(tenantId);
  const manifesto = lerJsonEntrada(entradas, BACKUP_MANIFEST_NAME);
  const snapshot = lerJsonEntrada(entradas, DB_SNAPSHOT_NAME);

  if (manifesto?.tipo !== "backup-saas-tenant-v2") {
    throw erro("Este arquivo não é um backup SaaS multiempresa compatível.", 400);
  }
  if (snapshot?.tipo !== "snapshot-postgresql-v2-multitenant") {
    throw erro("Snapshot do banco não é reconhecido.", 400);
  }

  const tenantManifesto = tenantSeguro(manifesto.tenantId);
  const tenantSnapshot = tenantSeguro(snapshot.tenantId);

  if (tenantManifesto !== tenant || tenantSnapshot !== tenant) {
    throw erro("Backup bloqueado: o arquivo pertence a outra academia.", 403);
  }

  if (!Array.isArray(snapshot.registros)) {
    throw erro("Snapshot do banco não contém registros válidos.", 400);
  }

  for (const linha of snapshot.registros) {
    if (tenantSeguro(linha.tenant_id) !== tenant) {
      throw erro("Backup bloqueado: foi encontrado registro de outra academia.", 403);
    }
    if (!/^[a-z0-9_-]+$/i.test(String(linha.collection || ""))) {
      throw erro("Coleção inválida no snapshot do banco.", 400);
    }
    if (!linha.payload || typeof linha.payload !== "object" || Array.isArray(linha.payload)) {
      throw erro("Registro inválido no snapshot do banco.", 400);
    }
  }

  return { manifesto, snapshot };
}

async function restaurarBancoSupabase(snapshot, tenantId) {
  const tenant = tenantSeguro(tenantId);
  const tabela = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
  const colecoes = {};

  for (const linha of snapshot.registros) {
    const nome = String(linha.collection || "").toLowerCase();
    (colecoes[nome] ||= []).push({
      ...(linha.payload || {}),
      id: linha.payload?.id || linha.record_id
    });
  }

  const sb = supabaseClient();
  const pagina = 1000;

  for (let inicio = 0; ; inicio += pagina) {
    const { data: atuais, error: atuaisErro } = await sb
      .from(tabela)
      .select("collection")
      .eq("tenant_id", tenant)
      .range(inicio, inicio + pagina - 1);

    if (atuaisErro) {
      throw erro(`Falha ao preparar restauração do banco: ${atuaisErro.message}`, 500);
    }

    for (const linha of atuais || []) {
      const nome = String(linha.collection || "").toLowerCase();
      if (/^[a-z0-9_-]+$/.test(nome) && !Object.hasOwn(colecoes, nome)) {
        colecoes[nome] = [];
      }
    }

    if (!atuais || atuais.length < pagina) break;
  }

  const operacaoId = `restore-backup-${tenant}-${crypto.randomUUID()}`;

  const { data, error } = await sb.rpc("fusion_replace_collections", {
    p_tenant_id: tenant,
    p_collections: colecoes,
    p_operation_id: operacaoId
  });

  if (error) {
    throw erro(`Falha na restauração transacional do banco: ${error.message}`, 500);
  }

  return {
    ok: true,
    tenantId: tenant,
    operacaoId,
    colecoes: Object.keys(colecoes).length,
    resultado: data
  };
}

export async function restaurarBackupSupabase(caminho = "", confirmacao = "", tenantId = "") {
  const tenant = tenantSeguro(tenantId);

  if (String(confirmacao).trim().toUpperCase() !== "RESTAURAR") {
    throw erro("Confirmação inválida. Digite RESTAURAR para continuar.", 400);
  }

  const config = await lerConfiguracaoBackup(tenant);
  const pasta = pastaDoTenant(config, tenant);
  const alvo = String(caminho || "").replace(/^\/+/, "");
  const formatoValido = /\.zip$/i.test(alvo) || alvo.endsWith(MULTIPART_SUFFIX);

  if (
    !alvo.startsWith(`${pasta}/`) ||
    !formatoValido ||
    alvo.includes("..")
  ) {
    throw erro("Backup bloqueado: caminho não pertence à academia autenticada.", 403);
  }

  const backupSeguranca = await enviarBackupSupabase(
    { sufixo: "antes-restauracao" },
    tenant
  );

  const bucket = await garantirBucketBackup();
  const sb = supabaseClient();
  const buffer = await baixarBackupSelecionado(sb, bucket, alvo, pasta, tenant);
  const entradas = extrairZipSeguro(buffer);
  const { snapshot } = validarEscopoBackup(entradas, tenant);
  const banco = await restaurarBancoSupabase(snapshot, tenant);

  return {
    ok: true,
    tenantId: tenant,
    mensagem: "Backup da academia restaurado com isolamento multiempresa.",
    backupRestaurado: alvo,
    backupSeguranca: backupSeguranca.caminho,
    banco,
    restauradoEm: new Date().toISOString()
  };
}

async function listarTenantsAtivos() {
  const { data, error } = await supabaseClient()
    .from("fusion_tenants")
    .select("tenant_id,status")
    .in("status", ["active", "trial"])
    .order("tenant_id", { ascending: true });

  if (error) throw erro(`Falha ao listar academias para backup automático: ${error.message}`, 500);
  return (data || []).map(item => tenantSeguro(item.tenant_id));
}

async function executarBackupAutomatico() {
  try {
    const tenants = await listarTenantsAtivos();
    const resultados = [];

    for (const tenant of tenants) {
      try {
        resultados.push(await enviarBackupSupabase({ sufixo: "automatico" }, tenant));
      } catch (e) {
        resultados.push({ ok: false, tenantId: tenant, erro: e.message || String(e) });
      }
    }

    ultimoBackupAutomatico = {
      executadoEm: new Date().toISOString(),
      totalTenants: tenants.length,
      sucessos: resultados.filter(item => item.ok).length,
      falhas: resultados.filter(item => !item.ok).length,
      resultados
    };
    ultimoErroAutomatico = resultados.some(item => !item.ok)
      ? "Um ou mais backups automáticos falharam."
      : "";
  } catch (e) {
    ultimoErroAutomatico = e.message || String(e);
    console.error(`[Backup automático] ${ultimoErroAutomatico}`);
  }
}

export function iniciarBackupAutomatico() {
  const ativo = !["0", "false", "nao", "não"].includes(
    String(process.env.FUSION_BACKUP_AUTO || "false").toLowerCase()
  );

  if (!ativo || backupAutomaticoTimer || !process.env.SUPABASE_URL) {
    return statusBackupAutomatico();
  }

  const intervalo = Math.max(
    15 * 60 * 1000,
    Number(process.env.FUSION_BACKUP_AUTO_MS || 6 * 60 * 60 * 1000)
  );

  const primeiro = setTimeout(
    executarBackupAutomatico,
    Math.min(60 * 1000, Math.floor(intervalo / 4))
  );
  primeiro.unref?.();

  backupAutomaticoTimer = setInterval(executarBackupAutomatico, intervalo);
  backupAutomaticoTimer.unref?.();

  return statusBackupAutomatico();
}

export function statusBackupAutomatico() {
  return {
    ativo: Boolean(backupAutomaticoTimer),
    modo: "multiempresa",
    intervaloMs: Math.max(
      15 * 60 * 1000,
      Number(process.env.FUSION_BACKUP_AUTO_MS || 6 * 60 * 60 * 1000)
    ),
    ultimoBackup: ultimoBackupAutomatico,
    ultimoErro: ultimoErroAutomatico
  };
}

export async function statusBackup(tenantId = "") {
  const tenant = tenantSeguro(tenantId);
  const config = await lerConfiguracaoBackup(tenant);

  return {
    ok: true,
    tenantId: tenant,
    supabaseConfigurado: Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    bucket: process.env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET,
    pasta: pastaDoTenant(config, tenant),
    config,
    automatico: statusBackupAutomatico(),
    isolamento: {
      ativo: true,
      caminhoPorTenant: true,
      restoreValidaTenant: true,
      fallbackAcademiaPiloto: false
    }
  };
}
