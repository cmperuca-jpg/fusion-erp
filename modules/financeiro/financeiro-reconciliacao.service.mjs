import { lerJsonDuravel, salvarJsonMultiplosAtomico } from "../core/persistence/durable-json.mjs";
import { persistenciaAtiva, verificarPersistenciaTransacional } from "../core/persistence/collection-store.mjs";

const COL = Object.freeze({
  financeiro: "financeiro.json",
  recebimentos: "recebimentos.json",
  recibos: "recibos.json",
  itens: "recibos_itens.json",
  caixa: "caixa.json",
  auditoria: "auditoria_financeira.json"
});

const agora = () => new Date().toISOString();
const dataISO = (valor) => String(valor || "").slice(0, 10);
const txt = (valor) => String(valor ?? "").trim();
const norm = (valor) => txt(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const moeda = (valor) => Number((Number(String(valor ?? 0).replace(",", ".")) || 0).toFixed(2));
const centavos = (valor) => Math.round(moeda(valor) * 100);
const reais = (valor) => Number((Number(valor || 0) / 100).toFixed(2));

function caixaVazio() {
  return { caixas: [], movimentos: [] };
}

function statusCancelado(item = {}) {
  return ["cancelado", "cancelada", "estornado", "estornada", "excluido", "excluida"].includes(norm(item.status || item.situacao)) || item.cancelado === true || item.excluido === true;
}

function statusPago(item = {}) {
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(norm(item.status || item.situacao));
}

function tipoPagar(item = {}) {
  const alvo = norm([item.tipo, item.natureza, item.modulo, item.origem, item.categoria].filter(Boolean).join(" "));
  return alvo.includes("pagar") || alvo.includes("pagamento") || alvo.includes("despesa") || alvo.includes("fornecedor");
}

function valorPago(item = {}) {
  return moeda(item.valorPago ?? item.valorRecebido ?? item.valorLiquido ?? item.valorBaixado ?? item.valor);
}

function valorTitulo(item = {}) {
  return moeda(item.valor ?? item.valorBruto ?? item.total ?? item.valorOriginal);
}

function garantirLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function caixaIdParaData(caixa, data) {
  const encontrado = caixa.caixas.find((item) => dataISO(item.dataAbertura || item.abertoEm || item.criadoEm) === data);
  return encontrado?.id || `cx_reconc_${String(data || "sem_data").replace(/\D/g, "") || "historico"}`;
}

function garantirCaixaHistorico(caixa, caixaId, data, resumo) {
  const id = txt(caixaId) || caixaIdParaData(caixa, data);
  let registro = caixa.caixas.find((item) => txt(item.id) === id);
  if (registro) return registro;

  registro = {
    id,
    dataAbertura: data || new Date().toISOString().slice(0, 10),
    valorAbertura: 0,
    valorAberturaCentavos: 0,
    responsavel: "Reconciliacao financeira",
    observacaoAbertura: "Caixa historico reconstruido pela reconciliacao financeira.",
    status: "fechado",
    abertoEm: `${data || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    fechadoEm: agora(),
    valorFechamentoInformado: null,
    valorFechamentoInformadoCentavos: null,
    diferenca: null,
    observacaoFechamento: "Registro criado para preservar vinculos historicos de recibos/pagamentos.",
    reconciliado: true,
    criadoEm: agora(),
    atualizadoEm: agora()
  };
  caixa.caixas.push(registro);
  resumo.caixasCriados += 1;
  return registro;
}

function movimentoAtivo(movimento = {}) {
  return !["cancelado", "estornado"].includes(norm(movimento.status));
}

function existeMovimentoRecibo(caixa, reciboId) {
  const id = txt(reciboId);
  if (!id) return false;
  return caixa.movimentos.some((movimento) => movimentoAtivo(movimento) && txt(movimento.reciboId) === id && norm(movimento.tipo).includes("entrada"));
}

function existeMovimentoPagamento(caixa, pagamentoId) {
  const id = txt(pagamentoId);
  if (!id) return false;
  return caixa.movimentos.some((movimento) => {
    if (!movimentoAtivo(movimento)) return false;
    if (!norm(movimento.tipo).includes("saida")) return false;
    return [movimento.lancamentoFinanceiroId, movimento.financeiroId, movimento.pagamentoId, movimento.referenciaId].some((ref) => txt(ref) === id);
  });
}

function existeMovimentoRecebimento(caixa, recebimento = {}) {
  const refs = [
    recebimento.movimentoCaixaId,
    recebimento.reciboId,
    recebimento.ultimoReciboId,
    recebimento.id,
    recebimento.financeiroId,
    recebimento.lancamentoFinanceiroId
  ].map(txt).filter(Boolean);
  if (!refs.length) return false;
  return caixa.movimentos.some((movimento) => {
    if (!movimentoAtivo(movimento)) return false;
    if (!norm(movimento.tipo).includes("entrada")) return false;
    const movimentoRefs = [
      movimento.id,
      movimento.movimentoCaixaId,
      movimento.reciboId,
      movimento.recebimentoId,
      movimento.lancamentoFinanceiroId,
      movimento.financeiroId,
      movimento.referenciaId,
      movimento.mensalidadeId
    ].map(txt).filter(Boolean);
    return refs.some((ref) => movimentoRefs.includes(ref));
  });
}

function categoriaDoRecibo(recibo, itens, titulos) {
  const relacionados = itens.filter((item) => txt(item.reciboId) === txt(recibo.id));
  const categorias = new Set();
  for (const item of relacionados) {
    const titulo = titulos.find((lancamento) => txt(lancamento.id) === txt(item.tituloId));
    if (titulo?.categoria) categorias.add(titulo.categoria);
  }
  return categorias.size === 1 ? [...categorias][0] : "Recebimentos";
}

function tituloUnicoDoRecibo(recibo, itens, titulos) {
  const relacionados = itens.filter((item) => txt(item.reciboId) === txt(recibo.id));
  if (relacionados.length !== 1) return {};
  return titulos.find((lancamento) => txt(lancamento.id) === txt(relacionados[0].tituloId)) || {};
}

function taxaForma(forma = {}, recibo = {}, totalFormas = 1) {
  if (forma.taxa !== undefined || forma.taxaOperadoraValor !== undefined || forma.taxaValor !== undefined) {
    return moeda(forma.taxa ?? forma.taxaOperadoraValor ?? forma.taxaValor);
  }
  const totalTaxa = moeda(recibo.taxaOperadoraValor ?? recibo.taxaValor ?? recibo.taxa ?? 0);
  return totalFormas > 0 ? moeda(totalTaxa / totalFormas) : totalTaxa;
}

function movimentoDeRecibo(recibo, forma, indice, caixaId, categoria, titulo) {
  const bruto = moeda(forma.valor ?? forma.valorPago ?? recibo.valorPago);
  const taxa = Math.min(bruto, taxaForma(forma, recibo, recibo.formasPagamento?.length || 1));
  const liquido = moeda(bruto - taxa);
  return {
    id: `mov_rec_reconc_${txt(recibo.id).replace(/[^a-zA-Z0-9_-]/g, "")}_${indice + 1}`,
    caixaId,
    tipo: "entrada",
    descricao: `Recibo ${recibo.numero || recibo.id} - ${recibo.aluno || "Cliente"}`,
    categoria,
    pessoa: recibo.aluno || titulo.alunoFornecedor || titulo.pessoa || "",
    alunoId: recibo.alunoId || titulo.alunoId || "",
    reciboId: recibo.id,
    lancamentoFinanceiroId: titulo.id || "",
    mensalidadeId: titulo.mensalidadeId || "",
    matriculaId: titulo.matriculaId || "",
    formaPagamento: forma.formaPagamento || forma.forma || recibo.formaPagamento || "Dinheiro",
    bandeiraCartao: forma.bandeiraCartao || "",
    modalidadeCartao: forma.modalidadeCartao || "",
    parcelasCartao: forma.parcelasCartao || "",
    valor: bruto,
    valorCentavos: centavos(bruto),
    valorBruto: bruto,
    taxaOperadoraValor: taxa,
    taxaCentavos: centavos(taxa),
    valorLiquido: liquido,
    valorLiquidoCentavos: centavos(liquido),
    data: dataISO(recibo.data || recibo.criadoEm),
    status: "ativo",
    origem: "recibo",
    reconciliado: true,
    observacao: "Movimento reconstruido a partir de recibo historico.",
    criadoEm: agora(),
    atualizadoEm: agora()
  };
}

function movimentoDePagamento(lancamento, caixaId) {
  const valor = valorPago(lancamento) || valorTitulo(lancamento);
  return {
    id: `mov_pag_reconc_${txt(lancamento.id).replace(/[^a-zA-Z0-9_-]/g, "")}`,
    caixaId,
    tipo: "saida",
    origem: "pagamentos",
    referenciaId: lancamento.id,
    lancamentoFinanceiroId: lancamento.id,
    descricao: lancamento.descricao || "Pagamento",
    categoria: lancamento.categoria || "Pagamentos",
    pessoa: lancamento.alunoFornecedor || lancamento.pessoa || lancamento.pessoaFornecedor || lancamento.fornecedor || "",
    formaPagamento: lancamento.formaPagamento || lancamento.forma || "Dinheiro",
    valor,
    valorCentavos: centavos(valor),
    valorBruto: valor,
    valorLiquido: valor,
    data: dataISO(lancamento.dataPagamento || lancamento.pagamento || lancamento.vencimento || lancamento.atualizadoEm),
    status: "ativo",
    reconciliado: true,
    observacao: "Saida reconstruida a partir de conta a pagar baixada.",
    criadoEm: agora(),
    atualizadoEm: agora()
  };
}

function dataRecebimento(item = {}) {
  return dataISO(item.dataPagamento || item.pagamento || item.dataBaixa || item.recebidoEm || item.pagoEm || item.atualizadoEm || item.criadoEm || item.vencimento || item.dataVencimento || item.data);
}

function tituloDoRecebimento(recebimento, titulos) {
  const refs = [
    recebimento.financeiroId,
    recebimento.lancamentoFinanceiroId,
    recebimento.tituloId,
    recebimento.contaReceberId
  ].map(txt).filter(Boolean);
  const porId = titulos.find((lancamento) => refs.includes(txt(lancamento.id)));
  if (porId) return porId;
  const reciboId = txt(recebimento.reciboId || recebimento.ultimoReciboId);
  if (reciboId) {
    const porRecibo = titulos.find((lancamento) => txt(lancamento.reciboId || lancamento.ultimoReciboId) === reciboId);
    if (porRecibo) return porRecibo;
  }
  const mensalidadeId = txt(recebimento.mensalidadeId);
  if (mensalidadeId) return titulos.find((lancamento) => txt(lancamento.mensalidadeId) === mensalidadeId) || {};
  return {};
}

function movimentoDeRecebimento(recebimento, caixaId, titulo = {}) {
  const bruto = valorPago(recebimento) || valorTitulo(recebimento);
  const taxa = Math.min(bruto, moeda(recebimento.ultimaTaxaOperadoraValor ?? recebimento.taxaOperadoraValor ?? recebimento.taxaValor ?? recebimento.taxa ?? 0));
  const liquido = moeda(bruto - taxa);
  const baseId = txt(recebimento.reciboId || recebimento.ultimoReciboId || recebimento.id).replace(/[^a-zA-Z0-9_-]/g, "");
  return {
    id: `mov_rec_reconc_${baseId || Date.now()}_recebimento`,
    caixaId,
    tipo: "entrada",
    descricao: `Recebimento ${recebimento.reciboNumero || recebimento.numeroRecibo || recebimento.reciboId || recebimento.id}`,
    categoria: recebimento.categoria || titulo.categoria || "Recebimentos",
    pessoa: recebimento.aluno || recebimento.alunoNome || recebimento.pessoa || titulo.alunoFornecedor || titulo.pessoa || "",
    alunoId: recebimento.alunoId || titulo.alunoId || "",
    reciboId: recebimento.reciboId || recebimento.ultimoReciboId || "",
    recebimentoId: recebimento.id || "",
    lancamentoFinanceiroId: titulo.id || recebimento.financeiroId || recebimento.lancamentoFinanceiroId || "",
    mensalidadeId: recebimento.mensalidadeId || titulo.mensalidadeId || "",
    matriculaId: recebimento.matriculaId || titulo.matriculaId || "",
    formaPagamento: recebimento.formaPagamento || recebimento.forma || titulo.formaPagamento || "Dinheiro",
    bandeiraCartao: recebimento.bandeiraCartao || "",
    modalidadeCartao: recebimento.modalidadeCartao || "",
    parcelasCartao: recebimento.parcelasCartao || "",
    valor: bruto,
    valorCentavos: centavos(bruto),
    valorBruto: bruto,
    taxaOperadoraValor: taxa,
    taxaCentavos: centavos(taxa),
    valorLiquido: liquido,
    valorLiquidoCentavos: centavos(liquido),
    data: dataRecebimento(recebimento) || new Date().toISOString().slice(0, 10),
    status: "ativo",
    origem: "recebimento",
    reconciliado: true,
    observacao: "Movimento reconstruido a partir de recebimento confirmado.",
    criadoEm: agora(),
    atualizadoEm: agora()
  };
}

function vincularMovimento(registros, predicado, movimento) {
  for (let i = 0; i < registros.length; i += 1) {
    if (!predicado(registros[i])) continue;
    registros[i] = {
      ...registros[i],
      caixaId: registros[i].caixaId || movimento.caixaId,
      movimentoCaixaId: registros[i].movimentoCaixaId || movimento.id,
      atualizadoEm: agora()
    };
  }
}

async function garantirPersistenciaSupabase(exigirSupabase) {
  if (!exigirSupabase) return { ok: true, provider: persistenciaAtiva() };
  const status = await verificarPersistenciaTransacional();
  if (status.provider !== "supabase") {
    throw new Error("Reconciliação financeira exige Supabase. Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e FUSION_DATABASE_PROVIDER=supabase.");
  }
  return status;
}

export async function reconciliarFinanceiroCaixa({ aplicar = false, usuario = "sistema", exigirSupabase = true } = {}) {
  const persistencia = await garantirPersistenciaSupabase(exigirSupabase);
  const [recibos, itens, financeiro, recebimentos, caixaRaw, auditoriaRaw] = await Promise.all([
    lerJsonDuravel(COL.recibos, []),
    lerJsonDuravel(COL.itens, []),
    lerJsonDuravel(COL.financeiro, []),
    lerJsonDuravel(COL.recebimentos, []),
    lerJsonDuravel(COL.caixa, caixaVazio()),
    lerJsonDuravel(COL.auditoria, [])
  ]);

  const caixa = Array.isArray(caixaRaw) ? caixaVazio() : {
    caixas: garantirLista(caixaRaw.caixas),
    movimentos: garantirLista(caixaRaw.movimentos)
  };
  const listaRecibos = garantirLista(recibos);
  const listaItens = garantirLista(itens);
  const listaFinanceiro = garantirLista(financeiro);
  const listaRecebimentos = garantirLista(recebimentos);
  const auditoria = garantirLista(auditoriaRaw);
  const resumo = {
    ok: true,
    modo: aplicar ? "aplicado" : "simulacao",
    provider: persistencia.provider,
    tenantId: persistencia.tenantId || "",
    tabela: persistencia.tabela || "",
    caixasCriados: 0,
    entradasCriadas: 0,
    saidasCriadas: 0,
    recebimentosVinculados: 0,
    financeiroVinculado: 0
  };

  for (const recibo of listaRecibos.filter((item) => !statusCancelado(item))) {
    if (existeMovimentoRecibo(caixa, recibo.id)) continue;
    const data = dataISO(recibo.data || recibo.criadoEm) || new Date().toISOString().slice(0, 10);
    const caixaRegistro = garantirCaixaHistorico(caixa, recibo.caixaId, data, resumo);
    const titulo = tituloUnicoDoRecibo(recibo, listaItens, listaFinanceiro);
    const categoria = categoriaDoRecibo(recibo, listaItens, listaFinanceiro);
    const formas = Array.isArray(recibo.formasPagamento) && recibo.formasPagamento.length
      ? recibo.formasPagamento
      : [{ formaPagamento: recibo.formaPagamento || "Dinheiro", valor: recibo.valorPago || recibo.valorAplicado || 0 }];

    const movimentosCriados = formas.map((forma, indice) => movimentoDeRecibo(recibo, forma, indice, caixaRegistro.id, categoria, titulo));
    caixa.movimentos.push(...movimentosCriados);
    resumo.entradasCriadas += movimentosCriados.length;
    const primeiro = movimentosCriados[0];
    vincularMovimento(listaRecebimentos, (item) => txt(item.reciboId || item.ultimoReciboId) === txt(recibo.id), primeiro);
    vincularMovimento(listaFinanceiro, (item) => txt(item.ultimoReciboId || item.reciboId) === txt(recibo.id), primeiro);
    resumo.recebimentosVinculados += listaRecebimentos.filter((item) => txt(item.reciboId || item.ultimoReciboId) === txt(recibo.id)).length;
    resumo.financeiroVinculado += listaFinanceiro.filter((item) => txt(item.ultimoReciboId || item.reciboId) === txt(recibo.id)).length;
  }

  for (const recebimento of listaRecebimentos.filter((item) => statusPago(item) && !statusCancelado(item))) {
    if (existeMovimentoRecebimento(caixa, recebimento)) continue;
    const data = dataRecebimento(recebimento) || new Date().toISOString().slice(0, 10);
    const titulo = tituloDoRecebimento(recebimento, listaFinanceiro);
    const caixaRegistro = garantirCaixaHistorico(caixa, recebimento.caixaId || titulo.caixaId, data, resumo);
    const movimento = movimentoDeRecebimento(recebimento, caixaRegistro.id, titulo);
    caixa.movimentos.push(movimento);
    resumo.entradasCriadas += 1;
    vincularMovimento(listaRecebimentos, (item) => txt(item.id) === txt(recebimento.id), movimento);
    vincularMovimento(listaFinanceiro, (item) => txt(item.id) === txt(titulo.id), movimento);
    resumo.recebimentosVinculados += 1;
    if (titulo.id) resumo.financeiroVinculado += 1;
  }

  for (const lancamento of listaFinanceiro.filter((item) => tipoPagar(item) && statusPago(item) && !statusCancelado(item))) {
    if (existeMovimentoPagamento(caixa, lancamento.id)) continue;
    const data = dataISO(lancamento.dataPagamento || lancamento.pagamento || lancamento.vencimento || lancamento.atualizadoEm) || new Date().toISOString().slice(0, 10);
    const caixaRegistro = garantirCaixaHistorico(caixa, lancamento.caixaId, data, resumo);
    const movimento = movimentoDePagamento(lancamento, caixaRegistro.id);
    caixa.movimentos.push(movimento);
    resumo.saidasCriadas += 1;
    vincularMovimento(listaFinanceiro, (item) => txt(item.id) === txt(lancamento.id), movimento);
    resumo.financeiroVinculado += 1;
  }

  if (aplicar && (resumo.caixasCriados || resumo.entradasCriadas || resumo.saidasCriadas || resumo.recebimentosVinculados || resumo.financeiroVinculado)) {
    auditoria.unshift({
      id: `aud_reconc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      dataHora: agora(),
      usuario,
      acao: "reconciliar_financeiro_caixa",
      entidade: "caixa",
      entidadeId: "historico",
      detalhes: resumo
    });
    await salvarJsonMultiplosAtomico({
      [COL.caixa]: caixa,
      [COL.financeiro]: listaFinanceiro,
      [COL.recebimentos]: listaRecebimentos,
      [COL.auditoria]: auditoria.slice(0, 50000)
    });
  }

  return resumo;
}
