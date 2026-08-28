import crypto from "node:crypto";
import { dataLocalISO } from "../core/time/fusion-time.mjs";
import {
  atualizarPagamentoRaw,
  atualizarPagamentoComMovimentoCaixa,
  inserirPagamentoRaw,
  listarPagamentosRaw,
  listarFechamentosFinanceiros,
  salvarFechamentosFinanceiros
} from "./pagamentos.repository.mjs";
import {
  calcularSaldo,
  gerarIdPagamento,
  montarPagamento,
  normalizarStatus,
  numeroMoeda,
  somenteData,
  somarDias,
  validarCriacao,
  validarEdicao
} from "./pagamentos.schema.mjs";

function texto(item, campos = []) {
  for (const c of campos) {
    if (item?.[c] !== undefined && item?.[c] !== null && String(item[c]).trim()) return String(item[c]);
  }
  return "";
}

function dataItem(item) { return somenteData(texto(item, ["vencimento", "dataVencimento", "data", "competencia"])); }
function valorTotal(item) { return numeroMoeda(item.valor ?? item.valorBruto ?? item.total ?? item.valorOriginal); }
function valorPago(item) { return numeroMoeda(item.valorPago ?? item.pago ?? item.valorLiquido ?? item.valorBaixado); }
function hojeIso() { return dataLocalISO(new Date()); }
function idItem(item = {}) { return String(item.id || item._id || item.codigo || item.uuid || item.chave || ""); }


function uid(prefixo = "pag") {
  return `${prefixo}_${crypto.randomUUID()}`;
}

function operacaoDoPayload(payload = {}) {
  return String(payload?.operacaoId || payload?.idempotencyKey || "").trim();
}

function idDeterministico(prefixo, operacaoId, sufixo = "") {
  const hash = crypto
    .createHash("sha256")
    .update(`${operacaoId}|${sufixo}`)
    .digest("hex")
    .slice(0, 24);
  return `${prefixo}_${hash}`;
}

function operacaoRepositorio(prefixo, operacaoId) {
  return operacaoId
    ? `${prefixo}:${operacaoId}`
    : `${prefixo}:${crypto.randomUUID()}`;
}

function operacaoAplicada(item = {}, acao = "", operacaoId = "") {
  if (!operacaoId) return false;
  return String(item?.operacoesIdempotentes?.[acao] || "") === operacaoId;
}

function marcarOperacao(item = {}, acao = "", operacaoId = "") {
  if (!operacaoId) return item;
  return {
    ...item,
    operacoesIdempotentes: {
      ...(item.operacoesIdempotentes || {}),
      [acao]: operacaoId
    }
  };
}

function payloadObjeto(valor, campo = "motivo") {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) return valor;
  return { [campo]: valor };
}

function aplicarFiltros(lista, filtros = {}) {
  const busca = String(filtros.busca || filtros.q || "").trim().toLowerCase();
  const status = String(filtros.status || "").trim().toLowerCase();
  const forma = String(filtros.forma || filtros.formaPagamento || "").trim().toLowerCase();
  const inicio = somenteData(filtros.inicio || filtros.de || "");
  const fim = somenteData(filtros.fim || filtros.ate || filtros.até || "");
  const fornecedor = String(filtros.fornecedor || filtros.credor || "").trim().toLowerCase();
  const categoria = String(filtros.categoria || "").trim().toLowerCase();

  return lista.filter((item) => {
    const st = normalizarStatus(item.status);
    const fm = texto(item, ["formaPagamento", "forma", "meioPagamento"]).toLowerCase();
    const data = dataItem(item);
    const fornecedorItem = texto(item, ["fornecedor", "credor", "nome"]).toLowerCase();
    const categoriaItem = texto(item, ["categoria"]).toLowerCase();
    const alvo = [fornecedorItem, texto(item, ["descricao", "observacao", "referencia"]), texto(item, ["documento", "numeroDocumento"]), categoriaItem].join(" ").toLowerCase();
    if (status && st !== status) return false;
    if (forma && fm !== forma) return false;
    if (fornecedor && !fornecedorItem.includes(fornecedor)) return false;
    if (categoria && !categoriaItem.includes(categoria)) return false;
    if (inicio && data && data < inicio) return false;
    if (fim && data && data > fim) return false;
    if (busca && !alvo.includes(busca)) return false;
    return true;
  });
}

