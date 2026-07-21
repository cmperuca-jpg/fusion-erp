import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const FILES = {
  mensalidades: path.join(DATA_DIR, "mensalidades.json"),
  financeiro: path.join(DATA_DIR, "financeiro.json"),
  matriculas: path.join(DATA_DIR, "matriculas.json"),
  alunos: path.join(DATA_DIR, "alunos.json"),
  planos: path.join(DATA_DIR, "planos.json"),
  cobrancaLog: path.join(DATA_DIR, "cobranca_log.json"),
  creditos: path.join(DATA_DIR, "creditos.json")
};

async function garantirArquivo(arquivo, padrao = []) {
  try {
    await fs.access(arquivo);
  } catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), "utf8");
  }
}

async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const txt = await fs.readFile(arquivo, "utf8");
  if (!txt.trim()) return padrao;
  try {
    return JSON.parse(txt) ?? padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf8");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao;
}

function gerarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function somenteData(valor) {
  return String(valor || "").slice(0, 10);
}

function competencia(dataISO) {
  return somenteData(dataISO || hojeISO()).slice(0, 7);
}

function statusNormalizado(status) {
  const s = String(status || "").trim().toLowerCase();
  if (["pago", "recebido", "quitado", "baixado"].includes(s)) return "pago";
  if (["cancelado", "cancelada"].includes(s)) return "cancelado";
  if (["parcial", "parcialmente pago"].includes(s)) return "parcial";
  return "aberto";
}

function estaPago(obj = {}) {
  return statusNormalizado(obj.status) === "pago" ||
    statusNormalizado(obj.statusPagamento) === "pago" ||
    Boolean(obj.dataPagamento || obj.pagamento || obj.baixadoEm);
}

function statusMatriculaAtivo(status) {
  return ["ativa", "ativo"].includes(String(status || "").trim().toLowerCase());
}

function normalizarPeriodicidadePlano(plano = {}, matricula = {}) {
  const bruto = String(
    matricula.periodicidade ||
    matricula.periodicidadePlano ||
    plano.periodicidade ||
    plano.tipo ||
    "Mensal"
  ).trim().toLowerCase();

  const mesesDireto = Number(
    matricula.periodicidadeMeses ??
    matricula.mesesCiclo ??
    plano.periodicidadeMeses ??
    plano.mesesCiclo ??
    plano.duracaoMeses ??
    0
  );

  if (Number.isFinite(mesesDireto) && mesesDireto > 0) {
    return { nome: "Personalizado", meses: Math.max(1, Math.round(mesesDireto)) };
  }

  if (bruto.includes("bimes")) return { nome: "Bimestral", meses: 2 };
  if (bruto.includes("trimes")) return { nome: "Trimestral", meses: 3 };
  if (bruto.includes("semes")) return { nome: "Semestral", meses: 6 };
  if (bruto.includes("anual") || bruto.includes("ano")) return { nome: "Anual", meses: 12 };
  if (bruto.includes("avul")) return { nome: "Avulso", meses: 0 };

  return { nome: "Mensal", meses: 1 };
}

function planoRenovaAutomaticamente(plano = {}, matricula = {}) {
  if (matricula.renovacaoAutomatica === false || matricula.gerarMensalidadeAutomatica === false) return false;
  if (plano.renovacaoAutomatica === false || plano.renovarAutomaticamente === false) return false;

  const periodicidade = normalizarPeriodicidadePlano(plano, matricula);
  if (periodicidade.meses <= 0) return false;

  return true;
}

function adicionarMeses(dataISO, meses = 1, diaVencimento = null) {
  const origem = somenteData(dataISO || hojeISO());
  const base = new Date(`${origem}T12:00:00`);
  const diaOriginal = base.getDate();
  const diaDesejado = diaVencimento ? Number(diaVencimento) : diaOriginal;

  // Evita estouro de mês. Ex.: 31/01 + 1 mês não deve virar março.
  base.setDate(1);
  base.setMonth(base.getMonth() + Number(meses || 1));

  const ultimoDiaMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(Math.max(diaDesejado, 1), ultimoDiaMes));

  return base.toISOString().slice(0, 10);
}

