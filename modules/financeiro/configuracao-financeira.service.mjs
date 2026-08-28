import {
  lerJsonDuravel,
  salvarJsonDuravel
} from "../core/persistence/durable-json.mjs";

const CONFIG_ARQ = "financeiro_config.json";
const PLANOS_ARQ = "planos.json";

const txt = (valor) => String(valor ?? "").trim();
const norm = (valor) =>
  txt(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function centavos(valor) {
  return Math.round(numero(valor, 0) * 100);
}

function reais(valorCentavos) {
  return Number((Math.max(0, Number(valorCentavos) || 0) / 100).toFixed(2));
}

function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

function dataISO(valor = "") {
  const s = txt(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function diasEntre(inicioISO, fimISO) {
  const a = Date.parse(`${inicioISO}T12:00:00Z`);
  const b = Date.parse(`${fimISO}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function valorTituloCentavos(titulo = {}) {
  if (Number.isInteger(titulo.valorCentavos)) {
    return Math.max(0, titulo.valorCentavos);
  }
  return Math.max(
    0,
    centavos(
      titulo.valorOriginal ??
      titulo.valorBruto ??
      titulo.valor ??
      titulo.total ??
      0
    )
  );
}

function valorPagoCentavos(titulo = {}) {
  if (Number.isInteger(titulo.valorPagoCentavos)) {
    return Math.max(0, titulo.valorPagoCentavos);
  }
  return Math.max(
    0,
    centavos(
      titulo.valorPago ??
      titulo.valorRecebido ??
      titulo.valor_pago ??
      0
    )
  );
}

function acrescimoCentavos(titulo = {}) {
  if (Number.isInteger(titulo.acrescimoCentavos)) {
    return Math.max(0, titulo.acrescimoCentavos);
  }
  return Math.max(
    0,
    centavos(titulo.acrescimo ?? titulo.juros ?? titulo.multa ?? 0)
  );
}

function ehMatriculaInicial(titulo = {}, mensalidade = {}) {
  const contexto = norm([
    titulo.origem,
    titulo.categoria,
    titulo.descricao,
    mensalidade.origem,
    mensalidade.categoria,
    mensalidade.descricao,
    mensalidade.tipoCobranca
  ].join(" "));

  return [
    "matricula_inicial_unificada",
    "matricula inicial",
    "matricula + mensalidade",
    "entrada_unica",
    "entrada unica",
    "taxa de matricula",
    "adesao"
  ].some((termo) => contexto.includes(termo));
}

function ehMensalidadeRecorrente(titulo = {}, mensalidade = {}) {
  if (ehMatriculaInicial(titulo, mensalidade)) return false;
  const contexto = norm([
    titulo.origem,
    titulo.categoria,
    titulo.descricao,
    mensalidade.origem,
    mensalidade.categoria,
    mensalidade.descricao
  ].join(" "));
  return Boolean(mensalidade?.id) || contexto.includes("mensal");
}

function planoAtivo(plano = {}) {
  const s = norm(plano.status || "ativo");
  return ![
    "inativo",
    "inativa",
    "cancelado",
    "cancelada",
    "excluido",
    "excluida"
  ].includes(s);
}

function normalizarAtrasoSalvo(dados = {}) {
  return {
    ativo: dados.ativo !== false,
    multaPercentual: clamp(numero(dados.multaPercentual, 0), 0, 100),
    jurosDiaPercentual: clamp(numero(dados.jurosDiaPercentual, 0), 0, 100),
    carenciaDias: Math.max(
      0,
      Math.min(365, Math.trunc(numero(dados.carenciaDias, 0)))
    )
  };
}

export async function obterConfiguracaoAtraso() {
  const [configBruta, planos] = await Promise.all([
    lerJsonDuravel(CONFIG_ARQ, {}),
    lerJsonDuravel(PLANOS_ARQ, [])
  ]);

  const salvo =
    configBruta &&
    typeof configBruta === "object" &&
    configBruta.atraso &&
    typeof configBruta.atraso === "object"
      ? normalizarAtrasoSalvo(configBruta.atraso)
      : null;

  const percentuaisPlanos = [
    ...new Set(
      (Array.isArray(planos) ? planos : [])
        .filter(planoAtivo)
        .map((plano) =>
          clamp(numero(plano.multaAtrasoPercentual, 0), 0, 100)
        )
        .filter((valor) => valor > 0)
        .map((valor) => Number(valor.toFixed(4)))
    )
  ].sort((a, b) => a - b);

  const sugestaoLegada =
    percentuaisPlanos.length === 1
      ? percentuaisPlanos[0]
      : 0;

  return {
    configurado: Boolean(salvo),
    ativo: salvo?.ativo ?? true,
    multaPercentual: salvo?.multaPercentual ?? sugestaoLegada,
    jurosDiaPercentual: salvo?.jurosDiaPercentual ?? 0,
    carenciaDias: salvo?.carenciaDias ?? 0,
    fonte: salvo
      ? "administrativo"
      : percentuaisPlanos.length
        ? "planos_legados"
        : "padrao_zero",
    percentuaisPlanosLegados: percentuaisPlanos,
    aviso:
      !salvo && percentuaisPlanos.length > 1
        ? "Existem percentuais diferentes nos planos antigos. Salve uma regra global para centralizar."
        : ""
  };
}

export async function salvarConfiguracaoAtraso(
  dados = {},
  usuario = "sistema"
) {
  const atual = await lerJsonDuravel(CONFIG_ARQ, {});
  const atraso = normalizarAtrasoSalvo(dados);

  const novo = {
    ...(atual && typeof atual === "object" ? atual : {}),
    atraso: {
      ...atraso,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: txt(usuario) || "sistema"
    }
  };

  await salvarJsonDuravel(CONFIG_ARQ, novo);
  return obterConfiguracaoAtraso();
}

export function regraAtrasoParaPlano(config = {}, plano = {}) {
  const multaPlano = clamp(
    numero(plano?.multaAtrasoPercentual, 0),
    0,
    100
  );

  return {
    ativo: config.ativo !== false,
    multaPercentual: config.configurado
      ? clamp(numero(config.multaPercentual, 0), 0, 100)
      : (multaPlano || clamp(numero(config.multaPercentual, 0), 0, 100)),
    jurosDiaPercentual: clamp(
      numero(config.jurosDiaPercentual, 0),
      0,
      100
    ),
    carenciaDias: Math.max(
      0,
      Math.min(365, Math.trunc(numero(config.carenciaDias, 0)))
    )
  };
}

export function calcularEncargosAtraso({
  titulo = {},
  mensalidade = {},
  plano = {},
  config = {},
  dataPagamento = ""
} = {}) {
  const regra = regraAtrasoParaPlano(config, plano);

  const vencimento = dataISO(
    titulo.vencimento ||
    titulo.dataVencimento ||
    mensalidade.vencimento ||
    mensalidade.dataVencimento
  );
  const pagamento = dataISO(dataPagamento);

  const totalC = valorTituloCentavos(titulo);
  const pagoC = Math.min(totalC, valorPagoCentavos(titulo));
  const saldoPrincipalC = Math.max(0, totalC - pagoC);

  const base = {
    aplicavel: false,
    motivo: "",
    vencimento,
    dataPagamento: pagamento,
    diasAtraso: 0,
    diasComEncargo: 0,
    multaPercentual: regra.multaPercentual,
    jurosDiaPercentual: regra.jurosDiaPercentual,
    carenciaDias: regra.carenciaDias,
    saldoPrincipalCentavos: saldoPrincipalC,
    multaTotalEsperadaCentavos: 0,
    jurosTotalEsperadoCentavos: 0,
    multaJaAplicadaCentavos: 0,
    jurosJaAplicadoCentavos: 0,
    multaPendenteCentavos: 0,
    jurosPendenteCentavos: 0,
    encargosPendentesCentavos: 0,
    valorDevidoCentavos: saldoPrincipalC
  };

  if (!regra.ativo) return { ...base, motivo: "regra_desativada" };
  if (!ehMensalidadeRecorrente(titulo, mensalidade)) {
    return { ...base, motivo: "nao_mensalidade_recorrente" };
  }
  if (!vencimento || !pagamento) {
    return { ...base, motivo: "data_invalida" };
  }
  if (pagamento <= vencimento) {
    return { ...base, motivo: "nao_atrasado" };
  }
  if (saldoPrincipalC <= 0) {
    return { ...base, motivo: "sem_saldo" };
  }

  const diasAtraso = diasEntre(vencimento, pagamento);
  const diasComEncargo = Math.max(
    0,
    diasAtraso - regra.carenciaDias
  );

  if (diasComEncargo <= 0) {
    return {
      ...base,
      motivo: "dentro_carencia",
      diasAtraso,
      diasComEncargo
    };
  }

  const multaEsperadaC = Math.max(
    0,
    Math.round(saldoPrincipalC * regra.multaPercentual / 100)
  );
  const jurosEsperadoC = Math.max(
    0,
    Math.round(
      saldoPrincipalC *
      regra.jurosDiaPercentual /
      100 *
      diasComEncargo
    )
  );

  const marcadorMulta =
    Number.isInteger(titulo.multaAtrasoAplicadaCentavos)
      ? Math.max(0, titulo.multaAtrasoAplicadaCentavos)
      : null;

  const marcadorJuros =
    Number.isInteger(titulo.jurosAtrasoAplicadoCentavos)
      ? Math.max(0, titulo.jurosAtrasoAplicadoCentavos)
      : null;

  const legado =
    marcadorMulta === null && marcadorJuros === null
      ? Math.min(
          multaEsperadaC + jurosEsperadoC,
          acrescimoCentavos(titulo)
        )
      : 0;

  const multaJaC =
    marcadorMulta !== null
      ? marcadorMulta
      : Math.min(multaEsperadaC, legado);

  const jurosJaC =
    marcadorJuros !== null
      ? marcadorJuros
      : Math.min(
          jurosEsperadoC,
          Math.max(0, legado - multaJaC)
        );

  const multaPendenteC = Math.max(
    0,
    multaEsperadaC - multaJaC
  );
  const jurosPendenteC = Math.max(
    0,
    jurosEsperadoC - jurosJaC
  );
  const encargosPendentesC =
    multaPendenteC + jurosPendenteC;

  return {
    ...base,
    aplicavel: true,
    motivo:
      encargosPendentesC > 0
        ? "encargos_pendentes"
        : "encargos_ja_aplicados",
    diasAtraso,
    diasComEncargo,
    multaTotalEsperadaCentavos: multaEsperadaC,
    jurosTotalEsperadoCentavos: jurosEsperadoC,
    multaJaAplicadaCentavos: multaJaC,
    jurosJaAplicadoCentavos: jurosJaC,
    multaPendenteCentavos: multaPendenteC,
    jurosPendenteCentavos: jurosPendenteC,
    encargosPendentesCentavos: encargosPendentesC,
    valorDevidoCentavos:
      saldoPrincipalC + encargosPendentesC
  };
}

export function valoresEncargosReais(calculo = {}) {
  return {
    saldoPrincipal: reais(calculo.saldoPrincipalCentavos),
    multaTotalEsperada: reais(calculo.multaTotalEsperadaCentavos),
    jurosTotalEsperado: reais(calculo.jurosTotalEsperadoCentavos),
    multaJaAplicada: reais(calculo.multaJaAplicadaCentavos),
    jurosJaAplicado: reais(calculo.jurosJaAplicadoCentavos),
    multaPendente: reais(calculo.multaPendenteCentavos),
    jurosPendente: reais(calculo.jurosPendenteCentavos),
    encargosPendentes: reais(calculo.encargosPendentesCentavos),
    valorDevido: reais(calculo.valorDevidoCentavos)
  };
}