function agrupar(lista, campo) {
  const mapa = new Map();
  for (const item of lista) {
    const chave = texto(item, [campo]) || texto(item, [campo === "fornecedor" ? "credor" : campo]) || "Sem informação";
    const atual = mapa.get(chave) || { nome: chave, total: 0, valorPrevisto: 0, valorPago: 0, valorAberto: 0 };
    atual.total += 1;
    atual.valorPrevisto = numeroMoeda(atual.valorPrevisto + valorTotal(item));
    atual.valorPago = numeroMoeda(atual.valorPago + valorPago(item));
    atual.valorAberto = numeroMoeda(atual.valorAberto + calcularSaldo(item));
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valorAberto - a.valorAberto || b.valorPrevisto - a.valorPrevisto).slice(0, 12);
}

function montarResumo(lista) {
  const aberto = lista.filter((i) => normalizarStatus(i.status) === "aberto");
  const parcial = lista.filter((i) => normalizarStatus(i.status) === "parcial");
  const pago = lista.filter((i) => normalizarStatus(i.status) === "pago");
  const cancelado = lista.filter((i) => normalizarStatus(i.status) === "cancelado");
  const estornado = lista.filter((i) => normalizarStatus(i.status) === "estornado");
  const vencidosLista = lista.filter((i) => ["aberto", "parcial"].includes(normalizarStatus(i.status)) && dataItem(i) && dataItem(i) < hojeIso());
  return {
    total: lista.length,
    abertos: aberto.length,
    pagos: pago.length,
    parciais: parcial.length,
    cancelados: cancelado.length,
    estornados: estornado.length,
    vencidos: vencidosLista.length,
    valorPrevisto: numeroMoeda(lista.reduce((a, i) => a + valorTotal(i), 0)),
    valorPago: numeroMoeda(lista.reduce((a, i) => a + valorPago(i), 0)),
    valorAberto: numeroMoeda(lista.reduce((a, i) => a + calcularSaldo(i), 0)),
    valorVencido: numeroMoeda(vencidosLista.reduce((a, i) => a + calcularSaldo(i), 0)),
    porFornecedor: agrupar(lista, "fornecedor"),
    porCategoria: agrupar(lista, "categoria")
  };
}

export async function listarPagamentos(filtros = {}) {
  const todos = await listarPagamentosRaw();
  const lancamentos = aplicarFiltros(todos, filtros).sort((a, b) => String(dataItem(a)).localeCompare(String(dataItem(b))) );
  return { ok: true, lancamentos, pagamentos: lancamentos, resumo: montarResumo(lancamentos) };
}

export async function obterPagamento(id) {
  const todos = await listarPagamentosRaw();
  const item = todos.find((p) => idItem(p) === String(id));
  if (!item) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }
  return montarPagamento(item);
}

export async function criarPagamento(payload = {}) {
  const operacaoId = operacaoDoPayload(payload);

  if (operacaoId) {
    const existente = (await listarPagamentosRaw())
      .find((item) => String(item.criacaoOperacaoId || "") === operacaoId);
    if (existente) return montarPagamento(existente);
  }

  const entrada = {
    ...payload,
    id:
      payload.id ||
      (operacaoId
        ? idDeterministico("fin_pag", operacaoId, "criar")
        : gerarIdPagamento())
  };

  const validacao = validarCriacao(entrada);
  if (!validacao.ok) {
    const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
    erro.status = 400;
    throw erro;
  }

  const pagamento = {
    ...validacao.pagamento,
    criacaoOperacaoId: operacaoId
  };

  return inserirPagamentoRaw(pagamento, {
    operacaoId: operacaoRepositorio("pagamento-criar", operacaoId)
  });
}

