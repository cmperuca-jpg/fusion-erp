import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "development";
process.env.FUSION_DATABASE_PROVIDER = "json";
process.env.FUSION_JSON_FALLBACK = "true";

const raizProjeto = process.cwd();
const dashboard = await fs.readFile(
  path.join(raizProjeto, "public/pages/dashboard/financeiro-operacional-dashboard.js"),
  "utf8"
);
const financeiroUi = await fs.readFile(
  path.join(raizProjeto, "public/pages/financeiro/financeiro.js"),
  "utf8"
);

assert.match(dashboard, /obterJson\("\/api\/financeiro"\)/);
assert.doesNotMatch(dashboard, /obterJson\("\/api\/recebimentos"\)/);
assert.match(dashboard, /const tipo = normalizar\(item\.tipo \|\| ""\)/);
assert.match(dashboard, /tipo !== "receber"/);
assert.match(dashboard, /\/pages\/financeiro\/index\.html\?financeiroId=/);
assert.match(dashboard, /origem=dashboard-receber/);
assert.match(financeiroUi, /async function abrirBaixaPorUrlSeExistir\(\)/);
assert.match(financeiroUi, /const financeiroId = params\.get\("financeiroId"\)/);
assert.match(financeiroUi, /abrirBaixaPorUrlSeExistir\(\);/);
assert.match(financeiroUi, /abrirModalBaixa\(lancamento\);/);

const temporario = await fs.mkdtemp(path.join(os.tmpdir(), "fusion-estorno-dashboard-"));
const dataDir = path.join(temporario, "data");
await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(path.join(dataDir, "alunos.json"), JSON.stringify([
  { id: "aluno_teste_estorno", nome: "Aluno Teste", status: "ativo" }
]));
await fs.writeFile(path.join(dataDir, "matriculas.json"), "[]");
await fs.writeFile(path.join(dataDir, "planos.json"), "[]");
await fs.writeFile(path.join(dataDir, "taxas_cartao.json"), "[]");

const cwdOriginal = process.cwd();
process.chdir(temporario);

