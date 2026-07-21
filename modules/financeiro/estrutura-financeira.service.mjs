import crypto from "node:crypto";
import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { baixarLancamento } from "./financeiro.service.mjs";

const FORMAS_PADRAO = ["Dinheiro", "Cheque", "Boleto", "Cartão", "Depósito", "PIX"];
const PLANO_CONTAS_PADRAO = [
  ["Mensalidade", "receita"], ["Venda de produtos", "receita"], ["Avaliação física", "receita"],
  ["Taxa de matrícula", "receita"], ["Outras receitas", "receita"], ["Funcionários", "despesa"],
  ["Água", "despesa"], ["Energia", "despesa"], ["Aluguel", "despesa"],
  ["Internet", "despesa"], ["Manutenção", "despesa"], ["Material de consumo", "despesa"],
  ["Impostos e taxas", "despesa"], ["Outras despesas", "despesa"]
];

const agora = () => new Date().toISOString();
const id = (prefixo) => `${prefixo}_${crypto.randomUUID()}`;
const numero = (valor) => Number((Number(valor || 0) || 0).toFixed(2));
const texto = (valor) => String(valor ?? "").trim();
const status = (item = {}) => texto(item.status || item.situacao).toLowerCase();
const ativo = (item = {}) => !["cancelado", "cancelada", "excluido", "excluida", "estornado", "estornada"].includes(status(item)) && item.excluido !== true;
const pago = (item = {}) => ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(status(item));
const alunoId = (item = {}) => texto(item.alunoId || item.aluno_id || item.pessoaId);
const matriculaId = (item = {}) => texto(item.matriculaId || item.matricula_id);
const vencimento = (item = {}) => texto(item.vencimento || item.dataVencimento || item.data_vencimento).slice(0, 10);
const valorTitulo = (item = {}) => numero(item.valorOriginal ?? item.valorBruto ?? item.valor ?? item.total);
const valorPago = (item = {}) => numero(item.valorPago ?? item.valorRecebido ?? item.valor_pago);

async function garantirCadastros() {
  let formas = await lerJsonDuravel("formas_pagamento.json", []);
  if (!Array.isArray(formas) || !formas.length) {
    formas = FORMAS_PADRAO.map((nome, indice) => ({ id: `fp_${indice + 1}`, nome, ativo: true, ordem: indice + 1 }));
    await salvarJsonDuravel("formas_pagamento.json", formas);
  }
  let plano = await lerJsonDuravel("plano_contas.json", []);
  if (!Array.isArray(plano) || !plano.length) {
    plano = PLANO_CONTAS_PADRAO.map(([nome, tipo], indice) => ({ id: `pc_${indice + 1}`, codigo: String(indice + 1).padStart(3, "0"), nome, tipo, ativo: true, excluido: false }));
    await salvarJsonDuravel("plano_contas.json", plano);
  }
  return { formas, plano };
}

async function auditar(acao, entidade, entidadeId, detalhes = {}, usuario = "Administrador") {
  const lista = await lerJsonDuravel("auditoria_financeira.json", []);
  lista.unshift({ id: id("audfin"), dataHora: agora(), usuario: texto(usuario) || "Administrador", acao, entidade, entidadeId: texto(entidadeId), detalhes });
  await salvarJsonDuravel("auditoria_financeira.json", lista.slice(0, 20000));
}

export async function obterEstruturaFinanceira() {
  const { formas, plano } = await garantirCadastros();
  return { ok: true, formasPagamento: formas.filter((x) => x.ativo !== false), planoContas: plano.filter(ativo) };
}

export async function salvarPlanoContas(payload = {}) {
  const nome = texto(payload.nome || payload.descricao);
  const tipo = texto(payload.tipo).toLowerCase();
  if (!nome || !["receita", "despesa"].includes(tipo)) {
    const erro = new Error("Informe o nome e o tipo receita ou despesa."); erro.status = 400; throw erro;
  }
  const lista = await lerJsonDuravel("plano_contas.json", []);
  const registro = { id: texto(payload.id) || id("pc"), codigo: texto(payload.codigo) || String(lista.length + 1).padStart(3, "0"), nome, tipo, ativo: payload.ativo !== false, excluido: false, atualizadoEm: agora() };
  const indice = lista.findIndex((x) => String(x.id) === registro.id);
  if (indice >= 0) lista[indice] = { ...lista[indice], ...registro }; else lista.push({ ...registro, criadoEm: agora() });
  await salvarJsonDuravel("plano_contas.json", lista);
  await auditar(indice >= 0 ? "editar_plano_contas" : "criar_plano_contas", "plano_contas", registro.id, registro, payload.usuario);
  return { ok: true, registro };
}

