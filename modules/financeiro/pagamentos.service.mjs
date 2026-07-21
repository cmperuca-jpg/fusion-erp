import {
  atualizarPagamentoRaw,
  atualizarPagamentoComMovimentoCaixa,
  inserirPagamentoRaw,
  listarPagamentosRaw,
  lerDb,
  salvarDb
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
function hojeIso() { return new Date().toISOString().slice(0, 10); }
function idItem(item = {}) { return String(item.id || item._id || item.codigo || item.uuid || item.chave || ""); }

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
  const validacao = validarCriacao(payload);
  if (!validacao.ok) {
    const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
    erro.status = 400;
    throw erro;
  }
  return inserirPagamentoRaw(validacao.pagamento);
}

export async function editarPagamento(id, payload = {}) {
  return atualizarPagamentoRaw(id, (item) => {
    const validacao = validarEdicao(payload, item);
    if (!validacao.ok) {
      const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }
    return { ...validacao.pagamento, id: idItem(item), updatedAt: new Date().toISOString() };
  });
}

export async function excluirPagamento(id) {
  const pagamento = await cancelarPagamento(id, "Cancelamento solicitado pela exclusão legada.");
  return { id: String(id), removido: false, cancelado: true, pagamento };
}

export async function baixarPagamento(id, payload = {}) {
  const valorBaixa = numeroMoeda(payload.valor || payload.valorPago || payload.total);
  if (!(valorBaixa > 0)) {
    const erro = new Error("Informe um valor maior que zero.");
    erro.status = 400;
    throw erro;
  }

  const operacaoId = String(payload.operacaoId || payload.idempotencyKey || `baixa-pagamento-${id}-${Date.now()}`);
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
      id: `mov_pag_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
      tipo: "baixa_pagamento",
      data: new Date().toISOString(),
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

  return { ...resultado.pagamento, movimentoCaixa: resultado.movimento };
}

export async function estornarPagamento(id, motivo = "") {
  const operacaoId = `estorno-pagamento-${id}-${Date.now()}`;
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
    const movimento = { id: `est_pag_${Date.now()}`, tipo: "estorno", data: new Date().toISOString(), valor: pago, observacao: motivo || "Estorno de pagamento" };
    return { ...atual, valorPago: 0, valorLiquido: 0, valorRestante: valorTotal(atual), status: "aberto", estornadoEm: movimento.data, motivoEstorno: motivo || "Estorno de pagamento", historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], updatedAt: new Date().toISOString() };
  }, (atualizado) => ({
    id: `cx_${operacaoId}`,
    tipo: "entrada",
    origem: "estorno_pagamentos",
    referenciaId: id,
    descricao: `Estorno: ${atualizado.descricao || "Pagamento"}`,
    valor: valorEstornado,
    formaPagamento: atualizado.formaPagamento || atualizado.forma || "",
    data: new Date().toISOString(),
    observacao: motivo || "Estorno de conta a pagar"
  }), operacaoId);
  return { ...resultado.pagamento, movimentoCaixa: resultado.movimento };
}

export async function cancelarPagamento(id, motivo = "") {
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (valorPago(atual) > 0 || ["pago", "parcial"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento com baixa não pode ser cancelado. Faça o estorno primeiro.");
      erro.status = 409;
      throw erro;
    }
    const movimento = { id: `can_pag_${Date.now()}`, tipo: "cancelamento", data: new Date().toISOString(), valor: 0, observacao: motivo || "Cancelamento de pagamento" };
    return { ...atual, status: "cancelado", historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], updatedAt: new Date().toISOString() };
  });
}

export async function duplicarPagamento(id, payload = {}) {
  const original = await obterPagamento(id);
  const novo = montarPagamento({
    ...original,
    ...payload,
    id: gerarIdPagamento(),
    documento: payload.documento ?? `${original.documento || "DOC"}-COPIA`,
    vencimento: payload.vencimento || original.vencimento,
    dataVencimento: payload.dataVencimento || payload.vencimento || original.dataVencimento,
    valorPago: 0,
    valorLiquido: 0,
    valorRestante: payload.valor || original.valor,
    status: "aberto",
    historico: [{ id: `dup_pag_${Date.now()}`, tipo: "duplicacao", origemId: id, data: new Date().toISOString(), observacao: payload.observacao || "Duplicado pelo módulo de pagamentos" }]
  });
  return inserirPagamentoRaw(novo);
}

export async function parcelarPagamento(payload = {}) {
  const total = numeroMoeda(payload.valor || payload.valorBruto || payload.total);
  const parcelas = Math.max(1, Math.min(60, Number.parseInt(payload.parcelas || 1, 10)));
  const intervaloDias = Math.max(1, Number.parseInt(payload.intervaloDias || 30, 10));
  const base = { ...payload, valor: numeroMoeda(total / parcelas), valorBruto: numeroMoeda(total / parcelas), valorPago: 0, valorLiquido: 0, status: "aberto" };
  const criados = [];
  for (let i = 1; i <= parcelas; i++) {
    const vencimento = somarDias(payload.vencimento || payload.dataVencimento || hojeIso(), intervaloDias * (i - 1));
    const validacao = validarCriacao({
      ...base,
      id: gerarIdPagamento(),
      descricao: `${payload.descricao || "Pagamento parcelado"} (${i}/${parcelas})`,
      documento: payload.documento ? `${payload.documento}-${String(i).padStart(2, "0")}` : "",
      vencimento,
      dataVencimento: vencimento,
      valor: i === parcelas ? numeroMoeda(total - (numeroMoeda(total / parcelas) * (parcelas - 1))) : numeroMoeda(total / parcelas),
      valorBruto: i === parcelas ? numeroMoeda(total - (numeroMoeda(total / parcelas) * (parcelas - 1))) : numeroMoeda(total / parcelas),
      grupoParcelamento: payload.grupoParcelamento || `grp_pag_${Date.now()}`,
      parcela: i,
      parcelas
    });
    if (!validacao.ok) {
      const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }
    criados.push(await inserirPagamentoRaw(validacao.pagamento));
  }
  return criados;
}


export async function obterHistoricoPagamento(id) {
  const pagamento = await obterPagamento(id);
  return Array.isArray(pagamento.historico) ? pagamento.historico : [];
}

export async function baixarPagamentosEmLote(payload = {}) {
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
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
        observacao: payload.observacao || "Baixa em lote"
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
  const fechamento = {
    id: `fec_pag_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    modulo: "pagamentos",
    inicio,
    fim,
    data: new Date().toISOString(),
    observacao: payload.observacao || "Fechamento de contas a pagar",
    resumo
  };
  const { db, filePath } = await lerDb();
  if (!Array.isArray(db.fechamentosFinanceiros)) db.fechamentosFinanceiros = [];
  db.fechamentosFinanceiros.push(fechamento);
  await salvarDb(db, filePath);
  return fechamento;
}


