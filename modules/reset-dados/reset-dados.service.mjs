import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";
import { autenticar } from "../auth/auth.service.mjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_ALUNOS = path.join(ROOT, "uploads", "alunos");
const TABLE = process.env.FUSION_SUPABASE_RECORDS_TABLE || "fusion_v3_records";
const FRASE = "APAGAR TODOS OS DADOS";

const PRESERVAR = new Set([
  "usuarios", "access_config", "access_integracoes_sdk", "access_regras",
  "henry7x", "formas_pagamento", "taxas_cartao", "plano_contas",
  "exercicios", "exercicios_biblioteca", "modelos-treino"
]);

function tenantId() {
  return String(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto")
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "academia-piloto";
}

function nomeColecao(nome = "") {
  return path.basename(String(nome)).replace(/\.json$/i, "").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}

async function listarJsonRecursivo(dir = DATA_DIR) {
  const saida = [];
  let itens = [];
  try { itens = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return saida; throw e; }
  for (const item of itens) {
    const alvo = path.join(dir, item.name);
    if (item.isDirectory()) saida.push(...await listarJsonRecursivo(alvo));
    else if (item.isFile() && item.name.toLowerCase().endsWith(".json")) saida.push(alvo);
  }
  return saida;
}

async function lerJsonSeguro(arquivo, fallback = []) {
  try {
    const raw = await fs.readFile(arquivo, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function adminsDaLista(lista, usuarioAtual) {
  if (!Array.isArray(lista)) return [];
  const admins = lista.filter(item => {
    const perfil = String(item?.perfil || "").toLowerCase();
    const permissoes = Array.isArray(item?.permissoes) ? item.permissoes : [];
    return String(item?.id) === String(usuarioAtual?.id) || perfil === "administrador" || perfil === "admin" || permissoes.includes("*");
  });
  const atual = admins.find(item => String(item.id) === String(usuarioAtual?.id));
  return atual ? [atual] : admins.slice(0, 1);
}

async function contarArquivos(dir) {
  let total = 0;
  let itens = [];
  try { itens = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return 0; throw e; }
  for (const item of itens) total += item.isDirectory() ? await contarArquivos(path.join(dir, item.name)) : 1;
  return total;
}

async function limparDiretorio(dir) {
  let itens = [];
  try { itens = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return 0; throw e; }
  let removidos = 0;
  for (const item of itens) {
    const alvo = path.join(dir, item.name);
    if (item.isDirectory()) {
      removidos += await limparDiretorio(alvo);
      await fs.rm(alvo, { recursive: true, force: true });
    } else {
      await fs.rm(alvo, { force: true });
      removidos++;
    }
  }
  await fs.mkdir(dir, { recursive: true });
  return removidos;
}

async function limparStorageBucket(supabase, bucket) {
  let removidos = 0;
  async function percorrer(prefixo = "") {
    const { data, error } = await supabase.storage.from(bucket).list(prefixo, { limit: 1000 });
    if (error) {
      if (/not found|does not exist/i.test(error.message || "")) return;
      throw error;
    }
    for (const item of data || []) {
      const nome = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id) {
        const { error: remErro } = await supabase.storage.from(bucket).remove([nome]);
        if (remErro) throw remErro;
        removidos++;
      } else await percorrer(nome);
    }
  }
  await percorrer("");
  return removidos;
}

async function obterResumoLocal(usuarioAtual) {
  const arquivos = await listarJsonRecursivo();
  const colecoes = [];
  let registros = 0;
  for (const arquivo of arquivos) {
    const colecao = nomeColecao(arquivo);
    if (PRESERVAR.has(colecao)) continue;
    const dados = await lerJsonSeguro(arquivo, []);
    const quantidade = Array.isArray(dados) ? dados.length : (dados && typeof dados === "object" ? Object.keys(dados).length : 0);
    registros += quantidade;
    colecoes.push({ colecao, arquivo: path.relative(ROOT, arquivo), registros: quantidade });
  }
  const usuarios = await lerJsonSeguro(path.join(DATA_DIR, "usuarios.json"), []);
  return {
    colecoes,
    registros,
    usuariosRemovidos: Math.max(0, (Array.isArray(usuarios) ? usuarios.length : 0) - adminsDaLista(usuarios, usuarioAtual).length),
    fotos: await contarArquivos(UPLOADS_ALUNOS)
  };
}

async function obterResumoSupabase() {
  const supabase = obterSupabaseAdmin({ obrigatorio: false });
  if (!supabase) return { configurado: false, registros: 0, colecoes: [] };
  const { data, error } = await supabase.from(TABLE).select("collection,record_id").eq("tenant_id", tenantId()).limit(100000);
  if (error) throw new Error(`Falha ao consultar Supabase: ${error.message}`);
  const mapa = new Map();
  for (const row of data || []) if (!PRESERVAR.has(nomeColecao(row.collection))) mapa.set(row.collection, (mapa.get(row.collection) || 0) + 1);
  return { configurado: true, registros: [...mapa.values()].reduce((a,b) => a+b, 0), colecoes: [...mapa].map(([colecao, registros]) => ({ colecao, registros })) };
}

export async function visualizarReset(usuarioAtual) {
  const [local, supabase] = await Promise.all([obterResumoLocal(usuarioAtual), obterResumoSupabase()]);
  return { ok: true, fraseConfirmacao: FRASE, administrador: { id: usuarioAtual.id, nome: usuarioAtual.nome, email: usuarioAtual.email }, local, supabase };
}

export async function executarReset({ usuarioAtual, senha, confirmacao }) {
  if (String(confirmacao || "").trim() !== FRASE) throw Object.assign(new Error(`Digite exatamente: ${FRASE}`), { status: 400 });
  await autenticar(usuarioAtual.email, senha);

  const antes = await visualizarReset(usuarioAtual);
  const arquivos = await listarJsonRecursivo();
  const adminArquivo = path.join(DATA_DIR, "usuarios.json");
  const usuariosAtuais = await lerJsonSeguro(adminArquivo, []);
  const admins = adminsDaLista(usuariosAtuais, usuarioAtual);
  if (!admins.length) throw Object.assign(new Error("Administrador autenticado não foi localizado em usuarios.json."), { status: 409 });

  const operacaoId = `reset-${Date.now()}-${crypto.randomUUID()}`;
  let jsonZerados = 0;
  for (const arquivo of arquivos) {
    const colecao = nomeColecao(arquivo);
    if (colecao === "usuarios") {
      await fs.writeFile(arquivo, JSON.stringify(admins, null, 2), "utf8");
      continue;
    }
    if (PRESERVAR.has(colecao)) continue;
    await fs.writeFile(arquivo, "[]\n", "utf8");
    jsonZerados++;
  }

  const fotosLocais = await limparDiretorio(UPLOADS_ALUNOS);
  const supabase = obterSupabaseAdmin({ obrigatorio: false });
  let supabaseRegistros = 0;
  let storageFotos = 0;
  if (supabase) {
    const { data: linhas, error: leituraErro } = await supabase.from(TABLE).select("collection,record_id").eq("tenant_id", tenantId()).limit(100000);
    if (leituraErro) throw new Error(`Dados locais foram limpos, mas o Supabase falhou na consulta: ${leituraErro.message}`);
    const colecoesApagar = [...new Set((linhas || []).map(r => nomeColecao(r.collection)).filter(c => !PRESERVAR.has(c)))];
    if (colecoesApagar.length) {
      const { data, error } = await supabase.from(TABLE).delete().eq("tenant_id", tenantId()).in("collection", colecoesApagar).select("record_id");
      if (error) throw new Error(`Dados locais foram limpos, mas o Supabase falhou: ${error.message}`);
      supabaseRegistros = data?.length || 0;
    }
    const adminPayload = admins.map(item => ({ tenant_id: tenantId(), collection: "usuarios", record_id: String(item.id), payload: item, updated_at: new Date().toISOString() }));
    const { error: usuariosErro } = await supabase.from(TABLE).delete().eq("tenant_id", tenantId()).eq("collection", "usuarios");
    if (usuariosErro) throw new Error(`Falha ao preservar administrador no Supabase: ${usuariosErro.message}`);
    const { error: adminErro } = await supabase.from(TABLE).upsert(adminPayload, { onConflict: "tenant_id,collection,record_id" });
    if (adminErro) throw new Error(`Falha ao restaurar administrador no Supabase: ${adminErro.message}`);
    storageFotos = await limparStorageBucket(supabase, process.env.SUPABASE_FOTOS_BUCKET || "alunos-fotos");
  }

  return { ok: true, mensagem: "Reset concluído. O sistema foi mantido e somente os dados de uso foram apagados.", operacaoId, administradorPreservado: admins[0].email, jsonZerados, fotosLocais, supabaseRegistros, storageFotos, antes };
}