export async function editarPagamento(id, payload = {}) {
  const operacaoId = operacaoDoPayload(payload);
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (operacaoAplicada(atual, "editar", operacaoId)) return atual;

    const validacao = validarEdicao(payload, item);
    if (!validacao.ok) {
      const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }

    return marcarOperacao(
      { ...validacao.pagamento, id: idItem(item), updatedAt: new Date().toISOString() },
      "editar",
      operacaoId
    );
  }, {
    operacaoId: operacaoRepositorio(`pagamento-editar-${id}`, operacaoId)
  });
}

export async function excluirPagamento(id, payload = {}) {
  const pagamento = await cancelarPagamento(id, {
    ...payload,
    motivo:
      payload.motivo ||
      "Cancelamento solicitado pela exclusão legada."
  });
  return { id: String(id), removido: false, cancelado: true, pagamento };
}

export async function baixarPagamento(id, payload = {}) {
  const valorBaixa = numeroMoeda(payload.valor || payload.valorPago || payload.total);
  if (!(valorBaixa > 0)) {
    const erro = new Error("Informe um valor maior que zero.");
    erro.status = 400;
    throw erro;
  }

  const operacaoId = String(payload.operacaoId || payload.idempotencyKey || uid(`baixa-pagamento-${id}`));
  const resultado = await atualizarPagamentoComMovimentoCaixa(id, (item) => {
    const atual = montarPagamento(item);
    if (["cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento cancelado ou estornado não pode receber baixa.");
      erro.status = 400;
      throw erro;
    }
    const saldo = calcularSaldo(atual);
    if (valorBaixa > saldo + 0.009) {
      const erro = new Error("Valor da baixa não pode ser maior que o saldo.");
      erro.status = 400;
      throw erro;
    }
    const novoPago = numeroMoeda(valorPago(atual) + valorBaixa);
    const novoSaldo = Math.max(0, numeroMoeda(valorTotal(atual) - novoPago));
    const movimento = {
      id: uid("mov_pag"),
      tipo: "baixa_pagamento",
      data: hojeIso(),
      valor: valorBaixa,
      formaPagamento: payload.formaPagamento || payload.forma || atual.formaPagamento,
      observacao: payload.observacao || "Baixa de pagamento"
    };
    return {
      ...atual,
      valorPago: novoPago,
      valorLiquido: novoPago,
      valorRestante: novoSaldo,
      status: novoSaldo <= 0 ? "pago" : "parcial",
      formaPagamento: movimento.formaPagamento,
      forma: movimento.formaPagamento,
      historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento],
      updatedAt: new Date().toISOString()
    };
  }, (atualizado) => ({
    id: `cx_${operacaoId}`,
    tipo: "saida",
    origem: "pagamentos",
    referenciaId: id,
    descricao: atualizado.descricao || "Pagamento",
    valor: valorBaixa,
    formaPagamento: payload.formaPagamento || payload.forma || atualizado.formaPagamento,
    data: new Date().toISOString(),
    observacao: payload.observacao || "Baixa de conta a pagar"
  }), operacaoId);

  return { ...resultado.pagamento, movimentoCaixa: resultado.movimento, idempotente: resultado.idempotente === true };
}

