import "dotenv/config";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { analisarAlunosTxt, importarAlunosLocal } from "../modules/importador-access/alunos/importador-alunos.service.mjs";
import { importarFotosAccessLocal } from "../modules/importador-access/fotos/importador-fotos.service.mjs";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const IMPORTACAO = path.join(DATA, "importacao");
const CONFIRMACAO = "PREPARAR-PILOTO-ACCESS";
const CONFIRMACAO_SUPABASE = "SUBIR-PILOTO-ACCESS";

const COLECOES_LIMPAS = [
  "alunos", "matriculas", "mensalidades", "financeiro", "recebimentos", "pagamentos",
  "creditos", "cobranca_log", "avaliacoes", "treinos", "treinos_integrados",
  "treinos_prescritos", "treinos_ciclos", "treinos_execucoes", "checkin", "checkins",
  "frequencia", "presencas", "biometrias", "access_logs", "access_eventos",
  "access_pessoas_presentes", "agenda", "agenda_operacional", "site_chat", "crm",
  "leads", "matriculas_online", "alunos_historico_planos", "contratos",
  "servicos_contratados"
];

function arg(nome, padrao = "") {
  const prefixo = `--${nome}=`;
  const item = process.argv.find((valor) => valor.startsWith(prefixo));
  return item ? item.slice(prefixo.length) : padrao;
}

function temFlag(nome) {
  return process.argv.includes(`--${nome}`);
}

function dataHoraArquivo() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function lerJson(arquivo, padrao) {
  try {
    const bruto = await fs.readFile(arquivo, "utf8");
    return bruto.trim() ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(nome, dados) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, `${nome}.json`), JSON.stringify(dados, null, 2), "utf8");
}

async function limparPastaConteudo(pasta) {
  if (!fsSync.existsSync(pasta)) return;
  const itens = await fs.readdir(pasta);
  for (const item of itens) await fs.rm(path.join(pasta, item), { recursive: true, force: true });
}

async function criarBackupLocal() {
  const backupRoot = path.join(ROOT, "backups", "piloto-access");
  const destino = path.join(backupRoot, `antes-piloto-access-${dataHoraArquivo()}`);
  await fs.mkdir(destino, { recursive: true });
  if (fsSync.existsSync(DATA)) await fs.cp(DATA, path.join(destino, "data"), { recursive: true });
  if (fsSync.existsSync(UPLOADS)) await fs.cp(UPLOADS, path.join(destino, "uploads"), { recursive: true });
  return destino;
}

async function prepararBaseLimpa() {
  await fs.mkdir(DATA, { recursive: true });
  await fs.mkdir(IMPORTACAO, { recursive: true });
  for (const colecao of COLECOES_LIMPAS) await salvarJson(colecao, []);
  await salvarJson("caixa", { caixas: [], movimentos: [] });
  await limparPastaConteudo(path.join(UPLOADS, "alunos"));
  await limparPastaConteudo(IMPORTACAO);
}

async function lerTextoWindows1252(arquivo) {
  const buffer = await fs.readFile(arquivo);
  return new TextDecoder("windows-1252").decode(buffer);
}

async function zerarFinanceiroPiloto(relatorioAlunos) {
  const matriculasPath = path.join(DATA, "matriculas.json");
  const alunosPath = path.join(DATA, "alunos.json");
  const matriculas = await lerJson(matriculasPath, []);
  const alunos = await lerJson(alunosPath, []);
  const agora = new Date().toISOString();

  for (const matricula of matriculas) {
    if (!matricula?.importadoAccess) continue;
    delete matricula.financeiroInicialId;
    delete matricula.recebimentoPromocionalId;
    delete matricula.mensalidadeProximaId;
    delete matricula.financeiroProximoId;
    matricula.valorMatricula = 0;
    matricula.valorTotalInicial = 0;
    matricula.statusFinanceiroInicial = "Sem lancamento no piloto";
    matricula.formaPagamento = "";
    matricula.observacao = "Importacao Access para piloto: aluno ativo, sem lancamento financeiro inicial.";
    matricula.atualizadoEm = agora;
    matricula.atualizado_em = agora;
  }

  for (const aluno of alunos) {
    if (!aluno?.importado_access) continue;
    aluno.inadimplente = false;
    aluno.emAtraso = false;
    aluno.bloqueado = false;
    aluno.motivoBloqueio = "";
    aluno.atualizadoEm = agora;
    aluno.atualizado_em = agora;
  }

  await fs.writeFile(matriculasPath, JSON.stringify(matriculas, null, 2), "utf8");
  await fs.writeFile(alunosPath, JSON.stringify(alunos, null, 2), "utf8");
  await salvarJson("mensalidades", []);
  await salvarJson("financeiro", []);
  await salvarJson("recebimentos", []);
  await salvarJson("pagamentos", []);
  await salvarJson("creditos", []);
  await salvarJson("cobranca_log", []);
  await salvarJson("caixa", { caixas: [], movimentos: [] });

  return {
    lancamentosFinanceirosRemovidos: relatorioAlunos.financeiro_lancamentos || 0,
    recebimentosRemovidos: relatorioAlunos.recebimentos_promocionais || 0,
    mensalidadesRemovidas: relatorioAlunos.mensalidades_agosto_2026 || 0
  };
}

