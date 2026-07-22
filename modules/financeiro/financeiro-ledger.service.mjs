import crypto from "node:crypto";
import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel, salvarJsonMultiplosAtomico } from "../core/persistence/durable-json.mjs";

const COL = Object.freeze({
  alunos: "alunos.json", matriculas: "matriculas.json", titulos: "financeiro.json",
  mensalidades: "mensalidades.json", recebimentos: "recebimentos.json", caixa: "caixa.json",
  recibos: "recibos.json", itens: "recibos_itens.json", formas: "formas_pagamento.json",
  plano: "plano_contas.json", auditoria: "auditoria_financeira.json", creditos: "creditos.json",
  taxasCartao: "taxas_cartao.json",
  checkins: "checkin.json",
  pagamentosLegacy: "pagamentos.json", dbLegacy: "db.json"
});

const FORMAS = ["Dinheiro", "Cheque", "Boleto", "Cartão de crédito", "Cartão de débito", "Depósito", "Transferência", "PIX"];
const CONTAS = [
  ["1.01", "Mensalidades", "receita"], ["1.02", "Taxa de matrícula", "receita"],
  ["1.03", "Avaliação física", "receita"], ["1.04", "Venda de produtos", "receita"],
  ["1.99", "Outras receitas", "receita"], ["2.01", "Funcionários", "despesa"],
  ["2.02", "Água", "despesa"], ["2.03", "Energia", "despesa"], ["2.04", "Aluguel", "despesa"],
  ["2.05", "Internet", "despesa"], ["2.06", "Manutenção", "despesa"],
  ["2.07", "Material de consumo", "despesa"], ["2.08", "Impostos e taxas", "despesa"],
  ["2.99", "Outras despesas", "despesa"]
];