export async function estornarPagamento(id, motivoOuPayload = "") {
  const payload = motivoOuPayload && typeof motivoOuPayload === "object"
    ? motivoOuPayload
    : { motivo: motivoOuPayload };
  const motivo = String(payload.motivo || payload.observacao || "").trim();
  const operacaoId = String(
    payload.operacaoId ||
    payload.idempotencyKey ||
    uid(`estorno-pagamento-${id}`)
  );

  let valorEstornado = 0;
  const resultado = await atualizarPagamentoComMovimentoCaixa(id, (item) => {
    const atual = montarPagamento(item);
    const pago = valorPago(atual);
    if (!(pago > 0) || !["pago", "parcial"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Somente um pagamento baixado pode ser estornado.");
      erro.status = 400;
      throw erro;
    }
    valorEstornado = pago;
    const movimento = { id: uid("est_pag"), tipo: "estorno", data: hojeIso(), valor: pago, observacao: motivo || "Estorno de pagamento" };
    return { ...atual, valorPago: 0, valorLiquido: 0, valorRestante: valorTotal(atual), status: "aberto", estornadoEm: movimento.data, motivoEstorno: motivo || "Estorno de pagamento", historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], updatedAt: new Date().toISOString() };
  }, (atualizado) => ({
    id: `cx_${operacaoId}`,
    tipo: "entrada",
    origem: "estorno_pagamentos",
    referenciaId: id,
    descricao: `Estorno: ${atualizado.descricao || "Pagamento"}`,
    valor: valorEstornado,
    formaPagamento: atualizado.formaPagamento || atualizado.forma || "",
    data: hojeIso(),
    observacao: motivo || "Estorno de conta a pagar"
  }), operacaoId);

  return {
    ...resultado.pagamento,
    movimentoCaixa: resultado.movimento,
    idempotente: resultado.idempotente === true
  };
}

export async function cancelarPagamento(id, motivoOuPayload = "") {
  const payload = payloadObjeto(motivoOuPayload);
  const motivo = String(payload.motivo || payload.observacao || "").trim();
  const operacaoId = operacaoDoPayload(payload);

  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);

    if (operacaoAplicada(atual, "cancelar", operacaoId)) return atual;

    if (normalizarStatus(atual.status) === "cancelado") {
      const erro = new Error("Pagamento já cancelado.");
      erro.status = 409;
      throw erro;
    }

    if (valorPago(atual) > 0 || ["pago", "parcial"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento com baixa não pode ser cancelado. Faça o estorno primeiro.");
      erro.status = 409;
      throw erro;
    }

    const movimento = {
      id: uid("can_pag"),
      tipo: "cancelamento",
      data: new Date().toISOString(),
      valor: 0,
      observacao: motivo || "Cancelamento de pagamento"
    };

    return marcarOperacao({
      ...atual,
      status: "cancelado",
      historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento],
      updatedAt: new Date().toISOString()
    }, "cancelar", operacaoId);
  }, {
    operacaoId: operacaoRepositorio(`pagamento-cancelar-${id}`, operacaoId)
  });
}

export async function duplicarPagamento(id, payload = {}) {
  const operacaoId = operacaoDoPayload(payload);

  if (operacaoId) {
    const existente = (await listarPagamentosRaw()).find((item) =>
      String(item.duplicacaoOperacaoId || "") === operacaoId &&
      String(item.duplicadoDe || "") === String(id)
    );
    if (existente) return montarPagamento(existente);
  }

  const original = await obterPagamento(id);
  const novo = montarPagamento({
    ...original,
    ...payload,
    id: operacaoId
      ? idDeterministico("fin_pag", operacaoId, `duplicar:${id}`)
      : gerarIdPagamento(),
    documento: payload.documento ?? `${original.documento || "DOC"}-COPIA`,
    vencimento: payload.vencimento || original.vencimento,
    dataVencimento: payload.dataVencimento || payload.vencimento || original.dataVencimento,
    valorPago: 0,
    valorLiquido: 0,
    valorRestante: payload.valor || original.valor,
    status: "aberto",
    historico: [{
      id: uid("dup_pag"),
      tipo: "duplicacao",
      origemId: id,
      data: new Date().toISOString(),
      observacao: payload.observacao || "Duplicado pelo módulo de pagamentos"
    }]
  });

  return inserirPagamentoRaw({
    ...novo,
    duplicacaoOperacaoId: operacaoId,
    duplicadoDe: String(id)
  }, {
    operacaoId: operacaoRepositorio(`pagamento-duplicar-${id}`, operacaoId)
  });
}

