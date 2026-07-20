import path from "path";
import {
  listarLancamentos,
  salvarLancamentos,
  buscarLancamentoPorId
} from "./financeiro.repository.mjs";
import { baixarMensalidade } from "./mensalidades.service.mjs";
import { confirmarRecebimento } from "./recebimentos.service.mjs";
import { desbloquearAlunoAposPagamento } from "./desbloqueio.service.mjs";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const TAXAS_CARTAO_PATH = path.resolve(process.cwd(), "data", "taxas_cartao.json");

async function lerJsonFinanceiro(nomeArquivo, padrao = []) {
  try {
    return await lerJsonDuravel(nomeArquivo, padrao);
  } catch {
    return padrao;
  }
}

async function salvarJsonFinanceiro(nomeArquivo, dados) {
  await salvarJsonDuravel(nomeArquivo, dados);
}

function ehEntradaMatriculaFinanceiro(item = {}) {
  const alvo = String([
    item.origem,
    item.categoria,
    item.descricao,
    item.recorrencia
  ].join(" ")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return Boolean(item.ativarMatriculaAoReceber) ||
    alvo.includes("matricula_inicial_unificada") ||
    alvo.includes("matricula inicial") ||
    alvo.includes("entrada matricula") ||
    alvo.includes("matricula + mensalidade") ||
    alvo.includes("matricula e mensalidade");
}

async function ativarAlunoMatriculaAposBaixaFinanceira(lancamento = {}) {
  if (!ehEntradaMatriculaFinanceiro(lancamento)) return null;

  const alunoId = lancamento.alunoId || "";
  const matriculaId = lancamento.matriculaId || "";
  const agora = new Date().toISOString();

  if (!alunoId && !matriculaId) return null;

  const alunos = await lerJsonFinanceiro("alunos.json", []);
  const matriculas = await lerJsonFinanceiro("matriculas.json", []);
  const checkins = await lerJsonFinanceiro("checkins.json", []);

  let alunoAtualizado = null;
  let matriculaAtualizada = null;

  // Regra segura:
  // pagamento inicial ativa somente a matrícula vinculada ao lançamento pago.
  // Não ativa/cancela outras pré-matrículas do mesmo aluno.
  let matriculaAlvo = null;

  if (matriculaId) {
    matriculaAlvo = matriculas.find((m) => String(m.id) === String(matriculaId)) || null;
  }

  if (!matriculaAlvo && lancamento.mensalidadeId) {
    matriculaAlvo = matriculas.find((m) => String(m.mensalidadeInicialId || "") === String(lancamento.mensalidadeId)) || null;
  }

  if (!matriculaAlvo && lancamento.id) {
    matriculaAlvo = matriculas.find((m) => String(m.financeiroInicialId || "") === String(lancamento.id)) || null;
  }

  if (!matriculaAlvo && alunoId) {
    matriculaAlvo = matriculas.find((m) =>
      String(m.alunoId) === String(alunoId) &&
      ["pendente", "pre-matriculado", "pré-matriculado"].includes(String(m.status || "").toLowerCase())
    ) || null;
  }

  if (matriculaAlvo) {
    const statusMatriculaAtual = String(matriculaAlvo.status || "").toLowerCase();

    if (!["cancelada", "cancelado"].includes(statusMatriculaAtual)) {
      matriculaAlvo.status = "Ativa";
      matriculaAlvo.statusPagamento = "Pago";
      matriculaAlvo.statusFinanceiroInicial = "Pago";
      matriculaAlvo.bloqueada = false;
      matriculaAlvo.bloqueioCheckin = false;
      matriculaAlvo.motivoBloqueio = "";
      matriculaAlvo.motivoBloqueioCheckin = "";
      matriculaAlvo.financeiroInicialId = matriculaAlvo.financeiroInicialId || lancamento.id || "";
      matriculaAlvo.mensalidadeInicialId = matriculaAlvo.mensalidadeInicialId || lancamento.mensalidadeId || "";
      matriculaAlvo.ativadaEm = matriculaAlvo.ativadaEm || agora;
      matriculaAlvo.liberadaAcessoEm = agora;
      matriculaAlvo.liberadaPorPagamentoEm = agora;
      matriculaAlvo.cacheAcessoLimpoEm = agora;
      delete matriculaAlvo.encerradaEm;
      delete matriculaAlvo.canceladaEm;
      delete matriculaAlvo.motivoEncerramento;
      delete matriculaAlvo.motivoCancelamento;
      matriculaAlvo.atualizadoEm = agora;
      matriculaAlvo.historico = Array.isArray(matriculaAlvo.historico) ? matriculaAlvo.historico : [];
      matriculaAlvo.historico.push({
        id: `hist_mat_ativ_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
        acao: "ativacao_por_baixa_financeira",
        descricao: "Matrícula ativada automaticamente após confirmação do pagamento inicial.",
        lancamentoFinanceiroId: lancamento.id || "",
        mensalidadeId: lancamento.mensalidadeId || "",
        criadoEm: agora
      });
      matriculaAtualizada = matriculaAlvo;
    }
  }

  for (const aluno of alunos) {
    const mesmoAluno = alunoId && String(aluno.id) === String(alunoId);
    const mesmaMatricula = matriculaAtualizada?.id && String(aluno.matriculaId || "") === String(matriculaAtualizada.id);
    if (!mesmoAluno && !mesmaMatricula) continue;
    if (!matriculaAtualizada) continue;

    if (["inativo", "cancelado", "desligado"].includes(String(aluno.status || "").toLowerCase())) continue;

    aluno.status = "ativo";
    aluno.ativo = true;
    aluno.situacao = "ativo";
    aluno.status_legado_access = "ativo";
    aluno.statusMatricula = "Ativa";
    aluno.matriculaStatus = "Ativa";
    aluno.bloqueado = false;
    aluno.bloqueioCheckin = false;
    aluno.inadimplente = false;
    aluno.emAtraso = false;
    aluno.motivoBloqueio = "";
    aluno.motivoBloqueioCheckin = "";
    aluno.reativacaoPendenteEm = "";
    aluno.recebimentoReativacaoId = "";
    if (matriculaAtualizada?.id) {
      aluno.matriculaId = matriculaAtualizada.id;
      aluno.numeroMatricula = matriculaAtualizada.numero || aluno.numeroMatricula || "";
      aluno.planoId = matriculaAtualizada.planoId || aluno.planoId || "";
      aluno.plano = matriculaAtualizada.plano || aluno.plano || "";
    }
    aluno.ativadoEm = aluno.ativadoEm || agora;
    aluno.liberadoAcessoEm = agora;
    aluno.liberadoPorPagamentoEm = agora;
    aluno.cacheAcessoLimpoEm = agora;
    aluno.atualizadoEm = agora;
    alunoAtualizado = aluno;
  }

  for (const vinculo of checkins) {
    const mesmoAluno = alunoId && String(vinculo.alunoId) === String(alunoId);
    const mesmaMatricula = matriculaId && String(vinculo.matriculaId) === String(matriculaId);
    if (!mesmoAluno && !mesmaMatricula) continue;
    vinculo.status = "Ativo";
    vinculo.bloqueado = false;
    vinculo.bloqueioCheckin = false;
    vinculo.motivoBloqueio = "";
    vinculo.motivoBloqueioCheckin = "";
    vinculo.cacheAcessoLimpoEm = agora;
    vinculo.atualizadoEm = agora;
  }

  await salvarJsonFinanceiro("alunos.json", alunos);
  await salvarJsonFinanceiro("matriculas.json", matriculas);
  await salvarJsonFinanceiro("checkins.json", checkins);

  return {
    aluno: alunoAtualizado,
    matricula: matriculaAtualizada
  };
}


const TAXAS_CARTAO_TESTE = [
  { bandeira: "Mastercard", modalidade: "debito", parcelas: 1, percentual: 1.09, taxaFixa: 0, descricao: "Débito Mastercard" },
  { bandeira: "Mastercard", modalidade: "credito", parcelas: 1, percentual: 2.99, taxaFixa: 0, descricao: "Crédito Mastercard 1x" },
  { bandeira: "Mastercard", modalidade: "credito", parcelas: 2, percentual: 4.05, taxaFixa: 0, descricao: "Crédito Mastercard 2x" },
  { bandeira: "Visa", modalidade: "debito", parcelas: 1, percentual: 1.15, taxaFixa: 0, descricao: "Débito Visa" },
  { bandeira: "Visa", modalidade: "credito", parcelas: 1, percentual: 3.05, taxaFixa: 0, descricao: "Crédito Visa 1x" },
  { bandeira: "Visa", modalidade: "credito", parcelas: 2, percentual: 4.15, taxaFixa: 0, descricao: "Crédito Visa 2x" },
  { bandeira: "Elo", modalidade: "debito", parcelas: 1, percentual: 1.35, taxaFixa: 0, descricao: "Débito Elo" },
  { bandeira: "Elo", modalidade: "credito", parcelas: 1, percentual: 3.35, taxaFixa: 0, descricao: "Crédito Elo 1x" },
  { bandeira: "Elo", modalidade: "credito", parcelas: 2, percentual: 4.45, taxaFixa: 0, descricao: "Crédito Elo 2x" },
  { bandeira: "Hipercard", modalidade: "credito", parcelas: 1, percentual: 3.49, taxaFixa: 0, descricao: "Crédito Hipercard 1x" },
  { bandeira: "Hipercard", modalidade: "credito", parcelas: 2, percentual: 4.75, taxaFixa: 0, descricao: "Crédito Hipercard 2x" },
  { bandeira: "American Express", modalidade: "credito", parcelas: 1, percentual: 3.85, taxaFixa: 0, descricao: "Crédito Amex 1x" },
  { bandeira: "American Express", modalidade: "credito", parcelas: 2, percentual: 5.10, taxaFixa: 0, descricao: "Crédito Amex 2x" },
  { bandeira: "PIX", modalidade: "pix", parcelas: 1, percentual: 0.99, taxaFixa: 0, descricao: "PIX recebido" },
  { bandeira: "Boleto", modalidade: "boleto", parcelas: 1, percentual: 0, taxaFixa: 3.49, descricao: "Boleto emitido" }
];

async function garantirTaxasCartao() {
  const taxas = await lerJsonDuravel(TAXAS_CARTAO_PATH, []);
  if (!Array.isArray(taxas) || !taxas.length) await salvarJsonDuravel(TAXAS_CARTAO_PATH, TAXAS_CARTAO_TESTE);
}

function normalizarTaxaCartao(item = {}) {
  return {
    bandeira: String(item.bandeira || "").trim(),
    modalidade: String(item.modalidade || "credito").trim().toLowerCase(),
    parcelas: Math.max(1, Number(item.parcelas || 1)),
    percentual: normalizarValor(item.percentual),
    taxaFixa: normalizarValor(item.taxaFixa ?? item.taxaOperadoraFixa ?? 0),
    descricao: String(item.descricao || "").trim()
  };
}

export async function obterTaxasCartao() {
  await garantirTaxasCartao();
  const dados = await lerJsonDuravel(TAXAS_CARTAO_PATH, []);
  if (!Array.isArray(dados) || !dados.length) {
    await salvarJsonDuravel(TAXAS_CARTAO_PATH, TAXAS_CARTAO_TESTE);
    return TAXAS_CARTAO_TESTE;
  }
  return dados.map(normalizarTaxaCartao).filter((t) => t.bandeira && t.percentual >= 0);
}

export async function salvarTaxasCartao(taxas = []) {
  const lista = (Array.isArray(taxas) ? taxas : [])
    .map(normalizarTaxaCartao)
    .filter((t) => t.bandeira && ["debito", "credito", "pix", "boleto"].includes(t.modalidade) && t.parcelas >= 1 && t.percentual >= 0 && t.taxaFixa >= 0);
  if (!lista.length) {
    const erro = new Error("Informe ao menos uma taxa de recebimento válida.");
    erro.status = 400;
    throw erro;
  }
  await salvarJsonDuravel(TAXAS_CARTAO_PATH, lista);
  return lista;
}

function calcularTaxaOperadora(dados = {}, valorBruto = 0) {
  const percentual = normalizarValor(dados.taxaOperadoraPercentual ?? dados.taxaPercentual ?? 0);
  const taxaFixa = normalizarValor(dados.taxaOperadoraFixa ?? dados.taxaFixa ?? 0);
  const valorInformado = dados.taxaOperadoraValor ?? dados.taxaValor;
  const taxaValor = valorInformado !== undefined && valorInformado !== null && String(valorInformado) !== ""
    ? normalizarValor(valorInformado)
    : Number(((normalizarValor(valorBruto) * percentual / 100) + taxaFixa).toFixed(2));
  return {
    taxaOperadoraPercentual: percentual,
    taxaOperadoraFixa: taxaFixa,
    taxaOperadoraValor: taxaValor,
    valorLiquido: Number(Math.max(0, normalizarValor(valorBruto) - taxaValor).toFixed(2))
  };
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizarValor(valor) {
  return Number(valor || 0);
}

function valorBrutoRecebido(item = {}) {
  return normalizarValor(item.valorBrutoRecebido ?? item.valorPago ?? item.valorRecebido ?? item.valor ?? item.valorBruto ?? 0);
}

function taxaFinanceira(item = {}) {
  return normalizarValor(item.taxaOperadoraValor ?? item.taxaValor ?? 0);
}

function valorLiquidoRecebido(item = {}) {
  const liquido = normalizarValor(item.valorLiquido ?? item.valorRecebidoLiquido ?? 0);
  if (liquido > 0) return liquido;
  return Math.max(0, Number((valorBrutoRecebido(item) - taxaFinanceira(item)).toFixed(2)));
}

function estaPago(item = {}) {
  return statusPagoOuBaixadoFinanceiro(item.status);
}

function dataOrdenacaoFinanceiro(item = {}) {
  const campos = [
    item.atualizadoEm,
    item.updatedAt,
    item.baixadoEm,
    item.dataPagamento,
    item.pagamento,
    item.recebidoEm,
    item.criadoEm,
    item.createdAt,
    item.vencimento
  ];

  for (const campo of campos) {
    const valor = String(campo || '').trim();
    if (!valor) continue;
    const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
    if (!Number.isNaN(data.getTime())) return data.getTime();
  }

  return 0;
}

export async function listarFinanceiro(filtros = {}) {
  let lancamentos = await listarLancamentos();

  if (filtros.tipo) {
    lancamentos = lancamentos.filter((item) => item.tipo === filtros.tipo);
  }

  if (filtros.status) {
    lancamentos = lancamentos.filter((item) => item.status === filtros.status);
  }

  if (filtros.categoria) {
    lancamentos = lancamentos.filter((item) =>
      item.categoria.toLowerCase().includes(filtros.categoria.toLowerCase())
    );
  }

  if (filtros.busca) {
    const busca = filtros.busca.toLowerCase();
    lancamentos = lancamentos.filter((item) =>
      [
        item.descricao,
        item.categoria,
        item.centroCusto,
        item.alunoFornecedor,
        item.formaPagamento,
        item.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(busca)
    );
  }

  return lancamentos.sort((a, b) => {
    const dataB = dataOrdenacaoFinanceiro(b);
    const dataA = dataOrdenacaoFinanceiro(a);
    if (dataB !== dataA) return dataB - dataA;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

export async function obterResumoFinanceiro() {
  const lancamentos = await listarLancamentos();

  const receitasRecebidas = lancamentos
    .filter((item) => item.tipo === "receber" && estaPago(item))
    .reduce((total, item) => total + valorBrutoRecebido(item), 0);

  const taxasFinanceiras = lancamentos
    .filter((item) => item.tipo === "receber" && estaPago(item))
    .reduce((total, item) => total + taxaFinanceira(item), 0);

  const receitasLiquidasPagas = lancamentos
    .filter((item) => item.tipo === "receber" && estaPago(item))
    .reduce((total, item) => total + valorLiquidoRecebido(item), 0);

  const receitasAbertas = lancamentos
    .filter((item) => item.tipo === "receber" && !estaPago(item) && item.status !== "Cancelado")
    .reduce((total, item) => total + normalizarValor(item.valor), 0);

  const despesasPagas = lancamentos
    .filter((item) => item.tipo === "pagar" && estaPago(item))
    .reduce((total, item) => total + normalizarValor(item.valor), 0);

  const despesasAbertas = lancamentos
    .filter((item) => item.tipo === "pagar" && !estaPago(item) && item.status !== "Cancelado")
    .reduce((total, item) => total + normalizarValor(item.valor), 0);

  return {
    totalLancamentos: lancamentos.length,
    receitasPagas: Number(receitasLiquidasPagas.toFixed(2)),
    receitasBrutasPagas: Number(receitasRecebidas.toFixed(2)),
    receitasLiquidasPagas: Number(receitasLiquidasPagas.toFixed(2)),
    taxasFinanceiras: Number(taxasFinanceiras.toFixed(2)),
    receitasAbertas,
    despesasPagas,
    despesasAbertas,
    saldoRealizado: Number((receitasLiquidasPagas - despesasPagas).toFixed(2)),
    saldoPrevisto: Number((receitasLiquidasPagas + receitasAbertas - despesasPagas - despesasAbertas).toFixed(2)),
    saldoLiquidoPrevisto: Number((receitasLiquidasPagas + receitasAbertas - despesasPagas - despesasAbertas).toFixed(2))
  };
}

async function registrarSaidaPagaNoCaixa(lancamento = {}, dados = {}) {
  const valor = normalizarValor(dados.valorPago ?? dados.valor ?? lancamento.valor ?? 0);
  if (!(valor > 0)) return null;

  const caixa = await lerJsonFinanceiro("caixa.json", { caixas: [], movimentos: [] });
  if (!Array.isArray(caixa.caixas)) caixa.caixas = [];
  if (!Array.isArray(caixa.movimentos)) caixa.movimentos = [];

  let aberto = caixa.caixas.find((item) => String(item.status || "").toLowerCase() === "aberto");
  if (!aberto) {
    aberto = {
      id: `cx_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      dataAbertura: hojeISO(),
      valorAbertura: 0,
      responsavel: "Administrador",
      observacaoAbertura: "Caixa aberto automaticamente pelo financeiro.",
      status: "aberto",
      abertoEm: new Date().toISOString(),
      fechadoEm: "",
      valorFechamentoInformado: null,
      diferenca: null,
      observacaoFechamento: ""
    };
    caixa.caixas.push(aberto);
  }

  const movimento = {
    id: `mov_fin_pag_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    caixaId: aberto.id,
    tipo: "saida",
    descricao: lancamento.descricao || "Pagamento",
    categoria: lancamento.categoria || "Despesas",
    pessoa: lancamento.alunoFornecedor || lancamento.pessoa || lancamento.pessoaFornecedor || "",
    formaPagamento: dados.formaPagamento || lancamento.formaPagamento || "Dinheiro",
    valor,
    valorBruto: valor,
    valorLiquido: valor,
    data: dados.dataPagamento || dados.pagamento || hojeISO(),
    status: "ativo",
    origem: "financeiro",
    lancamentoFinanceiroId: lancamento.id || "",
    observacao: dados.observacao || dados.observacoes || lancamento.observacoes || "",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  caixa.movimentos.push(movimento);
  await salvarJsonFinanceiro("caixa.json", caixa);
  return movimento;
}

export async function criarLancamento(dados) {
  const lancamentos = await listarLancamentos();
  const statusInformado = dados.status || "Aberto";
  const deveBaixarAoCriar = statusPagoOuBaixadoFinanceiro(statusInformado);

  const novo = {
    id: gerarId(),
    tipo: dados.tipo || "receber",
    descricao: dados.descricao || "",
    categoria: dados.categoria || "",
    centroCusto: dados.centroCusto || "",
    alunoFornecedor: dados.alunoFornecedor || "",
    pessoaTipo: dados.pessoaTipo || "",
    pessoaId: dados.pessoaId || "",
    alunoId: dados.alunoId || "",
    fornecedorId: dados.fornecedorId || "",
    valor: normalizarValor(dados.valor),
    vencimento: dados.vencimento || "",
    pagamento: dados.pagamento || "",
    formaPagamento: dados.formaPagamento || "",
    status: deveBaixarAoCriar ? "Aberto" : statusInformado,
    observacoes: dados.observacoes || "",
    criadoEm: new Date().toISOString()
  };

  lancamentos.push(novo);
  await salvarLancamentos(lancamentos);

  if (deveBaixarAoCriar) {
    return await baixarLancamento(novo.id, {
      ...dados,
      valorPago: normalizarValor(dados.valor),
      valor: normalizarValor(dados.valor),
      dataPagamento: dados.pagamento || hojeISO(),
      pagamento: dados.pagamento || hojeISO(),
      formaPagamento: dados.formaPagamento || "Dinheiro"
    });
  }

  return novo;
}

export async function atualizarLancamento(id, dados) {
  const lancamentos = await listarLancamentos();
  const index = lancamentos.findIndex((item) => String(item.id) === String(id));

  if (index === -1) {
    return null;
  }

  const anterior = lancamentos[index];
  const deveBaixarAgora = !estaPago(anterior) && statusPagoOuBaixadoFinanceiro(dados.status);
  const dadosParaSalvar = deveBaixarAgora ? { ...dados, status: anterior.status || "Aberto" } : dados;

  lancamentos[index] = {
    ...lancamentos[index],
    ...dadosParaSalvar,
    valor: normalizarValor(dados.valor ?? lancamentos[index].valor),
    atualizadoEm: new Date().toISOString()
  };

  await salvarLancamentos(lancamentos);

  if (deveBaixarAgora) {
    return await baixarLancamento(id, {
      ...dados,
      valorPago: normalizarValor(dados.valorPago ?? dados.valor ?? lancamentos[index].valor),
      valor: normalizarValor(dados.valorPago ?? dados.valor ?? lancamentos[index].valor),
      dataPagamento: dados.pagamento || dados.dataPagamento || hojeISO(),
      pagamento: dados.pagamento || dados.dataPagamento || hojeISO(),
      formaPagamento: dados.formaPagamento || lancamentos[index].formaPagamento || "Dinheiro"
    });
  }

  const desbloqueioAcesso = await desbloquearAlunoAposPagamento(lancamentos[index], {
    origem: "financeiro_atualizacao_manual"
  });

  return {
    ...lancamentos[index],
    desbloqueioAcesso
  };
}

export async function baixarLancamento(id, dados = {}) {
  const lancamentos = await listarLancamentos();
  const index = lancamentos.findIndex((item) => String(item.id) === String(id));

  if (index === -1) {
    return null;
  }

  const atual = lancamentos[index];
  const dataPagamento = dados.dataPagamento || dados.pagamento || new Date().toISOString().slice(0, 10);
  const formaPagamento = dados.formaPagamento || atual.formaPagamento || "Dinheiro";
  const desconto = normalizarValor(dados.desconto ?? 0);
  const acrescimo = normalizarValor(dados.acrescimo ?? dados.juros ?? 0);
  const valorBaseBaixa = normalizarValor(atual.valorRestante ?? atual.saldo ?? atual.valor ?? 0);
  const valorPago = normalizarValor(dados.valorPago ?? dados.valor ?? Math.max(0, valorBaseBaixa + acrescimo - desconto));

  // Fluxo único de recebimento:
  // Todo lançamento do tipo RECEBER deve passar pelo motor de recebimentos,
  // que grava recebimentos.json, movimenta caixa.json e sincroniza mensalidade/financeiro.
  // Isso impede pagamento marcado como Pago sem dinheiro registrado no caixa do dia.
  if (String(atual.tipo || '').toLowerCase() === 'receber' && dados.fluxoRecebimentoUnico !== false && !dados._viaRecebimentos) {
    const resultadoRecebimento = await confirmarRecebimento(id, {
      ...dados,
      valorRecebido: valorPago,
      valorPago,
      valorBaixa: valorPago,
      dataRecebimento: dataPagamento,
      dataPagamento,
      formaPagamento,
      usuario: dados.usuario || 'Administrador'
    });

    const atualizados = await listarLancamentos();
    const lancamentoAtualizado = atualizados.find((item) => String(item.id) === String(id)) || atual;

    return {
      ...lancamentoAtualizado,
      recebimento: resultadoRecebimento?.recebimento || null,
      caixa: resultadoRecebimento?.caixa || null,
      mensalidade: resultadoRecebimento?.mensalidade || null,
      matricula: resultadoRecebimento?.matricula || null,
      desbloqueioAcesso: resultadoRecebimento?.desbloqueioAcesso || null,
      cobrancaAutomatica: resultadoRecebimento?.cobrancaAutomatica || null,
      mensagem: 'Recebimento confirmado pelo fluxo único: recebimento do dia, caixa e financeiro sincronizados.'
    };
  }
  const taxaCartao = calcularTaxaOperadora(dados, valorPago);
  const formaNormalizada = String(formaPagamento || "").toLowerCase();
  const temTaxaOperadora = formaNormalizada.includes("cart") || formaNormalizada.includes("pix") || formaNormalizada.includes("boleto");

  if (!(valorPago > 0)) {
    const erro = new Error("Informe um valor pago maior que zero.");
    erro.status = 400;
    throw erro;
  }

  if (atual.mensalidadeId && dados.sincronizarMensalidade !== false) {
    try {
      await baixarMensalidade(atual.mensalidadeId, {
        valorPago,
        dataPagamento,
        formaPagamento,
        desconto: dados.desconto || 0,
        juros: dados.juros || dados.acrescimo || 0,
        multa: dados.multa || 0,
        observacao: dados.observacao || dados.observacoes || "Baixa pelo financeiro",
        usuario: dados.usuario || "Administrador",
        bandeiraCartao: dados.bandeiraCartao || "",
        modalidadeCartao: dados.modalidadeCartao || "",
        parcelasCartao: dados.parcelasCartao || "",
        taxaOperadoraPercentual: temTaxaOperadora ? taxaCartao.taxaOperadoraPercentual : 0,
        taxaOperadoraFixa: temTaxaOperadora ? taxaCartao.taxaOperadoraFixa : 0,
        taxaOperadoraValor: temTaxaOperadora ? taxaCartao.taxaOperadoraValor : 0,
        valorBrutoRecebido: valorPago,
        valorLiquido: temTaxaOperadora ? taxaCartao.valorLiquido : valorPago
      });

      const atualizados = await listarLancamentos();
      let lancamentoBaixado = atualizados.find((item) => String(item.id) === String(id)) || {
        ...atual,
        status: "Pago",
        valorPago,
        valorRecebido: valorPago,
        valorBrutoRecebido: valorPago,
        valorLiquido: temTaxaOperadora ? taxaCartao.valorLiquido : valorPago,
        taxaOperadoraPercentual: temTaxaOperadora ? taxaCartao.taxaOperadoraPercentual : 0,
        taxaOperadoraFixa: temTaxaOperadora ? taxaCartao.taxaOperadoraFixa : 0,
        taxaOperadoraValor: temTaxaOperadora ? taxaCartao.taxaOperadoraValor : 0,
        bandeiraCartao: dados.bandeiraCartao || "",
        modalidadeCartao: dados.modalidadeCartao || "",
        parcelasCartao: dados.parcelasCartao || "",
        pagamento: dataPagamento,
        dataPagamento,
        formaPagamento,
        atualizadoEm: new Date().toISOString()
      };

      if (ehEntradaMatriculaFinanceiro(lancamentoBaixado)) {
        await ativarAlunoMatriculaAposBaixaFinanceira(lancamentoBaixado);
        lancamentoBaixado = {
          ...lancamentoBaixado,
          statusAtivacaoMatricula: "Ativa",
          mensagemMotorCobranca: "Aluno e matrícula ativados após pagamento inicial."
        };

        const listaFinal = await listarLancamentos();
        const idxFinal = listaFinal.findIndex((item) => String(item.id) === String(id));
        if (idxFinal >= 0) {
          listaFinal[idxFinal] = { ...listaFinal[idxFinal], ...lancamentoBaixado };
          await salvarLancamentos(listaFinal);
        }
      }

      const desbloqueioAcesso = await desbloquearAlunoAposPagamento(lancamentoBaixado, {
        origem: "financeiro_baixa"
      });

      return {
        ...lancamentoBaixado,
        desbloqueioAcesso
      };
    } catch (erro) {
      if (!String(erro.message || "").toLowerCase().includes("já está paga")) {
        throw erro;
      }
    }
  }

  const valorOriginal = normalizarValor(atual.valor || atual.valorBruto || 0);
  const valorJaPago = normalizarValor(atual.valorPago || atual.valorRecebido || 0);
  const novoValorPago = normalizarValor(valorJaPago + valorPago);
  const valorRestante = Math.max(0, normalizarValor(valorOriginal - novoValorPago));

  lancamentos[index] = {
    ...atual,
    status: valorRestante <= 0 ? "Pago" : "Parcial",
    valorPago: novoValorPago,
    valorRecebido: novoValorPago,
    valorRestante,
    valorBrutoRecebido: valorPago,
    valorLiquido: temTaxaOperadora ? taxaCartao.valorLiquido : valorPago,
    taxaOperadoraPercentual: temTaxaOperadora ? taxaCartao.taxaOperadoraPercentual : 0,
    taxaOperadoraFixa: temTaxaOperadora ? taxaCartao.taxaOperadoraFixa : 0,
    taxaOperadoraValor: temTaxaOperadora ? taxaCartao.taxaOperadoraValor : 0,
    bandeiraCartao: dados.bandeiraCartao || "",
    modalidadeCartao: dados.modalidadeCartao || "",
    parcelasCartao: dados.parcelasCartao || "",
    pagamento: dataPagamento,
    dataPagamento,
    formaPagamento,
    observacoes: dados.observacao || dados.observacoes || atual.observacoes || "",
    atualizadoEm: new Date().toISOString()
  };

  if (valorRestante <= 0 && ehEntradaMatriculaFinanceiro(lancamentos[index])) {
    await ativarAlunoMatriculaAposBaixaFinanceira(lancamentos[index]);
    lancamentos[index] = {
      ...lancamentos[index],
      statusAtivacaoMatricula: "Ativa",
      mensagemMotorCobranca: "Aluno e matrícula ativados após pagamento inicial."
    };
  }

  await salvarLancamentos(lancamentos);

  let movimentoCaixa = null;
  if (String(atual.tipo || "").toLowerCase() === "pagar") {
    movimentoCaixa = await registrarSaidaPagaNoCaixa(lancamentos[index], {
      ...dados,
      valorPago,
      dataPagamento,
      formaPagamento
    });

    if (movimentoCaixa) {
      lancamentos[index] = {
        ...lancamentos[index],
        caixaId: movimentoCaixa.caixaId,
        movimentoCaixaId: movimentoCaixa.id,
        movimentosCaixaIds: [
          ...(Array.isArray(lancamentos[index].movimentosCaixaIds) ? lancamentos[index].movimentosCaixaIds : []),
          movimentoCaixa.id
        ]
      };
      await salvarLancamentos(lancamentos);
    }
  }

  const desbloqueioAcesso = valorRestante <= 0
    ? await desbloquearAlunoAposPagamento(lancamentos[index], { origem: "financeiro_baixa" })
    : { ok: true, desbloqueado: false, motivo: "Pagamento parcial." };

  return {
    ...lancamentos[index],
    caixa: movimentoCaixa,
    desbloqueioAcesso
  };
}

function statusPagoOuBaixadoFinanceiro(status = "") {
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(
    String(status || "").trim().toLowerCase()
  );
}

function mesmoRegistroFinanceiro(a, b) {
  return String(a || "") && String(a || "") === String(b || "");
}

async function removerVinculosAbertosDoLancamento(lancamento = {}) {
  const agora = new Date().toISOString();
  const mensalidades = await lerJsonFinanceiro("mensalidades.json", []);
  const recebimentos = await lerJsonFinanceiro("recebimentos.json", []);

  if (Array.isArray(mensalidades)) {
    const mensalidadesFiltradas = mensalidades.filter((m) => {
      const vinculado =
        mesmoRegistroFinanceiro(m.id, lancamento.mensalidadeId) ||
        mesmoRegistroFinanceiro(m.lancamentoFinanceiroId, lancamento.id) ||
        mesmoRegistroFinanceiro(m.financeiroInicialId, lancamento.id) ||
        mesmoRegistroFinanceiro(m.financeiroId, lancamento.id);

      if (!vinculado) return true;
      return statusPagoOuBaixadoFinanceiro(m.status) || Number(m.valorPago || m.valorRecebido || 0) > 0;
    });

    await salvarJsonFinanceiro("mensalidades.json", mensalidadesFiltradas);
  }

  if (Array.isArray(recebimentos)) {
    const recebimentosFiltrados = recebimentos.filter((r) => {
      const vinculado =
        mesmoRegistroFinanceiro(r.id, lancamento.recebimentoId) ||
        mesmoRegistroFinanceiro(r.financeiroId, lancamento.id) ||
        mesmoRegistroFinanceiro(r.financeiro_id, lancamento.id) ||
        mesmoRegistroFinanceiro(r.lancamentoFinanceiroId, lancamento.id) ||
        mesmoRegistroFinanceiro(r.mensalidadeId, lancamento.mensalidadeId);

      if (!vinculado) return true;
      return statusPagoOuBaixadoFinanceiro(r.status || r.situacao) || Number(r.valorPago || r.valorRecebido || r.valor_pago || 0) > 0;
    });

    await salvarJsonFinanceiro("recebimentos.json", recebimentosFiltrados);
  }

  return { sincronizadoEm: agora };
}

export async function excluirLancamento(id) {
  const lancamentos = await listarLancamentos();
  const lancamento = await buscarLancamentoPorId(id);

  if (!lancamento) {
    return null;
  }

  await removerVinculosAbertosDoLancamento(lancamento);
  await salvarLancamentos(lancamentos.filter((item) => String(item.id) !== String(id)));
  return lancamento;
}
