import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { fileURLToPath } from "url";
import { spawn, spawnSync } from "child_process";

import henry7xRoutes from "./modules/henry7x/henry7x.routes.mjs";
import alunosRoutes from "./modules/alunos/alunos.routes.mjs";
import professoresRoutes from "./modules/professores/professores.routes.mjs";
import fornecedoresRoutes from "./modules/fornecedores/fornecedores.routes.mjs";
import modalidadesRoutes from "./modules/modalidades/modalidades.routes.mjs";
import planosRoutes from "./modules/planos/planos.routes.mjs";
import turmasRoutes from "./modules/turmas/turmas.routes.mjs";
import agendaRoutes from "./modules/agenda/agenda.routes.mjs";
import agendaOperacionalRoutes from "./modules/agenda-operacional/agenda-operacional.routes.mjs";
import checkinRoutes from "./modules/checkin/checkin.routes.mjs";
import financeiroRoutes from "./modules/financeiro/financeiro.routes.mjs";
import relatoriosFinanceirosRoutes from "./modules/financeiro/relatorios.routes.mjs";
import mensalidadesRoutes from "./modules/financeiro/mensalidades.routes.mjs";
import matriculaIntegracaoRoutes from "./modules/matriculas/matricula.integracao.routes.mjs";
import caixaRoutes from "./modules/financeiro/caixa.routes.mjs";
import recebimentosRoutes from "./modules/financeiro/recebimentos.routes.mjs";
import pagamentosRoutes from "./modules/financeiro/pagamentos.routes.mjs";
import avaliacoesRoutes from "./modules/avaliacoes/avaliacoes.routes.mjs";
import treinosRoutes from "./modules/treinos/treinos.routes.mjs";
import cobrancaRoutes from "./modules/cobranca/cobranca.routes.mjs";
import authRoutes from "./modules/auth/auth.routes.mjs";
import biRoutes from "./modules/bi/bi.routes.mjs";
import presencasRoutes from "./modules/presencas/presencas.routes.mjs";
import frequenciaRoutes from "./modules/frequencia/frequencia.routes.mjs";
import operacaoRoutes from "./modules/operacao/operacao.routes.mjs";
import comercialRoutes from "./modules/comercial/comercial.routes.mjs";
import natacaoRoutes from "./modules/natacao/natacao.routes.mjs";
import backupRoutes from "./modules/backup/backup.routes.mjs";
import importadorAccessRoutes from "./modules/importador-access/importador-access.routes.mjs";
import accessEngineRoutes from "./modules/access-engine/access-engine.routes.mjs";
import matriculaOnlineRoutes from "./modules/matricula-online/matricula-online.routes.mjs";
import leadsRoutes from "./modules/leads/leads.routes.mjs";
import siteChatRoutes from "./modules/site-chat/site-chat.routes.mjs";
import notificacoesRoutes from "./modules/notificacoes/notificacoes.routes.mjs";
import fidelidadeRoutes from "./modules/fidelidade/fidelidade.routes.mjs";
import accessBridgeRoutes from "./modules/access-bridge/access-bridge.routes.mjs";
import reconhecimentoFacialRoutes from "./modules/reconhecimento-facial/reconhecimento-facial.routes.mjs";
import accessOnboardingRoutes from "./modules/access-onboarding/access-onboarding.routes.mjs";
import { inicializarPersistenciaSupabase, encerrarPersistenciaSupabase } from "./modules/backup/supabase-data.service.mjs";
import { iniciarBackupAutomatico } from "./modules/backup/backup.service.mjs";
import { assertDatabaseConfiguration } from "./config/database.config.mjs";
import { verificarPersistenciaTransacional, migrarTodosJsonParaSupabase } from "./modules/core/persistence/collection-store.mjs";


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const isRender = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);
const persistentRoot = process.env.FUSION_PERSISTENT_DIR || "/var/data/fusion";


console.log("Biometria removida: controle físico exclusivo pelo Fusion Access Agent.");

