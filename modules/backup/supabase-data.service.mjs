import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(ROOT_DIR, "data");
const UPLOADS_DIR = path.resolve(ROOT_DIR, "uploads");
const DEFAULT_BUCKET = "fusion-data";
const MANIFEST_NAME = "_manifest.json";

let cliente = null;
let timer = null;
let sincronizando = false;
let inicializado = false;
let ultimoErro = "";
let ultimaSincronizacao = null;
let ultimoResultado = null;
let estadoLocal = new Map();
let ultimaAssinaturaManifesto = "";

function configurado() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function obrigatorio() {
  const valor = String(process.env.FUSION_REQUIRE_SUPABASE_DATA ?? (process.env.RENDER ? "true" : "false")).toLowerCase();
  return ["1", "true", "sim", "yes"].includes(valor);
}

function tenantId() {
  return String(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto")
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "academia-piloto";
}

function bucketNome() {
  return process.env.SUPABASE_DATA_BUCKET || DEFAULT_BUCKET;
}

function prefixo() {
  return `tenants/${tenantId()}`;
}

function supabase() {
  if (!configurado()) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para persistência.");
  if (!cliente) {
    cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cliente;
}

async function garantirBucket() {
  const sb = supabase();
  const bucket = bucketNome();
  const { data, error } = await sb.storage.getBucket(bucket);
  if (!error && data) return;
  const { error: criarErro } = await sb.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 52428800
  });
  if (criarErro && !/already exists|duplicate/i.test(criarErro.message || "")) throw criarErro;
}

function caminhoSeguro(relativo = "") {
  const limpo = String(relativo).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!limpo || limpo.includes("..") || !/^(data|uploads)\//.test(limpo)) {
    throw new Error(`Caminho de persistência inválido: ${relativo}`);
  }
  return limpo;
}

function absoluto(relativo) {
  const seguro = caminhoSeguro(relativo);
  const base = seguro.startsWith("data/") ? DATA_DIR : UPLOADS_DIR;
  const interno = seguro.replace(/^(data|uploads)\//, "");
  const destino = path.resolve(base, interno);
  if (!destino.startsWith(`${base}${path.sep}`) && destino !== base) throw new Error("Destino fora da pasta permitida.");
  return destino;
}

async function garantirDiretorio(absPath) {
  const stat = await fs.lstat(absPath).catch(() => null);
  if (stat) {
    if (stat.isSymbolicLink()) {
      try {
        const alvo = await fs.stat(absPath);
        if (alvo.isDirectory()) return;
      } catch {}
    } else if (stat.isDirectory()) {
      return;
    }
    await fs.rm(absPath, { recursive: true, force: true });
  }
  await fs.mkdir(absPath, { recursive: true });
}

async function garantirDiretoriosBase() {
  await garantirDiretorio(DATA_DIR);
  await garantirDiretorio(UPLOADS_DIR);
}

async function listarArquivosDiretorio(base, prefixoRelativo) {
  const saida = [];
  async function percorrer(dir) {
    let itens = [];
    try { itens = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const item of itens) {
      if (item.name.endsWith(".tmp") || item.name.includes(".tmp-")) continue;
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) await percorrer(abs);
      else if (item.isFile()) {
        const rel = path.relative(base, abs).split(path.sep).join("/");
        saida.push({ abs, relativo: `${prefixoRelativo}/${rel}` });
      }
    }
  }
  await percorrer(base);
  return saida;
}

async function inventarioLocal() {
  await garantirDiretoriosBase();
  const arquivos = [
    ...(await listarArquivosDiretorio(DATA_DIR, "data")),
    ...(await listarArquivosDiretorio(UPLOADS_DIR, "uploads"))
  ];
  const itens = [];
  for (const arquivo of arquivos) {
    const stat = await fs.stat(arquivo.abs);
    itens.push({ ...arquivo, bytes: stat.size, mtimeMs: stat.mtimeMs });
  }
  return itens;
}

async function hashArquivo(abs) {
  const dados = await fs.readFile(abs);
  return crypto.createHash("sha256").update(dados).digest("hex");
}