function usuarioOperacao(payload = {}) {
  return String(payload.usuario || payload.user || payload.operador || payload.responsavel || "sistema").trim() || "sistema";
}

function registrarAuditoriaLocal(item = {}, acao, payload = {}) {
  const registro = {
    id: `aud_pag_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    acao,
    usuario: usuarioOperacao(payload),
    data: new Date().toISOString(),
    observacao: payload.observacao || payload.motivo || ""
  };
  return [...(Array.isArray(item.auditoria) ? item.auditoria : []), registro];
}

export async function aprovarPagamento(id, payload = {}) {
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (["pago", "cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento pago, cancelado ou estornado não pode ser aprovado.");
      erro.status = 400;
      throw erro;
    }
    const movimento = { id: `apr_pag_${Date.now()}`, tipo: "aprovacao", data: new Date().toISOString(), usuario: usuarioOperacao(payload), observacao: payload.observacao || "Pagamento aprovado" };
    return { ...atual, status: "aprovado", aprovadoPor: usuarioOperacao(payload), aprovadoEm: movimento.data, historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "aprovar", payload), updatedAt: new Date().toISOString() };
  });
}

export async function reprovarPagamento(id, payload = {}) {
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (["pago", "cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento pago, cancelado ou estornado não pode ser reprovado.");
      erro.status = 400;
      throw erro;
    }
    const movimento = { id: `rep_pag_${Date.now()}`, tipo: "reprovacao", data: new Date().toISOString(), usuario: usuarioOperacao(payload), observacao: payload.motivo || payload.observacao || "Pagamento reprovado" };
    return { ...atual, status: "reprovado", historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "reprovar", payload), updatedAt: new Date().toISOString() };
  });
}

export async function agendarPagamento(id, payload = {}) {
  const data = somenteData(payload.data || payload.agendadoPara || payload.dataAgendamento || "");
  if (!data) {
    const erro = new Error("Informe a data do agendamento.");
    erro.status = 400;
    throw erro;
  }
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    if (["pago", "cancelado", "estornado"].includes(normalizarStatus(atual.status))) {
      const erro = new Error("Pagamento pago, cancelado ou estornado não pode ser agendado.");
      erro.status = 400;
      throw erro;
    }
    const movimento = { id: `age_pag_${Date.now()}`, tipo: "agendamento", data: new Date().toISOString(), agendadoPara: data, usuario: usuarioOperacao(payload), observacao: payload.observacao || "Pagamento agendado" };
    return { ...atual, status: "agendado", agendadoPara: data, historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "agendar", payload), updatedAt: new Date().toISOString() };
  });
}

export async function anexarComprovantePagamento(id, payload = {}) {
  const nome = String(payload.nome || payload.filename || payload.arquivo || "").trim();
  const url = String(payload.url || payload.path || payload.caminho || payload.base64 || "").trim();
  if (!nome && !url) {
    const erro = new Error("Informe nome ou URL/base64 do comprovante.");
    erro.status = 400;
    throw erro;
  }
  return atualizarPagamentoRaw(id, (item) => {
    const atual = montarPagamento(item);
    const comprovante = { id: `comp_pag_${Date.now()}_${Math.floor(Math.random()*999999)}`, nome: nome || "comprovante", url, tipo: payload.tipo || "comprovante", criadoEm: new Date().toISOString(), usuario: usuarioOperacao(payload) };
    const movimento = { id: `his_comp_pag_${Date.now()}`, tipo: "comprovante", data: new Date().toISOString(), comprovanteId: comprovante.id, observacao: payload.observacao || "Comprovante anexado" };
    return { ...atual, comprovantes: [...(Array.isArray(atual.comprovantes) ? atual.comprovantes : []), comprovante], historico: [...(Array.isArray(atual.historico) ? atual.historico : []), movimento], auditoria: registrarAuditoriaLocal(atual, "anexar_comprovante", payload), updatedAt: new Date().toISOString() };
  });
}

function proximoVencimento(dataIso, frequencia) {
  const d = new Date(`${somenteData(dataIso)}T12:00:00`);
  const f = String(frequencia || "mensal").toLowerCase();
  if (f === "semanal") d.setDate(d.getDate() + 7);
  else if (f === "anual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0,10);
}

export async function criarPagamentosRecorrentes(payload = {}) {
  const repeticoes = Math.max(1, Math.min(120, Number.parseInt(payload.repeticoes || payload.quantidade || 12, 10)));
  const frequencia = String(payload.frequencia || payload.recorrencia || "mensal").toLowerCase();
  let vencimento = somenteData(payload.vencimento || payload.dataVencimento || hojeIso());
  const grupo = payload.grupoRecorrencia || `rec_pag_${Date.now()}`;
  const criados = [];
  for (let i=1; i<=repeticoes; i++) {
    const validacao = validarCriacao({ ...payload, id: gerarIdPagamento(), vencimento, dataVencimento: vencimento, descricao: `${payload.descricao || "Pagamento recorrente"} (${i}/${repeticoes})`, status: payload.status || "pendente", recorrencia: { grupo, frequencia, parcela: i, total: repeticoes } });
    if (!validacao.ok) {
      const erro = new Error(`Campos obrigatórios: ${validacao.erros.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }
    criados.push(await inserirPagamentoRaw({ ...validacao.pagamento, auditoria: registrarAuditoriaLocal(validacao.pagamento, "criar_recorrencia", payload) }));
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
