import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "development";
process.env.FUSION_DATABASE_PROVIDER = "json";
process.env.FUSION_JSON_FALLBACK = "true";

const raizOriginal = process.cwd();
const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-financeiro-test-"));
await fs.mkdir(path.join(temporario, "data"), { recursive: true });

const aluno = { id: "aluno_teste", nome: "Aluno Teste", cpf: "12345678901", status: "pre-matriculado", planoId: "plano_teste" };
const matricula = { id: "mat_teste", alunoId: aluno.id, numero: "MAT-TESTE", status: "Pendente", planoId: "plano_teste", plano: "Plano Mensal", valorMensal: 100, diaVencimento: 10, vencimentoInicial: "2026-08-10", renovacaoAutomatica: true };
const plano = { id: "plano_teste", nome: "Plano Mensal", valorMensal: 100, periodicidade: "Mensal", renovacaoAutomatica: true };
await fs.writeFile(path.join(temporario, "data", "alunos.json"), JSON.stringify([aluno]));
await fs.writeFile(path.join(temporario, "data", "matriculas.json"), JSON.stringify([matricula]));
await fs.writeFile(path.join(temporario, "data", "planos.json"), JSON.stringify([plano]));
await fs.writeFile(path.join(temporario, "data", "taxas_cartao.json"), JSON.stringify([
  { bandeira: "Mastercard", modalidade: "debito", parcelas: 1, percentual: 1.09, taxaFixa: 0 },
  { bandeira: "Mastercard", modalidade: "credito", parcelas: 1, percentual: 2.99, taxaFixa: 0 }
]));
process.chdir(temporario);

