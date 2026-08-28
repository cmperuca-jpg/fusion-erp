import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { listarEstornosCobrancaAsaas, reembolsarCobrancaAsaas } from "./asaas.client.mjs";
import { cancelarCobrancaPagbank } from "./pagbank.client.mjs";
import { obterConfiguracaoPagamentosRuntime } from "./pagamentos-online.config.mjs";

const COL_PAGAMENTOS = "pagamentos_online";
const COL_RECIBOS = "recibos.json";
const COL_ITENS = "recibos_itens.json";
const COL_CAIXA = "caixa.json";

const txt = (v) => String(v ?? "").trim();
const norm = (v) => txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const moeda = (v) => Number((Number(String(v ?? 0).replace(",", ".")) || 0).toFixed(2));

function erro(mensagem, status = 400, code = "") {
  return Object.assign(new Error(mensagem), { status, code });
}

function mesmo(a, b) {
  return Boolean(txt(a) && txt(b) && txt(a) === txt(b));
}

function reciboEstornado(recibo = {}) {
  return ["estornado", "estornada"].includes(norm(recibo.status)) || recibo.cancelado === true;
}

function formasRecibo(recibo = {}) {
  const formas = Array.isArray(recibo.formasPagamento) ? recibo.formasPagamento : [];
  const nomes = formas.map((item) => txt(item?.formaPagamento || item?.forma || item?.meio));
  if (txt(recibo.formaPagamento)) nomes.push(txt(recibo.formaPagamento));
  return nomes.filter(Boolean);
}

function reciboEletronico(recibo = {}) {
  const bruto = norm(formasRecibo(recibo).join(" "));
  return [
    "pix", "cartao", "credito", "debito", "credit card", "debit card",
    "pagamento online", "asaas", "pagbank", "pagseguro", "infinitepay"
  ].some((termo) => bruto.includes(termo));
}

function valorRecibo(recibo = {}) {
  return moeda(recibo.valorPago ?? recibo.valorRecebido ?? recibo.valor ?? recibo.total ?? 0);
}

function reciboDoRegistro(registro = {}) {
  return registro.baixa?.resultado?.recibo || {};
}

function idsTitulosDoRegistro(registro = {}) {
  return [
    registro.target?.tituloId,
    registro.tituloId,
    registro.baixa?.resultado?.lancamento?.id
  ].map(txt).filter(Boolean);
}

function transacaoPagbank(registro = {}) {
  const explicita = txt(registro.providerTransactionId);
  if (explicita.startsWith("CHAR_")) return explicita;
  const eventos = Array.isArray(registro.eventos) ? [...registro.eventos].reverse() : [];
  const evento = eventos.find((item) => txt(item?.providerPaymentId).startsWith("CHAR_"));
  return txt(evento?.providerPaymentId);
}

function transacaoProvider(registro = {}) {
  const provider = norm(registro.provider);
  if (provider === "pagbank") return transacaoPagbank(registro);
  return txt(registro.providerTransactionId || registro.providerPaymentId);
}

async function contextoRecibo(reciboId, recebimento = {}) {
  const [recibos, itens] = await Promise.all([
    lerJsonDuravel(COL_RECIBOS, []),
    lerJsonDuravel(COL_ITENS, [])
  ]);

  const recibo = (Array.isArray(recibos) ? recibos : []).find(
    (item) => mesmo(item.id, reciboId) || mesmo(item.numero, reciboId)
  );
  if (!recibo) throw erro("Recibo não encontrado.", 404, "REFUND_RECEIPT_NOT_FOUND");

  const tituloIds = new Set(
    (Array.isArray(itens) ? itens : [])
      .filter((item) => mesmo(item.reciboId, recibo.id) && !item.cancelado)
      .map((item) => txt(item.tituloId))
      .filter(Boolean)
  );

  for (const id of [recebimento.lancamentoFinanceiroId, recebimento.financeiroId]) {
    if (txt(id)) tituloIds.add(txt(id));
  }

  return { recibo, tituloIds };
}