export async function parcelarPagamento(payload = {}) {
  const total = numeroMoeda(payload.valor || payload.valorBruto || payload.total);
  const parcelas = Math.max(1, Math.min(60, Number.parseInt(payload.parcelas || 1, 10)));
  const intervaloDias = Math.max(1, Number.parseInt(payload.intervaloDias || 30, 10));
  const operacaoId = operacaoDoPayload(payload);

  if (operacaoId) {
    const existentes = (await listarPagamentosRaw())
      .filter((item) => String(item.parcelamentoOperacaoId || "") === operacaoId)
      .sort((a, b) => Number(a.parcela || 0) - Number(b.parcela || 0));

    if (existentes.length) {
      if (existentes.length !== parcelas) {
        const erro = new Error("Parcelamento idempotente incompleto. Reconcilie antes de repetir a operação.");
        erro.status = 409;
        throw erro;
      }
      return existentes.map(montarPagamento);
    }
  }

  const grupo =
    payload.grupoParcelamento ||
    (operacaoId
      ? idDeterministico("grp_pag", operacaoId, "parcelamento")
      : uid("grp_pag"));

  const base = {
    ...payload,
    valor: numeroMoeda(total / parcelas),
    valorBruto: numeroMoeda(total / parcelas),
    valorPago: 0,
    valorLiquido: 0,
    status: "aberto"
  };

  const criados = [];
  for (let i = 1; i <= parcelas; i++) {
    const vencimento = somarDias(
      payload.vencimento || payload.dataVencimento || hojeIso(),
      intervaloDias * (i - 1)
    );

    const validacao = validarCriacao({
      ...base,
      id: operacaoId
        ? idDeterministico("fin_pag", operacaoId, `parcela:${i}`)
        : gerarIdPagamento(),
      descricao: `${payload.descricao || "Pagamento parcelado"} (${i}/${parcelas})`,
      documento: payload.documento ? `${payload.documento}-${String(i).padStart(2, "0")}` : "",
      vencimento,
      dataVencimento: vencimento,
      valor: i === parcelas
        ? numeroMoeda(total - (numeroMoeda(total / parcelas) * (parcelas - 1)))
        : numeroMoeda(total / parcelas),
      valorBruto: i === parcelas
        ? numeroMoeda(total - (numeroMoeda(total / parcelas) * (parcelas - 1)))
        : numeroMoeda(total / parcelas),
      grupoParcelamento: grupo,
      parcela: i,
      parcelas
    });

    if (!validacao.ok) {
      const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }

    criados.push(await inserirPagamentoRaw({
      ...validacao.pagamento,
      grupoParcelamento: grupo,
      parcela: i,
      parcelas,
      parcelamentoOperacaoId: operacaoId
    }, {
      operacaoId: operacaoRepositorio(`pagamento-parcela-${i}`, operacaoId)
    }));
  }

  return criados;
}


export async function obterHistoricoPagamento(id) {
  const pagamento = await obterPagamento(id);
  return Array.isArray(pagamento.historico) ? pagamento.historico : [];
}

export async function baixarPagamentosEmLote(payload = {}) {
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
  const operacaoLote = String(payload.operacaoId || payload.idempotencyKey || "").trim();
  if (!ids.length) {
    const erro = new Error("Informe ao menos um pagamento para baixa em lote.");
    erro.status = 400;
    throw erro;
  }
  const resultados = [];
  for (const id of ids) {
    try {
      const atual = await obterPagamento(id);
      const valor = payload.valorPorId?.[id] ?? calcularSaldo(atual);
      const pagamento = await baixarPagamento(id, {
        valor,
        formaPagamento: payload.formaPagamento || payload.forma || atual.formaPagamento || "pix",
        forma: payload.formaPagamento || payload.forma || atual.forma || "pix",
        observacao: payload.observacao || "Baixa em lote",
        operacaoId: operacaoLote ? `${operacaoLote}:${id}` : undefined
      });
      resultados.push({ id, ok: true, pagamento });
    } catch (err) {
      resultados.push({ id, ok: false, erro: err.message || "Falha na baixa" });
    }
  }
  return {
    ok: resultados.every((r) => r.ok),
    total: resultados.length,
    baixados: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
    resultados
  };
}

