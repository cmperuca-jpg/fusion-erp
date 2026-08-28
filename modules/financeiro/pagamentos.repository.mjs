import path from "path";
import crypto from "node:crypto";
import { dataLocalISO } from "../core/time/fusion-time.mjs";
import {
  lerJsonDuravel,
  salvarJsonDuravel,
  salvarJsonMultiplosAtomico,
  executarTransacaoJson
} from "../core/persistence/durable-json.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FINANCEIRO_PATH = path.join(DATA_DIR, "financeiro.json");
const CAIXA_PATH = path.join(DATA_DIR, "caixa.json");
const FECHAMENTOS_PATH = path.join(DATA_DIR, "fechamentos_financeiros.json");

function idItem(item = {}) {
  return String(item.id || item._id || item.codigo || item.uuid || item.chave || "");
}

function centavos(valor) {
  const n = Number(String(valor ?? 0).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function isPagar(item = {}) {
  const alvo = String([
    item.tipo,
    item.natureza,
    item.conta,
    item.modulo,
    item.origem,
    item.categoria
  ].filter(Boolean).join(" ")).toLowerCase();
  return alvo.includes("pagar") || alvo.includes("pagamento") || alvo.includes("despesa") || alvo.includes("fornecedor");
}

async function lerFinanceiro() {
  const dados = await lerJsonDuravel(FINANCEIRO_PATH, []);
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.lancamentos)) return dados.lancamentos;
  return [];
}

async function salvarFinanceiro(lista) {
  return salvarJsonDuravel(FINANCEIRO_PATH, lista);
}

export async function resolverDbPath() {
  return FECHAMENTOS_PATH;
}

// Compatibilidade restrita aos fechamentos. Contas e caixa não são mais espelhados em db.json.
export async function listarFechamentosFinanceiros() {
  const lista = await lerJsonDuravel(FECHAMENTOS_PATH, []);
  return Array.isArray(lista) ? lista : [];
}

export async function salvarFechamentosFinanceiros(lista, { operacaoId = "" } = {}) {
  const opcoes = operacaoId ? { operacaoId } : {};
  return salvarJsonDuravel(
    FECHAMENTOS_PATH,
    Array.isArray(lista) ? lista : [],
    opcoes
  );
}

// Compatibilidade temporaria para consumidores antigos. O modulo ativo de
// pagamentos usa diretamente a colecao dedicada de fechamentos.
export async function lerDb() {
  return {
    db: { fechamentosFinanceiros: await listarFechamentosFinanceiros() },
    filePath: FECHAMENTOS_PATH
  };
}

export async function salvarDb(db) {
  return salvarFechamentosFinanceiros(
    Array.isArray(db?.fechamentosFinanceiros) ? db.fechamentosFinanceiros : []
  );
}

export async function listarPagamentosRaw() {
  return (await lerFinanceiro()).filter(isPagar);
}

async function inserirPagamentoRawInterno(pagamento) {
  const agora = new Date().toISOString();
  const item = {
    ...pagamento,
    tipo: "pagar",
    natureza: "pagar",
    modulo: "pagamentos",
    valorCentavos: centavos(pagamento.valor ?? pagamento.valorBruto),
    valorPagoCentavos: centavos(pagamento.valorPago ?? pagamento.valorLiquido),
    criadoEm: pagamento.criadoEm || pagamento.createdAt || agora,
    atualizadoEm: agora
  };
  const lista = await lerFinanceiro();
  const id = idItem(item);
  if (!id) {
    const erro = new Error("Pagamento sem identificador.");
    erro.status = 400;
    throw erro;
  }
  if (lista.some((atual) => idItem(atual) === id)) {
    const erro = new Error("Já existe um pagamento com este identificador.");
    erro.status = 409;
    throw erro;
  }
  lista.push(item);
  await salvarFinanceiro(lista);
  return item;
}

export async function inserirPagamentoRaw(pagamento, { operacaoId = "" } = {}) {
  return executarTransacaoJson(() => inserirPagamentoRawInterno(pagamento), {
    operacaoId:
      operacaoId ||
      `pagamento-inserir-${idItem(pagamento) || crypto.randomUUID()}`
  });
}

async function atualizarPagamentoRawInterno(id, updater) {
  const lista = await lerFinanceiro();
  const indice = lista.findIndex((item) => idItem(item) === String(id) && isPagar(item));
  if (indice < 0) {
    const erro = new Error("Pagamento não encontrado.");
    erro.status = 404;
    throw erro;
  }
  const atualizado = updater(lista[indice]);
  lista[indice] = {
    ...atualizado,
    id: idItem(lista[indice]),
    tipo: "pagar",
    natureza: "pagar",
    modulo: "pagamentos",
    valorCentavos: centavos(atualizado.valor ?? atualizado.valorBruto),
    valorPagoCentavos: centavos(atualizado.valorPago ?? atualizado.valorLiquido),
    atualizadoEm: new Date().toISOString()
  };
  await salvarFinanceiro(lista);
  return lista[indice];
}

export async function atualizarPagamentoRaw(id, updater, { operacaoId = "" } = {}) {
  return executarTransacaoJson(() => atualizarPagamentoRawInterno(id, updater), {
    operacaoId:
      operacaoId ||
      `pagamento-atualizar-${id}-${crypto.randomUUID()}`
  });
}