async function copiarTemporario(origem, destino) {
  if (!origem || !fsSync.existsSync(origem)) return false;
  await fs.copyFile(origem, destino);
  return true;
}

async function importarFotosSeExistirem(fotosTxt, fotosZip) {
  if (!fotosTxt || !fotosZip || !fsSync.existsSync(fotosTxt) || !fsSync.existsSync(fotosZip)) {
    return { ok: true, pulado: true, motivo: "Fotos.txt ou Fotos.zip nao informado/encontrado." };
  }

  const destinoTxt = path.join(ROOT, "Fotos.txt");
  const destinoZip = path.join(ROOT, "Fotos.zip");
  let copiouTxt = false;
  let copiouZip = false;
  try {
    copiouTxt = await copiarTemporario(fotosTxt, destinoTxt);
    copiouZip = await copiarTemporario(fotosZip, destinoZip);
    if (!copiouTxt || !copiouZip) return { ok: true, pulado: true, motivo: "Nao foi possivel preparar Fotos.txt/Fotos.zip." };
    return await importarFotosAccessLocal();
  } finally {
    if (copiouTxt) await fs.rm(destinoTxt, { force: true });
    if (copiouZip) await fs.rm(destinoZip, { force: true });
  }
}

function tenantId() {
  return String(process.env.FUSION_TENANT_ID || process.env.FUSION_ACADEMIA_ID || "academia-piloto")
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "academia-piloto";
}

async function limparStorageTenant() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados para sincronizar.");
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  const bucket = process.env.SUPABASE_DATA_BUCKET || "fusion-data";
  const prefixo = `tenants/${tenantId()}`;
  const arquivos = [];

  async function percorrer(pasta) {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from(bucket).list(pasta, { limit: 100, offset });
      if (error) {
        if (/not found|does not exist/i.test(error.message || "")) return;
        throw new Error(`Falha ao listar Storage durante sincronizacao: ${error.message}`);
      }
      for (const item of data || []) {
        const caminho = `${pasta}/${item.name}`;
        if (item.id || item.metadata) arquivos.push(caminho);
        else await percorrer(caminho);
      }
      if (!data || data.length < 100) break;
    }
  }

  await percorrer(prefixo);
  for (let i = 0; i < arquivos.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(arquivos.slice(i, i + 100));
    if (error) throw new Error(`Falha ao limpar arquivos antigos do tenant: ${error.message}`);
  }

  return { bucket, prefixo, removidos: arquivos.length };
}

async function sincronizarSupabase() {
  if (arg("confirmar-supabase") !== CONFIRMACAO_SUPABASE) {
    throw new Error(`Confirmacao Supabase ausente. Execute com --confirmar-supabase=${CONFIRMACAO_SUPABASE}.`);
  }

  const { verificarPersistenciaTransacional, migrarTodosJsonParaSupabase } = await import("../modules/core/persistence/collection-store.mjs");
  const { enviarBackupSupabase } = await import("../modules/backup/backup.service.mjs");
  const { restaurarArquivosNoSupabase } = await import("../modules/backup/supabase-data.service.mjs");

  await verificarPersistenciaTransacional();
  const backupSupabase = await enviarBackupSupabase({ sufixo: "antes-piloto-access" });
  const migracao = await migrarTodosJsonParaSupabase({ operacaoId: `piloto-access-${crypto.randomUUID()}` });
  const storageLimpo = await limparStorageTenant();
  const storage = await restaurarArquivosNoSupabase();

  return { backupSupabase, migracao, storageLimpo, storage };
}

async function contarJson() {
  const alunos = await lerJson(path.join(DATA, "alunos.json"), []);
  const matriculas = await lerJson(path.join(DATA, "matriculas.json"), []);
  const financeiro = await lerJson(path.join(DATA, "financeiro.json"), []);
  const recebimentos = await lerJson(path.join(DATA, "recebimentos.json"), []);
  const pagamentos = await lerJson(path.join(DATA, "pagamentos.json"), []);
  const mensalidades = await lerJson(path.join(DATA, "mensalidades.json"), []);
  const caixa = await lerJson(path.join(DATA, "caixa.json"), { caixas: [], movimentos: [] });
  return {
    alunos: alunos.length,
    alunosAtivos: alunos.filter((aluno) => aluno.status === "ativo" || aluno.ativo === true).length,
    alunosInativos: alunos.filter((aluno) => aluno.status === "inativo" || aluno.ativo === false).length,
    alunosComFoto: alunos.filter((aluno) => aluno.foto || aluno.foto_url || aluno.fotoUrl).length,
    matriculas: matriculas.length,
    financeiro: financeiro.length,
    recebimentos: recebimentos.length,
    pagamentos: pagamentos.length,
    mensalidades: mensalidades.length,
    caixas: Array.isArray(caixa.caixas) ? caixa.caixas.length : 0,
    movimentosCaixa: Array.isArray(caixa.movimentos) ? caixa.movimentos.length : 0
  };
}