try {
  const ledger = await import(`../modules/financeiro/financeiro-ledger.service.mjs?teste=${Date.now()}`);
  const caixa = await import(`../modules/financeiro/caixa.service.mjs?teste=${Date.now()}`);
  const pagamentos = await import(`../modules/financeiro/pagamentos.service.mjs?teste=${Date.now()}`);
  const cobranca = await import(`../modules/cobranca/cobranca.service.mjs?teste=${Date.now()}`);
  const relatorios = await import(`../modules/financeiro/relatorios.service.mjs?teste=${Date.now()}`);

  const estrutura = await ledger.garantirEstruturaFinanceira();
  assert.equal(estrutura.formasPagamento.length >= 8, true);
  assert.equal(estrutura.planoContas.length >= 10, true);

  const titulo1 = await ledger.criarTitulo({ tipo: "receber", alunoId: aluno.id, matriculaId: matricula.id, descricao: "Mensalidade teste", categoria: "Mensalidades", origem: "matricula_inicial_unificada", ativarMatriculaAoReceber: true, valor: 100, vencimento: "2026-08-10" });
  await assert.rejects(() => ledger.receberTitulos({ tituloId: titulo1.id, valor: 100, formaPagamento: "Dinheiro" }), /Abra o caixa/);

  await caixa.abrirCaixa({ valorAbertura: 50, responsavel: "Teste automatizado" });
  const recebimento = await ledger.receberTitulos({ operacaoId: "op_credito_1", tituloId: titulo1.id, valorAplicado: 100, valorPago: 120, destinoDiferenca: "credito", formaPagamento: "PIX", usuario: "teste" });
  assert.equal(recebimento.recibo.numero, "00000001");
  assert.equal(recebimento.recibo.creditoGerado, 20);
  assert.equal(recebimento.lancamento.status, "Pago");
  const matriculasAposBaixa = JSON.parse(await fs.readFile(path.join(temporario, "data", "matriculas.json"), "utf8"));
  assert.equal(matriculasAposBaixa[0].status, "Ativa");
  const recorrencia = await cobranca.gerarProximaMensalidadeAposPagamento({ financeiroId: titulo1.id, alunoId: aluno.id, usuario: "teste" });
  assert.equal(recorrencia.gerada, true);

  const repetido = await ledger.receberTitulos({ operacaoId: "op_credito_1", tituloId: titulo1.id, valorAplicado: 100, valorPago: 120, destinoDiferenca: "credito", formaPagamento: "PIX" });
  assert.equal(repetido.idempotente, true);
  assert.equal((await ledger.listarRecibos()).length, 1);

  await ledger.estornarRecibo(recebimento.recibo.id, { motivo: "Teste de estorno", usuario: "teste" });
  const tituloReaberto = (await ledger.listarTitulos()).find((x) => x.id === titulo1.id);
  assert.equal(tituloReaberto.status, "Aberto");

  await ledger.alterarVencimento(titulo1.id, { vencimento: "2026-08-15", motivo: "Acordo de teste", usuario: "teste" });
  const titulo2 = await ledger.criarTitulo({ tipo: "receber", alunoId: aluno.id, matriculaId: matricula.id, descricao: "Avaliação", categoria: "Avaliação física", valor: 50, vencimento: "2026-08-15" });
  const multiplo = await ledger.receberTitulos({
    operacaoId: "op_multipla_1",
    itens: [{ tituloId: titulo1.id, valor: 100 }, { tituloId: titulo2.id, valor: 50 }],
    pagamentos: [{ formaPagamento: "PIX", valor: 100 }, { formaPagamento: "Cartão de débito", bandeiraCartao: "Mastercard", modalidadeCartao: "debito", parcelasCartao: 1, valor: 50 }],
    usuario: "teste"
  });
  assert.equal(multiplo.itens.length, 2);
  assert.equal(multiplo.recibo.formasPagamento.length, 2);
  assert.equal(multiplo.recibo.taxaOperadoraValor, 0.55);

  const tituloCartao = await ledger.criarTitulo({ tipo: "receber", alunoId: aluno.id, matriculaId: matricula.id, descricao: "Reativação cartão", categoria: "Reativação", valor: 65, vencimento: "2026-08-15" });
  const cartao = await ledger.receberTitulos({
    operacaoId: "op_cartao_1",
    tituloId: tituloCartao.id,
    valorAplicado: 65,
    valorPago: 65,
    formaPagamento: "Cartão de crédito",
    bandeiraCartao: "Mastercard",
    modalidadeCartao: "credito",
    parcelasCartao: 1,
    // Simula uma tela antiga que mandou taxa zero. O servidor deve recalcular 2,99%.
    taxaOperadoraValor: 0,
    usuario: "teste"
  });
  assert.equal(cartao.recibo.valorBrutoRecebido, 65);
  assert.equal(cartao.recibo.taxaOperadoraValor, 1.94);
  assert.equal(cartao.recibo.valorLiquido, 63.06);
  assert.equal(cartao.lancamento.taxaOperadoraValor, 1.94);
  assert.equal(cartao.lancamento.valorLiquido, 63.06);

  const recebimentosGravados = JSON.parse(await fs.readFile(path.join(temporario, "data", "recebimentos.json"), "utf8"));
  const recebimentoCartao = recebimentosGravados.find((item) => item.reciboId === cartao.recibo.id);
  assert.equal(recebimentoCartao.taxaOperadoraValor, 1.94);
  assert.equal(recebimentoCartao.valorLiquido, 63.06);
  const caixaGravado = JSON.parse(await fs.readFile(path.join(temporario, "data", "caixa.json"), "utf8"));
  const movimentoCartao = caixaGravado.movimentos.find((item) => item.reciboId === cartao.recibo.id && item.tipo === "entrada");
  assert.equal(movimentoCartao.taxaOperadoraValor, 1.94);
  assert.equal(movimentoCartao.valorLiquido, 63.06);

  const dataRelatorio = new Date().toISOString().slice(0, 10);
  const relatorio = await relatorios.movimentoDiarioCaixa({ dataInicio: dataRelatorio, dataFim: dataRelatorio });
  const linhasCartao = relatorio.recebimentos.filter((item) => item.reciboId === cartao.recibo.id);
  assert.equal(linhasCartao.length, 1, "O recibo e o recebimento não podem ser somados duas vezes.");
  assert.equal(linhasCartao[0].bruto, 65);
  assert.equal(linhasCartao[0].taxa, 1.94);
  assert.equal(linhasCartao[0].liquido, 63.06);
  assert.equal(linhasCartao[0].categoria, "Reativação");

  const conta = await pagamentos.criarPagamento({ fornecedor: "Fornecedor Teste", descricao: "Energia", categoria: "Energia", valor: 80, vencimento: "2026-08-20" });
  const contaBaixada = await pagamentos.baixarPagamento(conta.id, { valor: 80, formaPagamento: "PIX", operacaoId: "op_pagar_1" });
  assert.equal(String(contaBaixada.status).toLowerCase(), "pago");
  await assert.rejects(() => pagamentos.cancelarPagamento(conta.id, "cancelamento indevido"), /estorno primeiro/);
  const contaEstornada = await pagamentos.estornarPagamento(conta.id, "Teste de estorno de despesa");
  assert.equal(String(contaEstornada.status).toLowerCase(), "aberto");

  const extrato = await ledger.extratoAluno(aluno.id);
  assert.equal(extrato.titulos.length, 4);
  assert.equal(extrato.totais.recebido, 215);

  const integridade = await ledger.verificarIntegridadeFinanceira();
  assert.equal(integridade.ok, true, JSON.stringify(integridade.falhas));
  console.log(JSON.stringify({ ok: true, recibos: (await ledger.listarRecibos()).length, integridade: integridade.contagens }, null, 2));
} finally {
  process.chdir(raizOriginal);
  await fs.rm(temporario, { recursive: true, force: true });
}