function garantirDiretorio(absPath) {
  if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, { recursive: true });
}

function copiarSeedsSeDiretorioVazio(origem, destino) {
  if (!fs.existsSync(origem) || !fs.statSync(origem).isDirectory()) return;
  garantirDiretorio(destino);
  const destinoVazio = fs.readdirSync(destino).length === 0;
  if (!destinoVazio) return;
  fs.cpSync(origem, destino, { recursive: true, force: false, errorOnExist: false });
}

function prepararPersistenciaRender() {
  const pastas = ["data", "uploads"];
  for (const pasta of pastas) {
    const localPath = path.join(__dirname, pasta);
    const persistentePath = path.join(persistentRoot, pasta);

    if (!isRender) {
      garantirDiretorio(localPath);
      continue;
    }

    garantirDiretorio(path.dirname(persistentePath));
    copiarSeedsSeDiretorioVazio(localPath, persistentePath);

    try {
      if (fs.existsSync(localPath)) {
        const stat = fs.lstatSync(localPath);
        if (!stat.isSymbolicLink()) {
          const backupPath = path.join(__dirname, `.${pasta}-repo-seed`);
          if (!fs.existsSync(backupPath)) fs.renameSync(localPath, backupPath);
          else fs.rmSync(localPath, { recursive: true, force: true });
        }
      }
      if (!fs.existsSync(localPath)) fs.symlinkSync(persistentePath, localPath, "dir");
    } catch (erro) {
      console.warn(`[Render] Não foi possível vincular ${pasta} ao disco persistente: ${erro.message}`);
      garantirDiretorio(localPath);
    }
  }
}

prepararPersistenciaRender();
assertDatabaseConfiguration();
await verificarPersistenciaTransacional();
await inicializarPersistenciaSupabase();
if (["1", "true", "sim", "yes"].includes(String(process.env.FUSION_MIGRATE_JSON_ON_START || "false").toLowerCase())) {
  const migracao = await migrarTodosJsonParaSupabase();
  console.log(`[Persistência] Migração inicial concluída: ${migracao.totalColecoes} coleção(ões).`);
}

const backupRoot = isRender ? path.join(persistentRoot, "backups") : path.join(__dirname, "backups");
const backupDataRoot = path.join(backupRoot, "data");

function dataHoraArquivo() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function listarArquivosRecursivo(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const itens = [];

  function percorrer(dir) {
    for (const nome of fs.readdirSync(dir)) {
      const absoluto = path.join(dir, nome);
      const relativo = path.relative(baseDir, absoluto).replace(/\\/g, "/");
      const stat = fs.statSync(absoluto);

      if (stat.isDirectory()) {
        percorrer(absoluto);
      } else {
        itens.push({
          arquivo: relativo,
          bytes: stat.size,
          modificadoEm: stat.mtime.toISOString()
        });
      }
    }
  }

  percorrer(baseDir);
  return itens.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
}