// Mantido para clientes antigos: DELETE agora é cancelamento lógico e nunca apaga histórico.
export async function removerPagamentoRaw(id) {
  return atualizarPagamentoRaw(id, (item) => ({
    ...item,
    status: "cancelado",
    canceladoEm: new Date().toISOString(),
    historico: [
      ...(Array.isArray(item.historico) ? item.historico : []),
      { id: `can_pag_${crypto.randomUUID()}`, tipo: "cancelamento", data: new Date().toISOString(), observacao: "Cancelamento solicitado pela rota legada." }
    ]
  }));
}

async function registrarMovimentoCaixaInterno(movimento) {
  const caixa = await lerJsonDuravel(CAIXA_PATH, { caixas: [], movimentos: [] });
  if (Array.isArray(caixa)) {
    const erro = new Error("Estrutura de caixa antiga detectada. Execute a migração financeira antes da baixa.");
    erro.status = 409;
    throw erro;
  }
  if (!Array.isArray(caixa.caixas)) caixa.caixas = [];
  if (!Array.isArray(caixa.movimentos)) caixa.movimentos = [];
  const aberto = caixa.caixas.find((item) => String(item.status || "").toLowerCase() === "aberto");
  if (!aberto) {
    const erro = new Error("Abra o caixa antes de registrar uma saída.");
    erro.status = 409;
    throw erro;
  }
  const id = idItem(movimento);
  if (id && caixa.movimentos.some((item) => idItem(item) === id)) {
    return caixa.movimentos.find((item) => idItem(item) === id);
  }
  const agora = new Date().toISOString();
  const item = {
    ...movimento,
    id: id || `mov_pag_${crypto.randomUUID()}`,
    caixaId: movimento.caixaId || aberto.id,
    valor: Number((centavos(movimento.valor) / 100).toFixed(2)),
    valorCentavos: centavos(movimento.valor),
    data: String(movimento.data || dataLocalISO(new Date())).slice(0, 10),
    status: movimento.status || "ativo",
    pessoa: movimento.pessoa || movimento.fornecedor || movimento.credor || "",
    criadoEm: movimento.criadoEm || agora,
    atualizadoEm: agora
  };
  caixa.movimentos.push(item);
  await salvarJsonDuravel(CAIXA_PATH, caixa);
  return item;
}

export async function registrarMovimentoCaixa(movimento, { operacaoId = "" } = {}) {
  return executarTransacaoJson(() => registrarMovimentoCaixaInterno(movimento), {
    operacaoId:
      operacaoId ||
      `caixa-movimento-${idItem(movimento) || crypto.randomUUID()}`
  });
}

export async function atualizarPagamentoComMovimentoCaixa(id, updater, montarMovimento, operacaoId = "") {
  return executarTransacaoJson(async () => {
    const lista = await lerFinanceiro();
    const indice = lista.findIndex((item) => idItem(item) === String(id) && isPagar(item));
    if (indice < 0) {
      const erro = new Error("Pagamento não encontrado.");
      erro.status = 404;
      throw erro;
    }
    const caixa = await lerJsonDuravel(CAIXA_PATH, { caixas: [], movimentos: [] });
    const movimentoIdempotente = operacaoId ? `cx_${operacaoId}` : "";
    const movimentoExistente = movimentoIdempotente &&
      !Array.isArray(caixa) &&
      Array.isArray(caixa.movimentos)
      ? caixa.movimentos.find((item) => idItem(item) === movimentoIdempotente)
      : null;

    if (movimentoExistente) {
      return {
        pagamento: lista[indice],
        movimento: movimentoExistente,
        idempotente: true
      };
    }

    const aberto = !Array.isArray(caixa) && Array.isArray(caixa.caixas)
      ? caixa.caixas.find((item) => String(item.status || "").toLowerCase() === "aberto")
      : null;
    if (!aberto) {
      const erro = new Error("Abra o caixa antes de registrar esta operação.");
      erro.status = 409;
      throw erro;
    }
    if (!Array.isArray(caixa.movimentos)) caixa.movimentos = [];
    const agora = new Date().toISOString();
    const atualizado = updater(lista[indice]);
    lista[indice] = {
      ...atualizado,
      id: idItem(lista[indice]),
      tipo: "pagar",
      natureza: "pagar",
      modulo: "pagamentos",
      valorCentavos: centavos(atualizado.valor ?? atualizado.valorBruto),
      valorPagoCentavos: centavos(atualizado.valorPago ?? atualizado.valorLiquido),
      atualizadoEm: agora
    };
    const movimentoBase = montarMovimento(lista[indice]);
    const movimento = {
      ...movimentoBase,
      id: idItem(movimentoBase) || `mov_pag_${crypto.randomUUID()}`,
      caixaId: movimentoBase.caixaId || aberto.id,
      referenciaId: movimentoBase.referenciaId || String(id),
      valor: Number((centavos(movimentoBase.valor) / 100).toFixed(2)),
      valorCentavos: centavos(movimentoBase.valor),
      data: String(movimentoBase.data || dataLocalISO(new Date())).slice(0, 10),
      status: movimentoBase.status || "ativo",
      criadoEm: movimentoBase.criadoEm || agora,
      atualizadoEm: agora
    };
    if (caixa.movimentos.some((item) => idItem(item) === movimento.id)) {
      const erro = new Error("Esta operação de caixa já foi registrada.");
      erro.status = 409;
      throw erro;
    }
    caixa.movimentos.push(movimento);
    await salvarJsonMultiplosAtomico({ [FINANCEIRO_PATH]: lista, [CAIXA_PATH]: caixa });
    return { pagamento: lista[indice], movimento };
  }, { operacaoId: operacaoId || `pagamento-caixa-${id}-${crypto.randomUUID()}` });
}
