const STATUS_ATIVOS = new Set(["trial", "ativa", "inadimplente", "suspensa", "cancelada"]);

function texto(valor = "", limite = 200) {
  return String(valor ?? "").trim().slice(0, limite);
}

export function dataCivil(valor = "") {
  const bruto = texto(valor, 40);
  if (!bruto) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
  const d = new Date(bruto);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}

export function adicionarDiasBilling(dataBase, dias = 0) {
  const data = dataCivil(dataBase);
  if (!data) return "";
  const d = new Date(`${data}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}

export function adicionarMesesBilling(dataBase, meses = 1) {
  const data = dataCivil(dataBase);
  if (!data) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + Math.max(1, Number(meses || 1));
  const novoAno = Math.floor(total / 12);
  const novoMesZero = total % 12;
  const ultimoDia = new Date(Date.UTC(novoAno, novoMesZero + 1, 0, 12)).getUTCDate();
  const novoDia = Math.min(dia, ultimoDia);
  return `${String(novoAno).padStart(4, "0")}-${String(novoMesZero + 1).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`;
}

export function normalizarDiasTolerancia(valor, fallback = 7) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(60, Math.round(n)));
}

function maiorData(...valores) {
  return valores.map(dataCivil).filter(Boolean).sort().at(-1) || "";
}

export function vencimentoBilling(assinatura = {}) {
  const status = texto(assinatura.status, 40).toLowerCase();
  if (status === "trial") {
    return maiorData(assinatura.trialAte, assinatura.proximaCobrancaEm, assinatura.pagoAte);
  }
  return maiorData(assinatura.proximaCobrancaEm, assinatura.pagoAte);
}

export function avaliarAcessoBilling(assinatura = null) {
  if (!assinatura?.id) {
    return { configurado: false, permitido: true, status: "sem_assinatura", motivo: "Billing ainda nao formalizado." };
  }
  const status = texto(assinatura.status, 40).toLowerCase();
  if (!STATUS_ATIVOS.has(status)) {
    return { configurado: true, permitido: false, status, motivo: "Status de billing invalido." };
  }
  if (["suspensa", "cancelada"].includes(status)) {
    return { configurado: true, permitido: false, status, motivo: status === "suspensa" ? "Assinatura suspensa por billing." : "Assinatura cancelada." };
  }
  return {
    configurado: true,
    permitido: true,
    status,
    motivo: status === "inadimplente" ? "Academia dentro do fluxo de cobranca/tolerancia." : "Assinatura liberada."
  };
}

export function calcularTransicoesBilling(assinatura = null, opcoes = {}) {
  if (!assinatura?.id) {
    return { dataReferencia: dataCivil(opcoes.dataReferencia) || new Date().toISOString().slice(0, 10), diasTolerancia: normalizarDiasTolerancia(opcoes.diasTolerancia), vencimento: "", inadimplenteDesde: "", suspenderEm: "", transicoes: [], acesso: avaliarAcessoBilling(null) };
  }

  const hoje = dataCivil(opcoes.dataReferencia) || new Date().toISOString().slice(0, 10);
  const diasTolerancia = normalizarDiasTolerancia(opcoes.diasTolerancia);
  const statusInicial = texto(assinatura.status, 40).toLowerCase();
  const vencimento = vencimentoBilling(assinatura);
  const transicoes = [];

  if (["cancelada", "suspensa"].includes(statusInicial) || !vencimento || hoje <= vencimento) {
    return {
      dataReferencia: hoje,
      diasTolerancia,
      vencimento,
      inadimplenteDesde: dataCivil(assinatura.inadimplenteDesde),
      suspenderEm: dataCivil(assinatura.inadimplenteDesde) ? adicionarDiasBilling(assinatura.inadimplenteDesde, diasTolerancia) : "",
      transicoes,
      acesso: avaliarAcessoBilling(assinatura)
    };
  }

  const inadimplenteDesde = dataCivil(assinatura.inadimplenteDesde) || adicionarDiasBilling(vencimento, 1);
  const suspenderEm = adicionarDiasBilling(inadimplenteDesde, diasTolerancia);
  let statusProjetado = statusInicial;

  if (["ativa", "trial"].includes(statusProjetado)) {
    transicoes.push({
      de: statusProjetado,
      para: "inadimplente",
      em: inadimplenteDesde,
      tipoEvento: "inadimplencia_automatica",
      motivo: `Cobranca vencida em ${vencimento} sem pagamento identificado.`
    });
    statusProjetado = "inadimplente";
  }

  if (statusProjetado === "inadimplente" && hoje >= suspenderEm) {
    transicoes.push({
      de: "inadimplente",
      para: "suspensa",
      em: suspenderEm,
      tipoEvento: "assinatura_suspensa_automaticamente",
      motivo: `Inadimplencia acima da tolerancia de ${diasTolerancia} dia(s).`
    });
    statusProjetado = "suspensa";
  }

  return {
    dataReferencia: hoje,
    diasTolerancia,
    vencimento,
    inadimplenteDesde,
    suspenderEm,
    transicoes,
    acesso: avaliarAcessoBilling({ ...assinatura, status: statusProjetado, inadimplenteDesde, suspensoEm: statusProjetado === "suspensa" ? suspenderEm : assinatura.suspensoEm })
  };
}
