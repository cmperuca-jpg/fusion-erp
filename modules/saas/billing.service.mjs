import crypto from "node:crypto";
import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";

const COLECAO = "fusion_billing";
const STATUS_VALIDOS = new Set(["trial", "ativa", "inadimplente", "suspensa", "cancelada"]);

function texto(valor = "", limite = 500) {
  return String(valor ?? "").trim().slice(0, limite);
}

function numero(valor, fallback = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function agoraISO() {
  return new Date().toISOString();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataISO(valor = "") {
  const bruto = texto(valor, 40);
  if (!bruto) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
  const d = new Date(bruto);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}

function adicionarDias(dataBase = hojeISO(), dias = 0) {
  const d = new Date(`${dataISO(dataBase) || hojeISO()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}

function adicionarMeses(dataBase = hojeISO(), meses = 1) {
  const d = new Date(`${dataISO(dataBase) || hojeISO()}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + Math.max(1, Number(meses || 1)));
  return d.toISOString().slice(0, 10);
}

function estadoInicial() {
  return {
    versao: 1,
    tenantId: tenantAtual(),
    assinatura: null,
    pagamentos: [],
    eventos: []
  };
}

function normalizarEstado(valor = {}) {
  const base = valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  return {
    versao: 1,
    tenantId: texto(base.tenantId || tenantAtual(), 120),
    assinatura: base.assinatura && typeof base.assinatura === "object" ? base.assinatura : null,
    pagamentos: Array.isArray(base.pagamentos) ? base.pagamentos : [],
    eventos: Array.isArray(base.eventos) ? base.eventos : []
  };
}

function operador(usuario = {}) {
  return {
    id: texto(usuario.id || usuario.sub, 120),
    nome: texto(usuario.nome || usuario.email || "Administrador", 160),
    perfil: texto(usuario.perfil || usuario.perfilOriginal || "", 80)
  };
}

function evento(tipo, detalhes = {}, usuario = {}) {
  return {
    id: `bill_evt_${crypto.randomUUID()}`,
    tipo,
    detalhes,
    operador: operador(usuario),
    criadoEm: agoraISO()
  };
}

function assinaturaBase(payload = {}, existente = null) {
  const tenantId = tenantAtual();
  const valorMensal = numero(payload.valorMensal ?? payload.valor ?? existente?.valorMensal ?? 0, 0);
  const contratadoEm = dataISO(payload.contratadoEm || payload.inicioEm) || existente?.contratadoEm || hojeISO();
  const trialDias = Math.max(0, Math.min(90, Number(payload.trialDias ?? existente?.trialDias ?? 14)));
  const trialAte = dataISO(payload.trialAte) || (trialDias ? adicionarDias(contratadoEm, trialDias) : "");
  const status = texto(payload.status || existente?.status || (trialDias ? "trial" : "ativa"), 40).toLowerCase();

  if (!STATUS_VALIDOS.has(status)) {
    throw Object.assign(new Error("Status de assinatura invalido."), { status: 400 });
  }

  return {
    id: existente?.id || `bill_sub_${crypto.randomUUID()}`,
    tenantId,
    planoCodigo: texto(payload.planoCodigo || payload.plano || existente?.planoCodigo || "fusion-piloto", 80),
    planoNome: texto(payload.planoNome || existente?.planoNome || "Fusion Piloto", 160),
    ciclo: texto(payload.ciclo || existente?.ciclo || "mensal", 40),
    moeda: texto(payload.moeda || existente?.moeda || "BRL", 12),
    valorMensal,
    status,
    trialDias,
    trialAte,
    contratadoEm,
    proximaCobrancaEm: dataISO(payload.proximaCobrancaEm) || existente?.proximaCobrancaEm || trialAte || adicionarMeses(contratadoEm, 1),
    pagoAte: dataISO(payload.pagoAte) || existente?.pagoAte || "",
    inadimplenteDesde: existente?.inadimplenteDesde || "",
    suspensoEm: existente?.suspensoEm || "",
    motivoStatus: texto(payload.motivo || existente?.motivoStatus || "", 300),
    atualizadoEm: agoraISO()
  };
}

function exigirAssinatura(estado = {}) {
  if (!estado.assinatura?.id) {
    throw Object.assign(new Error("Nenhuma assinatura Fusion foi formalizada para esta academia."), { status: 404 });
  }
  return estado.assinatura;
}

async function carregarEstado() {
  return normalizarEstado(await lerJsonDuravel(COLECAO, estadoInicial()));
}

async function salvarEstado(estado) {
  const normalizado = normalizarEstado(estado);
  normalizado.tenantId = tenantAtual();
  await salvarJsonDuravel(COLECAO, normalizado);
  return normalizado;
}

export async function obterBillingFusion() {
  const estado = await carregarEstado();
  return {
    ok: true,
    modulo: "saas-billing",
    tenantId: estado.tenantId,
    assinatura: estado.assinatura,
    pagamentos: estado.pagamentos.slice(0, 20),
    eventos: estado.eventos.slice(0, 50)
  };
}

export async function formalizarContratacaoFusion(payload = {}, usuario = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    const assinatura = assinaturaBase(payload, estado.assinatura);
    const novoContrato = !estado.assinatura?.id;

    estado.assinatura = {
      ...estado.assinatura,
      ...assinatura,
      criadoEm: estado.assinatura?.criadoEm || agoraISO()
    };
    estado.eventos.unshift(evento(novoContrato ? "contratacao_formalizada" : "contratacao_atualizada", {
      status: estado.assinatura.status,
      planoCodigo: estado.assinatura.planoCodigo,
      valorMensal: estado.assinatura.valorMensal,
      proximaCobrancaEm: estado.assinatura.proximaCobrancaEm
    }, usuario));

    return {
      ok: true,
      acao: novoContrato ? "contratacao_formalizada" : "contratacao_atualizada",
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-contratacao-${tenantAtual()}-${Date.now()}` });
}

export async function registrarPagamentoFusion(payload = {}, usuario = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    const assinatura = exigirAssinatura(estado);
    const recebidoEm = dataISO(payload.recebidoEm || payload.data) || hojeISO();
    const meses = Math.max(1, Math.min(36, Number(payload.periodoMeses || payload.meses || 1)));
    const baseCiclo = assinatura.pagoAte && assinatura.pagoAte > recebidoEm ? assinatura.pagoAte : recebidoEm;
    const coberturaAte = dataISO(payload.coberturaAte || payload.pagoAte) || adicionarMeses(baseCiclo, meses);
    const pagamento = {
      id: `bill_pay_${crypto.randomUUID()}`,
      tenantId: tenantAtual(),
      valor: numero(payload.valor ?? assinatura.valorMensal, 0),
      moeda: texto(payload.moeda || assinatura.moeda || "BRL", 12),
      forma: texto(payload.forma || payload.formaPagamento || "manual", 80),
      referencia: texto(payload.referencia || payload.comprovante || "", 160),
      recebidoEm,
      coberturaAte,
      observacao: texto(payload.observacao || "", 500),
      operador: operador(usuario),
      criadoEm: agoraISO()
    };
    if (pagamento.valor <= 0) {
      throw Object.assign(new Error("Informe um valor positivo para o pagamento."), { status: 400 });
    }

    estado.pagamentos.unshift(pagamento);
    estado.assinatura = {
      ...assinatura,
      status: "ativa",
      pagoAte: coberturaAte,
      proximaCobrancaEm: coberturaAte,
      inadimplenteDesde: "",
      suspensoEm: "",
      motivoStatus: "",
      atualizadoEm: agoraISO()
    };
    estado.eventos.unshift(evento("pagamento_registrado", {
      pagamentoId: pagamento.id,
      valor: pagamento.valor,
      recebidoEm,
      coberturaAte
    }, usuario));

    return {
      ok: true,
      acao: "pagamento_registrado",
      pagamento,
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-pagamento-${tenantAtual()}-${Date.now()}` });
}

export async function renovarAssinaturaFusion(payload = {}, usuario = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    const assinatura = exigirAssinatura(estado);
    const inicio = dataISO(payload.inicioEm) || assinatura.pagoAte || hojeISO();
    const meses = Math.max(1, Math.min(36, Number(payload.periodoMeses || payload.meses || 1)));
    const renovadoAte = dataISO(payload.renovadoAte || payload.pagoAte) || adicionarMeses(inicio, meses);
    const status = texto(payload.status || "ativa", 40).toLowerCase();
    if (!STATUS_VALIDOS.has(status)) {
      throw Object.assign(new Error("Status de assinatura invalido."), { status: 400 });
    }

    estado.assinatura = {
      ...assinatura,
      status,
      pagoAte: renovadoAte,
      proximaCobrancaEm: renovadoAte,
      inadimplenteDesde: "",
      suspensoEm: "",
      motivoStatus: texto(payload.motivo || "", 300),
      atualizadoEm: agoraISO()
    };
    estado.eventos.unshift(evento("assinatura_renovada", {
      inicio,
      renovadoAte,
      motivo: estado.assinatura.motivoStatus
    }, usuario));

    return {
      ok: true,
      acao: "assinatura_renovada",
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-renovacao-${tenantAtual()}-${Date.now()}` });
}

export async function marcarInadimplenciaFusion(payload = {}, usuario = {}) {
  return atualizarStatusManual("inadimplente", payload, usuario, {
    tipoEvento: "inadimplencia_marcada",
    campoData: "inadimplenteDesde"
  });
}

export async function suspenderAssinaturaFusion(payload = {}, usuario = {}) {
  return atualizarStatusManual("suspensa", payload, usuario, {
    tipoEvento: "assinatura_suspensa",
    campoData: "suspensoEm"
  });
}

export async function reativarAssinaturaFusion(payload = {}, usuario = {}) {
  return atualizarStatusManual("ativa", payload, usuario, {
    tipoEvento: "assinatura_reativada",
    limparBloqueios: true
  });
}

async function atualizarStatusManual(status, payload = {}, usuario = {}, opcoes = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    const assinatura = exigirAssinatura(estado);
    const data = dataISO(payload.data || payload.em) || hojeISO();
    const motivo = texto(payload.motivo || payload.observacao || "", 300);
    const proximaCobrancaEm = dataISO(payload.proximaCobrancaEm) || assinatura.proximaCobrancaEm || "";
    const atualizado = {
      ...assinatura,
      status,
      motivoStatus: motivo,
      proximaCobrancaEm,
      atualizadoEm: agoraISO()
    };

    if (opcoes.campoData) atualizado[opcoes.campoData] = data;
    if (opcoes.limparBloqueios) {
      atualizado.inadimplenteDesde = "";
      atualizado.suspensoEm = "";
    }

    estado.assinatura = atualizado;
    estado.eventos.unshift(evento(opcoes.tipoEvento, { status, data, motivo, proximaCobrancaEm }, usuario));

    return {
      ok: true,
      acao: opcoes.tipoEvento,
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-status-${status}-${tenantAtual()}-${Date.now()}` });
}