export async function listarConciliacaoPagamentos(filtros = {}) {
  const todos = await listarPagamentosRaw();
  const lista = aplicarFiltros(todos, filtros);
  const pendentes = lista.filter((item) => ["aberto", "parcial"].includes(normalizarStatus(item.status)) && calcularSaldo(item) > 0);
  const pagosSemForma = lista.filter((item) => normalizarStatus(item.status) === "pago" && !texto(item, ["formaPagamento", "forma", "meioPagamento"]));
  const divergentes = lista.filter((item) => {
    const total = valorTotal(item);
    const pago = valorPago(item);
    const saldo = calcularSaldo(item);
    const st = normalizarStatus(item.status);
    return (st === "pago" && saldo > 0.009) || (st === "aberto" && pago > 0.009) || total < 0;
  });
  return {
    ok: true,
    resumo: {
      total: lista.length,
      pendentes: pendentes.length,
      pagosSemForma: pagosSemForma.length,
      divergentes: divergentes.length,
      valorPendente: numeroMoeda(pendentes.reduce((acc, item) => acc + calcularSaldo(item), 0))
    },
    pendentes,
    pagosSemForma,
    divergentes
  };
}

export async function fecharPeriodoPagamentos(payload = {}) {
  const inicio = somenteData(payload.inicio || payload.de || "");
  const fim = somenteData(payload.fim || payload.ate || payload.até || "");
  if (!inicio || !fim) {
    const erro = new Error("Informe início e fim do período para fechamento.");
    erro.status = 400;
    throw erro;
  }
  if (fim < inicio) {
    const erro = new Error("A data final não pode ser menor que a inicial.");
    erro.status = 400;
    throw erro;
  }
  const lista = aplicarFiltros(await listarPagamentosRaw(), { inicio, fim });
  const resumo = montarResumo(lista);
  const operacaoId = operacaoDoPayload(payload);
  const fechamentos = await listarFechamentosFinanceiros();

  if (operacaoId) {
    const existente = fechamentos.find((item) =>
      String(item.operacaoId || "") === operacaoId
    );
    if (existente) return existente;
  }

  const fechamento = {
    id: operacaoId
      ? idDeterministico("fec_pag", operacaoId, "fechamento")
      : uid("fec_pag"),
    operacaoId,
    modulo: "pagamentos",
    inicio,
    fim,
    data: new Date().toISOString(),
    observacao: payload.observacao || "Fechamento de contas a pagar",
    resumo
  };

  fechamentos.push(fechamento);
  await salvarFechamentosFinanceiros(fechamentos, {
    operacaoId: operacaoRepositorio("pagamento-fechamento", operacaoId)
  });
  return fechamento;
}


function usuarioOperacao(payload = {}) {
  return String(payload.usuario || payload.user || payload.operador || payload.responsavel || "sistema").trim() || "sistema";
}

function registrarAuditoriaLocal(item = {}, acao, payload = {}) {
  const registro = {
    id: uid("aud_pag"),
    acao,
    usuario: usuarioOperacao(payload),
    data: new Date().toISOString(),
    observacao: payload.observacao || payload.motivo || ""
  };
  return [...(Array.isArray(item.auditoria) ? item.auditoria : []), registro];
}

export async function aprovarPagamento(id, payload = {}) {
  const operacaoId = operacaoDoPayload(payload);
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (operacaoAplicada(atual, "aprovar", operacaoId)) return atual;
    if (["pago", "cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento pago, cancelado ou estornado não pode ser aprovado.");
      erro.status = 400;
      throw erro;
    }
    const movimento = { id: uid("apr_pag"), tipo: "aprovacao", data: new Date().toISOString(), usuario: usuarioOperacao(payload), observacao: payload.observacao || "Pagamento aprovado" };
    return marcarOperacao({ ...atual, status: "aprovado", aprovadoPor: usuarioOperacao(payload), aprovadoEm: movimento.data, historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "aprovar", payload), updatedAt: new Date().toISOString() }, "aprovar", operacaoId);
  }, { operacaoId: operacaoRepositorio(`pagamento-aprovar-${id}`, operacaoId) });
}