export async function obterExtratoAluno(idAluno) {
  const [alunos, matriculas, financeiro, mensalidades, recebimentos, recibos, creditos] = await Promise.all([
    lerJsonDuravel("alunos.json", []), lerJsonDuravel("matriculas.json", []), lerJsonDuravel("financeiro.json", []),
    lerJsonDuravel("mensalidades.json", []), lerJsonDuravel("recebimentos.json", []), lerJsonDuravel("recibos.json", []), lerJsonDuravel("creditos.json", [])
  ]);
  const aluno = alunos.find((x) => String(x.id) === String(idAluno));
  if (!aluno) { const erro = new Error("Aluno não encontrado."); erro.status = 404; throw erro; }
  const filtrar = (lista) => lista.filter((x) => alunoId(x) === String(idAluno));
  const titulos = filtrar(financeiro).filter((x) => texto(x.tipo).toLowerCase() === "receber");
  const totais = titulos.filter(ativo).reduce((r, x) => {
    const total = valorTitulo(x); const recebido = valorPago(x); const saldo = pago(x) ? 0 : Math.max(0, numero(total - recebido));
    r.cobrado += total; r.recebido += recebido; r.aberto += saldo; if (saldo > 0 && vencimento(x) && vencimento(x) < new Date().toISOString().slice(0, 10)) r.vencido += saldo;
    return r;
  }, { cobrado: 0, recebido: 0, aberto: 0, vencido: 0 });
  Object.keys(totais).forEach((k) => { totais[k] = numero(totais[k]); });
  return { ok: true, aluno, matriculas: filtrar(matriculas), titulos, mensalidades: filtrar(mensalidades), recebimentos: filtrar(recebimentos), recibos: filtrar(recibos), creditos: filtrar(creditos), totais };
}

export async function alterarVencimentoTitulo(idTitulo, payload = {}) {
  const novaData = texto(payload.novoVencimento || payload.vencimento).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) { const erro = new Error("Informe o novo vencimento."); erro.status = 400; throw erro; }
  return executarTransacaoJson(async () => {
    const financeiro = await lerJsonDuravel("financeiro.json", []);
    const indice = financeiro.findIndex((x) => String(x.id) === String(idTitulo));
    if (indice < 0) { const erro = new Error("Título não encontrado."); erro.status = 404; throw erro; }
    if (pago(financeiro[indice]) || !ativo(financeiro[indice])) { const erro = new Error("Somente títulos abertos podem ter o vencimento alterado."); erro.status = 409; throw erro; }
    const anterior = vencimento(financeiro[indice]);
    const valorAnterior = valorTitulo(financeiro[indice]);
    let ajuste = 0;
    if (payload.recalcularDiferenca === true && anterior) {
      const dias = Math.round((new Date(`${novaData}T12:00:00`) - new Date(`${anterior}T12:00:00`)) / 86400000);
      ajuste = numero((valorAnterior / 30) * dias);
    }
    const novoValor = numero(Math.max(0, valorAnterior + ajuste));
    financeiro[indice] = { ...financeiro[indice], vencimento: novaData, dataVencimento: novaData, valor: novoValor, valorBruto: novoValor, ajusteMudancaVencimento: ajuste, atualizadoEm: agora() };
    const mensalidades = await lerJsonDuravel("mensalidades.json", []);
    const mid = texto(financeiro[indice].mensalidadeId);
    const mi = mensalidades.findIndex((x) => (mid && String(x.id) === mid) || String(x.lancamentoFinanceiroId || x.financeiroId) === String(idTitulo));
    if (mi >= 0) mensalidades[mi] = { ...mensalidades[mi], vencimento: novaData, dataVencimento: novaData, valor: novoValor, atualizadoEm: agora() };
    await salvarJsonDuravel("financeiro.json", financeiro);
    await salvarJsonDuravel("mensalidades.json", mensalidades);
    await auditar("alterar_vencimento", "titulo", idTitulo, { anterior, novo: novaData, valorAnterior, novoValor, ajuste, motivo: texto(payload.motivo) }, payload.usuario);
    return { ok: true, titulo: financeiro[indice], diferenca: ajuste };
  });
}