async function localizarPagamentoOnline(recibo, tituloIds = new Set()) {
  const lista = await lerJsonDuravel(COL_PAGAMENTOS, []);
  const pagamentos = Array.isArray(lista) ? lista : [];

  const exatos = pagamentos.filter((registro) => {
    const rb = reciboDoRegistro(registro);
    return (
      mesmo(registro.reciboId, recibo.id) ||
      mesmo(registro.reciboNumero, recibo.numero) ||
      mesmo(rb.id, recibo.id) ||
      mesmo(rb.numero, recibo.numero)
    );
  });

  if (exatos.length > 1) {
    throw erro(
      "Mais de um pagamento online está vinculado ao mesmo recibo. Reconcilie antes do estorno.",
      409,
      "REFUND_ONLINE_PAYMENT_AMBIGUOUS"
    );
  }
  if (exatos.length === 1) return { registro: exatos[0] };

  if (tituloIds.size) {
    const porTitulo = pagamentos.filter((registro) =>
      idsTitulosDoRegistro(registro).some((id) => tituloIds.has(id))
    );
    if (porTitulo.length > 1) {
      throw erro(
        "Mais de um pagamento online pode corresponder a este título. Reconcilie antes do estorno.",
        409,
        "REFUND_ONLINE_PAYMENT_AMBIGUOUS"
      );
    }
    if (porTitulo.length === 1) return { registro: porTitulo[0] };
  }

  return { registro: null };
}

async function exigirCaixaAberto() {
  const caixa = await lerJsonDuravel(COL_CAIXA, { caixas: [], movimentos: [] });
  const aberto = (Array.isArray(caixa?.caixas) ? caixa.caixas : []).some(
    (item) => norm(item.status) === "aberto"
  );
  if (!aberto) {
    throw erro(
      "Abra o caixa antes de solicitar o estorno. Nenhum valor foi devolvido ao cliente.",
      409,
      "CAIXA_FECHADO"
    );
  }
}

function resumoReembolso(registro = {}, reembolso = {}, extra = {}) {
  return {
    necessario: true,
    provider: norm(registro.provider),
    status: txt(reembolso.status),
    protocolo: txt(reembolso.protocolo),
    transacaoId: txt(reembolso.transacaoId || transacaoProvider(registro)),
    idempotente: Boolean(extra.idempotente),
    devolucaoAceita: ["externo_concluido", "local_pendente", "local_concluido"].includes(txt(reembolso.status)),
    aguardandoConfirmacao: txt(reembolso.status) === "externo_pendente"
  };
}

async function atualizarReembolso(registroId, patch, operacaoId, sufixo) {
  return executarTransacaoJson(async () => {
    const lista = await lerJsonDuravel(COL_PAGAMENTOS, []);
    const pagamentos = Array.isArray(lista) ? lista : [];
    const idx = pagamentos.findIndex((item) => mesmo(item.id, registroId));
    if (idx < 0) throw erro("Pagamento online não encontrado durante o estorno.", 409, "REFUND_RECORD_LOST");

    pagamentos[idx] = {
      ...pagamentos[idx],
      reembolsoReal: {
        ...(pagamentos[idx].reembolsoReal || {}),
        ...patch,
        atualizadoEm: new Date().toISOString()
      },
      atualizadoEm: new Date().toISOString()
    };
    await salvarJsonDuravel(COL_PAGAMENTOS, pagamentos);
    return pagamentos[idx];
  }, { operacaoId: `refund-${sufixo}-${registroId}-${operacaoId}` });
}

