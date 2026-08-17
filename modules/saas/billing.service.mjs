import crypto from "node:crypto";
import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";
import {
  adicionarDiasBilling,
  adicionarMesesBilling,
  avaliarAcessoBilling,
  calcularTransicoesBilling,
  dataCivil,
  normalizarDiasTolerancia
} from "./billing-policy.mjs";

const COLECAO = "fusion_billing";
const STATUS_VALIDOS = new Set(["trial", "ativa", "inadimplente", "suspensa", "cancelada"]);
const PLANO_PADRAO = "free";

function planoValorEnv(nome, fallback = 0) {
  return numero(process.env[nome], fallback);
}

function codigoPlano(valor = "") {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function catalogoPlanosFusion() {
  const valorMensal = planoValorEnv("FUSION_PLANO_MENSAL_VALOR", 0);
  const valorAnual = planoValorEnv("FUSION_PLANO_ANUAL_VALOR", valorMensal > 0 ? valorMensal * 12 : 0);
  const valorMensalAnual = planoValorEnv(
    "FUSION_PLANO_ANUAL_VALOR_MENSAL",
    valorAnual > 0 ? valorAnual / 12 : 0
  );

  return [
    {
      codigo: "free",
      nome: "Free",
      descricao: "Entrada controlada para validacao inicial da academia.",
      ciclo: "free",
      periodoMeses: 0,
      valorMensal: 0,
      valorCiclo: 0,
      trialDias: 0,
      fidelidade: false,
      statusInicial: "ativa",
      destaque: "Sem cobranca",
      recursos: [
        "Cadastro inicial da academia",
        "Acesso administrativo essencial",
        "Base pronta para evoluir para plano pago"
      ],
      limites: {
        alunos: 30,
        usuarios: 2
      }
    },
    {
      codigo: "mensal-sem-fidelidade",
      nome: "Mensal sem fidelidade",
      descricao: "Assinatura mensal do Fusion, sem contrato minimo.",
      ciclo: "mensal",
      periodoMeses: 1,
      valorMensal,
      valorCiclo: valorMensal,
      trialDias: 0,
      fidelidade: false,
      statusInicial: "ativa",
      destaque: valorMensal > 0 ? "Cobranca mensal" : "Valor a definir",
      recursos: [
        "Uso completo do Fusion ERP",
        "Mensalidade recorrente",
        "Cancelamento sem fidelidade"
      ],
      limites: {
        alunos: null,
        usuarios: null
      }
    },
    {
      codigo: "anual",
      nome: "Anual",
      descricao: "Assinatura anual do Fusion para academias em operacao continua.",
      ciclo: "anual",
      periodoMeses: 12,
      valorMensal: valorMensalAnual,
      valorCiclo: valorAnual,
      trialDias: 0,
      fidelidade: true,
      statusInicial: "ativa",
      destaque: valorAnual > 0 ? "Cobranca anual" : "Valor a definir",
      recursos: [
        "Uso completo do Fusion ERP",
        "Contrato anual",
        "Previsibilidade para expansao da academia"
      ],
      limites: {
        alunos: null,
        usuarios: null
      }
    }
  ];
}

function clonarPlano(plano = {}) {
  return {
    ...plano,
    recursos: Array.isArray(plano.recursos) ? [...plano.recursos] : [],
    limites: plano.limites && typeof plano.limites === "object" ? { ...plano.limites } : {}
  };
}

function aliasPlano(codigo = "") {
  const chave = codigoPlano(codigo);
  if (!chave) return PLANO_PADRAO;
  if (["gratis", "gratuito", "trial", "piloto", "fusion-piloto"].includes(chave)) return "free";
  if (["mensal", "mensal-sem-fidelizacao", "mensal-sem-fidelidade", "fusion-pro"].includes(chave)) {
    return "mensal-sem-fidelidade";
  }
  if (["ano", "anual", "annual"].includes(chave)) return "anual";
  return chave;
}

function statusInicialPlano(plano = {}, trialAte = "", trialDias = 0) {
  if (trialAte || trialDias > 0) return "trial";
  return texto(plano.statusInicial || "ativa", 40).toLowerCase();
}

export function listarPlanosFusion() {
  return catalogoPlanosFusion().map(clonarPlano);
}

export function resolverPlanoFusion(codigo = "", opcoes = {}) {
  const normalizado = aliasPlano(codigo);
  const plano = catalogoPlanosFusion().find(item => item.codigo === normalizado);
  if (plano) return clonarPlano(plano);

  if (opcoes.permitirCustom) {
    return {
      codigo: codigoPlano(codigo) || PLANO_PADRAO,
      nome: texto(codigo || "Plano customizado", 160),
      descricao: "",
      ciclo: "mensal",
      periodoMeses: 1,
      valorMensal: 0,
      valorCiclo: 0,
      trialDias: 0,
      fidelidade: false,
      statusInicial: "ativa",
      destaque: "Plano customizado",
      recursos: [],
      limites: {}
    };
  }

  throw Object.assign(new Error("Plano Fusion invalido."), { status: 400 });
}

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
  return dataCivil(valor);
}