async function main() {
  const dryRun = temFlag("dry-run");
  const somenteSupabase = temFlag("somente-supabase");
  const deveSincronizarSupabase = temFlag("sincronizar-supabase");
  const modoFinanceiro = arg("financeiro", "zerado").toLowerCase();
  const alunosTxt = arg("alunos", "C:\\Users\\academia01\\Desktop\\links\\Alunos.txt");
  const fotosTxt = arg("fotos", "C:\\Users\\academia01\\Desktop\\links\\Fotos.txt");
  const fotosZip = arg("zip", "C:\\PROSISTEMAS\\SCA\\Fotos.zip");

  const conteudo = somenteSupabase ? "" : await lerTextoWindows1252(alunosTxt);
  const simulacao = somenteSupabase ? null : analisarAlunosTxt(conteudo, path.basename(alunosTxt));

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      modo: "simulacao",
      alunosTxt,
      fotosTxt,
      fotosZip,
      financeiro: modoFinanceiro,
      totalRegistros: simulacao?.total_registros || 0,
      importaveis: simulacao?.importaveis || 0,
      ativos: simulacao?.ativos || 0,
      inativos: simulacao?.inativos || 0,
      excluidos: simulacao?.excluidos || 0,
      matriculasPrevistas: simulacao?.ativos || 0,
      financeiroPrevistoAntesDoAjuste: (simulacao?.ativos || 0) * 2,
      recebimentosPrevistosAntesDoAjuste: simulacao?.ativos || 0,
      mensalidadesPrevistasAntesDoAjuste: simulacao?.ativos || 0
    }, null, 2));
    return;
  }

  if (!somenteSupabase && arg("confirmar") !== CONFIRMACAO) {
    throw new Error(`Confirmacao ausente. Execute com --confirmar=${CONFIRMACAO}.`);
  }

  const backup = somenteSupabase ? "" : await criarBackupLocal();
  let relatorioAlunos = null;
  let ajusteFinanceiro = null;
  let relatorioFotos = null;

  if (!somenteSupabase) {
    await prepararBaseLimpa();
    relatorioAlunos = await importarAlunosLocal({ conteudo, nomeArquivo: path.basename(alunosTxt), dryRun: false });
    ajusteFinanceiro = modoFinanceiro === "normal" ? { mantido: true } : await zerarFinanceiroPiloto(relatorioAlunos);
    relatorioFotos = await importarFotosSeExistirem(fotosTxt, fotosZip);
  }

  const contagens = await contarJson();
  const supabase = deveSincronizarSupabase ? await sincronizarSupabase() : null;

  const relatorio = {
    ok: true,
    operacao: "preparar_piloto_access",
    id: crypto.randomUUID(),
    backup,
    alunosTxt,
    fotosTxt,
    fotosZip,
    financeiro: modoFinanceiro,
    alunos: {
      importaveis: relatorioAlunos?.importaveis || contagens.alunos,
      ativos: relatorioAlunos?.ativos_importaveis || contagens.alunosAtivos,
      inativos: relatorioAlunos?.inativos_importaveis || contagens.alunosInativos,
      excluidos: relatorioAlunos?.excluidos || 0,
      duplicadosArquivo: relatorioAlunos?.duplicados_arquivo || 0
    },
    ajusteFinanceiro,
    fotos: {
      vinculadas: relatorioFotos?.vinculadas || contagens.alunosComFoto,
      semAluno: relatorioFotos?.sem_aluno || 0,
      semArquivo: relatorioFotos?.sem_arquivo || 0,
      imagensNoZip: relatorioFotos?.imagens_no_zip || 0,
      pulado: Boolean(relatorioFotos?.pulado),
      motivo: relatorioFotos?.motivo || ""
    },
    contagens,
    supabase,
    geradoEm: new Date().toISOString()
  };

  await fs.mkdir(IMPORTACAO, { recursive: true });
  await fs.writeFile(path.join(IMPORTACAO, "relatorio_piloto_access.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log(JSON.stringify(relatorio, null, 2));
}

main().catch((erro) => {
  console.error(JSON.stringify({ ok: false, mensagem: erro.message }, null, 2));
  process.exit(1);
});