async function criarBackupData(motivo = "manual") {
  const origem = path.join(__dirname, "data");
  await fsp.mkdir(origem, { recursive: true });
  await fsp.mkdir(backupDataRoot, { recursive: true });

  const nomeBackup = `data-${dataHoraArquivo()}-${String(motivo).replace(/[^a-z0-9_-]/gi, "_")}`;
  const destino = path.join(backupDataRoot, nomeBackup);

  await fsp.cp(origem, destino, { recursive: true, force: false, errorOnExist: true });

  const arquivos = listarArquivosRecursivo(destino);
  const manifest = {
    ok: true,
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    tipo: "backup-data-json",
    motivo,
    origem,
    destino,
    render: isRender,
    persistenciaRoot: isRender ? persistentRoot : __dirname,
    totalArquivos: arquivos.length,
    totalBytes: arquivos.reduce((total, item) => total + item.bytes, 0),
    criadoEm: new Date().toISOString(),
    arquivos
  };

  await fsp.writeFile(path.join(destino, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  return manifest;
}

async function salvarJsonSeguro(arquivo, dados) {
  await fsp.mkdir(path.dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.tmp-${Date.now()}`;
  await fsp.writeFile(temporario, JSON.stringify(dados, null, 2), "utf-8");
  await fsp.rename(temporario, arquivo);
}

const pagamentosJsonCandidates = [
  path.join(__dirname, "data", "financeiro", "pagamentos.json"),
  path.join(__dirname, "data", "pagamentos.json"),
  path.join(__dirname, "database", "financeiro", "pagamentos.json"),
  path.join(__dirname, "database", "pagamentos.json"),
  path.join(__dirname, "db", "financeiro", "pagamentos.json"),
  path.join(__dirname, "db", "pagamentos.json")
];

function normalizarNumero(valor, padrao = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

function normalizarDataISO(valor) {
  if (valor) return String(valor).slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function localizarArquivoPagamentos() {
  for (const arquivo of pagamentosJsonCandidates) {
    if (fs.existsSync(arquivo)) return arquivo;
  }

  const arquivoPadrao = pagamentosJsonCandidates[0];
  await fsp.mkdir(path.dirname(arquivoPadrao), { recursive: true });
  await fsp.writeFile(arquivoPadrao, JSON.stringify([], null, 2), "utf-8");
  return arquivoPadrao;
}

async function lerPagamentosStore() {
  const arquivo = await localizarArquivoPagamentos();
  let bruto = "[]";

  try {
    bruto = await fsp.readFile(arquivo, "utf-8");
  } catch {
    bruto = "[]";
  }

  let dados;
  try {
    dados = bruto.trim() ? JSON.parse(bruto) : [];
  } catch {
    dados = [];
  }

  if (Array.isArray(dados)) {
    return { arquivo, dados, pagamentos: dados };
  }

  if (Array.isArray(dados.pagamentos)) {
    return { arquivo, dados, pagamentos: dados.pagamentos };
  }

  if (Array.isArray(dados.lancamentos)) {
    return { arquivo, dados, pagamentos: dados.lancamentos };
  }

  dados.pagamentos = [];
  return { arquivo, dados, pagamentos: dados.pagamentos };
}

async function salvarPagamentosStore(store) {
  await criarBackupData("antes-salvar-pagamentos");
  await salvarJsonSeguro(store.arquivo, store.dados);
}

function encontrarPagamentoPorId(pagamentos, id) {
  return pagamentos.find((item) => String(item.id) === String(id));
}

function valorBasePagamento(pagamento) {
  return normalizarNumero(
    pagamento.valorLiquido ??
    pagamento.valorTotal ??
    pagamento.total ??
    pagamento.valor ??
    pagamento.valorBruto,
    0
  );
}

function totalPagoPagamento(pagamento) {
  return normalizarNumero(
    pagamento.valorPagoTotal ??
    pagamento.totalPago ??
    pagamento.valorPago ??
    pagamento.pago,
    0
  );
}

function garantirHistoricoPagamento(pagamento) {
  if (!Array.isArray(pagamento.historico)) pagamento.historico = [];
  return pagamento.historico;
}

function calcularStatusPagamento(valorBase, totalPago) {
  if (totalPago <= 0) return "aberto";
  if (totalPago >= valorBase) return "pago";
  return "parcial";
}


app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));


app.get("/api/health", (req, res) => {
  const dataPath = path.join(__dirname, "data");
  const uploadsPath = path.join(__dirname, "uploads");
  res.json({
    ok: true,
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    status: "online",
    ambiente: process.env.NODE_ENV || "development",
    render: isRender,
    persistencia: {
      root: isRender ? persistentRoot : __dirname,
      data: fs.existsSync(dataPath),
      uploads: fs.existsSync(uploadsPath)
    },
    timestamp: new Date().toISOString()
  });
});

const legacyPageRedirects = new Map([
  ["/pages/login/login.html", "/pages/login/index.html"],
  ["/pages/login.html", "/pages/login/index.html"],
  ["/pages/agenda/cadastro.html", "/pages/agenda/index.html"],
  ["/pages/agenda/ficha.html", "/pages/agenda/index.html"],
  ["/pages/turmas/cadastro.html", "/pages/turmas/index.html"],
  ["/pages/turmas/ficha.html", "/pages/turmas/index.html"],
  ["/pages/presencas/", "/pages/checkin/index.html"],
  ["/pages/presencas/cadastro.html", "/pages/checkin/index.html"],
  ["/pages/presencas/ficha.html", "/pages/checkin/index.html"],
  ["/pages/financeiro/cadastro.html", "/pages/financeiro/index.html"],
  ["/pages/financeiro/ficha.html", "/pages/financeiro/index.html"],
  ["/pages/pagamentos/", "/pages/financeiro/pagamentos/index.html"],
  ["/pages/bi/", "/pages/bi-financeiro/index.html"],
  ["/pages/bi-dashboard/", "/pages/bi-financeiro/index.html"],
  ["/pages/bi-comercial/", "/pages/bi-academia/index.html"],
  ["/pages/bi-operacional/", "/pages/bi-academia-operacional/index.html"],
  ["/pages/relatorios/", "/pages/relatorios-caixa/index.html"],
  ["/pages/exercicios/", "/pages/treinos/index.html"],
  ["/pages/aluno-treino/", "/pages/aluno-treinos/index.html"],
  ["/pages/portal-aluno/", "/pages/aluno-login/index.html"],
  ["/pages/treinos-v3-aluno/", "/pages/aluno-treinos/index.html"],
  ["/pages/professor-painel/", "/pages/professor-area/index.html"]
]);

function normalizarPaginaLegada(pathname = "") {
  return String(pathname)
    .replace(/\/index\.html$/i, "/")
    .replace(/\/+$/g, "/");
}

app.use((req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  const destino = legacyPageRedirects.get(req.path) || legacyPageRedirects.get(normalizarPaginaLegada(req.path));
  if (destino) return res.redirect(302, destino);
  return next();
});

// A página comercial institucional pertence à empresa Fusion ERP, não à
// academia cliente. Esta proteção vem antes dos arquivos estáticos para também
// bloquear uma cópia residual deixada por alguma atualização anterior.
app.use((req, res, next) => {
  const rota = String(req.path || "").replace(/\/+$/, "");
  if (
    ["GET", "HEAD"].includes(req.method) &&
    ["/pages/comercial", "/pages/comercial/index.html"].includes(rota)
  ) {
    return res.redirect(302, "/pages/promocao/index.html");
  }
  return next();
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.redirect(302, "/pages/promocao/index.html");
});

app.get("/api", (req, res) => {
  res.json({
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    status: "Online"
  });
});

app.post("/api/sistema/backup-data", async (req, res) => {
  try {
    const tokenConfigurado = process.env.FUSION_BACKUP_TOKEN || "";
    const tokenRecebido = req.headers["x-fusion-backup-token"] || req.body?.token || req.query?.token || "";

    if (tokenConfigurado && String(tokenRecebido) !== String(tokenConfigurado)) {
      return res.status(401).json({
        ok: false,
        mensagem: "Token de backup inválido."
      });
    }

    const motivo = req.body?.motivo || req.query?.motivo || "manual";
    const backup = await criarBackupData(motivo);

    return res.json({
      ok: true,
      mensagem: "Backup da pasta data criado com sucesso.",
      backup
    });
  } catch (erro) {
    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao criar backup da pasta data.",
      erro: erro.message
    });
  }
});

app.get("/api/sistema/backups-data", async (req, res) => {
  try {
    await fsp.mkdir(backupDataRoot, { recursive: true });
    const backups = fs.readdirSync(backupDataRoot)
      .map((nome) => {
        const absoluto = path.join(backupDataRoot, nome);
        const stat = fs.statSync(absoluto);
        return { nome, caminho: absoluto, criadoEm: stat.birthtime.toISOString(), modificadoEm: stat.mtime.toISOString() };
      })
      .filter((item) => fs.statSync(item.caminho).isDirectory())
      .sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm));

    res.json({
      ok: true,
      versao: "2.8.0-piloto",
      total: backups.length,
      backups
    });
  } catch (erro) {
    res.status(500).json({
      ok: false,
      mensagem: "Erro ao listar backups da pasta data.",
      erro: erro.message
    });
  }
});


// Login administrado por modules/auth/auth.routes.mjs


// Rotas diretas da Parte 4.2 - Pagamentos ZIP 13
app.post("/api/financeiro/pagamentos/:id/baixar", async (req, res) => {
  try {
    const { id } = req.params;
    const store = await lerPagamentosStore();
    const pagamento = encontrarPagamentoPorId(store.pagamentos, id);

    if (!pagamento) {
      return res.status(404).json({
        ok: false,
        mensagem: "Pagamento não encontrado"
      });
    }

    if (pagamento.status === "cancelado") {
      return res.status(400).json({
        ok: false,
        mensagem: "Pagamento cancelado não pode receber baixa"
      });
    }

    const statusAnterior = pagamento.status ?? "aberto";
    const valorOriginal = valorBasePagamento(pagamento);
    const valorJaPago = totalPagoPagamento(pagamento);
    const juros = normalizarNumero(req.body?.juros, 0);
    const multa = normalizarNumero(req.body?.multa, 0);
    const desconto = normalizarNumero(req.body?.desconto, 0);
    const acrescimos = juros + multa - desconto;
    const valorInformado = normalizarNumero(req.body?.valorPago ?? req.body?.valor ?? req.body?.valorBaixa, 0);
    const valorFinal = Math.max(valorOriginal + acrescimos, 0);
    const valorBaixa = valorInformado > 0 ? valorInformado : Math.max(valorFinal - valorJaPago, 0);
    const dataPagamento = normalizarDataISO(req.body?.dataPagamento ?? req.body?.dataBaixa);
    const formaPagamento = req.body?.formaPagamento ?? req.body?.forma ?? pagamento.formaPagamento ?? "";
    const observacao = req.body?.observacao ?? req.body?.descricao ?? "";

    const novoTotalPago = valorJaPago + valorBaixa;
    const novoStatus = calcularStatusPagamento(valorFinal, novoTotalPago);

    pagamento.valorPago = novoTotalPago;
    pagamento.valorPagoTotal = novoTotalPago;
    pagamento.valorLiquido = valorFinal;
    pagamento.status = novoStatus;
    pagamento.dataPagamento = dataPagamento;
    pagamento.formaPagamento = formaPagamento;
    pagamento.atualizadoEm = new Date().toISOString();

    const historico = garantirHistoricoPagamento(pagamento);
    historico.push({
      id: `hist_pag_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      tipo: "baixa",
      data: dataPagamento,
      valor: valorBaixa,
      juros,
      multa,
      desconto,
      formaPagamento,
      observacao,
      statusAnterior,
      statusAtual: novoStatus,
      criadoEm: new Date().toISOString()
    });

    await salvarPagamentosStore(store);

    return res.json({
      ok: true,
      pagamento,
      mensagem: novoStatus === "pago" ? "Pagamento baixado com sucesso" : "Baixa parcial registrada com sucesso"
    });
  } catch (erro) {
    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao baixar pagamento",
      erro: erro.message
    });
  }
});