const agora = () => new Date().toISOString();
const hoje = () => agora().slice(0, 10);
const uid = (prefixo) => `${prefixo}_${crypto.randomUUID()}`;
const txt = (valor) => String(valor ?? "").trim();
const norm = (valor) => txt(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const moeda = (valor) => Number((Number(String(valor ?? 0).replace(",", ".")) || 0).toFixed(2));
const centavos = (valor) => Math.round(moeda(valor) * 100);
const reais = (valor) => Number((Number(valor || 0) / 100).toFixed(2));
const idAluno = (x = {}) => txt(x.alunoId || x.aluno_id || (norm(x.pessoaTipo) === "aluno" ? x.pessoaId : ""));
const idMatricula = (x = {}) => txt(x.matriculaId || x.matricula_id);
const status = (x = {}) => norm(x.status || x.situacao || "aberto");
const finalizado = (x = {}) => ["cancelado", "cancelada", "estornado", "estornada", "excluido", "excluida"].includes(status(x)) || x.excluido === true;
const quitado = (x = {}) => ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(status(x));
const tipoTitulo = (x = {}) => norm(x.tipo).includes("pagar") || norm(x.tipo).includes("despesa") ? "pagar" : "receber";
const valorTituloC = (x = {}) => Number.isInteger(x.valorCentavos) ? x.valorCentavos : centavos(x.valorOriginal ?? x.valorBruto ?? x.valor ?? x.total);
const valorPagoC = (x = {}) => Number.isInteger(x.valorPagoCentavos) ? x.valorPagoCentavos : centavos(x.valorPago ?? x.valorRecebido ?? x.valor_pago);
const saldoC = (x = {}) => finalizado(x) || quitado(x) ? 0 : Math.max(0, valorTituloC(x) - valorPagoC(x));
const dataVencimento = (x = {}) => txt(x.vencimento || x.dataVencimento || x.data_vencimento).slice(0, 10);

function erro(mensagem, codigo = 400) { const e = new Error(mensagem); e.status = codigo; return e; }
function caixaVazio() { return { caixas: [], movimentos: [] }; }
function caixaAberto(base = {}) { return (base.caixas || []).find((x) => status(x) === "aberto") || null; }
function mesmo(a, b) { return txt(a) && txt(a) === txt(b); }

function campoInformado(objeto = {}, campo = "") {
  return Object.prototype.hasOwnProperty.call(objeto, campo) && objeto[campo] !== null && txt(objeto[campo]) !== "";
}

function modalidadePagamento(forma = "", modalidade = "") {
  const informada = norm(modalidade);
  if (informada) return informada;
  const f = norm(forma);
  if (f.includes("debito")) return "debito";
  if (f.includes("credito") || f.includes("cartao")) return "credito";
  if (f.includes("pix")) return "pix";
  if (f.includes("boleto")) return "boleto";
  return "";
}

function pagamentoComCartao(forma = "") {
  const f = norm(forma);
  return f.includes("cartao") || f.includes("credito") || f.includes("debito");
}

function localizarTaxaConfigurada(taxas = [], meio = {}) {
  const modalidade = modalidadePagamento(meio.formaPagamento || meio.forma, meio.modalidadeCartao || meio.modalidade);
  const parcelas = Math.max(1, Number(meio.parcelasCartao || meio.parcelas || 1));
  const bandeira = norm(meio.bandeiraCartao || meio.bandeira);
  let candidatas = (Array.isArray(taxas) ? taxas : []).filter((taxa) => {
    return norm(taxa.modalidade || "credito") === modalidade && Math.max(1, Number(taxa.parcelas || 1)) === parcelas;
  });
  if (bandeira) candidatas = candidatas.filter((taxa) => norm(taxa.bandeira) === bandeira);
  return candidatas.length === 1 ? candidatas[0] : null;
}

function normalizarMeioComTaxa(meioEntrada = {}, dadosGerais = {}, taxas = {}) {
  const meio = { ...meioEntrada };
  const formaPagamento = txt(meio.formaPagamento || meio.forma || dadosGerais.formaPagamento || dadosGerais.forma) || "Dinheiro";
  const valorCentavos = centavos(meio.valor ?? dadosGerais.valorEntregue ?? dadosGerais.valorPago ?? 0);
  const bandeiraCartao = txt(meio.bandeiraCartao || meio.bandeira || dadosGerais.bandeiraCartao || dadosGerais.bandeira);
  const modalidadeCartao = modalidadePagamento(
    formaPagamento,
    meio.modalidadeCartao || meio.modalidade || dadosGerais.modalidadeCartao || dadosGerais.modalidade
  );
  const parcelasCartao = Math.max(1, Number(meio.parcelasCartao || meio.parcelas || dadosGerais.parcelasCartao || dadosGerais.parcelas || 1));
  const taxaConfigurada = localizarTaxaConfigurada(taxas, { formaPagamento, bandeiraCartao, modalidadeCartao, parcelasCartao });

  const valorTaxaInformado = campoInformado(meio, "taxa") || campoInformado(meio, "taxaOperadoraValor") || campoInformado(meio, "taxaValor") ||
    campoInformado(dadosGerais, "taxaOperadoraValor") || campoInformado(dadosGerais, "taxaValor");

  const percentual = moeda(
    meio.taxaOperadoraPercentual ?? meio.taxaPercentual ?? dadosGerais.taxaOperadoraPercentual ??
    dadosGerais.taxaPercentual ?? taxaConfigurada?.percentual ?? 0
  );
  const taxaFixa = moeda(
    meio.taxaOperadoraFixa ?? meio.taxaFixa ?? dadosGerais.taxaOperadoraFixa ??
    dadosGerais.taxaFixa ?? taxaConfigurada?.taxaFixa ?? 0
  );

  let taxaCentavos = valorTaxaInformado
    ? centavos(meio.taxa ?? meio.taxaOperadoraValor ?? meio.taxaValor ?? dadosGerais.taxaOperadoraValor ?? dadosGerais.taxaValor)
    : Math.round((valorCentavos * percentual / 100) + centavos(taxaFixa));

  // Uma tela antiga pode enviar taxa zero mesmo havendo configuração válida.
  // Nesse caso o servidor é a autoridade e refaz o cálculo no momento da baixa.
  if (taxaCentavos <= 0 && taxaConfigurada) {
    const percentualConfigurado = moeda(taxaConfigurada.percentual || 0);
    const fixaConfigurada = moeda(taxaConfigurada.taxaFixa || 0);
    taxaCentavos = Math.round((valorCentavos * percentualConfigurado / 100) + centavos(fixaConfigurada));
  }

  if (pagamentoComCartao(formaPagamento) && taxaCentavos <= 0 && !taxaConfigurada && percentual <= 0 && taxaFixa <= 0) {
    throw erro(`Não foi possível calcular a taxa do cartão ${bandeiraCartao || "sem bandeira"} (${modalidadeCartao || "modalidade não informada"}, ${parcelasCartao}x). Confira as taxas de recebimento antes de confirmar.`);
  }

  taxaCentavos = Math.max(0, Math.min(valorCentavos, taxaCentavos));
  return {
    ...meio,
    formaPagamento,
    valorCentavos,
    valor: reais(valorCentavos),
    bandeiraCartao: bandeiraCartao || txt(taxaConfigurada?.bandeira),
    modalidadeCartao,
    parcelasCartao,
    taxaOperadoraPercentual: percentual || moeda(taxaConfigurada?.percentual || 0),
    taxaOperadoraFixa: taxaFixa || moeda(taxaConfigurada?.taxaFixa || 0),
    taxaCentavos,
    taxa: reais(taxaCentavos),
    taxaOperadoraValor: reais(taxaCentavos),
    valorLiquidoCentavos: valorCentavos - taxaCentavos,
    valorLiquido: reais(valorCentavos - taxaCentavos)
  };
}

function distribuirCentavos(total = 0, bases = []) {
  const totalInteiro = Math.max(0, Math.round(Number(total) || 0));
  const pesos = bases.map((base) => Math.max(0, Math.round(Number(base) || 0)));
  const soma = pesos.reduce((acc, valor) => acc + valor, 0);
  if (!totalInteiro || !soma) return pesos.map(() => 0);
  const partes = pesos.map((peso, indice) => {
    const exato = totalInteiro * peso / soma;
    return { indice, valor: Math.floor(exato), resto: exato - Math.floor(exato) };
  });
  let restante = totalInteiro - partes.reduce((acc, parte) => acc + parte.valor, 0);
  for (const parte of [...partes].sort((a, b) => b.resto - a.resto || a.indice - b.indice)) {
    if (restante <= 0) break;
    parte.valor += 1;
    restante -= 1;
  }
  return partes.sort((a, b) => a.indice - b.indice).map((parte) => parte.valor);
}

function tituloNormalizado(item = {}) {
  const totalC = valorTituloC(item); const pagoC = Math.min(totalC, Math.max(0, valorPagoC(item)));
  const saldoAtualC = finalizado(item) || quitado(item) ? 0 : Math.max(0, totalC - pagoC);
  let situacao = finalizado(item) ? (status(item).startsWith("estorn") ? "Estornado" : "Cancelado") : pagoC >= totalC && totalC > 0 ? "Pago" : pagoC > 0 ? "Parcial" : "Aberto";
  return {
    ...item, id: txt(item.id) || uid("tit"), tipo: tipoTitulo(item), valorCentavos: totalC,
    valor: reais(totalC), valorBruto: reais(totalC), valorPagoCentavos: pagoC, valorPago: reais(pagoC),
    valorRecebido: reais(pagoC), saldoCentavos: saldoAtualC, valorRestante: reais(saldoAtualC), status: situacao,
    alunoId: idAluno(item), matriculaId: idMatricula(item), vencimento: dataVencimento(item),
    descricao: txt(item.descricao || item.historico || "Lançamento financeiro"), categoria: txt(item.categoria || "Outras receitas"),
    planoContaId: txt(item.planoContaId || item.plano_conta_id), excluido: Boolean(item.excluido)
  };
}

async function ler(nome, padrao = []) { return lerJsonDuravel(nome, padrao); }
async function salvar(nome, dados) { return salvarJsonDuravel(nome, dados); }

async function auditar(acao, entidade, entidadeId, detalhes = {}, usuario = "sistema") {
  const lista = await ler(COL.auditoria, []);
  lista.unshift({ id: uid("audfin"), dataHora: agora(), usuario: txt(usuario) || "sistema", acao, entidade, entidadeId: txt(entidadeId), detalhes });
  await salvar(COL.auditoria, lista.slice(0, 50000));
}

export async function garantirEstruturaFinanceira() {
  return executarTransacaoJson(async () => {
    let formas = await ler(COL.formas, []);
    if (!Array.isArray(formas) || !formas.length) {
      formas = FORMAS.map((nome, i) => ({ id: `fp_${i + 1}`, codigo: String(i + 1).padStart(2, "0"), nome, ativo: true, ordem: i + 1 }));
      await salvar(COL.formas, formas);
    }
    let plano = await ler(COL.plano, []);
    if (!Array.isArray(plano) || !plano.length) {
      plano = CONTAS.map(([codigo, nome, tipo]) => ({ id: `pc_${codigo.replace(".", "_")}`, codigo, nome, tipo, ativo: true, excluido: false }));
      await salvar(COL.plano, plano);
    }
    for (const [nome, padrao] of [[COL.recibos, []], [COL.itens, []], [COL.auditoria, []], [COL.creditos, []]]) {
      const atual = await ler(nome, padrao); if (!Array.isArray(atual)) await salvar(nome, padrao);
    }
    return { ok: true, formasPagamento: formas.filter((x) => x.ativo !== false), planoContas: plano.filter((x) => x.ativo !== false && !x.excluido) };
  }, { operacaoId: "bootstrap-financeiro-ledger-v1" });
}

export async function migrarFinanceiroLegado({ aplicar = false, usuario = "migracao" } = {}) {
  return executarTransacaoJson(async () => {
    const [financeiro, pagamentos, db, mensalidades] = await Promise.all([
      ler(COL.titulos, []), ler(COL.pagamentosLegacy, []), ler(COL.dbLegacy, {}), ler(COL.mensalidades, [])
    ]);
    const baseFinanceiro = Array.isArray(financeiro) ? financeiro : (financeiro?.lancamentos || []);
    const fontesPagar = [
      ...(Array.isArray(pagamentos) ? pagamentos : (pagamentos?.pagamentos || [])),
      ...(Array.isArray(db?.pagamentos) ? db.pagamentos : []),
      ...(Array.isArray(db?.lancamentosFinanceiros) ? db.lancamentosFinanceiros.filter((x) => tipoTitulo(x) === "pagar") : [])
    ];
    const mapa = new Map();
    for (const item of baseFinanceiro) {
      const normalizado = tituloNormalizado(item);
      mapa.set(normalizado.id, normalizado);
    }
    let contasPagarIncorporadas = 0;
    for (const item of fontesPagar) {
      const id = txt(item.id || item._id || item.codigo) || uid("titpag");
      if (mapa.has(id)) continue;
      mapa.set(id, tituloNormalizado({ ...item, id, tipo: "pagar", natureza: "pagar", modulo: "pagamentos" }));
      contasPagarIncorporadas += 1;
    }
    let mensalidadesIncorporadas = 0;
    for (const mensalidade of Array.isArray(mensalidades) ? mensalidades : []) {
      if (finalizado(mensalidade)) continue;
      const vinculo = txt(mensalidade.lancamentoFinanceiroId || mensalidade.financeiroId);
      if (vinculo && mapa.has(vinculo)) continue;
      const id = vinculo || `tit_mens_${txt(mensalidade.id)}`;
      if (!txt(mensalidade.id) || mapa.has(id)) continue;
      mapa.set(id, tituloNormalizado({
        ...mensalidade,
        id,
        tipo: "receber",
        natureza: "receber",
        origem: mensalidade.origem || "mensalidade_migrada",
        mensalidadeId: mensalidade.id,
        descricao: mensalidade.descricao || `Mensalidade ${mensalidade.competencia || mensalidade.vencimento || ""}`,
        categoria: mensalidade.categoria || "Mensalidades"
      }));
      mensalidadesIncorporadas += 1;
    }
    const consolidado = [...mapa.values()];
    const relatorio = {
      ok: true,
      modo: aplicar ? "aplicado" : "simulacao",
      titulosOriginais: baseFinanceiro.length,
      titulosConsolidados: consolidado.length,
      contasPagarIncorporadas,
      mensalidadesIncorporadas
    };
    if (aplicar) {
      await salvar(COL.titulos, consolidado);
      await auditar("migrar_financeiro_legado", "financeiro", "ledger-v1", relatorio, usuario);
    }
    return relatorio;
  }, { operacaoId: aplicar ? "migracao-financeiro-ledger-v1" : uid("simulacao") });
}

export async function listarTitulos(filtros = {}) {
  const lista = (await ler(COL.titulos, [])).map(tituloNormalizado);
  const busca = norm(filtros.busca || filtros.q); const tipo = norm(filtros.tipo); const st = norm(filtros.status);
  return lista.filter((x) => {
    if (tipo && tipoTitulo(x) !== tipo) return false;
    if (st && status(x) !== st) return false;
    if (filtros.alunoId && idAluno(x) !== txt(filtros.alunoId)) return false;
    if (filtros.matriculaId && idMatricula(x) !== txt(filtros.matriculaId)) return false;
    return !busca || norm(`${x.descricao} ${x.categoria} ${x.alunoFornecedor} ${x.pessoa} ${x.status}`).includes(busca);
  }).sort((a, b) => String(b.atualizadoEm || b.criadoEm || b.vencimento).localeCompare(String(a.atualizadoEm || a.criadoEm || a.vencimento)));
}

export async function resumoFinanceiro() {
  const lista = await listarTitulos(); const hojeIso = hoje();
  const r = { totalLancamentos: lista.length, receitasPagas: 0, receitasAbertas: 0, receitasVencidas: 0, despesasPagas: 0, despesasAbertas: 0, saldoRealizado: 0, saldoPrevisto: 0 };
  for (const x of lista) {
    if (finalizado(x)) continue; const pago = reais(valorPagoC(x)); const aberto = reais(saldoC(x));
    if (tipoTitulo(x) === "receber") { r.receitasPagas += pago; r.receitasAbertas += aberto; if (aberto && dataVencimento(x) < hojeIso) r.receitasVencidas += aberto; }
    else { r.despesasPagas += pago; r.despesasAbertas += aberto; }
  }
  r.saldoRealizado = r.receitasPagas - r.despesasPagas; r.saldoPrevisto = r.receitasPagas + r.receitasAbertas - r.despesasPagas - r.despesasAbertas;
  Object.keys(r).forEach((k) => { if (typeof r[k] === "number" && k !== "totalLancamentos") r[k] = moeda(r[k]); });
  return { ...r, receitasLiquidasPagas: r.receitasPagas, receitasBrutasPagas: r.receitasPagas, saldoLiquidoPrevisto: r.saldoPrevisto, taxasFinanceiras: 0 };
}

export async function criarTitulo(dados = {}) {
  return executarTransacaoJson(async () => {
    const descricao = txt(dados.descricao); const totalC = centavos(dados.valor ?? dados.valorBruto);
    if (!descricao || totalC <= 0) throw erro("Descrição e valor maior que zero são obrigatórios.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txt(dados.vencimento))) throw erro("Informe o vencimento no formato AAAA-MM-DD.");
    const lista = await ler(COL.titulos, []);
    const registro = tituloNormalizado({ ...dados, id: txt(dados.id) || uid("tit"), valorCentavos: totalC, valorPagoCentavos: 0, status: "Aberto", criadoEm: agora(), atualizadoEm: agora(), excluido: false });
    lista.push(registro); await salvar(COL.titulos, lista); await auditar("criar_titulo", "titulo", registro.id, { tipo: registro.tipo, valor: registro.valor, vencimento: registro.vencimento }, dados.usuario);
    return registro;
  });
}

export async function atualizarTitulo(id, dados = {}) {
  return executarTransacaoJson(async () => {
    const lista = await ler(COL.titulos, []); const i = lista.findIndex((x) => String(x.id) === String(id)); if (i < 0) return null;
    const atual = tituloNormalizado(lista[i]); if (valorPagoC(atual) > 0 || finalizado(atual)) throw erro("Título com baixa ou cancelado não pode ser editado. Estorne a operação primeiro.", 409);
    const totalC = dados.valor !== undefined ? centavos(dados.valor) : valorTituloC(atual); if (totalC <= 0) throw erro("O valor deve ser maior que zero.");
    lista[i] = tituloNormalizado({ ...atual, ...dados, id: atual.id, valorCentavos: totalC, valorPagoCentavos: 0, status: "Aberto", atualizadoEm: agora() });
    await salvar(COL.titulos, lista); await auditar("editar_titulo", "titulo", id, { antes: atual, depois: lista[i] }, dados.usuario); return lista[i];
  });
}

export async function alterarVencimento(id, dados = {}) {
  return executarTransacaoJson(async () => {
    const novo = txt(dados.novoVencimento || dados.vencimento).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(novo)) throw erro("Informe o novo vencimento.");
    const lista = await ler(COL.titulos, []); const i = lista.findIndex((x) => String(x.id) === String(id)); if (i < 0) throw erro("Título não encontrado.", 404);
    const atual = tituloNormalizado(lista[i]); if (valorPagoC(atual) > 0 || finalizado(atual)) throw erro("Somente títulos totalmente abertos podem mudar de vencimento.", 409);
    const anterior = atual.vencimento; let diferencaC = 0;
    if (dados.recalcularDiferenca === true && anterior) {
      const dias = Math.round((new Date(`${novo}T12:00:00`) - new Date(`${anterior}T12:00:00`)) / 86400000);
      diferencaC = Math.round((valorTituloC(atual) / 30) * dias);
    }
    const novoTotalC = Math.max(1, valorTituloC(atual) + diferencaC);
    lista[i] = tituloNormalizado({ ...atual, vencimento: novo, dataVencimento: novo, valorCentavos: novoTotalC, valor: reais(novoTotalC), ajusteMudancaVencimentoCentavos: diferencaC, atualizadoEm: agora() });
    const mensalidades = await ler(COL.mensalidades, []);
    for (let m = 0; m < mensalidades.length; m += 1) if (mesmo(mensalidades[m].id, atual.mensalidadeId) || mesmo(mensalidades[m].lancamentoFinanceiroId || mensalidades[m].financeiroId, id)) mensalidades[m] = { ...mensalidades[m], vencimento: novo, dataVencimento: novo, valor: reais(novoTotalC), atualizadoEm: agora() };
    await salvar(COL.titulos, lista); await salvar(COL.mensalidades, mensalidades);
    await auditar("alterar_vencimento", "titulo", id, { anterior, novo, diferenca: reais(diferencaC), motivo: txt(dados.motivo) }, dados.usuario);
    return { titulo: lista[i], diferenca: reais(diferencaC) };
  });
}

export async function cancelarTitulo(id, dados = {}) {
  return executarTransacaoJson(async () => {
    const lista = await ler(COL.titulos, []); const i = lista.findIndex((x) => String(x.id) === String(id)); if (i < 0) return null;
    const atual = tituloNormalizado(lista[i]); if (valorPagoC(atual) > 0) throw erro("Título com recebimento não pode ser cancelado. Estorne o recibo primeiro.", 409);
    lista[i] = { ...atual, status: "Cancelado", excluido: true, motivoCancelamento: txt(dados.motivo) || "Cancelado pelo financeiro", canceladoEm: agora(), atualizadoEm: agora() };
    await salvar(COL.titulos, lista); await auditar("cancelar_titulo", "titulo", id, { motivo: lista[i].motivoCancelamento }, dados.usuario); return lista[i];
  });
}

function proximoRecibo(recibos = []) { return String(recibos.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1).padStart(8, "0"); }

export async function receberTitulos(dados = {}) {
  const operacaoId = txt(dados.operacaoId || dados.idempotencyKey) || uid("oprec");
  return executarTransacaoJson(async () => {
    const recibos = await ler(COL.recibos, []); const repetido = recibos.find((x) => x.operacaoId === operacaoId); if (repetido) return { ok: true, idempotente: true, recibo: repetido };
    const [titulos, itensRecibo, caixa, mensalidades, recebimentos, matriculas, alunos, creditos, checkins, taxasCartao] = await Promise.all([
      ler(COL.titulos, []), ler(COL.itens, []), ler(COL.caixa, caixaVazio()), ler(COL.mensalidades, []), ler(COL.recebimentos, []), ler(COL.matriculas, []), ler(COL.alunos, []), ler(COL.creditos, []), ler(COL.checkins, []), ler(COL.taxasCartao, [])
    ]);
    const cx = caixaAberto(caixa); if (!cx) throw erro("Abra o caixa antes de registrar recebimentos.", 409);
    const itensEntrada = Array.isArray(dados.itens) && dados.itens.length ? dados.itens : [{ tituloId: dados.tituloId || dados.id, valor: dados.valorAplicado ?? dados.valor, desconto: dados.desconto, acrescimo: dados.acrescimo ?? dados.juros ?? dados.multa }];
    const alocacoes = []; let totalAplicadoC = 0; let alunoUnico = "";
    for (const entrada of itensEntrada) {
      const i = titulos.findIndex((x) => String(x.id) === String(entrada.tituloId)); if (i < 0) throw erro(`Título não encontrado: ${entrada.tituloId}.`, 404);
      let titulo = tituloNormalizado(titulos[i]); if (tipoTitulo(titulo) !== "receber") throw erro("Contas a pagar devem ser baixadas no módulo de pagamentos.");
      if (!idMatricula(titulo) && idAluno(titulo)) {
        const candidatas = matriculas.filter((m) => String(m.alunoId || m.aluno_id) === idAluno(titulo) && ["ativa", "ativo", "pendente"].includes(status(m)));
        if (candidatas.length === 1) {
          titulo = tituloNormalizado({ ...titulo, matriculaId: candidatas[0].id, vinculoMatriculaAutomatico: true });
          titulos[i] = titulo;
        }
      }
      if (finalizado(titulo) || saldoC(titulo) <= 0) throw erro(`O título ${titulo.descricao} não está disponível para recebimento.`, 409);
      if (alunoUnico && idAluno(titulo) && alunoUnico !== idAluno(titulo)) throw erro("Um recibo não pode misturar títulos de alunos diferentes.");
      alunoUnico = alunoUnico || idAluno(titulo);
      const descontoC = centavos(entrada.desconto || 0); const acrescimoC = centavos(entrada.acrescimo || entrada.juros || entrada.multa || 0);
      const devidoC = Math.max(0, saldoC(titulo) + acrescimoC - descontoC);
      const aplicadoC = entrada.valor === undefined || entrada.valor === "" ? devidoC : centavos(entrada.valor);
      if (aplicadoC <= 0 || aplicadoC > devidoC) throw erro(`Valor inválido para ${titulo.descricao}. Saldo devido: ${reais(devidoC).toFixed(2)}.`);
      totalAplicadoC += aplicadoC; alocacoes.push({ indice: i, titulo, aplicadoC, descontoC, acrescimoC, devidoC });
    }
    const meiosEntrada = Array.isArray(dados.pagamentos) && dados.pagamentos.length
      ? dados.pagamentos
      : [{
          formaPagamento: dados.formaPagamento || "Dinheiro",
          valor: dados.valorEntregue ?? dados.valorPago ?? reais(totalAplicadoC),
          bandeiraCartao: dados.bandeiraCartao,
          modalidadeCartao: dados.modalidadeCartao,
          parcelasCartao: dados.parcelasCartao,
          taxaOperadoraPercentual: dados.taxaOperadoraPercentual,
          taxaOperadoraFixa: dados.taxaOperadoraFixa,
          taxaOperadoraValor: dados.taxaOperadoraValor
        }];
    const meios = meiosEntrada.map((meio) => normalizarMeioComTaxa(meio, meiosEntrada.length === 1 ? dados : {}, taxasCartao));
    const totalMeiosC = meios.reduce((s, x) => s + x.valorCentavos, 0);
    const totalTaxasC = meios.reduce((s, x) => s + x.taxaCentavos, 0);
    if (totalMeiosC < totalAplicadoC) throw erro("A soma das formas de pagamento não cobre o valor aplicado nos títulos.");
    const diferencaC = totalMeiosC - totalAplicadoC;
    const destinoDiferenca = norm(dados.destinoDiferenca);
    if (diferencaC > 0 && !["troco", "credito"].includes(destinoDiferenca)) throw erro("Informe se a diferença será devolvida como troco ou mantida como crédito.");
    if (diferencaC > 0 && destinoDiferenca === "troco" && (meios.length !== 1 || norm(meios[0].formaPagamento || meios[0].forma) !== "dinheiro")) throw erro("Troco somente é permitido quando todo o pagamento é em dinheiro.");
    const aluno = alunos.find((x) => String(x.id) === alunoUnico) || {};
    const recibo = {
      id: uid("rec"),
      numero: proximoRecibo(recibos),
      operacaoId,
      data: txt(dados.dataPagamento || dados.dataRecebimento) || hoje(),
      hora: new Date().toTimeString().slice(0, 8),
      alunoId: alunoUnico,
      aluno: txt(aluno.nome || alocacoes[0]?.titulo.alunoFornecedor || alocacoes[0]?.titulo.pessoa),
      caixaId: cx.id,
      valorPagoCentavos: totalMeiosC,
      valorPago: reais(totalMeiosC),
      valorBrutoRecebido: reais(totalMeiosC),
      valorAplicadoCentavos: totalAplicadoC,
      valorAplicado: reais(totalAplicadoC),
      taxaOperadoraValorCentavos: totalTaxasC,
      taxaOperadoraValor: reais(totalTaxasC),
      valorLiquidoCentavos: totalMeiosC - totalTaxasC,
      valorLiquido: reais(totalMeiosC - totalTaxasC),
      diferencaCentavos: diferencaC,
      troco: destinoDiferenca === "troco" ? reais(diferencaC) : 0,
      creditoGerado: destinoDiferenca === "credito" ? reais(diferencaC) : 0,
      formasPagamento: meios.map((x) => ({
        formaPagamento: x.formaPagamento,
        valor: x.valor,
        referencia: txt(x.referencia),
        bandeiraCartao: x.bandeiraCartao,
        modalidadeCartao: x.modalidadeCartao,
        parcelasCartao: x.parcelasCartao,
        taxaOperadoraPercentual: x.taxaOperadoraPercentual,
        taxaOperadoraFixa: x.taxaOperadoraFixa,
        taxaOperadoraValor: x.taxaOperadoraValor,
        taxa: x.taxaOperadoraValor,
        valorLiquido: x.valorLiquido
      })),
      cancelado: false,
      usuario: txt(dados.usuario) || "sistema",
      observacao: txt(dados.observacao),
      criadoEm: agora()
    };
    const taxaAplicadaTitulosC = totalMeiosC > 0 ? Math.round(totalTaxasC * Math.min(totalAplicadoC, totalMeiosC) / totalMeiosC) : 0;
    const taxasPorTituloC = distribuirCentavos(taxaAplicadaTitulosC, alocacoes.map((alocacao) => alocacao.aplicadoC));
    const meioUnico = meios.length === 1 ? meios[0] : null;
    const novosItens = [];
    for (const [indiceAlocacao, a] of alocacoes.entries()) {
      const novoPagoC = Math.min(valorTituloC(a.titulo), valorPagoC(a.titulo) + a.aplicadoC + a.descontoC - a.acrescimoC);
      const taxaAnteriorC = Number.isInteger(a.titulo.taxaOperadoraValorCentavos)
        ? a.titulo.taxaOperadoraValorCentavos
        : centavos(a.titulo.taxaOperadoraValor || a.titulo.taxaValor || 0);
      const taxaAtualC = taxasPorTituloC[indiceAlocacao] || 0;
      const taxaAcumuladaC = taxaAnteriorC + taxaAtualC;
      titulos[a.indice] = tituloNormalizado({
        ...a.titulo,
        valorPagoCentavos: novoPagoC,
        valorBrutoRecebido: reais(novoPagoC),
        taxaOperadoraValorCentavos: taxaAcumuladaC,
        taxaOperadoraValor: reais(taxaAcumuladaC),
        ultimaTaxaOperadoraValor: reais(taxaAtualC),
        valorLiquido: reais(Math.max(0, novoPagoC - taxaAcumuladaC)),
        valorRecebidoLiquido: reais(Math.max(0, novoPagoC - taxaAcumuladaC)),
        taxaOperadoraPercentual: meioUnico?.taxaOperadoraPercentual || 0,
        taxaOperadoraFixa: meioUnico?.taxaOperadoraFixa || 0,
        bandeiraCartao: meioUnico?.bandeiraCartao || "",
        modalidadeCartao: meioUnico?.modalidadeCartao || "",
        parcelasCartao: meioUnico?.parcelasCartao || "",
        ultimoReciboId: recibo.id,
        dataPagamento: recibo.data,
        formaPagamento: meioUnico?.formaPagamento || "Múltiplas",
        atualizadoEm: agora()
      });
      const item = { id: uid("reci"), reciboId: recibo.id, tituloId: a.titulo.id, alunoId: alunoUnico, matriculaId: idMatricula(a.titulo), mensalidadeId: txt(a.titulo.mensalidadeId), valorOriginalCentavos: valorTituloC(a.titulo), saldoAnteriorCentavos: saldoC(a.titulo), descontoCentavos: a.descontoC, acrescimoCentavos: a.acrescimoC, valorAplicadoCentavos: a.aplicadoC, valorAplicado: reais(a.aplicadoC), taxaOperadoraValorCentavos: taxaAtualC, taxaOperadoraValor: reais(taxaAtualC), valorLiquidoAplicadoCentavos: Math.max(0, a.aplicadoC - taxaAtualC), valorLiquidoAplicado: reais(Math.max(0, a.aplicadoC - taxaAtualC)), cancelado: false, criadoEm: agora() };
      novosItens.push(item); itensRecibo.push(item);
      for (let m = 0; m < mensalidades.length; m += 1) if (mesmo(mensalidades[m].id, item.mensalidadeId) || mesmo(mensalidades[m].lancamentoFinanceiroId || mensalidades[m].financeiroId, item.tituloId)) mensalidades[m] = { ...mensalidades[m], valorPago: titulos[a.indice].valorPago, valorBrutoRecebido: titulos[a.indice].valorBrutoRecebido, valorRestante: titulos[a.indice].valorRestante, taxaOperadoraValor: titulos[a.indice].taxaOperadoraValor, ultimaTaxaOperadoraValor: titulos[a.indice].ultimaTaxaOperadoraValor, taxaOperadoraPercentual: titulos[a.indice].taxaOperadoraPercentual, taxaOperadoraFixa: titulos[a.indice].taxaOperadoraFixa, valorLiquido: titulos[a.indice].valorLiquido, bandeiraCartao: titulos[a.indice].bandeiraCartao, modalidadeCartao: titulos[a.indice].modalidadeCartao, parcelasCartao: titulos[a.indice].parcelasCartao, formaPagamento: titulos[a.indice].formaPagamento, status: titulos[a.indice].status === "Pago" ? "paga" : "parcial", ultimoReciboId: recibo.id, dataPagamento: recibo.data, atualizadoEm: agora() };
      const r = recebimentos.findIndex((x) => mesmo(x.lancamentoFinanceiroId || x.financeiroId, item.tituloId) || mesmo(x.mensalidadeId, item.mensalidadeId));
      const receb = { ...(r >= 0 ? recebimentos[r] : {}), id: r >= 0 ? recebimentos[r].id : uid("recv"), alunoId: alunoUnico, matriculaId: item.matriculaId, mensalidadeId: item.mensalidadeId, lancamentoFinanceiroId: item.tituloId, reciboId: recibo.id, numeroRecibo: recibo.numero, valorRecebido: titulos[a.indice].valorPago, valorBrutoRecebido: titulos[a.indice].valorBrutoRecebido, valorRestante: titulos[a.indice].valorRestante, taxaOperadoraValor: titulos[a.indice].taxaOperadoraValor, ultimaTaxaOperadoraValor: titulos[a.indice].ultimaTaxaOperadoraValor, taxaOperadoraPercentual: titulos[a.indice].taxaOperadoraPercentual, taxaOperadoraFixa: titulos[a.indice].taxaOperadoraFixa, valorLiquido: titulos[a.indice].valorLiquido, bandeiraCartao: titulos[a.indice].bandeiraCartao, modalidadeCartao: titulos[a.indice].modalidadeCartao, parcelasCartao: titulos[a.indice].parcelasCartao, status: titulos[a.indice].status === "Pago" ? "recebido" : "parcial", dataRecebimento: recibo.data, formaPagamento: meioUnico?.formaPagamento || "Múltiplas", atualizadoEm: agora(), criadoEm: r >= 0 ? recebimentos[r].criadoEm : agora() };
      if (r >= 0) recebimentos[r] = receb; else recebimentos.push(receb);
      const deveAtivarMatricula = titulos[a.indice].status === "Pago" && (a.titulo.ativarMatriculaAoReceber === true || norm(a.titulo.origem).includes("matricula_inicial") || status(matriculas.find((x) => mesmo(x.id, item.matriculaId)) || {}) === "pendente");
      if (deveAtivarMatricula) {
        const mi = matriculas.findIndex((x) => mesmo(x.id, item.matriculaId));
        if (mi >= 0 && !["cancelada", "encerrada"].includes(status(matriculas[mi]))) {
          const atualizadoEm = agora();
          const textoReativacao = [
            a.titulo.origem,
            a.titulo.descricao,
            a.titulo.categoria,
            matriculas[mi].origem
          ].map(norm).join(" ");
          const reativacaoPaga = matriculas[mi].reativacaoNovaMatricula === true ||
            textoReativacao.includes("reativacao") || textoReativacao.includes("reativar");
          matriculas[mi] = {
            ...matriculas[mi],
            status: "Ativa",
            statusPagamento: "Pago",
            statusFinanceiroInicial: "Pago",
            bloqueada: false,
            bloqueioCheckin: false,
            motivoBloqueio: "",
            motivoBloqueioCheckin: "",
            ativadaEm: matriculas[mi].ativadaEm || atualizadoEm,
            liberadaAcessoEm: atualizadoEm,
            liberadaPorPagamentoEm: atualizadoEm,
            cacheAcessoLimpoEm: atualizadoEm,
            atualizadoEm
          };
          // O cancelamento desliga a recorrência. Uma reativação paga inicia um
          // novo ciclo mensal e precisa religá-la; do contrário o aluno aparece
          // como "Renovação manual" e a agenda da próxima cobrança é ignorada.
          if (reativacaoPaga) {
            matriculas[mi].renovacaoAutomatica = true;
            matriculas[mi].gerarMensalidadeAutomatica = true;
            matriculas[mi].reativacaoPagaEm = recibo.data;
          }
          const ai = alunos.findIndex((x) => mesmo(x.id, alunoUnico));
          if (ai >= 0) alunos[ai] = {
            ...alunos[ai],
            status: "ativo",
            situacao: "ativo",
            ativo: true,
            status_legado_access: "ativo",
            statusMatricula: "Ativa",
            matriculaStatus: "Ativa",
            matriculaId: matriculas[mi].id,
            numeroMatricula: matriculas[mi].numero || matriculas[mi].numeroMatricula || alunos[ai].numeroMatricula,
            bloqueado: false,
            bloqueioCheckin: false,
            inadimplente: false,
            emAtraso: false,
            motivoBloqueio: "",
            motivoBloqueioCheckin: "",
            reativacaoPendenteEm: "",
            recebimentoReativacaoId: "",
            liberadoAcessoEm: atualizadoEm,
            liberadoPorPagamentoEm: atualizadoEm,
            cacheAcessoLimpoEm: atualizadoEm,
            atualizadoEm
          };
          if (ai >= 0 && reativacaoPaga) {
            alunos[ai].renovacaoAutomatica = true;
            alunos[ai].gerarMensalidadeAutomatica = true;
            alunos[ai].diaVencimento = matriculas[mi].diaVencimento || alunos[ai].diaVencimento || "";
            alunos[ai].proximoVencimento = matriculas[mi].proximoVencimento || alunos[ai].proximoVencimento || "";
            alunos[ai].reativacaoPagaEm = recibo.data;
          }
          for (const checkin of checkins) {
            const mesmoAluno = mesmo(checkin.alunoId, alunoUnico);
            const mesmaMatricula = mesmo(checkin.matriculaId, matriculas[mi].id);
            if (!mesmoAluno && !mesmaMatricula) continue;
            checkin.status = "Ativo";
            checkin.bloqueado = false;
            checkin.bloqueioCheckin = false;
            checkin.motivoBloqueio = "";
            checkin.motivoBloqueioCheckin = "";
            checkin.cacheAcessoLimpoEm = atualizadoEm;
            checkin.atualizadoEm = atualizadoEm;
          }
        }
      }
    }
    const categorias = [...new Set(alocacoes.map((a) => txt(a.titulo.categoria)).filter(Boolean))];
    const categoriaMovimento = categorias.length === 1 ? categorias[0] : "Recebimentos";
    for (const meio of meios) {
      const brutoC = meio.valorCentavos; const taxaC = meio.taxaCentavos;
      caixa.movimentos.push({ id: uid("movrec"), caixaId: cx.id, tipo: "entrada", descricao: `Recibo ${recibo.numero} - ${recibo.aluno || "Cliente"}`, categoria: categoriaMovimento, planoContaId: alocacoes[0]?.titulo.planoContaId || "pc_1_01", pessoa: recibo.aluno, alunoId: alunoUnico, reciboId: recibo.id, lancamentoFinanceiroId: alocacoes.length === 1 ? alocacoes[0].titulo.id : "", mensalidadeId: alocacoes.length === 1 ? txt(alocacoes[0].titulo.mensalidadeId) : "", formaPagamento: meio.formaPagamento, bandeiraCartao: meio.bandeiraCartao, modalidadeCartao: meio.modalidadeCartao, parcelasCartao: meio.parcelasCartao, valorCentavos: brutoC, valor: reais(brutoC), valorBruto: reais(brutoC), taxaCentavos: taxaC, taxaOperadoraPercentual: meio.taxaOperadoraPercentual, taxaOperadoraFixa: meio.taxaOperadoraFixa, taxaOperadoraValor: reais(taxaC), valorLiquidoCentavos: brutoC - taxaC, valorLiquido: reais(brutoC - taxaC), data: recibo.data, status: "ativo", origem: "recibo", criadoEm: agora() });
    }
    if (diferencaC > 0 && destinoDiferenca === "troco") caixa.movimentos.push({ id: uid("movtroco"), caixaId: cx.id, tipo: "saida", descricao: `Troco do recibo ${recibo.numero}`, categoria: "Troco", pessoa: recibo.aluno, alunoId: alunoUnico, reciboId: recibo.id, formaPagamento: "Dinheiro", valorCentavos: diferencaC, valor: reais(diferencaC), data: recibo.data, status: "ativo", origem: "troco_recibo", criadoEm: agora() });
    if (diferencaC > 0 && destinoDiferenca === "credito") creditos.push({ id: uid("cred"), alunoId: alunoUnico, reciboId: recibo.id, valorOriginalCentavos: diferencaC, saldoCentavos: diferencaC, valor: reais(diferencaC), saldo: reais(diferencaC), status: "ativo", origem: "diferenca_recebimento", criadoEm: agora() });
    recibos.unshift(recibo);
    await salvarJsonMultiplosAtomico({ [COL.titulos]: titulos, [COL.itens]: itensRecibo, [COL.recibos]: recibos, [COL.caixa]: caixa, [COL.mensalidades]: mensalidades, [COL.recebimentos]: recebimentos, [COL.matriculas]: matriculas, [COL.alunos]: alunos, [COL.creditos]: creditos, [COL.checkins]: checkins });
    await auditar("emitir_recibo", "recibo", recibo.id, { numero: recibo.numero, valor: recibo.valorPago, tituloIds: novosItens.map((x) => x.tituloId), caixaId: cx.id }, dados.usuario);
    return { ok: true, recibo, itens: novosItens, titulos: alocacoes.map((a) => titulos[a.indice]), lancamento: titulos[alocacoes[0].indice] };
  }, { operacaoId });
}

export async function estornarRecibo(id, dados = {}) {
  return executarTransacaoJson(async () => {
    const [recibos, itens, titulos, caixa, mensalidades, recebimentos, creditos] = await Promise.all([ler(COL.recibos, []), ler(COL.itens, []), ler(COL.titulos, []), ler(COL.caixa, caixaVazio()), ler(COL.mensalidades, []), ler(COL.recebimentos, []), ler(COL.creditos, [])]);
    const ri = recibos.findIndex((x) => String(x.id) === String(id) || String(x.numero) === String(id)); if (ri < 0) throw erro("Recibo não encontrado.", 404); if (recibos[ri].cancelado) throw erro("Recibo já estornado.", 409);
    const cx = caixaAberto(caixa); if (!cx) throw erro("Abra o caixa para registrar o estorno.", 409);
    const motivo = txt(dados.motivo); if (motivo.length < 3) throw erro("Informe o motivo do estorno.");
    const relacionados = itens.filter((x) => String(x.reciboId) === String(recibos[ri].id) && !x.cancelado);
    for (const item of relacionados) {
      const ti = titulos.findIndex((x) => String(x.id) === String(item.tituloId)); if (ti >= 0) {
        const t = tituloNormalizado(titulos[ti]); const novoPagoC = Math.max(0, valorPagoC(t) - Number(item.valorAplicadoCentavos || 0) - Number(item.descontoCentavos || 0) + Number(item.acrescimoCentavos || 0));
        const taxaAnteriorC = Number.isInteger(t.taxaOperadoraValorCentavos) ? t.taxaOperadoraValorCentavos : centavos(t.taxaOperadoraValor || t.taxaValor || 0);
        const novaTaxaC = Math.max(0, taxaAnteriorC - Number(item.taxaOperadoraValorCentavos || 0));
        titulos[ti] = tituloNormalizado({ ...t, valorPagoCentavos: novoPagoC, valorBrutoRecebido: reais(novoPagoC), taxaOperadoraValorCentavos: novaTaxaC, taxaOperadoraValor: reais(novaTaxaC), ultimaTaxaOperadoraValor: 0, valorLiquido: reais(Math.max(0, novoPagoC - novaTaxaC)), valorRecebidoLiquido: reais(Math.max(0, novoPagoC - novaTaxaC)), ultimoReciboId: "", atualizadoEm: agora() });
        for (let m = 0; m < mensalidades.length; m += 1) if (mesmo(mensalidades[m].id, item.mensalidadeId) || mesmo(mensalidades[m].lancamentoFinanceiroId || mensalidades[m].financeiroId, item.tituloId)) mensalidades[m] = { ...mensalidades[m], valorPago: titulos[ti].valorPago, valorBrutoRecebido: titulos[ti].valorBrutoRecebido, valorRestante: titulos[ti].valorRestante, taxaOperadoraValor: titulos[ti].taxaOperadoraValor, ultimaTaxaOperadoraValor: 0, valorLiquido: titulos[ti].valorLiquido, status: titulos[ti].status === "Parcial" ? "parcial" : "aberto", estornadoEm: agora(), atualizadoEm: agora() };
      }
      item.cancelado = true; item.estornadoEm = agora(); item.motivoEstorno = motivo;
    }
    for (const r of recebimentos) if (String(r.reciboId) === String(recibos[ri].id)) { r.status = "estornado"; r.motivoEstorno = motivo; r.estornadoEm = agora(); r.atualizadoEm = agora(); }
    recibos[ri] = { ...recibos[ri], cancelado: true, status: "Estornado", motivoEstorno: motivo, estornadoPor: txt(dados.usuario) || "sistema", estornadoEm: agora() };
    for (const meio of recibos[ri].formasPagamento || []) caixa.movimentos.push({ id: uid("movest"), caixaId: cx.id, tipo: "saida", descricao: `Estorno recibo ${recibos[ri].numero}`, categoria: "Estorno de recebimento", pessoa: recibos[ri].aluno, alunoId: recibos[ri].alunoId, reciboId: recibos[ri].id, reciboEstornadoId: recibos[ri].id, formaPagamento: meio.formaPagamento, valorCentavos: centavos(meio.valor), valor: moeda(meio.valor), data: hoje(), status: "ativo", origem: "estorno_recibo", criadoEm: agora() });
    if (centavos(recibos[ri].troco) > 0) caixa.movimentos.push({ id: uid("movesttroco"), caixaId: cx.id, tipo: "entrada", descricao: `Reversão do troco do recibo ${recibos[ri].numero}`, categoria: "Estorno de troco", pessoa: recibos[ri].aluno, alunoId: recibos[ri].alunoId, reciboId: recibos[ri].id, formaPagamento: "Dinheiro", valorCentavos: centavos(recibos[ri].troco), valor: moeda(recibos[ri].troco), data: hoje(), status: "ativo", origem: "estorno_troco", criadoEm: agora() });
    for (const credito of creditos) if (String(credito.reciboId) === String(recibos[ri].id) && status(credito) === "ativo") { credito.status = "estornado"; credito.saldoCentavos = 0; credito.saldo = 0; credito.estornadoEm = agora(); credito.motivoEstorno = motivo; }
    await salvarJsonMultiplosAtomico({ [COL.recibos]: recibos, [COL.itens]: itens, [COL.titulos]: titulos, [COL.caixa]: caixa, [COL.mensalidades]: mensalidades, [COL.recebimentos]: recebimentos, [COL.creditos]: creditos });
    await auditar("estornar_recibo", "recibo", recibos[ri].id, { numero: recibos[ri].numero, motivo, valor: recibos[ri].valorPago, caixaId: cx.id }, dados.usuario); return { ok: true, recibo: recibos[ri] };
  });
}

export async function listarRecibos(filtros = {}) {
  const lista = await ler(COL.recibos, []); const busca = norm(filtros.busca || filtros.q); return lista.filter((x) => !busca || norm(`${x.numero} ${x.aluno} ${x.formasPagamento?.map((f) => f.formaPagamento).join(" ")}`).includes(busca));
}

export async function extratoAluno(alunoId) {
  const [alunos, matriculas, titulos, recibos, itens, creditos] = await Promise.all([ler(COL.alunos, []), ler(COL.matriculas, []), ler(COL.titulos, []), ler(COL.recibos, []), ler(COL.itens, []), ler(COL.creditos, [])]);
  const aluno = alunos.find((x) => String(x.id) === String(alunoId)); if (!aluno) throw erro("Aluno não encontrado.", 404);
  const ts = titulos.map(tituloNormalizado).filter((x) => idAluno(x) === String(alunoId)); const rs = recibos.filter((x) => String(x.alunoId) === String(alunoId));
  const totais = ts.filter((x) => !finalizado(x)).reduce((r, x) => { r.cobradoC += valorTituloC(x); r.recebidoC += valorPagoC(x); r.abertoC += saldoC(x); if (saldoC(x) && dataVencimento(x) < hoje()) r.vencidoC += saldoC(x); return r; }, { cobradoC: 0, recebidoC: 0, abertoC: 0, vencidoC: 0 });
  return { ok: true, aluno, matriculas: matriculas.filter((x) => String(x.alunoId || x.aluno_id) === String(alunoId)), titulos: ts, recibos: rs, recibosItens: itens.filter((x) => String(x.alunoId) === String(alunoId)), creditos: creditos.filter((x) => String(x.alunoId) === String(alunoId)), totais: { cobrado: reais(totais.cobradoC), recebido: reais(totais.recebidoC), aberto: reais(totais.abertoC), vencido: reais(totais.vencidoC) } };
}

export async function auditoriaFinanceira(filtros = {}) { const lista = await ler(COL.auditoria, []); return lista.filter((x) => !filtros.entidadeId || String(x.entidadeId) === String(filtros.entidadeId)).slice(0, Math.min(2000, Number(filtros.limite) || 300)); }

export async function verificarIntegridadeFinanceira() {
  const [alunos, matriculas, titulosBrutos, recibos, itens, caixa] = await Promise.all([ler(COL.alunos, []), ler(COL.matriculas, []), ler(COL.titulos, []), ler(COL.recibos, []), ler(COL.itens, []), ler(COL.caixa, caixaVazio())]);
  const falhas = []; const alunoIds = new Set(alunos.map((x) => String(x.id))); const matriculaIds = new Set(matriculas.map((x) => String(x.id))); const tituloIds = new Set(titulosBrutos.map((x) => String(x.id))); const reciboIds = new Set(recibos.map((x) => String(x.id)));
  const cpfs = new Map(); for (const a of alunos) { const cpf = txt(a.cpf).replace(/\D/g, ""); if (cpf) cpfs.set(cpf, [...(cpfs.get(cpf) || []), a]); }
  for (const [cpf, registrosCpf] of cpfs) if (registrosCpf.length > 1) {
    const ativos = registrosCpf.filter((a) => !["inativo", "inativa", "cancelado", "cancelada", "desligado", "desligada"].includes(status(a)));
    falhas.push({ nivel: ativos.length > 1 ? "erro" : "aviso", codigo: ativos.length > 1 ? "CPF_DUPLICADO_ATIVO" : "CPF_REPETIDO_HISTORICO", cpfFinal: cpf.slice(-4), registros: registrosCpf.map((a) => a.id) });
  }
  for (const m of matriculas) if (!alunoIds.has(String(m.alunoId || m.aluno_id))) falhas.push({ nivel: "erro", codigo: "MATRICULA_SEM_ALUNO", registroId: m.id });
  for (const t0 of titulosBrutos) { const t = tituloNormalizado(t0); if (idAluno(t) && !alunoIds.has(idAluno(t))) falhas.push({ nivel: "erro", codigo: "TITULO_SEM_ALUNO", registroId: t.id }); if (idMatricula(t) && !matriculaIds.has(idMatricula(t))) falhas.push({ nivel: "erro", codigo: "TITULO_SEM_MATRICULA", registroId: t.id }); if (valorPagoC(t) > valorTituloC(t)) falhas.push({ nivel: "erro", codigo: "TITULO_PAGO_ACIMA_VALOR", registroId: t.id }); }
  for (const i of itens) { if (!reciboIds.has(String(i.reciboId))) falhas.push({ nivel: "erro", codigo: "ITEM_SEM_RECIBO", registroId: i.id }); if (!tituloIds.has(String(i.tituloId))) falhas.push({ nivel: "erro", codigo: "ITEM_SEM_TITULO", registroId: i.id }); }
  const nums = new Map(); for (const r of recibos) if (!r.cancelado) { if (nums.has(String(r.numero))) falhas.push({ nivel: "erro", codigo: "RECIBO_NUMERO_DUPLICADO", registros: [nums.get(String(r.numero)), r.id] }); else nums.set(String(r.numero), r.id); }
  if ((caixa.caixas || []).filter((x) => status(x) === "aberto").length > 1) falhas.push({ nivel: "erro", codigo: "MULTIPLOS_CAIXAS_ABERTOS" });
  for (const r of recibos.filter((x) => !x.cancelado)) if (!(caixa.movimentos || []).some((m) => String(m.reciboId) === String(r.id) && norm(m.origem) === "recibo")) falhas.push({ nivel: "erro", codigo: "RECIBO_SEM_MOVIMENTO_CAIXA", registroId: r.id });
  return { ok: !falhas.some((x) => x.nivel === "erro"), verificadoEm: agora(), contagens: { alunos: alunos.length, matriculas: matriculas.length, titulos: titulosBrutos.length, recibos: recibos.length, itensRecibo: itens.length, caixas: (caixa.caixas || []).length, movimentosCaixa: (caixa.movimentos || []).length }, falhas };
}