async function reservarReembolso(registro, recibo, motivo, operacaoId) {
  return executarTransacaoJson(async () => {
    const lista = await lerJsonDuravel(COL_PAGAMENTOS, []);
    const pagamentos = Array.isArray(lista) ? lista : [];
    const idx = pagamentos.findIndex((item) => mesmo(item.id, registro.id));
    if (idx < 0) throw erro("Pagamento online não encontrado durante o estorno.", 409, "REFUND_RECORD_LOST");

    const atual = pagamentos[idx];
    const reembolso = atual.reembolsoReal || {};
    const estado = txt(reembolso.status);

    if (["externo_concluido", "local_pendente", "local_concluido"].includes(estado)) {
      return { reservado: false, registro: atual, reembolso, idempotente: true };
    }

    if (["solicitando", "indeterminado"].includes(estado)) {
      throw erro(
        "Existe uma solicitação de estorno externo sem confirmação conclusiva. Não repetimos a devolução para evitar pagamento em dobro; reconcilie o gateway.",
        409,
        "REFUND_RECONCILIATION_REQUIRED"
      );
    }

    const novo = {
      status: "solicitando",
      operacaoId,
      provider: norm(atual.provider),
      transacaoId: transacaoProvider(atual),
      reciboId: txt(recibo.id),
      reciboNumero: txt(recibo.numero),
      valor: valorRecibo(recibo),
      motivo: txt(motivo).slice(0, 300),
      solicitadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    pagamentos[idx] = { ...atual, reembolsoReal: novo, atualizadoEm: new Date().toISOString() };
    await salvarJsonDuravel(COL_PAGAMENTOS, pagamentos);
    return { reservado: true, registro: pagamentos[idx], reembolso: novo, idempotente: false };
  }, { operacaoId: `refund-reserva-${registro.id}-${operacaoId}` });
}

function detalheErroExterno(e) {
  return txt(e?.message || "Falha no gateway.").slice(0, 300);
}

function resultadoIndeterminado(e) {
  return !Number.isFinite(Number(e?.status || e?.statusCode));
}

function itensEstornoAsaas(payload = {}) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.refunds)) return payload.refunds;
  return [];
}

function estadoEstornoAsaas(payload = {}, valorAlvo = 0) {
  const itens = itensEstornoAsaas(payload);
  const concluidos = itens.filter((item) => txt(item?.status).toUpperCase() === "DONE");
  const pendentes = itens.filter((item) => txt(item?.status).toUpperCase() === "PENDING");
  const cancelados = itens.filter((item) => txt(item?.status).toUpperCase() === "CANCELLED");
  const valorConcluido = moeda(concluidos.reduce((soma, item) => soma + moeda(item?.value), 0));
  return {
    itens,
    valorConcluido,
    concluido: valorConcluido + 0.009 >= moeda(valorAlvo),
    pendente: pendentes.length > 0,
    cancelado: cancelados.length > 0 && pendentes.length === 0,
    status: concluidos.length ? "DONE" : (pendentes.length ? "PENDING" : (cancelados.length ? "CANCELLED" : "")),
    comprovante: txt(concluidos.find((item) => txt(item?.transactionReceiptUrl))?.transactionReceiptUrl),
    endToEndIdentifier: txt(concluidos.find((item) => txt(item?.endToEndIdentifier))?.endToEndIdentifier)
  };
}

async function consultarEstadoAsaas(transacaoId, valorAlvo) {
  return estadoEstornoAsaas(await listarEstornosCobrancaAsaas(transacaoId), valorAlvo);
}