export async function reprovarPagamento(id, payload = {}) {
  const operacaoId = operacaoDoPayload(payload);
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (operacaoAplicada(atual, "reprovar", operacaoId)) return atual;
    if (["pago", "cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento pago, cancelado ou estornado não pode ser reprovado.");
      erro.status = 400;
      throw erro;
    }
    const movimento = { id: uid("rep_pag"), tipo: "reprovacao", data: new Date().toISOString(), usuario: usuarioOperacao(payload), observacao: payload.motivo || payload.observacao || "Pagamento reprovado" };
    return marcarOperacao({ ...atual, status: "reprovado", historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "reprovar", payload), updatedAt: new Date().toISOString() }, "reprovar", operacaoId);
  }, { operacaoId: operacaoRepositorio(`pagamento-reprovar-${id}`, operacaoId) });
}

export async function agendarPagamento(id, payload = {}) {
  const data = somenteData(payload.data || payload.agendadoPara || payload.dataAgendamento || "");
  if (!data) {
    const erro = new Error("Informe a data do agendamento.");
    erro.status = 400;
    throw erro;
  }
  const operacaoId = operacaoDoPayload(payload);
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (operacaoAplicada(atual, "agendar", operacaoId)) return atual;
    if (["pago", "cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento pago, cancelado ou estornado não pode ser agendado.");
      erro.status = 400;
      throw erro;
    }
    const movimento = { id: uid("age_pag"), tipo: "agendamento", data: new Date().toISOString(), agendadoPara: data, usuario: usuarioOperacao(payload), observacao: payload.observacao || "Pagamento agendado" };
    return marcarOperacao({ ...atual, status: "agendado", agendadoPara: data, historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "agendar", payload), updatedAt: new Date().toISOString() }, "agendar", operacaoId);
  }, { operacaoId: operacaoRepositorio(`pagamento-agendar-${id}`, operacaoId) });
}

export async function anexarComprovantePagamento(id, payload = {}) {
  const nome = String(payload.nome || payload.filename || payload.arquivo || "").trim();
  const url = String(payload.url || payload.path || payload.caminho || payload.base64 || "").trim();
  if (!nome && !url) {
    const erro = new Error("Informe nome ou URL/base64 do comprovante.");
    erro.status = 400;
    throw erro;
  }
  const operacaoId = operacaoDoPayload(payload);
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (operacaoAplicada(atual, "anexar_comprovante", operacaoId)) return atual;
    const comprovante = { id: uid("comp_pag"), nome: nome || "comprovante", url, tipo: payload.tipo || "comprovante", criadoEm: new Date().toISOString(), usuario: usuarioOperacao(payload) };
    const movimento = { id: uid("his_comp_pag"), tipo: "comprovante", data: new Date().toISOString(), comprovanteId: comprovante.id, observacao: payload.observacao || "Comprovante anexado" };
    return marcarOperacao({ ...atual, comprovantes: [...(Array.isArray(atual.comprovantes) ? atual.comprovantes : []), comprovante], historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "anexar_comprovante", payload), updatedAt: new Date().toISOString() }, "anexar_comprovante", operacaoId);
  }, { operacaoId: operacaoRepositorio(`pagamento-comprovante-${id}`, operacaoId) });
}