try {
  const ledger = await import(`../modules/financeiro/financeiro-ledger.service.mjs?estorno-dashboard=${Date.now()}`);
  const caixa = await import(`../modules/financeiro/caixa.service.mjs?estorno-dashboard=${Date.now()}`);

  await ledger.garantirEstruturaFinanceira();
  await caixa.abrirCaixa({ valorAbertura: 0, responsavel: "Teste automatizado" });

  const mensalidadeId = "men_teste_estorno_dashboard";
  const titulo = await ledger.criarTitulo({
    tipo: "receber",
    alunoId: "aluno_teste_estorno",
    mensalidadeId,
    descricao: "Mensalidade de teste",
    categoria: "Mensalidades",
    valor: 65,
    vencimento: "2026-08-20"
  });

  await fs.writeFile(path.join(dataDir, "mensalidades.json"), JSON.stringify([{
    id: mensalidadeId,
    alunoId: "aluno_teste_estorno",
    alunoNome: "Aluno Teste",
    valor: 65,
    valorOriginal: 65,
    valorPago: 0,
    valorRecebido: 0,
    valorBrutoRecebido: 0,
    valorRestante: 65,
    saldoRestante: 65,
    saldo: 65,
    status: "aberto",
    vencimento: "2026-08-20",
    competencia: "2026-08",
    lancamentoFinanceiroId: titulo.id
  }], null, 2));

  const financeiroPath = path.join(dataDir, "financeiro.json");
  const titulosBrutos = JSON.parse(await fs.readFile(financeiroPath, "utf8"));
  const tituloBruto = titulosBrutos.find(item => item.id === titulo.id);
  assert.ok(tituloBruto);
  tituloBruto.valorPago = 0;
  tituloBruto.valorPagoCentavos = 0;
  tituloBruto.valorBrutoRecebido = 0.03;
  tituloBruto.valorBrutoRecebidoCentavos = 3;
  tituloBruto.valorRecebido = 0.03;
  tituloBruto.status = "Aberto";
  await fs.writeFile(financeiroPath, JSON.stringify(titulosBrutos, null, 2));

  const baixa = await ledger.receberTitulos({
    operacaoId: "op-teste-estorno-dashboard-baixa-desconto",
    tituloId: titulo.id,
    valorAplicado: 0.01,
    valorPago: 0.01,
    valorRecebido: 0.01,
    valorEntregue: 0.01,
    desconto: 64.99,
    formaPagamento: "Dinheiro",
    usuario: "teste"
  });
  assert.equal(baixa.lancamento.status, "Pago");
  assert.equal(baixa.lancamento.valorBrutoRecebido, 0.04);
  assert.equal(baixa.lancamento.desconto, 64.99);

  await ledger.estornarRecibo(baixa.recibo.id, {
    operacaoId: "op-teste-estorno-dashboard-estorno-desconto",
    motivo: "Teste automatizado",
    usuario: "teste"
  });

  let tituloReaberto = (await ledger.listarTitulos()).find(item => item.id === titulo.id);
  assert.ok(tituloReaberto);
  assert.equal(tituloReaberto.status, "Aberto");
  assert.equal(tituloReaberto.valorPago, 0);
  assert.equal(tituloReaberto.valorBrutoRecebido, 0);
  assert.equal(tituloReaberto.valorRestante, 65);
  assert.equal(tituloReaberto.desconto, 0);
  assert.equal(tituloReaberto.acrescimo, 0);
  assert.equal(tituloReaberto.taxaOperadoraValor, 0);

  let mensalidades = JSON.parse(await fs.readFile(path.join(dataDir, "mensalidades.json"), "utf8"));
  let mensalidade = mensalidades.find(item => item.id === mensalidadeId);
  assert.ok(mensalidade);
  assert.equal(mensalidade.status, "aberto");
  assert.equal(mensalidade.valorPago, 0);
  assert.equal(mensalidade.valorRecebido, 0);
  assert.equal(mensalidade.valorBrutoRecebido, 0);
  assert.equal(mensalidade.valorRestante, 65);
  assert.equal(mensalidade.saldoRestante, 65);
  assert.equal(mensalidade.saldo, 65);
  assert.equal(mensalidade.desconto, 0);

  const baixaReteste = await ledger.receberTitulos({
    operacaoId: "op-teste-estorno-dashboard-reteste-desconto",
    tituloId: titulo.id,
    valorAplicado: 0.01,
    valorPago: 0.01,
    valorRecebido: 0.01,
    valorEntregue: 0.01,
    desconto: 64.99,
    formaPagamento: "Dinheiro",
    usuario: "teste"
  });
  assert.equal(baixaReteste.lancamento.status, "Pago");
  assert.equal(baixaReteste.lancamento.valorBrutoRecebido, 0.01);
  assert.equal(baixaReteste.lancamento.desconto, 64.99);

  await ledger.estornarRecibo(baixaReteste.recibo.id, {
    operacaoId: "op-teste-estorno-dashboard-reteste-estorno",
    motivo: "Teste automatizado",
    usuario: "teste"
  });

  tituloReaberto = (await ledger.listarTitulos()).find(item => item.id === titulo.id);
  assert.equal(tituloReaberto.status, "Aberto");
  assert.equal(tituloReaberto.valorBrutoRecebido, 0);
  assert.equal(tituloReaberto.valorRestante, 65);

  const recebimentos = JSON.parse(await fs.readFile(path.join(dataDir, "recebimentos.json"), "utf8"));
  const historico = recebimentos.find(item => item.lancamentoFinanceiroId === titulo.id);
  assert.ok(historico);
  assert.equal(historico.status, "estornado");

  console.log(JSON.stringify({
    ok: true,
    modulo: "dashboard-estorno-reabre-debito",
    dashboardUsaTitulosFinanceiros: true,
    tituloVoltaAberto: true,
    mensalidadeNormalizadaAposEstorno: true,
    recebimentoEstornadoPreservadoNoHistorico: true,
    residuoHistoricoZeradoNoEstornoIntegral: true,
    desconto6499RecebeSomenteUmCentavoAposLimpeza: true,
    dadosPessoaisExibidos: false
  }, null, 2));
} finally {
  process.chdir(cwdOriginal);
  await fs.rm(temporario, { recursive: true, force: true });
}