async function baixarObjeto(caminho) {
  const { data, error } = await supabase().storage.from(bucketNome()).download(caminho);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function enviarObjeto(caminho, dados, contentType = "application/octet-stream") {
  const { error } = await supabase().storage.from(bucketNome()).upload(caminho, dados, {
    contentType,
    upsert: true,
    cacheControl: "0"
  });
  if (error) throw error;
}

async function lerManifestoRemoto() {
  try {
    const dados = await baixarObjeto(`${prefixo()}/${MANIFEST_NAME}`);
    const json = JSON.parse(dados.toString("utf8"));
    return json && Array.isArray(json.arquivos) ? json : null;
  } catch (erro) {
    if (/not found|object not found|404/i.test(erro.message || "")) return null;
    throw erro;
  }
}

async function salvarManifesto(arquivos) {
  const manifesto = {
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    tenantId: tenantId(),
    atualizadoEm: new Date().toISOString(),
    arquivos: arquivos.map(({ relativo, bytes, hash }) => ({ relativo, bytes, hash }))
  };
  await enviarObjeto(`${prefixo()}/${MANIFEST_NAME}`, Buffer.from(JSON.stringify(manifesto, null, 2)), "application/json");
  return manifesto;
}

function assinaturaManifesto(arquivos = []) {
  return JSON.stringify(
    arquivos
      .map(({ relativo, bytes, hash }) => ({ relativo, bytes, hash }))
      .sort((a, b) => a.relativo.localeCompare(b.relativo))
  );
}

async function restaurarEstadoRemoto(manifesto) {
  await garantirDiretoriosBase();
  const nomesRemotos = new Set(manifesto.arquivos.map(item => caminhoSeguro(item.relativo)));
  const locais = await inventarioLocal();
  for (const item of locais) {
    if (!nomesRemotos.has(item.relativo)) await fs.rm(item.abs, { force: true });
  }
  let restaurados = 0;
  for (const item of manifesto.arquivos) {
    const relativo = caminhoSeguro(item.relativo);
    const dados = await baixarObjeto(`${prefixo()}/${relativo}`);
    const destino = absoluto(relativo);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    const temporario = `${destino}.tmp-${Date.now()}`;
    await fs.writeFile(temporario, dados);
    await fs.rename(temporario, destino);
    restaurados += 1;
  }
  return restaurados;
}

export async function sincronizarTudoAgora({ forcar = false } = {}) {
  if (!configurado()) return { ok: false, configurado: false, mensagem: "Supabase não configurado." };
  if (sincronizando) return ultimoResultado || { ok: true, aguardando: true };
  sincronizando = true;
  try {
    await garantirDiretoriosBase();
    await garantirBucket();
    const inventario = await inventarioLocal();
    const manifesto = [];
    let enviados = 0;
    for (const item of inventario) {
      const assinaturaRapida = `${item.bytes}:${item.mtimeMs}`;
      const anterior = estadoLocal.get(item.relativo);
      let hash = anterior?.hash || "";
      if (forcar || !anterior || anterior.assinaturaRapida !== assinaturaRapida) {
        hash = await hashArquivo(item.abs);
        if (forcar || !anterior || anterior.hash !== hash) {
          const dados = await fs.readFile(item.abs);
          const tipo = item.relativo.endsWith(".json") ? "application/json" : "application/octet-stream";
          await enviarObjeto(`${prefixo()}/${item.relativo}`, dados, tipo);
          enviados += 1;
        }
      }
      estadoLocal.set(item.relativo, { assinaturaRapida, hash });
      manifesto.push({ relativo: item.relativo, bytes: item.bytes, hash });
    }
    const assinaturaAtual = assinaturaManifesto(manifesto);
    if (forcar || assinaturaAtual !== ultimaAssinaturaManifesto) {
      await salvarManifesto(manifesto);
      ultimaAssinaturaManifesto = assinaturaAtual;
    }
    ultimaSincronizacao = new Date().toISOString();
    ultimoErro = "";
    ultimoResultado = { ok: true, configurado: true, enviados, totalArquivos: manifesto.length, tenantId: tenantId(), ultimaSincronizacao };
    return ultimoResultado;
  } catch (erro) {
    ultimoErro = erro.message || String(erro);
    throw erro;
  } finally {
    sincronizando = false;
  }
}

export async function inicializarPersistenciaSupabase() {
  if (inicializado) return statusPersistencia();
  if (!configurado()) {
    const mensagem = "Persistência Supabase desativada: credenciais não configuradas.";
    if (obrigatorio()) throw new Error(mensagem);
    console.warn(`[Persistência] ${mensagem}`);
    inicializado = true;
    return statusPersistencia();
  }
  try {
    await garantirDiretoriosBase();
    await garantirBucket();
    const manifesto = await lerManifestoRemoto();
    if (manifesto?.arquivos) {
      const restaurados = await restaurarEstadoRemoto(manifesto);
      ultimaAssinaturaManifesto = assinaturaManifesto(manifesto.arquivos);
      console.log(`[Persistência] ${restaurados} arquivo(s) restaurado(s) do Supabase para ${tenantId()}.`);
    } else {
      console.log(`[Persistência] Primeiro envio da base local para o Supabase (${tenantId()}).`);
    }
    estadoLocal = new Map();
    await sincronizarTudoAgora({ forcar: !manifesto });
  } catch (erro) {
    ultimoErro = erro.message || String(erro);
    if (obrigatorio()) throw erro;
    console.warn(`[Persistência] Supabase indisponível; ambiente local continuará sem sincronização: ${ultimoErro}`);
    inicializado = true;
    return statusPersistencia();
  }
  const intervalo = Math.max(1000, Number(process.env.FUSION_DATA_SYNC_MS || 2000));
  timer = setInterval(() => {
    sincronizarTudoAgora().catch((erro) => {
      ultimoErro = erro.message || String(erro);
      console.error(`[Persistência] Falha ao sincronizar: ${ultimoErro}`);
    });
  }, intervalo);
  timer.unref?.();
  inicializado = true;
  return statusPersistencia();
}

export async function restaurarArquivosNoSupabase() {
  estadoLocal = new Map();
  ultimaAssinaturaManifesto = "";
  return sincronizarTudoAgora({ forcar: true });
}

export function statusPersistencia() {
  return {
    ok: !ultimoErro,
    configurado: configurado(),
    obrigatorio: obrigatorio(),
    inicializado,
    sincronizando,
    tenantId: tenantId(),
    bucket: bucketNome(),
    ultimaSincronizacao,
    ultimoErro,
    ultimoResultado
  };
}

export async function encerrarPersistenciaSupabase() {
  if (timer) clearInterval(timer);
  timer = null;
  if (configurado()) await sincronizarTudoAgora();
}