async function receberTitulosInterno(payload = {}) {
  const ids = [...new Set((Array.isArray(payload.titulos) ? payload.titulos : [payload.tituloId]).map(texto).filter(Boolean))];
  if (!ids.length) { const erro = new Error("Selecione pelo menos um título."); erro.status = 400; throw erro; }
  const caixa = await lerJsonDuravel("caixa.json", { caixas: [], movimentos: [] });
  const caixaAberto = caixa.caixas?.find((x) => status(x) === "aberto");
  if (!caixaAberto) { const erro = new Error("Abra o caixa antes de registrar recebimentos."); erro.status = 409; throw erro; }
  const financeiro = await lerJsonDuravel("financeiro.json", []);
  const selecionados = ids.map((codigo) => financeiro.find((x) => String(x.id) === codigo));
  if (selecionados.some((x) => !x)) { const erro = new Error("Um dos títulos selecionados não foi encontrado."); erro.status = 404; throw erro; }
  const resultados = [];
  for (const item of selecionados) {
    if (pago(item) || !ativo(item)) { const erro = new Error(`O título ${item.descricao || item.id} não está aberto.`); erro.status = 409; throw erro; }
    const saldo = Math.max(0, numero(valorTitulo(item) - valorPago(item)));
    resultados.push(await baixarLancamento(item.id, { ...payload, valorPago: saldo, valorRecebido: saldo, valorBaixa: saldo, fluxoRecebimentoUnico: true, emitirReciboIndividual: false }));
  }
  const recibos = await lerJsonDuravel("recibos.json", []);
  const numeroRecibo = String((recibos.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1)).padStart(8, "0");
  const recibo = {
    id: id("rec"), numero: numeroRecibo, data: texto(payload.dataPagamento || payload.dataRecebimento) || new Date().toISOString().slice(0, 10),
    hora: new Date().toTimeString().slice(0, 8), alunoId: alunoId(selecionados[0]), aluno: texto(selecionados[0].alunoFornecedor || selecionados[0].pessoa),
    formaPagamento: texto(payload.formaPagamento) || "Dinheiro", valorCobrado: numero(selecionados.reduce((s, x) => s + valorTitulo(x), 0)),
    valorPago: numero(resultados.reduce((s, x) => s + numero(x.valorBrutoRecebido ?? x.valorPago), 0)), desconto: numero(payload.desconto), acrescimo: numero(payload.acrescimo || payload.juros),
    cancelado: false, caixaId: caixaAberto.id, tituloIds: ids, recebimentoIds: resultados.map((x) => texto(x.recebimento?.id || x.recebimentoId)).filter(Boolean),
    usuario: texto(payload.usuario) || "Administrador", observacao: texto(payload.observacao), criadoEm: agora()
  };
  recibos.unshift(recibo);
  await salvarJsonDuravel("recibos.json", recibos);
  const recebimentos = await lerJsonDuravel("recebimentos.json", []);
  const idsRecebimentos = new Set(recibo.recebimentoIds);
  for (let i = 0; i < recebimentos.length; i += 1) {
    if (idsRecebimentos.has(String(recebimentos[i].id))) recebimentos[i] = { ...recebimentos[i], reciboId: recibo.id, numeroRecibo: recibo.numero, atualizadoEm: agora() };
  }
  await salvarJsonDuravel("recebimentos.json", recebimentos);
  await auditar("emitir_recibo", "recibo", recibo.id, { numero: recibo.numero, tituloIds: ids, valorPago: recibo.valorPago }, payload.usuario);
  return { ok: true, recibo, resultados };
}

export async function receberTitulos(payload = {}) {
  return executarTransacaoJson(() => receberTitulosInterno(payload), { operacaoId: `receber-titulos-${payload.operacaoId || crypto.randomUUID()}` });
}

export async function listarRecibos(filtros = {}) {
  const lista = await lerJsonDuravel("recibos.json", []); const busca = texto(filtros.busca || filtros.q).toLowerCase();
  return { ok: true, recibos: lista.filter((x) => !busca || `${x.numero} ${x.aluno} ${x.formaPagamento}`.toLowerCase().includes(busca)) };
}

export async function listarAuditoriaFinanceira(filtros = {}) {
  const lista = await lerJsonDuravel("auditoria_financeira.json", []); const entidadeId = texto(filtros.entidadeId);
  return { ok: true, auditoria: lista.filter((x) => !entidadeId || String(x.entidadeId) === entidadeId).slice(0, Math.min(1000, Number(filtros.limite) || 200)) };
}
