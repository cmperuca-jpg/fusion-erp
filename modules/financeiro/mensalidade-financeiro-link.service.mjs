import {
  executarTransacaoJson,
  lerJsonDuravel,
  salvarJsonDuravel
} from "../core/persistence/durable-json.mjs";

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao;
}

function statusNormalizado(valor = "") {
  const s = texto(valor).toLowerCase();
  if (["cancelado", "cancelada"].includes(s)) return "cancelado";
  if (["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(s)) return "pago";
  if (["programado", "programada", "agendado", "agendada", "previsto", "prevista", "futuro", "futura"].includes(s)) return "programado";
  if (["parcial", "parcialmente pago"].includes(s)) return "parcial";
  return "aberto";
}

function ehProgramada(mensalidade = {}) {
  return mensalidade.programada === true ||
    statusNormalizado(mensalidade.status || mensalidade.situacao) === "programado";
}

function erro(mensagem, status = 400) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

function montarLancamento(mensalidade = {}) {
  const programada = ehProgramada(mensalidade);
  const statusMensalidade = statusNormalizado(mensalidade.status || mensalidade.statusPagamento);
  const valor = numero(
    mensalidade.valorOriginal ??
    mensalidade.total ??
    mensalidade.valor ??
    0
  );
  const valorPago = numero(
    mensalidade.valorPago ??
    mensalidade.valorQuitado ??
    mensalidade.valorRecebido ??
    0
  );
  const valorRestante = programada
    ? 0
    : numero(
        mensalidade.valorRestante ??
        mensalidade.saldoRestante ??
        Math.max(0, valor - valorPago)
      );

  return {
    id: `fin_${mensalidade.id}`,
    tipo: "receber",
    descricao: mensalidade.descricao ||
      `Mensalidade ${mensalidade.aluno || mensalidade.alunoNome || ""} - ${mensalidade.competencia || ""}`,
    categoria: "Mensalidades",
    centroCusto: "Academia",
    alunoFornecedor: mensalidade.aluno || mensalidade.alunoNome || "",
    pessoa: mensalidade.aluno || mensalidade.alunoNome || "",
    pessoaFornecedor: mensalidade.aluno || mensalidade.alunoNome || "",
    alunoId: mensalidade.alunoId || "",
    matriculaId: mensalidade.matriculaId || "",
    numeroMatricula: mensalidade.numeroMatricula || "",
    planoId: mensalidade.planoId || "",
    plano: mensalidade.plano || "",
    mensalidadeId: mensalidade.id,
    valor,
    valorBruto: valor,
    valorPago: statusMensalidade === "pago" ? Math.max(valorPago, valor) : valorPago,
    valorRecebido: statusMensalidade === "pago" ? Math.max(valorPago, valor) : valorPago,
    valorLiquido: statusMensalidade === "pago"
      ? numero(mensalidade.valorLiquido ?? mensalidade.valorRecebidoLiquido ?? Math.max(valorPago, valor))
      : 0,
    valorRestante: statusMensalidade === "pago" ? 0 : valorRestante,
    vencimento: mensalidade.vencimento || mensalidade.dataVencimento || "",
    pagamento: mensalidade.pagamento || mensalidade.dataPagamento || "",
    dataPagamento: mensalidade.dataPagamento || mensalidade.pagamento || "",
    formaPagamento: mensalidade.formaPagamento || "",
    status: statusMensalidade === "pago"
      ? "Pago"
      : statusMensalidade === "cancelado"
        ? "Cancelado"
        : programada
          ? "Programado"
          : statusMensalidade === "parcial"
            ? "Parcial"
            : "Aberto",
    programado: programada,
    previsto: programada,
    origem: mensalidade.origem || "mensalidade_automatica",
    periodicidade: mensalidade.periodicidade || "",
    periodicidadeMeses: mensalidade.periodicidadeMeses || 1,
    criadoEm: mensalidade.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
}

export async function garantirLancamentoFinanceiroMensalidade(mensalidadeId = "") {
  const id = texto(mensalidadeId);
  if (!id) throw erro("Mensalidade não informada.", 400);

  return executarTransacaoJson(async () => {
    const [mensalidades, financeiro] = await Promise.all([
      lerJsonDuravel("mensalidades.json", []),
      lerJsonDuravel("financeiro.json", [])
    ]);

    const mensalidade = mensalidades.find(item => texto(item.id) === id);
    if (!mensalidade) throw erro("Esta cobrança não foi encontrada.", 404);

    if (statusNormalizado(mensalidade.status || mensalidade.situacao) === "cancelado") {
      throw erro("Esta cobrança foi cancelada e não pode ser recebida.", 409);
    }

    let lancamento = financeiro.find(item =>
      texto(item.mensalidadeId) === id ||
      (mensalidade.lancamentoFinanceiroId &&
        texto(item.id) === texto(mensalidade.lancamentoFinanceiroId))
    ) || null;
    const criado = !lancamento;

    if (!lancamento) {
      lancamento = montarLancamento(mensalidade);

      const mesmoId = financeiro.findIndex(item => texto(item.id) === texto(lancamento.id));
      if (mesmoId >= 0) financeiro[mesmoId] = { ...financeiro[mesmoId], ...lancamento };
      else financeiro.push(lancamento);

      mensalidade.lancamentoFinanceiroId = lancamento.id;
      mensalidade.financeiroId = lancamento.id;
      mensalidade.atualizadoEm = new Date().toISOString();

      await salvarJsonDuravel("mensalidades.json", mensalidades);
      await salvarJsonDuravel("financeiro.json", financeiro);
    }

    return {
      ok: true,
      criado,
      mensalidadeId: id,
      financeiroId: lancamento.id,
      lancamento
    };
  }, { operacaoId: `vinculo-financeiro-${id}` });
}