function diaMes(dataISO) {
  const data = somenteData(dataISO || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const dia = Number(data.slice(8, 10));
  return Number.isFinite(dia) && dia > 0 ? dia : null;
}

function dataReferenciaParaProximaCobranca(mensalidadeAtual = {}, matricula = {}, aluno = {}) {
  // Reativação cria um novo ciclo. A primeira mensalidade futura deve nascer
  // exatamente um mês após a data do pagamento/recebimento da reativação.
  // Não herda dia de vencimento antigo importado nem data de matrícula anterior.
  if (ehReativacao(mensalidadeAtual) || ehReativacao(matricula)) {
    return (
      mensalidadeAtual.dataPagamento ||
      mensalidadeAtual.pagamento ||
      mensalidadeAtual.dataRecebimento ||
      mensalidadeAtual.vencimento ||
      mensalidadeAtual.dataVencimento ||
      matricula.dataInicio ||
      matricula.dataMatricula ||
      hojeISO()
    );
  }

  // Para mensalidade recorrente comum, a base é sempre o vencimento da própria mensalidade paga.
  if (ehMensalidadeRecorrente(mensalidadeAtual)) {
    return mensalidadeAtual.vencimento || mensalidadeAtual.dataVencimento || hojeISO();
  }

  // Para matrícula inicial/taxa única comum, mantém a regra comercial da matrícula.
  return (
    matricula.dataMatricula ||
    matricula.matriculaEm ||
    aluno.dataMatricula ||
    aluno.matriculaEm ||
    mensalidadeAtual.dataMatricula ||
    mensalidadeAtual.criadoEm ||
    matricula.vencimentoInicial ||
    mensalidadeAtual.vencimento ||
    mensalidadeAtual.dataVencimento ||
    hojeISO()
  );
}

function encontrarMatriculaAtiva(matriculas, mensalidade = {}, aluno = {}) {
  if (mensalidade.matriculaId) {
    const porId = matriculas.find(m => String(m.id) === String(mensalidade.matriculaId));
    if (porId && statusMatriculaAtivo(porId.status)) return porId;
  }

  const alunoId = mensalidade.alunoId || aluno.id;
  return matriculas.find(m =>
    String(m.alunoId) === String(alunoId) &&
    statusMatriculaAtivo(m.status)
  ) || null;
}

function encontrarPlano(planos, matricula = {}, aluno = {}) {
  const planoId = matricula.planoId || aluno.planoId || "";
  return planos.find(p => String(p.id) === String(planoId)) || null;
}


function textoLancamento(obj = {}) {
  return [
    obj.descricao, obj.categoria, obj.origem, obj.tipoCobranca, obj.tipoLancamento,
    obj.plano, obj.observacao, obj.observacoes
  ].map(v => String(v || "").toLowerCase()).join(" ");
}

function ehReativacao(obj = {}) {
  const txt = textoLancamento(obj);
  return txt.includes("reativacao") || txt.includes("reativação") || txt.includes("reativar");
}

function ehCobrancaInicialOuTaxa(obj = {}) {
  const txt = textoLancamento(obj);
  if (obj.taxaMatricula && numero(obj.taxaMatricula) > 0 && !txt.includes("mensalidade")) return true;
  return (
    ehReativacao(obj) ||
    txt.includes("matrícula inicial") ||
    txt.includes("matricula inicial") ||
    txt.includes("taxa de matrícula") ||
    txt.includes("taxa de matricula") ||
    txt.includes("taxa matricula") ||
    txt.includes("adesão") ||
    txt.includes("adesao") ||
    txt.includes("origem:matricula") ||
    txt.includes("matricula_inicial")
  );
}

function ehMensalidadeRecorrente(obj = {}) {
  const txt = textoLancamento(obj);
  if (ehCobrancaInicialOuTaxa(obj)) return false;
  return (
    txt.includes("mensalidade") ||
    txt.includes("mensalidades") ||
    txt.includes("mensalidade_automatica") ||
    obj.mensalidadeId ||
    obj.competencia
  );
}

function existeMensalidadeFuturaAberta(mensalidades, alunoId, matriculaId, vencimentoBase) {
  const base = somenteData(vencimentoBase || hojeISO());

  return mensalidades.some(m => {
    const mesmoAluno = String(m.alunoId) === String(alunoId);
    const mesmaMatricula = !matriculaId || !m.matriculaId || String(m.matriculaId) === String(matriculaId);
    const futuraOuAtual = somenteData(m.vencimento || m.dataVencimento || "") >= base;
    const aberta = ["aberto", "parcial"].includes(statusNormalizado(m.status));
    const naoCancelada = statusNormalizado(m.status) !== "cancelado";
    return mesmoAluno && mesmaMatricula && futuraOuAtual && aberta && naoCancelada;
  });
}

function existeMensalidadeCompetencia(mensalidades, alunoId, matriculaId, competenciaAlvo) {
  const comp = String(competenciaAlvo || "").slice(0, 7);
  if (!comp) return false;

  return mensalidades.some(m => {
    const mesmoAluno = String(m.alunoId) === String(alunoId);
    const mesmaMatricula = !matriculaId || !m.matriculaId || String(m.matriculaId) === String(matriculaId);
    const compItem = String(m.competencia || competencia(m.vencimento || m.dataVencimento || "")).slice(0, 7);
    const naoCancelada = statusNormalizado(m.status) !== "cancelado";
    return mesmoAluno && mesmaMatricula && compItem === comp && naoCancelada;
  });
}

function ultimaMensalidadeRecorrenteDoAluno(mensalidades, alunoId, matriculaId = "") {
  const lista = mensalidades
    .filter(m => {
      const mesmoAluno = String(m.alunoId) === String(alunoId);
      const mesmaMatricula = !matriculaId || !m.matriculaId || String(m.matriculaId) === String(matriculaId);
      const recorrente = ehMensalidadeRecorrente(m);
      const naoCancelada = statusNormalizado(m.status) !== "cancelado";
      return mesmoAluno && mesmaMatricula && recorrente && naoCancelada;
    })
    .sort((a, b) => String(b.vencimento || b.dataVencimento || "").localeCompare(String(a.vencimento || a.dataVencimento || "")));

  return lista[0] || null;
}

async function registrarLog(evento) {
  const log = await lerJson(FILES.cobrancaLog, []);
  log.unshift({
    id: gerarId("cob_log"),
    ...evento,
    criadoEm: agoraISO()
  });
  await salvarJson(FILES.cobrancaLog, log.slice(0, 1000));
}

function primeiroNumeroValido(...valores) {
  for (const valor of valores) {
    if (valor === undefined || valor === null || valor === "") continue;
    const n = numero(valor, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function valorTaxaUnica(plano = {}, matricula = {}, aluno = {}) {
  return primeiroNumeroValido(
    matricula.taxaMatricula,
    matricula.taxaMatriculaValor,
    matricula.valorTaxaMatricula,
    matricula.taxaAdesao,
    plano.taxaMatricula,
    plano.taxaMatriculaValor,
    plano.valorTaxaMatricula,
    plano.taxaAdesao,
    aluno.taxaMatricula
  );
}

function valorMensalidadePura(plano = {}, matricula = {}, aluno = {}) {
  // Regra principal: recorrência usa somente o valor mensal do plano.
  // Taxa de matrícula/adesão é única e nunca entra na próxima mensalidade.
  const valorPlano = primeiroNumeroValido(
    plano.valorMensal,
    plano.mensalidade,
    plano.valorRecorrente,
    plano.precoMensal,
    plano.valorPlanoMensal
  );
  if (valorPlano > 0) return valorPlano;

  const valorMatriculaMensal = primeiroNumeroValido(
    matricula.valorMensalidade,
    matricula.mensalidadeValor,
    matricula.valorRecorrente,
    matricula.valorPlanoMensal
  );
  if (valorMatriculaMensal > 0) return valorMatriculaMensal;

  const valorPossivelmenteComTaxa = primeiroNumeroValido(
    matricula.valorMensal,
    matricula.valor,
    aluno.valorMensal
  );
  const taxa = valorTaxaUnica(plano, matricula, aluno);

  if (valorPossivelmenteComTaxa > 0 && taxa > 0 && valorPossivelmenteComTaxa > taxa) {
    return numero(valorPossivelmenteComTaxa - taxa);
  }

  return valorPossivelmenteComTaxa;
}

function valorCicloPlano(plano = {}, matricula = {}, aluno = {}) {
  return valorMensalidadePura(plano, matricula, aluno);
}

function creditoAtivoAluno(credito = {}, alunoId = '') {
  const st = String(credito.status || 'Ativo').trim().toLowerCase();
  const saldo = numero(credito.saldo ?? credito.valorRestante ?? credito.valorOriginal, 0);
  return String(credito.alunoId || '') === String(alunoId || '') && saldo > 0 && !['cancelado', 'estornado', 'usado', 'utilizado', 'inativo'].includes(st);
}

function aplicarCreditosNaMensalidade(mensalidade, creditos = [], usuario = 'sistema') {
  const disponiveis = creditos
    .filter(c => creditoAtivoAluno(c, mensalidade.alunoId))
    .sort((a, b) => String(a.criadoEm || a.dataCredito || '').localeCompare(String(b.criadoEm || b.dataCredito || '')));

  let restante = numero(mensalidade.total ?? mensalidade.valor, 0);
  let aplicado = 0;
  const usos = [];

  for (const credito of disponiveis) {
    if (restante <= 0) break;
    const saldo = numero(credito.saldo ?? credito.valorRestante ?? credito.valorOriginal, 0);
    if (saldo <= 0) continue;
    const usar = Math.min(saldo, restante);
    credito.saldo = Number((saldo - usar).toFixed(2));
    credito.valorUtilizado = Number((numero(credito.valorUtilizado, 0) + usar).toFixed(2));
    credito.status = credito.saldo <= 0 ? 'Utilizado' : 'Ativo';
    credito.atualizadoEm = agoraISO();
    credito.historico = Array.isArray(credito.historico) ? credito.historico : [];
    credito.historico.push({
      id: gerarId('hist_cred'),
      acao: 'credito_utilizado',
      descricao: `Crédito utilizado automaticamente na mensalidade ${mensalidade.competencia}.`,
      mensalidadeId: mensalidade.id,
      valor: usar,
      usuario,
      criadoEm: agoraISO()
    });
    usos.push({ creditoId: credito.id, valor: usar });
    aplicado = Number((aplicado + usar).toFixed(2));
    restante = Number((restante - usar).toFixed(2));
  }

  if (aplicado > 0) {
    mensalidade.creditoAplicado = aplicado;
    mensalidade.creditosUtilizados = usos;
    mensalidade.valorAntesCredito = numero(mensalidade.total ?? mensalidade.valor, 0);
    mensalidade.valorRestante = restante;
    mensalidade.saldoRestante = restante;
    mensalidade.total = restante;
    mensalidade.valorDevido = restante;
    mensalidade.status = restante <= 0 ? 'pago' : 'aberto';
    if (restante <= 0) {
      mensalidade.valorPago = mensalidade.valorAntesCredito;
      mensalidade.dataPagamento = hojeISO();
      mensalidade.pagamento = hojeISO();
      mensalidade.formaPagamento = 'Crédito do aluno';
      mensalidade.observacao = [mensalidade.observacao, 'Mensalidade quitada automaticamente com crédito do aluno.'].filter(Boolean).join(' ');
    }
    mensalidade.historico = Array.isArray(mensalidade.historico) ? mensalidade.historico : [];
    mensalidade.historico.push({
      id: gerarId('hist_men'),
      acao: 'credito_aplicado',
      descricao: `Crédito do aluno aplicado automaticamente: R$ ${aplicado.toFixed(2)}.`,
      valor: aplicado,
      usos,
      criadoEm: agoraISO()
    });
  }

  return { valorAplicado: aplicado, usos, restante };
}

function montarMensalidade({ aluno, matricula, plano, vencimento, periodicidade }) {
  const valorPlano = valorCicloPlano(plano, matricula, aluno);
  const comp = competencia(vencimento);

  return {
    id: gerarId("men_auto"),
    alunoId: aluno.id,
    aluno: aluno.nome || aluno.aluno || aluno.name || "",
    alunoNome: aluno.nome || aluno.aluno || aluno.name || "",
    matriculaId: matricula.id || "",
    numeroMatricula: matricula.numero || "",
    planoId: matricula.planoId || plano?.id || aluno.planoId || "",
    plano: matricula.plano || plano?.nome || aluno.plano || "",
    competencia: comp,
    vencimento,
    valor: valorPlano,
    valorOriginal: valorPlano,
    taxaMatricula: 0,
    total: valorPlano,
    valorPago: 0,
    valorRestante: valorPlano,
    status: "aberto",
    origem: "mensalidade_automatica",
    renovacaoAutomatica: true,
    periodicidade: periodicidade.nome,
    periodicidadeMeses: periodicidade.meses,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    historico: [
      {
        id: gerarId("hist_men"),
        acao: "geracao_automatica",
        descricao: `Mensalidade gerada automaticamente. Periodicidade: ${periodicidade.nome}.`,
        criadoEm: agoraISO()
      }
    ]
  };
}

function montarLancamentoFinanceiro(mensalidade) {
  return {
    id: `fin_${mensalidade.id}`,
    tipo: "receber",
    descricao: `Mensalidade ${mensalidade.aluno || mensalidade.alunoNome || ""} - ${mensalidade.competencia}`,
    categoria: "Mensalidades",
    centroCusto: "Academia",
    alunoFornecedor: mensalidade.aluno || mensalidade.alunoNome || "",
    pessoa: mensalidade.aluno || mensalidade.alunoNome || "",
    pessoaFornecedor: mensalidade.aluno || mensalidade.alunoNome || "",
    alunoId: mensalidade.alunoId || "",
    matriculaId: mensalidade.matriculaId || "",
    numeroMatricula: mensalidade.numeroMatricula || "",
    planoId: mensalidade.planoId || "",
    plano: mensalidade.plano || "",
    mensalidadeId: mensalidade.id,
    valor: numero(mensalidade.total ?? mensalidade.valor),
    valorBruto: numero(mensalidade.total ?? mensalidade.valor),
    valorPago: mensalidade.status === "pago" ? numero(mensalidade.valorAntesCredito ?? mensalidade.valor ?? 0) : 0,
    valorLiquido: mensalidade.status === "pago" ? numero(mensalidade.valorAntesCredito ?? mensalidade.valor ?? 0) : 0,
    valorRestante: numero(mensalidade.total ?? mensalidade.valor),
    vencimento: mensalidade.vencimento,
    pagamento: mensalidade.pagamento || "",
    dataPagamento: mensalidade.dataPagamento || "",
    formaPagamento: mensalidade.formaPagamento || "",
    status: mensalidade.status === "pago" ? "Pago" : "Aberto",
    origem: "mensalidade_automatica",
    periodicidade: mensalidade.periodicidade,
    periodicidadeMeses: mensalidade.periodicidadeMeses,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };
}

export async function gerarProximaMensalidadeAposPagamento({ mensalidadeId = "", financeiroId = "", alunoId = "", vencimentoProgramado = "", usuario = "sistema" } = {}) {
  const [mensalidades, financeiro, matriculas, alunos, planos, creditos] = await Promise.all([
    lerJson(FILES.mensalidades, []),
    lerJson(FILES.financeiro, []),
    lerJson(FILES.matriculas, []),
    lerJson(FILES.alunos, []),
    lerJson(FILES.planos, []),
    lerJson(FILES.creditos, [])
  ]);

  let mensalidadeAtual = null;
  let lancamentoAtual = null;

  if (mensalidadeId) {
    mensalidadeAtual = mensalidades.find(m => String(m.id) === String(mensalidadeId)) || null;

    if (mensalidadeAtual && !ehMensalidadeRecorrente(mensalidadeAtual) && !estaPago(mensalidadeAtual)) {
      await registrarLog({ acao: "gerar_proxima_mensalidade", sucesso: true, gerada: false, motivo: "Cobrança inicial/taxa única ainda não paga; recorrência não gerada.", alunoId: mensalidadeAtual.alunoId || alunoId, mensalidadeId, financeiroId, usuario });
      return { ok: true, gerada: false, motivo: "Cobrança inicial/taxa única ainda não paga; próxima mensalidade não gerada." };
    }
  }

  if (financeiroId) {
    lancamentoAtual = financeiro.find(f => String(f.id) === String(financeiroId)) || null;

    if (lancamentoAtual && !ehMensalidadeRecorrente(lancamentoAtual) && !estaPago(lancamentoAtual)) {
      await registrarLog({ acao: "gerar_proxima_mensalidade", sucesso: true, gerada: false, motivo: "Lançamento inicial/taxa única ainda não pago; recorrência não gerada.", alunoId: lancamentoAtual.alunoId || alunoId, mensalidadeId, financeiroId, usuario });
      return { ok: true, gerada: false, motivo: "Lançamento inicial/taxa única ainda não pago; próxima mensalidade não gerada." };
    }

    if (!mensalidadeAtual && lancamentoAtual?.mensalidadeId) {
      mensalidadeAtual = mensalidades.find(m => String(m.id) === String(lancamentoAtual.mensalidadeId)) || null;
    }
    if (!alunoId && lancamentoAtual?.alunoId) alunoId = lancamentoAtual.alunoId;
  }

  if (!alunoId && mensalidadeAtual?.alunoId) alunoId = mensalidadeAtual.alunoId;

  if (mensalidadeAtual && !ehMensalidadeRecorrente(mensalidadeAtual) && !estaPago(mensalidadeAtual)) {
    await registrarLog({ acao: "gerar_proxima_mensalidade", sucesso: true, gerada: false, motivo: "Mensalidade inicial/taxa única ainda não paga; recorrência não gerada.", alunoId: mensalidadeAtual.alunoId || alunoId, mensalidadeId, financeiroId, usuario });
    return { ok: true, gerada: false, motivo: "Mensalidade inicial/taxa única ainda não paga; próxima mensalidade não gerada." };
  }

  const aluno = alunos.find(a => String(a.id) === String(alunoId)) || null;
  if (!aluno) {
    await registrarLog({ acao: "gerar_proxima_mensalidade", sucesso: false, motivo: "Aluno não encontrado.", alunoId, mensalidadeId, financeiroId, usuario });
    return { ok: false, gerada: false, motivo: "Aluno não encontrado." };
  }

  const matricula = encontrarMatriculaAtiva(matriculas, mensalidadeAtual || {}, aluno);
  if (!matricula) {
    await registrarLog({ acao: "gerar_proxima_mensalidade", sucesso: false, motivo: "Matrícula ativa não encontrada.", alunoId: aluno.id, mensalidadeId, financeiroId, usuario });
    return { ok: true, gerada: false, motivo: "Aluno sem matrícula ativa." };
  }

  const plano = encontrarPlano(planos, matricula, aluno);
  const periodicidade = normalizarPeriodicidadePlano(plano || {}, matricula || {});

  if (!planoRenovaAutomaticamente(plano || {}, matricula || {})) {
    await registrarLog({ acao: "gerar_proxima_mensalidade", sucesso: true, gerada: false, motivo: "Plano ou matrícula sem renovação automática.", alunoId: aluno.id, matriculaId: matricula.id, periodicidade, usuario });
    return { ok: true, gerada: false, motivo: "Plano ou matrícula sem renovação automática.", periodicidade };
  }

  let vencimentoAtual = dataReferenciaParaProximaCobranca(mensalidadeAtual || {}, matricula || {}, aluno || {});

  // Regra v5: a próxima competência é calculada a partir da cobrança paga.
  // Se a cobrança paga for recorrente, usa o vencimento dela.
  // Se a cobrança paga for matrícula inicial/taxa única, usa a data da matrícula.
  // Nunca pula competência por causa da data da baixa.
  if (mensalidadeAtual && ehMensalidadeRecorrente(mensalidadeAtual)) {
    vencimentoAtual = mensalidadeAtual.vencimento || mensalidadeAtual.dataVencimento || vencimentoAtual;
  }

  const cicloReativacao = ehReativacao(mensalidadeAtual || {}) || ehReativacao(lancamentoAtual || {}) || ehReativacao(matricula || {});
  const diaVencimento = cicloReativacao
    ? diaMes(vencimentoAtual)
    : (
      matricula.diaVencimento ||
      aluno.diaVencimento ||
      diaMes(vencimentoAtual) ||
      diaMes(matricula.vencimentoInicial) ||
      diaMes(matricula.dataMatricula) ||
      diaMes(aluno.dataMatricula) ||
      null
    );

  const proximoVencimento = somenteData(vencimentoProgramado) || adicionarMeses(vencimentoAtual, periodicidade.meses, diaVencimento);
  const proximaCompetencia = competencia(proximoVencimento);

  if (existeMensalidadeCompetencia(mensalidades, aluno.id, matricula.id, proximaCompetencia)) {
    await registrarLog({
      acao: "gerar_proxima_mensalidade",
      sucesso: true,
      gerada: false,
      motivo: "Competência futura já existe para este aluno.",
      alunoId: aluno.id,
      matriculaId: matricula.id,
      proximoVencimento,
      competencia: proximaCompetencia,
      periodicidade,
      usuario
    });
    return { ok: true, gerada: false, motivo: "Competência futura já existe para este aluno.", proximoVencimento, competencia: proximaCompetencia, periodicidade };
  }

  const novaMensalidade = montarMensalidade({ aluno, matricula, plano, vencimento: proximoVencimento, periodicidade });
  const creditoAplicado = aplicarCreditosNaMensalidade(novaMensalidade, creditos, usuario);
  const novoLancamento = montarLancamentoFinanceiro(novaMensalidade);

  novaMensalidade.lancamentoFinanceiroId = novoLancamento.id;

  mensalidades.push(novaMensalidade);
  financeiro.push(novoLancamento);

  matricula.ultimoPagamentoEm = vencimentoAtual || hojeISO();
  matricula.ultimaMensalidadeGeradaId = novaMensalidade.id;
  matricula.proximoVencimento = proximoVencimento;
  matricula.periodicidade = periodicidade.nome;
  matricula.periodicidadeMeses = periodicidade.meses;
  matricula.renovacaoAutomatica = true;
  matricula.atualizadoEm = agoraISO();

  if (!Array.isArray(matricula.historico)) matricula.historico = [];
  matricula.historico.push({
    id: gerarId("hist_mat"),
    acao: "mensalidade_automatica",
    descricao: `Mensalidade ${novaMensalidade.competencia} gerada automaticamente. Periodicidade: ${periodicidade.nome}.`,
    mensalidadeId: novaMensalidade.id,
    financeiroId: novoLancamento.id,
    vencimento: proximoVencimento,
    periodicidade,
    usuario,
    criadoEm: agoraISO()
  });

  await salvarJson(FILES.mensalidades, mensalidades);
  await salvarJson(FILES.financeiro, financeiro);
  await salvarJson(FILES.matriculas, matriculas);
  await salvarJson(FILES.creditos, creditos);

  await registrarLog({
    acao: "gerar_proxima_mensalidade",
    sucesso: true,
    gerada: true,
    alunoId: aluno.id,
    matriculaId: matricula.id,
    mensalidadeAnteriorId: mensalidadeAtual?.id || "",
    mensalidadeId: novaMensalidade.id,
    financeiroId: novoLancamento.id,
    vencimento: proximoVencimento,
    valor: novaMensalidade.total,
    creditoAplicado: creditoAplicado.valorAplicado,
    periodicidade,
    usuario
  });

  return {
    ok: true,
    gerada: true,
    mensalidade: novaMensalidade,
    financeiro: novoLancamento,
    proximoVencimento,
    periodicidade,
    creditoAplicado,
    mensagem: creditoAplicado.valorAplicado > 0 ? "Próxima mensalidade gerada com crédito do aluno aplicado." : "Próxima mensalidade gerada automaticamente."
  };
}

// Registra somente a agenda da recorrência. Esta função não cria título,
// mensalidade, recebimento nem movimento de caixa.
export async function programarProximaCobrancaAposPagamento({ mensalidadeId = "", financeiroId = "", alunoId = "", usuario = "sistema" } = {}) {
  const [mensalidades, financeiro, matriculas, alunos, planos] = await Promise.all([
    lerJson(FILES.mensalidades, []), lerJson(FILES.financeiro, []), lerJson(FILES.matriculas, []), lerJson(FILES.alunos, []), lerJson(FILES.planos, [])
  ]);
  const mensalidade = mensalidades.find(m => String(m.id) === String(mensalidadeId)) || null;
  const lancamento = financeiro.find(f => String(f.id) === String(financeiroId)) || null;
  const aluno = alunos.find(a => String(a.id) === String(alunoId || mensalidade?.alunoId || lancamento?.alunoId)) || null;
  if (!aluno) return { ok: true, programada: false, motivo: 'Aluno não encontrado para agendamento.' };
  const matricula = encontrarMatriculaAtiva(matriculas, mensalidade || lancamento || {}, aluno);
  if (!matricula) return { ok: true, programada: false, motivo: 'Aluno sem matrícula ativa.' };
  const plano = encontrarPlano(planos, matricula, aluno);
  if (!planoRenovaAutomaticamente(plano || {}, matricula)) return { ok: true, programada: false, motivo: 'Plano sem renovação automática.' };
  const periodicidade = normalizarPeriodicidadePlano(plano || {}, matricula);
  const referencia = somenteData(mensalidade?.vencimento || lancamento?.vencimento || matricula.proximoVencimento || hojeISO());
  const proximoVencimento = adicionarMeses(referencia, periodicidade.meses, matricula.diaVencimento || diaMes(referencia));
  matricula.proximoVencimento = proximoVencimento;
  matricula.ultimoPagamentoEm = hojeISO();
  matricula.atualizadoEm = agoraISO();
  await salvarJson(FILES.matriculas, matriculas);
  await registrarLog({ acao: 'programar_proxima_cobranca', sucesso: true, alunoId: aluno.id, matriculaId: matricula.id, mensalidadeId, financeiroId, vencimento: proximoVencimento, usuario });
  return { ok: true, programada: true, proximoVencimento, motivo: 'Próxima cobrança somente programada.' };
}

export async function executarMotorCobranca(filtros = {}) {
  const [matriculas, alunos] = await Promise.all([lerJson(FILES.matriculas, []), lerJson(FILES.alunos, [])]);
  const hoje = somenteData(filtros.dataReferencia || hojeISO());
  const resultados = [];
  for (const matricula of matriculas) {
    if (!statusMatriculaAtivo(matricula.status)) continue;
    if (filtros.alunoId && String(matricula.alunoId) !== String(filtros.alunoId)) continue;
    const vencimentoProgramado = somenteData(matricula.proximoVencimento || matricula.vencimentoInicial);
    if (!vencimentoProgramado || vencimentoProgramado > hoje) continue;
    const aluno = alunos.find(a => String(a.id) === String(matricula.alunoId));
    if (!aluno) continue;
    const resultado = await gerarProximaMensalidadeAposPagamento({
      alunoId: aluno.id,
      vencimentoProgramado,
      usuario: filtros.usuario || "motor"
    });
    resultados.push({ alunoId: aluno.id, matriculaId: matricula.id, vencimentoProgramado, ...resultado });
  }

  return {
    ok: true,
    totalProcessadas: resultados.length,
    geradas: resultados.filter(r => r.gerada).length,
    resultados
  };
}

export async function previsaoCobrancaAluno(alunoId) {
  const [mensalidades, matriculas, alunos, planos] = await Promise.all([
    lerJson(FILES.mensalidades, []),
    lerJson(FILES.matriculas, []),
    lerJson(FILES.alunos, []),
    lerJson(FILES.planos, []),
    lerJson(FILES.creditos, [])
  ]);

  const aluno = alunos.find(a => String(a.id) === String(alunoId)) || null;
  const matricula = aluno ? encontrarMatriculaAtiva(matriculas, {}, aluno) : null;
  const plano = matricula ? encontrarPlano(planos, matricula, aluno) : null;
  const periodicidade = normalizarPeriodicidadePlano(plano || {}, matricula || {});

  const listaAluno = mensalidades
    .filter(m => String(m.alunoId) === String(alunoId))
    .sort((a, b) => String(b.vencimento || "").localeCompare(String(a.vencimento || "")));

  const ultima = listaAluno[0] || null;
  const proximoVencimento = ultima
    ? adicionarMeses(ultima.vencimento || hojeISO(), periodicidade.meses || 1, matricula?.diaVencimento || aluno?.diaVencimento || null)
    : null;

  return {
    ok: true,
    aluno,
    matricula,
    plano,
    periodicidade,
    renovacaoAutomatica: planoRenovaAutomaticamente(plano || {}, matricula || {}),
    ultimaMensalidade: ultima,
    proximoVencimento,
    possuiFuturaAberta: matricula ? existeMensalidadeFuturaAberta(mensalidades, alunoId, matricula.id, proximoVencimento || hojeISO()) : false
  };
}

export async function statusMotorCobranca() {
  const [mensalidades, financeiro, matriculas, log] = await Promise.all([
    lerJson(FILES.mensalidades, []),
    lerJson(FILES.financeiro, []),
    lerJson(FILES.matriculas, []),
    lerJson(FILES.cobrancaLog, [])
  ]);

  return {
    ok: true,
    modulo: "motor-cobranca",
    status: "Online",
    recurso: "periodicidade-por-competencia-v5-sem-duplicidade",
    totais: {
      mensalidades: mensalidades.length,
      financeiro: financeiro.length,
      matriculas: matriculas.length,
      logs: log.length
    },
    rotas: [
      "GET /api/cobranca/status",
      "GET /api/cobranca/previsao/:alunoId",
      "POST /api/cobranca/gerar-proxima",
      "POST /api/cobranca/executar"
    ]
  };
}