app.post("/api/financeiro/pagamentos/:id/estornar", async (req, res) => {
  try {
    const { id } = req.params;
    const store = await lerPagamentosStore();
    const pagamento = encontrarPagamentoPorId(store.pagamentos, id);

    if (!pagamento) {
      return res.status(404).json({
        ok: false,
        mensagem: "Pagamento não encontrado"
      });
    }

    const statusAnterior = pagamento.status ?? "aberto";
    const valorJaPago = totalPagoPagamento(pagamento);
    const valorEstornoInformado = normalizarNumero(req.body?.valor ?? req.body?.valorEstorno, valorJaPago);
    const valorEstorno = Math.min(Math.max(valorEstornoInformado, 0), valorJaPago);
    const novoTotalPago = Math.max(valorJaPago - valorEstorno, 0);
    const valorBase = valorBasePagamento(pagamento);
    const novoStatus = calcularStatusPagamento(valorBase, novoTotalPago);
    const dataEstorno = normalizarDataISO(req.body?.dataEstorno ?? req.body?.data);
    const motivo = req.body?.motivo ?? req.body?.observacao ?? "";

    pagamento.valorPago = novoTotalPago;
    pagamento.valorPagoTotal = novoTotalPago;
    pagamento.status = novoStatus;
    pagamento.estornado = true;
    pagamento.dataEstorno = dataEstorno;
    pagamento.atualizadoEm = new Date().toISOString();

    const historico = garantirHistoricoPagamento(pagamento);
    historico.push({
      id: `hist_pag_est_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      tipo: "estorno",
      data: dataEstorno,
      valor: valorEstorno,
      motivo,
      statusAnterior,
      statusAtual: novoStatus,
      criadoEm: new Date().toISOString()
    });

    await salvarPagamentosStore(store);

    return res.json({
      ok: true,
      pagamento,
      mensagem: "Estorno registrado com sucesso"
    });
  } catch (erro) {
    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao estornar pagamento",
      erro: erro.message
    });
  }
});

app.get("/api/financeiro/pagamentos/:id/historico", async (req, res) => {
  try {
    const { id } = req.params;
    const store = await lerPagamentosStore();
    const pagamento = encontrarPagamentoPorId(store.pagamentos, id);

    if (!pagamento) {
      return res.status(404).json({
        ok: false,
        mensagem: "Pagamento não encontrado"
      });
    }

    return res.json({
      ok: true,
      pagamentoId: id,
      historico: Array.isArray(pagamento.historico) ? pagamento.historico : []
    });
  } catch (erro) {
    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao carregar histórico do pagamento",
      erro: erro.message
    });
  }
});

app.use("/api/alunos", alunosRoutes);
app.use("/api/professores", professoresRoutes);
app.use("/api/fornecedores", fornecedoresRoutes);
app.use("/api/modalidades", modalidadesRoutes);
app.use("/api/planos", planosRoutes);
app.use("/api/turmas", turmasRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/agenda-operacional", agendaOperacionalRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/financeiro/relatorios", relatoriosFinanceirosRoutes);
app.use("/api/financeiro", financeiroRoutes);
app.use("/api/mensalidades", mensalidadesRoutes);
app.use(matriculaIntegracaoRoutes);
app.use("/api/caixa", caixaRoutes);
app.use("/api/financeiro/pagamentos", pagamentosRoutes);
app.use("/api/pagamentos", pagamentosRoutes);
app.use("/api/recebimentos", recebimentosRoutes);
app.use("/api/avaliacoes", avaliacoesRoutes);
app.use("/api/treinos", treinosRoutes);
app.use("/api/cobranca", cobrancaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bi", biRoutes);
app.use("/api/presencas", presencasRoutes);
app.use("/api/frequencia", frequenciaRoutes);
app.use("/api/operacao", operacaoRoutes);
app.use(comercialRoutes);
app.use("/api/comercial", comercialRoutes);
app.use("/api/matricula-online", matriculaOnlineRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/site-chat", siteChatRoutes);
app.use("/api/notificacoes", notificacoesRoutes);
app.use("/api/fidelidade", fidelidadeRoutes);
app.use("/api/natacao", natacaoRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/importador-access", importadorAccessRoutes);
app.use("/api/access-engine", accessEngineRoutes);
app.use("/api/henry7x", henry7xRoutes);
app.use("/api/access-bridge", accessBridgeRoutes);
app.use("/api/reconhecimento-facial", reconhecimentoFacialRoutes);
app.use("/api/access-onboarding", accessOnboardingRoutes);

// Aliases legados de páginas: evitam 404 em favoritos/menus antigos.
app.get(['/pages/bi-comercial', '/pages/bi-comercial/', '/pages/bi-comercial/index.html'], (req, res) => {
  res.redirect(301, '/pages/bi-academia/index.html');
});
app.get(['/pages/bi-operacional', '/pages/bi-operacional/', '/pages/bi-operacional/index.html'], (req, res) => {
  res.redirect(301, '/pages/bi-academia-operacional/index.html');
});
app.get(['/pages/relatorios', '/pages/relatorios/', '/pages/relatorios/index.html'], (req, res) => {
  res.redirect(301, '/pages/relatorios-caixa/index.html');
});



app.get("/api/sistema/diagnostico", async (req, res) => {
  const arquivosObrigatorios = [
    "data/alunos.json",
    "data/professores.json",
    "data/matriculas.json",
    "data/financeiro.json",
    "data/mensalidades.json",
    "data/frequencia.json",
    "data/checkins.json",
    "data/treinos.json",
    "data/treinos_integrados.json",
    "data/treinos_execucoes.json"
  ];

  const arquivos = arquivosObrigatorios.map((relativo) => {
    const absoluto = path.join(__dirname, relativo);
    const existe = fs.existsSync(absoluto);
    let valido = false;
    let registros = 0;

    if (existe) {
      try {
        const bruto = fs.readFileSync(absoluto, "utf8");
        const json = bruto.trim() ? JSON.parse(bruto) : [];
        valido = true;
        registros = Array.isArray(json) ? json.length : Object.keys(json || {}).length;
      } catch {
        valido = false;
      }
    }

    return { arquivo: relativo, existe, jsonValido: valido, registros };
  });

  const inconsistencias = arquivos.filter((item) => !item.existe || !item.jsonValido);

  res.json({
    ok: inconsistencias.length === 0,
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    modulo: "auditoria-geral",
    mensagem: inconsistencias.length ? "Diagnóstico concluído com inconsistências." : "Diagnóstico concluído sem inconsistências críticas.",
    dados: {
      arquivos,
      inconsistencias,
      rotasCriticas: [
        "/api/checkin/resumo",
        "/api/treinos",
        "/api/sistema/diagnostico"
      ]
    }
  });
});


app.get("/api/sistema/performance", async (req, res) => {
  const inicio = Date.now();
  const arquivosCriticos = [
    "data/alunos.json",
    "data/professores.json",
    "data/matriculas.json",
    "data/financeiro.json",
    "data/mensalidades.json",
    "data/frequencia.json",
    "data/checkins.json",
    "data/treinos.json",
    "data/treinos_integrados.json",
    "data/treinos_execucoes.json"
  ];

  const arquivos = arquivosCriticos.map((relativo) => {
    const absoluto = path.join(__dirname, relativo);
    const existe = fs.existsSync(absoluto);
    let bytes = 0;
    let registros = 0;
    let jsonValido = true;

    if (existe) {
      try {
        const bruto = fs.readFileSync(absoluto, "utf8");
        bytes = Buffer.byteLength(bruto);
        const json = bruto.trim() ? JSON.parse(bruto) : [];
        registros = Array.isArray(json) ? json.length : Object.keys(json || {}).length;
      } catch {
        jsonValido = false;
      }
    }

    return { arquivo: relativo, existe, jsonValido, bytes, registros };
  });

  const memoria = process.memoryUsage();
  const totalBytes = arquivos.reduce((total, item) => total + item.bytes, 0);

  res.json({
    ok: arquivos.every((item) => !item.existe || item.jsonValido),
    sistema: "Fusion ERP",
    versao: "2.8.0-piloto",
    modulo: "performance",
    mensagem: "Diagnóstico de performance concluído.",
    dados: {
      tempoRespostaMs: Date.now() - inicio,
      uptimeSegundos: Math.round(process.uptime()),
      memoria: {
        rssMB: Number((memoria.rss / 1024 / 1024).toFixed(2)),
        heapUsadoMB: Number((memoria.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMB: Number((memoria.heapTotal / 1024 / 1024).toFixed(2))
      },
      arquivos,
      totalBytes,
      totalMB: Number((totalBytes / 1024 / 1024).toFixed(3)),
      rotasCriticas: [
        "/api/checkin/resumo",
        "/api/sistema/diagnostico",
        "/api/sistema/performance"
      ]
    }
  });
});


app.get("/api/sistema/seguranca", async (req, res) => {
  const rotasPublicasPermitidas = [
    "GET /",
    "GET /api",
    "POST /api/auth/login",
    "GET /api/sistema/diagnostico",
    "GET /api/sistema/performance",
    "GET /api/sistema/seguranca"
  ];

  const avisos = [];
  avisos.push("Ambiente recomendado para piloto: rede local ou VPN.");
  avisos.push("Antes de produção externa, restringir CORS por origem e trocar login fixo por autenticação persistida.");
  avisos.push("Fazer backup da pasta data antes de atualizar versões.");

  res.json({
    ok: true,
    versao: "2.8.0-piloto",
    modulo: "seguranca",
    status: "Homologação de segurança ativa",
    limites: {
      json: "50mb",
      urlencoded: "50mb"
    },
    rotasPublicasPermitidas,
    avisos,
    recomendacao: "Aprovado para piloto local após execução de npm run homologacao."
  });
});


app.get("/api/sistema/interface", async (req, res) => {
  const paginasCriticas = [
    "login/index.html",
    "dashboard/index.html",
    "checkin/index.html",
    "treinos/index.html",
    "alunos/index.html",
    "matriculas/index.html",
    "financeiro/index.html"
  ];

  const paginas = paginasCriticas.map((relativo) => {
    const absoluto = path.join(__dirname, "public", "pages", relativo);
    const existe = fs.existsSync(absoluto);
    let bytes = 0;
    let temViewport = false;
    let temTitulo = false;
    let temScript = false;
    let temCss = false;

    if (existe) {
      try {
        const html = fs.readFileSync(absoluto, "utf8");
        bytes = Buffer.byteLength(html);
        temViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
        temTitulo = /<title>[^<]+<\/title>/i.test(html);
        temScript = html.includes("<script");
        temCss = html.includes("stylesheet") || html.includes("fusion-app.css");
      } catch {}
    }

    return { pagina: relativo, existe, bytes, temViewport, temTitulo, temScript, temCss };
  });

  const falhas = paginas.filter((p) => !p.existe);
  const avisos = paginas.filter((p) => p.existe && (!p.temViewport || !p.temTitulo || !p.temScript || !p.temCss));

  res.json({
    ok: falhas.length === 0,
    versao: "2.8.0-piloto",
    modulo: "interface",
    mensagem: falhas.length ? "Auditoria de interface concluída com falhas." : "Auditoria de interface concluída.",
    dados: {
      paginasVerificadas: paginas.length,
      falhas: falhas.length,
      avisos: avisos.length,
      paginas,
      recomendacao: "Validar manualmente em desktop e celular antes do piloto."
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";


app.listen(PORT, HOST, async () => {
  console.log("====================================");
  console.log("        Fusion ERP");
  console.log("====================================");
  console.log(`Servidor iniciado na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || "development"}`);

  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`URL: ${process.env.RENDER_EXTERNAL_URL}`);
  }

  console.log("Controle de catraca online: Fusion Access Bridge ativo.");
  const backupAutomatico = iniciarBackupAutomatico();
  console.log(`Backup automático: ${backupAutomatico.ativo ? "ativo" : "inativo"}.`);
});

async function encerrarServidor(sinal) {
  console.log(`[Sistema] ${sinal}: sincronizando dados antes de encerrar.`);
  try { await encerrarPersistenciaSupabase(); }
  catch (erro) { console.error(`[Persistência] Falha no encerramento: ${erro.message}`); }
  process.exit(0);
}

process.once("SIGTERM", () => encerrarServidor("SIGTERM"));
process.once("SIGINT", () => encerrarServidor("SIGINT"));