function adicionarDias(dataBase = hojeISO(), dias = 0) {
  return adicionarDiasBilling(dataISO(dataBase) || hojeISO(), dias);
}

function adicionarMeses(dataBase = hojeISO(), meses = 1) {
  return adicionarMesesBilling(dataISO(dataBase) || hojeISO(), meses);
}

function diasToleranciaPadrao() {
  return normalizarDiasTolerancia(process.env.FUSION_BILLING_GRACE_DAYS, 7);
}

function estadoInicial() {
  return {
    versao: 2,
    tenantId: tenantAtual(),
    assinatura: null,
    pagamentos: [],
    eventos: []
  };
}

function normalizarEstado(valor = {}) {
  const base = valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  return {
    versao: 2,
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
  const plano = resolverPlanoFusion(
    payload.planoCodigo || payload.plano || existente?.planoCodigo || PLANO_PADRAO,
    { permitirCustom: true }
  );
  const contratadoEm = dataISO(payload.contratadoEm || payload.inicioEm) || existente?.contratadoEm || hojeISO();
  const trialAteInformado = dataISO(payload.trialAte);
  const trialDias = Math.max(0, Math.min(90, Number(
    payload.trialDias ?? existente?.trialDias ?? plano.trialDias ?? (trialAteInformado ? 14 : 0)
  )));
  const trialAte = trialAteInformado || (trialDias ? adicionarDias(contratadoEm, trialDias) : "");
  const periodoMeses = Math.max(0, Math.min(36, Number(
    payload.periodoMeses ?? payload.meses ?? existente?.periodoMeses ?? plano.periodoMeses ?? 1
  )));
  const valorMensal = numero(payload.valorMensal ?? payload.valor ?? existente?.valorMensal ?? plano.valorMensal ?? 0, 0);
  const valorCicloPadrao = periodoMeses > 1 ? valorMensal * periodoMeses : valorMensal;
  const valorCiclo = numero(
    payload.valorCiclo ?? payload.valorTotal ?? existente?.valorCiclo ?? plano.valorCiclo ?? valorCicloPadrao,
    valorCicloPadrao
  );
  const status = texto(
    payload.status || existente?.status || statusInicialPlano(plano, trialAte, trialDias),
    40
  ).toLowerCase();

  if (!STATUS_VALIDOS.has(status)) {
    throw Object.assign(new Error("Status de assinatura invalido."), { status: 400 });
  }

  const proximaCobrancaPadrao = trialAte || (periodoMeses > 0 ? adicionarMeses(contratadoEm, periodoMeses) : "");

  return {
    id: existente?.id || `bill_sub_${crypto.randomUUID()}`,
    tenantId,
    planoCodigo: texto(plano.codigo || payload.planoCodigo || payload.plano || existente?.planoCodigo || PLANO_PADRAO, 80),
    planoNome: texto(payload.planoNome || existente?.planoNome || plano.nome || "Plano Fusion", 160),
    planoDescricao: texto(payload.planoDescricao || existente?.planoDescricao || plano.descricao || "", 300),
    ciclo: texto(payload.ciclo || existente?.ciclo || plano.ciclo || "mensal", 40),
    periodoMeses,
    fidelidade: payload.fidelidade ?? existente?.fidelidade ?? Boolean(plano.fidelidade),
    moeda: texto(payload.moeda || existente?.moeda || "BRL", 12),
    valorMensal,
    valorCiclo,
    status,
    trialDias,
    trialAte,
    destaque: texto(payload.destaque || existente?.destaque || plano.destaque || "", 120),
    recursos: Array.isArray(payload.recursos)
      ? payload.recursos.map(item => texto(item, 120)).filter(Boolean)
      : Array.isArray(existente?.recursos)
        ? existente.recursos
        : plano.recursos,
    limites: payload.limites && typeof payload.limites === "object"
      ? { ...payload.limites }
      : existente?.limites && typeof existente.limites === "object"
        ? { ...existente.limites }
        : plano.limites,
    contratadoEm,
    proximaCobrancaEm: dataISO(payload.proximaCobrancaEm) || existente?.proximaCobrancaEm || proximaCobrancaPadrao,
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

function politicaAtual(assinatura = null) {
  return {
    diasTolerancia: diasToleranciaPadrao(),
    suspensaoAutomatica: true,
    acesso: avaliarAcessoBilling(assinatura)
  };
}

export async function obterBillingFusion() {
  const estado = await carregarEstado();
  return {
    ok: true,
    modulo: "saas-billing",
    tenantId: estado.tenantId,
    assinatura: estado.assinatura,
    politica: politicaAtual(estado.assinatura),
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
      planoNome: estado.assinatura.planoNome,
      ciclo: estado.assinatura.ciclo,
      periodoMeses: estado.assinatura.periodoMeses,
      fidelidade: estado.assinatura.fidelidade,
      valorMensal: estado.assinatura.valorMensal,
      valorCiclo: estado.assinatura.valorCiclo,
      proximaCobrancaEm: estado.assinatura.proximaCobrancaEm
    }, usuario));

    return {
      ok: true,
      acao: novoContrato ? "contratacao_formalizada" : "contratacao_atualizada",
      politica: politicaAtual(estado.assinatura),
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-contratacao-${tenantAtual()}-${Date.now()}` });
}

export async function registrarPagamentoFusion(payload = {}, usuario = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    const assinatura = exigirAssinatura(estado);
    const recebidoEm = dataISO(payload.recebidoEm || payload.data) || hojeISO();
    const meses = Math.max(1, Math.min(36, Number(payload.periodoMeses || payload.meses || assinatura.periodoMeses || 1)));
    const baseCiclo = assinatura.pagoAte && assinatura.pagoAte > recebidoEm ? assinatura.pagoAte : recebidoEm;
    const coberturaAte = dataISO(payload.coberturaAte || payload.pagoAte) || adicionarMeses(baseCiclo, meses);
    const pagamento = {
      id: `bill_pay_${crypto.randomUUID()}`,
      tenantId: tenantAtual(),
      valor: numero(payload.valor ?? assinatura.valorCiclo ?? assinatura.valorMensal, 0),
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

    const statusAntes = assinatura.status;
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
      coberturaAte,
      reativouAutomaticamente: ["inadimplente", "suspensa"].includes(statusAntes)
    }, usuario));

    return {
      ok: true,
      acao: "pagamento_registrado",
      pagamento,
      politica: politicaAtual(estado.assinatura),
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-pagamento-${tenantAtual()}-${Date.now()}` });
}