function proximoVencimento(dataIso, frequencia) {
  const data = somenteData(dataIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  const f = String(frequencia || "mensal").toLowerCase();
  if (f === "semanal") d.setUTCDate(d.getUTCDate() + 7);
  else if (f === "anual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export async function criarPagamentosRecorrentes(payload = {}) {
  const repeticoes = Math.max(1, Math.min(120, Number.parseInt(payload.repeticoes || payload.quantidade || 12, 10)));
  const frequencia = String(payload.frequencia || payload.recorrencia || "mensal").toLowerCase();
  const operacaoId = operacaoDoPayload(payload);
  let vencimento = somenteData(payload.vencimento || payload.dataVencimento || hojeIso());

  if (operacaoId) {
    const existentes = (await listarPagamentosRaw())
      .filter((item) => String(item.recorrenciaOperacaoId || "") === operacaoId)
      .sort((a, b) => Number(a.recorrencia?.parcela || 0) - Number(b.recorrencia?.parcela || 0));

    if (existentes.length) {
      if (existentes.length !== repeticoes) {
        const erro = new Error("Recorrência idempotente incompleta. Reconcilie antes de repetir a operação.");
        erro.status = 409;
        throw erro;
      }
      return existentes.map(montarPagamento);
    }
  }

  const grupo =
    payload.grupoRecorrencia ||
    (operacaoId
      ? idDeterministico("rec_pag", operacaoId, "recorrencia")
      : uid("rec_pag"));

  const criados = [];
  for (let i = 1; i <= repeticoes; i++) {
    const validacao = validarCriacao({
      ...payload,
      id: operacaoId
        ? idDeterministico("fin_pag", operacaoId, `recorrencia:${i}`)
        : gerarIdPagamento(),
      vencimento,
      dataVencimento: vencimento,
      descricao: `${payload.descricao || "Pagamento recorrente"} (${i}/${repeticoes})`,
      status: payload.status || "pendente",
      recorrencia: { grupo, frequencia, parcela: i, total: repeticoes }
    });

    if (!validacao.ok) {
      const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }

    criados.push(await inserirPagamentoRaw({
      ...validacao.pagamento,
      recorrenciaOperacaoId: operacaoId,
      auditoria: registrarAuditoriaLocal(validacao.pagamento, "criar_recorrencia", payload)
    }, {
      operacaoId: operacaoRepositorio(`pagamento-recorrencia-${i}`, operacaoId)
    }));

    vencimento = proximoVencimento(vencimento, frequencia);
  }

  return criados;
}

export async function obterDashboardPagamentos(filtros = {}) {
  const lista = aplicarFiltros(await listarPagamentosRaw(), filtros);
  const hoje = hojeIso();
  const em7 = somarDias(hoje, 7);
  const abertos = lista.filter((i) => ["aberto", "pendente", "aprovado", "agendado", "parcial"].includes(normalizarStatus(i.status)));
  const vencendoHoje = abertos.filter((i) => dataItem(i) === hoje);
  const vencendo7Dias = abertos.filter((i) => dataItem(i) && dataItem(i) > hoje && dataItem(i) <= em7);
  const emAtraso = abertos.filter((i) => dataItem(i) && dataItem(i) < hoje);
  const pagasPeriodo = lista.filter((i) => normalizarStatus(i.status) === "pago");
  return {
    ok: true,
    data: new Date().toISOString(),
    cards: {
      vencendoHoje: { quantidade: vencendoHoje.length, valor: numeroMoeda(vencendoHoje.reduce((a,i)=>a+calcularSaldo(i),0)) },
      vencendo7Dias: { quantidade: vencendo7Dias.length, valor: numeroMoeda(vencendo7Dias.reduce((a,i)=>a+calcularSaldo(i),0)) },
      emAtraso: { quantidade: emAtraso.length, valor: numeroMoeda(emAtraso.reduce((a,i)=>a+calcularSaldo(i),0)) },
      pagasPeriodo: { quantidade: pagasPeriodo.length, valor: numeroMoeda(pagasPeriodo.reduce((a,i)=>a+valorPago(i),0)) }
    },
    porFornecedor: agrupar(lista, "fornecedor"),
    porCategoria: agrupar(lista, "categoria"),
    porCentroCusto: agrupar(lista, "centroCusto"),
    porPlanoContas: agrupar(lista, "planoContas")
  };
}
