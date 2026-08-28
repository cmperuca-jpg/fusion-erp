import crypto from "node:crypto";

export const STATUS_PAGAMENTO = ["aberto", "pendente", "aprovado", "agendado", "parcial", "pago", "cancelado", "estornado", "reprovado"];
export const FORMAS_PAGAMENTO = ["dinheiro", "pix", "cartao", "boleto", "transferencia", "debito", "credito", "outros"];

export function somenteData(value = "") {
  return String(value || "").slice(0, 10);
}

export function normalizarStatus(value = "aberto") {
  const s = String(value || "aberto").trim().toLowerCase();
  if (["quitado", "baixado", "pago"].includes(s)) return "pago";
  if (["pendente", "em aberto", "vencido"].includes(s)) return "aberto";
  if (["parcialmente pago", "baixado parcial"].includes(s)) return "parcial";
  if (["pendente", "aprovado", "agendado", "cancelado", "estornado", "reprovado"].includes(s)) return s;
  return "aberto";
}

export function numeroMoeda(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function gerarIdPagamento() {
  return `fin_pag_${crypto.randomUUID()}`;
}

export function calcularSaldo(item = {}) {
  const valor = numeroMoeda(item.valor ?? item.valorBruto ?? item.total ?? item.valorOriginal);
  const pago = numeroMoeda(item.valorPago ?? item.pago ?? item.valorLiquido ?? item.valorBaixado);
  const saldoInformado = item.valorRestante ?? item.saldo ?? item.valorAberto;
  if (saldoInformado !== undefined && saldoInformado !== null) return Math.max(0, numeroMoeda(saldoInformado));
  return Math.max(0, numeroMoeda(valor - pago));
}

export function montarPagamento(payload = {}) {
  const valor = numeroMoeda(payload.valor ?? payload.valorBruto ?? payload.total);
  const status = normalizarStatus(payload.status);
  const valorPago = status === "pago" ? valor : numeroMoeda(payload.valorPago ?? payload.pago ?? payload.valorLiquido);
  const saldo = Math.max(0, numeroMoeda(valor - valorPago));
  const agora = new Date().toISOString();
  return {
    id: payload.id || gerarIdPagamento(),
    tipo: "pagar",
    fornecedor: String(payload.fornecedor || payload.credor || payload.nome || "").trim(),
    credor: String(payload.credor || payload.fornecedor || payload.nome || "").trim(),
    descricao: String(payload.descricao || payload.observacao || "").trim(),
    documento: String(payload.documento || payload.numeroDocumento || "").trim(),
    categoria: String(payload.categoria || "").trim(),
    vencimento: somenteData(payload.vencimento || payload.dataVencimento || payload.data),
    dataVencimento: somenteData(payload.dataVencimento || payload.vencimento || payload.data),
    valor,
    valorBruto: valor,
    valorPago,
    valorLiquido: valorPago,
    valorRestante: saldo,
    formaPagamento: String(payload.formaPagamento || payload.forma || "").trim() || "pix",
    forma: String(payload.forma || payload.formaPagamento || "").trim() || "pix",
    status: saldo <= 0 && valor > 0 ? "pago" : status,
    observacao: String(payload.observacao || "").trim(),
    centroCusto: String(payload.centroCusto || payload.centro_de_custo || "").trim(),
    planoContas: String(payload.planoContas || payload.plano_contas || "").trim(),
    aprovadoPor: payload.aprovadoPor || "",
    aprovadoEm: payload.aprovadoEm || "",
    agendadoPara: somenteData(payload.agendadoPara || payload.dataAgendamento || ""),
    recorrencia: payload.recorrencia || null,
    grupoParcelamento: String(payload.grupoParcelamento || "").trim(),
    parcela: payload.parcela ?? null,
    parcelas: payload.parcelas ?? null,
    criacaoOperacaoId: String(payload.criacaoOperacaoId || "").trim(),
    duplicacaoOperacaoId: String(payload.duplicacaoOperacaoId || "").trim(),
    parcelamentoOperacaoId: String(payload.parcelamentoOperacaoId || "").trim(),
    recorrenciaOperacaoId: String(payload.recorrenciaOperacaoId || "").trim(),
    operacoesIdempotentes:
      payload.operacoesIdempotentes &&
      typeof payload.operacoesIdempotentes === "object" &&
      !Array.isArray(payload.operacoesIdempotentes)
        ? { ...payload.operacoesIdempotentes }
        : {},
    comprovantes: Array.isArray(payload.comprovantes) ? payload.comprovantes : [],
    auditoria: Array.isArray(payload.auditoria) ? payload.auditoria : [],
    historico: Array.isArray(payload.historico) ? payload.historico : [],
    createdAt: payload.createdAt || agora,
    updatedAt: agora
  };
}

export function validarCriacao(payload = {}) {
  const erros = [];
  const pagamento = montarPagamento(payload);
  if (!pagamento.fornecedor) erros.push("fornecedor");
  if (!pagamento.descricao) erros.push("descrição");
  if (!pagamento.vencimento) erros.push("vencimento");
  if (!(pagamento.valor > 0)) erros.push("valor");
  return { ok: erros.length === 0, erros, pagamento };
}

export function validarEdicao(payload = {}, atual = {}) {
  const base = { ...atual, ...payload, id: atual.id || payload.id };
  const pagamento = montarPagamento(base);
  pagamento.historico = Array.isArray(atual.historico) ? atual.historico : [];
  pagamento.createdAt = atual.createdAt || pagamento.createdAt;
  if (payload.status && ["pendente", "aprovado", "agendado", "pago", "cancelado", "estornado", "reprovado"].includes(normalizarStatus(payload.status))) {
    pagamento.status = normalizarStatus(payload.status);
  }
  if (pagamento.valorPago > pagamento.valor) pagamento.valorPago = pagamento.valor;
  pagamento.valorLiquido = pagamento.valorPago;
  pagamento.valorRestante = Math.max(0, numeroMoeda(pagamento.valor - pagamento.valorPago));
  if (pagamento.valorRestante <= 0 && pagamento.valor > 0) pagamento.status = "pago";
  if (pagamento.valorRestante > 0 && pagamento.valorPago > 0 && !["cancelado", "estornado"].includes(pagamento.status)) pagamento.status = "parcial";
  if (pagamento.valorRestante > 0 && pagamento.valorPago <= 0 && !["cancelado", "estornado"].includes(pagamento.status)) pagamento.status = "aberto";

  const erros = [];
  if (!pagamento.fornecedor) erros.push("fornecedor");
  if (!pagamento.descricao) erros.push("descrição");
  if (!pagamento.vencimento) erros.push("vencimento");
  if (!(pagamento.valor > 0)) erros.push("valor");
  return { ok: erros.length === 0, erros, pagamento };
}

export function somarDias(dataIso, dias) {
  const data = somenteData(dataIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}