export async function renovarAssinaturaFusion(payload = {}, usuario = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    const assinatura = exigirAssinatura(estado);
    const inicio = dataISO(payload.inicioEm) || assinatura.pagoAte || hojeISO();
    const meses = Math.max(1, Math.min(36, Number(payload.periodoMeses || payload.meses || assinatura.periodoMeses || 1)));
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
      politica: politicaAtual(estado.assinatura),
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-renovacao-${tenantAtual()}-${Date.now()}` });
}

export async function processarBillingFusion(payload = {}, usuario = {}) {
  return executarTransacaoJson(async () => {
    const estado = await carregarEstado();
    if (!estado.assinatura?.id) {
      return {
        ok: true,
        acao: "sem_assinatura",
        alterado: false,
        tenantId: tenantAtual(),
        transicoes: [],
        politica: politicaAtual(null)
      };
    }

    const diasTolerancia = normalizarDiasTolerancia(payload.diasTolerancia, diasToleranciaPadrao());
    const avaliacao = calcularTransicoesBilling(estado.assinatura, {
      dataReferencia: payload.dataReferencia || payload.data,
      diasTolerancia
    });

    if (!avaliacao.transicoes.length) {
      return {
        ok: true,
        acao: "billing_sem_transicao",
        alterado: false,
        tenantId: tenantAtual(),
        assinatura: estado.assinatura,
        transicoes: [],
        avaliacao,
        politica: { diasTolerancia, suspensaoAutomatica: true, acesso: avaliacao.acesso }
      };
    }

    const aplicadas = [];
    for (const transicao of avaliacao.transicoes) {
      if (transicao.para === "inadimplente") {
        estado.assinatura = {
          ...estado.assinatura,
          status: "inadimplente",
          inadimplenteDesde: transicao.em,
          suspensoEm: "",
          motivoStatus: transicao.motivo,
          atualizadoEm: agoraISO()
        };
      } else if (transicao.para === "suspensa") {
        estado.assinatura = {
          ...estado.assinatura,
          status: "suspensa",
          inadimplenteDesde: estado.assinatura.inadimplenteDesde || avaliacao.inadimplenteDesde,
          suspensoEm: transicao.em,
          motivoStatus: transicao.motivo,
          atualizadoEm: agoraISO()
        };
      }

      estado.eventos.unshift(evento(transicao.tipoEvento, {
        de: transicao.de,
        para: transicao.para,
        data: transicao.em,
        vencimento: avaliacao.vencimento,
        diasTolerancia,
        motivo: transicao.motivo,
        automatico: true
      }, usuario));
      aplicadas.push(transicao);
    }

    const salvo = await salvarEstado(estado);
    return {
      ok: true,
      acao: aplicadas.at(-1)?.tipoEvento || "billing_processado",
      alterado: true,
      tenantId: tenantAtual(),
      transicoes: aplicadas,
      avaliacao: calcularTransicoesBilling(salvo.assinatura, { dataReferencia: avaliacao.dataReferencia, diasTolerancia }),
      politica: { diasTolerancia, suspensaoAutomatica: true, acesso: avaliarAcessoBilling(salvo.assinatura) },
      ...salvo
    };
  }, { operacaoId: `saas-billing-processar-${tenantAtual()}-${dataISO(payload.dataReferencia || payload.data) || hojeISO()}` });
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
      politica: politicaAtual(estado.assinatura),
      ...(await salvarEstado(estado))
    };
  }, { operacaoId: `saas-billing-status-${status}-${tenantAtual()}-${Date.now()}` });
}