export async function prepararReembolsoExterno({
  reciboId,
  recebimento = {},
  motivo = "",
  operacaoId = ""
} = {}) {
  const op = txt(operacaoId);
  if (!op) {
    throw erro("O estorno real exige uma chave de idempotência.", 428, "FINANCIAL_IDEMPOTENCY_REQUIRED");
  }

  const motivoLimpo = txt(motivo);
  if (motivoLimpo.length < 3) {
    throw erro("Informe o motivo do estorno.", 400, "REFUND_REASON_REQUIRED");
  }

  const { recibo, tituloIds } = await contextoRecibo(reciboId, recebimento);
  const { registro } = await localizarPagamentoOnline(recibo, tituloIds);

  if (!registro) {
    if (reciboEstornado(recibo) && reciboEletronico(recibo)) {
      throw erro(
        "Este recibo eletrônico já foi estornado apenas no Fusion e não possui vínculo seguro com o gateway. Faça a reconciliação antes de devolver qualquer valor.",
        409,
        "REFUND_RECONCILIATION_REQUIRED"
      );
    }

    if (reciboEletronico(recibo)) {
      throw erro(
        "Pagamento PIX/cartão sem transação de gateway vinculada. O Fusion não fará estorno apenas contábil: devolva pelo provedor/banco e reconcilie a operação.",
        409,
        "REFUND_EXTERNAL_REFERENCE_REQUIRED"
      );
    }

    return {
      necessario: false,
      recibo,
      registroId: "",
      externamenteConcluido: false,
      localJaConcluido: false,
      resumo: { necessario: false, provider: "", status: "nao_aplicavel" }
    };
  }

  const provider = norm(registro.provider);
  if (!["asaas", "pagbank", "infinitepay"].includes(provider)) {
    throw erro(
      "Gateway do pagamento não possui fluxo de estorno real homologado no Fusion.",
      409,
      "REFUND_PROVIDER_UNSUPPORTED"
    );
  }

  if (provider === "infinitepay") {
    throw erro(
      "A InfinitePay exige cancelamento/devolução no App, navegador ou maquininha. O Fusion não alterou o financeiro local. Faça a devolução na InfinitePay e depois reconcilie.",
      409,
      "REFUND_MANUAL_REQUIRED"
    );
  }

  const valor = valorRecibo(recibo);
  const valorOnline = moeda(registro.valorConfirmado || registro.valor);
  if (!(valor > 0)) throw erro("Valor do recibo inválido para estorno real.", 409, "REFUND_VALUE_INVALID");
  if (valorOnline > 0 && Math.abs(valorOnline - valor) > 0.01) {
    throw erro(
      "O valor do recibo não confere com a transação online. Reconcilie antes do estorno.",
      409,
      "REFUND_VALUE_MISMATCH"
    );
  }

  const anterior = registro.reembolsoReal || {};

  if (provider === "asaas" && txt(anterior.status) === "externo_pendente") {
    const transacaoPendente = txt(anterior.transacaoId || transacaoProvider(registro));
    if (!transacaoPendente) {
      throw erro(
        "Existe um estorno Asaas pendente sem identificador da cobrança. Reconcilie antes de qualquer nova tentativa.",
        409,
        "REFUND_RECONCILIATION_REQUIRED"
      );
    }

    let estadoAtual;
    try {
      estadoAtual = await consultarEstadoAsaas(transacaoPendente, valor);
    } catch (e) {
      throw erro(
        "Não foi possível consultar o andamento do estorno no Asaas. Nenhuma nova devolução foi solicitada para evitar duplicidade.",
        Number(e?.status || e?.statusCode || 502),
        "REFUND_EXTERNAL_STATUS_UNKNOWN"
      );
    }

    if (estadoAtual.concluido) {
      const atualizado = await atualizarReembolso(
        registro.id,
        {
          status: "externo_concluido",
          statusGateway: "DONE",
          protocolo: estadoAtual.endToEndIdentifier || anterior.protocolo || transacaoPendente,
          comprovante: estadoAtual.comprovante,
          valor,
          erro: "",
          concluidoExternoEm: new Date().toISOString()
        },
        op,
        "asaas-confirmado"
      );
      return {
        necessario: true,
        recibo,
        registroId: registro.id,
        externamenteConcluido: true,
        localJaConcluido: false,
        aguardandoExterno: false,
        resumo: resumoReembolso(atualizado, atualizado.reembolsoReal)
      };
    }

    if (estadoAtual.pendente) {
      return {
        necessario: true,
        recibo,
        registroId: registro.id,
        externamenteConcluido: false,
        localJaConcluido: false,
        aguardandoExterno: true,
        resumo: resumoReembolso(registro, { ...anterior, status: "externo_pendente" }, { idempotente: true })
      };
    }

    if (estadoAtual.cancelado) {
      await atualizarReembolso(
        registro.id,
        {
          status: "falhou",
          statusGateway: "CANCELLED",
          erro: "O estorno Asaas foi cancelado e não deve ser considerado devolvido."
        },
        op,
        "asaas-cancelado"
      );
      throw erro(
        "O Asaas informa que o estorno foi cancelado. O financeiro local permanece recebido.",
        409,
        "REFUND_PROVIDER_REJECTED"
      );
    }

    throw erro(
      "O Asaas ainda não retornou um estado conclusivo para a devolução. Nenhuma nova solicitação foi enviada.",
      409,
      "REFUND_EXTERNAL_STATUS_UNKNOWN"
    );
  }

  if (reciboEstornado(recibo)) {
    if (["externo_concluido", "local_pendente", "local_concluido"].includes(txt(anterior.status))) {
      return {
        necessario: true,
        recibo,
        registroId: registro.id,
        externamenteConcluido: true,
        localJaConcluido: true,
        resumo: resumoReembolso(registro, { ...anterior, status: "local_concluido" }, { idempotente: true })
      };
    }
    throw erro(
      "O recibo já está estornado localmente, mas não existe confirmação segura de devolução no gateway. Reconcilie antes de qualquer nova tentativa.",
      409,
      "REFUND_RECONCILIATION_REQUIRED"
    );
  }

  // Evita devolver no gateway e só depois descobrir que o caixa local está fechado.
  await exigirCaixaAberto();

  const reserva = await reservarReembolso(registro, recibo, motivoLimpo, op);
  if (!reserva.reservado) {
    return {
      necessario: true,
      recibo,
      registroId: registro.id,
      externamenteConcluido: true,
      localJaConcluido: txt(reserva.reembolso.status) === "local_concluido",
      resumo: resumoReembolso(reserva.registro, reserva.reembolso, { idempotente: true })
    };
  }

  const transacaoId = transacaoProvider(reserva.registro);
  if (!transacaoId) {
    await atualizarReembolso(
      registro.id,
      { status: "falhou", erro: "Identificador da transação no gateway não encontrado." },
      op,
      "sem-transacao"
    );
    throw erro(
      "Não foi possível identificar a transação original no gateway. Nenhum valor foi devolvido; reconcilie o pagamento.",
      409,
      "REFUND_PROVIDER_TRANSACTION_MISSING"
    );
  }

  try {
    let resposta;
    if (provider === "asaas") {
      resposta = await reembolsarCobrancaAsaas(transacaoId, { motivo: motivoLimpo });

      let estadoAsaas = estadoEstornoAsaas(resposta, valor);
      if (!estadoAsaas.concluido && !estadoAsaas.pendente && !estadoAsaas.cancelado) {
        try {
          estadoAsaas = await consultarEstadoAsaas(transacaoId, valor);
        } catch {
          // O POST foi aceito; sem consulta conclusiva, não repetimos o refund e não estornamos localmente.
          estadoAsaas = {
            concluido: false,
            pendente: true,
            cancelado: false,
            status: "PENDING",
            comprovante: "",
            endToEndIdentifier: ""
          };
        }
      }

      if (estadoAsaas.cancelado) {
        await atualizarReembolso(
          registro.id,
          {
            status: "falhou",
            statusGateway: "CANCELLED",
            erro: "O Asaas cancelou a solicitação de estorno."
          },
          op,
          "asaas-cancelado"
        );
        throw erro(
          "O Asaas cancelou a solicitação de estorno. Nenhuma baixa local foi desfeita.",
          409,
          "REFUND_PROVIDER_REJECTED"
        );
      }

      if (!estadoAsaas.concluido) {
        const pendente = await atualizarReembolso(
          registro.id,
          {
            status: "externo_pendente",
            protocolo: estadoAsaas.endToEndIdentifier || transacaoId,
            transacaoId,
            statusGateway: estadoAsaas.status || "PENDING",
            comprovante: estadoAsaas.comprovante || "",
            valor,
            erro: "",
            pendenteExternoEm: new Date().toISOString()
          },
          op,
          "asaas-pendente"
        );

        return {
          necessario: true,
          recibo,
          registroId: registro.id,
          externamenteConcluido: false,
          localJaConcluido: false,
          aguardandoExterno: true,
          resumo: resumoReembolso(pendente, pendente.reembolsoReal)
        };
      }

      resposta = {
        ...resposta,
        refundId: estadoAsaas.endToEndIdentifier || txt(resposta?.refundId),
        status: "DONE",
        transactionReceiptUrl: estadoAsaas.comprovante || txt(resposta?.transactionReceiptUrl)
      };
    } else {
      const runtime = await obterConfiguracaoPagamentosRuntime();
      resposta = await cancelarCobrancaPagbank(
        transacaoId,
        { valorCentavos: Math.round(valor * 100) },
        runtime.pagbank || {}
      );
    }

    const protocolo = txt(resposta?.refundId || resposta?.id || resposta?.charge?.id || transacaoId);
    const statusGateway = txt(resposta?.status || resposta?.charge?.status || "aceito");

    const atualizado = await atualizarReembolso(
      registro.id,
      {
        status: "externo_concluido",
        protocolo,
        transacaoId,
        statusGateway,
        comprovante: txt(resposta?.transactionReceiptUrl),
        valor,
        erro: "",
        concluidoExternoEm: new Date().toISOString()
      },
      op,
      "externo-ok"
    );

    return {
      necessario: true,
      recibo,
      registroId: registro.id,
      externamenteConcluido: true,
      localJaConcluido: false,
      aguardandoExterno: false,
      resumo: resumoReembolso(atualizado, atualizado.reembolsoReal)
    };
  } catch (e) {
    const incerto = resultadoIndeterminado(e);
    await atualizarReembolso(
      registro.id,
      {
        status: incerto ? "indeterminado" : "falhou",
        erro: detalheErroExterno(e),
        falhouEm: new Date().toISOString()
      },
      op,
      incerto ? "externo-incerto" : "externo-falhou"
    );

    if (incerto) {
      throw erro(
        "A comunicação com o gateway terminou sem confirmação. O Fusion não repetirá a devolução automaticamente para evitar estorno em dobro. Reconcilie o gateway.",
        502,
        "REFUND_EXTERNAL_STATUS_UNKNOWN"
      );
    }

    throw erro(
      `O gateway recusou o estorno: ${detalheErroExterno(e)} Nenhuma baixa local foi desfeita.`,
      Number(e?.status || e?.statusCode || 502),
      txt(e?.code) || "REFUND_PROVIDER_REJECTED"
    );
  }
}

export async function marcarReembolsoLocalConcluido(registroId, operacaoId) {
  if (!txt(registroId)) return null;
  return atualizarReembolso(
    registroId,
    { status: "local_concluido", erroLocal: "", concluidoLocalEm: new Date().toISOString() },
    txt(operacaoId),
    "local-ok"
  );
}

export async function marcarReembolsoLocalPendente(registroId, operacaoId, erroLocal) {
  if (!txt(registroId)) return null;
  return atualizarReembolso(
    registroId,
    {
      status: "local_pendente",
      erroLocal: txt(erroLocal?.message || erroLocal).slice(0, 300),
      pendenteLocalEm: new Date().toISOString()
    },
    txt(operacaoId),
    "local-pendente"
  );
}
