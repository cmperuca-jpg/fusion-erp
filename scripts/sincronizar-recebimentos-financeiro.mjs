import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const LOG_DIR = path.join(ROOT, "logs");
const FINANCEIRO_FILE = path.join(DATA_DIR, "financeiro.json");
const RECEBIMENTOS_FILE = path.join(DATA_DIR, "recebimentos.json");

function normalizar(v) {
  return String(v || "").trim().toLowerCase();
}

function numero(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

async function lerJson(file, fallback = []) {
  try {
    if (!fssync.existsSync(file)) return fallback;
    const txt = await fs.readFile(file, "utf8");
    return txt.trim() ? JSON.parse(txt) : fallback;
  } catch {
    return fallback;
  }
}

async function salvarJson(file, dados) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(dados, null, 2), "utf8");
}

function statusRecebimento(status) {
  const s = normalizar(status);
  if (["pago", "recebido", "quitado", "baixado"].includes(s)) return "recebido";
  if (["parcial", "baixado parcial", "parcialmente pago"].includes(s)) return "parcial";
  if (["cancelado", "cancelada"].includes(s)) return "cancelado";
  if (["estornado", "estornada"].includes(s)) return "estornado";
  return "aberto";
}

function converter(lancamento) {
  const valorBruto = numero(lancamento.valor ?? lancamento.valorBruto ?? lancamento.total);
  const valorRecebido = numero(lancamento.valorRecebido ?? lancamento.valorPago ?? lancamento.valorLiquido);
  const status = statusRecebimento(lancamento.status);

  return {
    id: lancamento.recebimentoId || `rec_${lancamento.id}`,
    descricao: lancamento.descricao || "Recebimento",
    referencia: lancamento.referencia || lancamento.documento || "",
    categoria: lancamento.categoria || "Recebimentos",
    centroCusto: lancamento.centroCusto || "Caixa",
    pessoa: lancamento.pessoa || lancamento.aluno || lancamento.alunoFornecedor || "",
    cliente: lancamento.pessoa || lancamento.aluno || lancamento.alunoFornecedor || "",
    aluno: lancamento.aluno || lancamento.pessoa || "",
    alunoId: lancamento.alunoId || "",
    mensalidadeId: lancamento.mensalidadeId || "",
    matriculaId: lancamento.matriculaId || "",
    ativarMatriculaAoReceber: Boolean(lancamento.ativarMatriculaAoReceber),
    formaPagamento: lancamento.formaPagamento || "",
    valorBruto,
    taxaValor: numero(lancamento.taxaValor ?? lancamento.taxaOperadoraValor),
    taxaPercentual: numero(lancamento.taxaPercentual ?? lancamento.taxaOperadoraPercentual),
    valorLiquido: numero(lancamento.valorLiquido ?? valorRecebido),
    valorRecebido,
    vencimento: lancamento.vencimento || lancamento.dataVencimento || hojeISO(),
    dataRecebimento: lancamento.dataPagamento || lancamento.pagamento || "",
    valorRestante: status === "recebido" ? 0 : Math.max(0, numero(lancamento.valorRestante ?? lancamento.saldo ?? (valorBruto - valorRecebido))),
    status,
    observacao: lancamento.observacao || lancamento.observacoes || "",
    caixaId: lancamento.caixaId || "",
    movimentoCaixaId: lancamento.movimentoCaixaId || "",
    lancamentoFinanceiroId: lancamento.id || "",
    origem: lancamento.origem || "financeiro",
    criadoPor: lancamento.criadoPor || "sistema",
    criadoEm: lancamento.criadoEm || agoraISO(),
    atualizadoEm: agoraISO(),
    sincronizadoDoFinanceiro: true
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });

  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  const recebimentos = await lerJson(RECEBIMENTOS_FILE, []);

  const chaves = new Set();
  for (const r of recebimentos) {
    if (r.id) chaves.add(String(r.id));
    if (r.lancamentoFinanceiroId) chaves.add(String(r.lancamentoFinanceiroId));
  }

  const criados = [];
  for (const lancamento of financeiro) {
    if (normalizar(lancamento.tipo) !== "receber") continue;
    const idFinanceiro = String(lancamento.id || "");
    const idRecebimento = String(lancamento.recebimentoId || `rec_${idFinanceiro}`);

    if (chaves.has(idFinanceiro) || chaves.has(idRecebimento)) continue;

    const novo = converter(lancamento);
    recebimentos.push(novo);
    criados.push({
      recebimentoId: novo.id,
      lancamentoFinanceiroId: novo.lancamentoFinanceiroId,
      pessoa: novo.pessoa,
      valor: novo.valorBruto,
      status: novo.status
    });
    chaves.add(idFinanceiro);
    chaves.add(idRecebimento);
  }

  await salvarJson(RECEBIMENTOS_FILE, recebimentos);

  const relatorio = {
    ok: true,
    data: new Date().toISOString(),
    origem: "financeiro.json",
    destino: "recebimentos.json",
    financeirosReceber: financeiro.filter((f) => normalizar(f.tipo) === "receber").length,
    recebimentosCriados: criados.length,
    criados
  };

  const out = path.join(LOG_DIR, "sincronizar-recebimentos-financeiro.json");
  await salvarJson(out, relatorio);

  console.log("Fusion ERP — Sincronização Financeiro → Recebimentos");
  console.log(`Recebimentos criados: ${criados.length}`);
  console.log(`Relatório: ${out}`);
}

main().catch((erro) => {
  console.error("Falha na sincronização:", erro.message);
  process.exit(1);
});
