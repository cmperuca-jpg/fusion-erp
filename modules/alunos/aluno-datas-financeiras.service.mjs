// AJUSTE DE DATAS FINANCEIRAS DO ALUNO 20260826
import {
  lerJsonDuravel,
  salvarJsonMultiplosAtomico,
  executarTransacaoJson
} from "../core/persistence/durable-json.mjs";

const COL = {
  alunos: "alunos.json",
  matriculas: "matriculas.json",
  mensalidades: "mensalidades.json",
  financeiro: "financeiro.json",
  recebimentos: "recebimentos.json",
  recibos: "recibos.json",
  caixa: "caixa.json",
  auditoria: "ajustes_datas_financeiras.json"
};

function txt(v = "") { return String(v ?? "").trim(); }
function norm(v = "") {
  return txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function id(v = {}) {
  return txt(v.id || v._id || v.codigo || v.uuid || v.recordId || v.chave);
}
function dataISO(v = "") {
  const s = txt(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function numero(v = 0) {
  const n = Number(String(v ?? 0).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function arrayDe(v, chave = "") {
  if (Array.isArray(v)) return v;
  if (chave && Array.isArray(v?.[chave])) return v[chave];
  if (Array.isArray(v?.dados)) return v.dados;
  if (Array.isArray(v?.items)) return v.items;
  return [];
}
function erro(mensagem, status = 400, code = "AJUSTE_DATAS_FINANCEIRAS") {
  const e = new Error(mensagem);
  e.status = status;
  e.statusCode = status;
  e.code = code;
  return e;
}
function pertenceAluno(item = {}, alunoId = "") {
  const alvo = txt(alunoId);
  if (!alvo) return false;
  return [
    item.alunoId, item.aluno_id, item.studentId, item.student_id,
    item.pessoaId, item.pessoa_id
  ].some((v) => txt(v) === alvo);
}
function statusPago(item = {}) {
  const s = norm(item.status || item.statusPagamento || item.situacao);
  return ["pago","paga","recebido","recebida","quitado","quitada","baixado","baixada","parcial","recebido parcial","pago parcial"].includes(s) ||
    numero(item.valorPago ?? item.valorRecebido ?? item.valorBaixado) > 0 ||
    Boolean(dataISO(item.dataPagamento || item.pagamento || item.dataRecebimento || item.dataBaixa));
}
function dataPagamento(item = {}) {
  return dataISO(
    item.dataPagamento || item.pagamento || item.dataRecebimento ||
    item.dataBaixa || item.recebidoEm || item.pagoEm
  );
}
function vencimento(item = {}) {
  return dataISO(item.vencimento || item.dataVencimento || item.data_vencimento);
}
function refs(item = {}) {
  return new Set([
    item.id, item._id,
    item.financeiroId, item.lancamentoFinanceiroId,
    item.mensalidadeId, item.recebimentoId,
    item.reciboId, item.ultimoReciboId,
    item.movimentoCaixaId, item.movimentoId,
    item.referenciaId, item.tituloId
  ].map(txt).filter(Boolean));
}
function cruzaRefs(item = {}, conjunto = new Set()) {
  for (const r of refs(item)) if (conjunto.has(r)) return true;
  return false;
}
function conjuntoRefs(...itens) {
  const s = new Set();
  for (const item of itens.flat().filter(Boolean)) {
    for (const r of refs(item)) s.add(r);
  }
  return s;
}
function nomeAluno(aluno = {}) {
  return txt(aluno.nome || aluno.nomeCompleto || aluno.name || aluno.alunoNome);
}
function moeda(v) {
  return Number(numero(v).toFixed(2));
}
function valorItem(item = {}) {
  return moeda(item.valor ?? item.total ?? item.valorOriginal ?? item.valorBruto ?? item.valorDevido);
}
function statusItem(item = {}) {
  return txt(item.status || item.statusPagamento || item.situacao || "Aberto");
}

async function lerBase() {
  const [
    alunosRaw, matriculasRaw, mensalidadesRaw, financeiroRaw,
    recebimentosRaw, recibosRaw, caixaRaw, auditoriaRaw
  ] = await Promise.all([
    lerJsonDuravel(COL.alunos, []),
    lerJsonDuravel(COL.matriculas, []),
    lerJsonDuravel(COL.mensalidades, []),
    lerJsonDuravel(COL.financeiro, []),
    lerJsonDuravel(COL.recebimentos, []),
    lerJsonDuravel(COL.recibos, []),
    lerJsonDuravel(COL.caixa, { caixas: [], movimentos: [] }),
    lerJsonDuravel(COL.auditoria, [])
  ]);

  return {
    alunos: arrayDe(alunosRaw, "alunos"),
    matriculas: arrayDe(matriculasRaw, "matriculas"),
    mensalidades: arrayDe(mensalidadesRaw, "mensalidades"),
    financeiro: arrayDe(financeiroRaw, "lancamentos"),
    recebimentos: arrayDe(recebimentosRaw, "recebimentos"),
    recibos: arrayDe(recibosRaw, "recibos"),
    caixa: Array.isArray(caixaRaw)
      ? { caixas: [], movimentos: caixaRaw }
      : {
          ...(caixaRaw && typeof caixaRaw === "object" ? caixaRaw : {}),
          caixas: Array.isArray(caixaRaw?.caixas) ? caixaRaw.caixas : [],
          movimentos: Array.isArray(caixaRaw?.movimentos) ? caixaRaw.movimentos : []
        },
    auditoria: arrayDe(auditoriaRaw, "ajustes")
  };
}

function localizarAluno(base, alunoId) {
  return base.alunos.find((a) => id(a) === txt(alunoId) || txt(a.alunoId) === txt(alunoId)) || null;
}

function montarRegistros(base, alunoId) {
  const mens = base.mensalidades.filter((m) => pertenceAluno(m, alunoId));
  const fins = base.financeiro.filter((f) => pertenceAluno(f, alunoId));
  const registros = [];
  const usadosM = new Set();
  const usadosF = new Set();

  function incluir(fin = null, men = null) {
    const conjunto = conjuntoRefs(fin, men);
    const recs = base.recebimentos.filter((r) =>
      pertenceAluno(r, alunoId) && (cruzaRefs(r, conjunto) || (
        men && txt(r.mensalidadeId) === id(men)
      ) || (
        fin && [r.lancamentoFinanceiroId, r.financeiroId, r.tituloId].some((v) => txt(v) === id(fin))
      ))
    );
    for (const r of recs) for (const x of refs(r)) conjunto.add(x);

    const recibos = base.recibos.filter((r) =>
      cruzaRefs(r, conjunto) ||
      (Array.isArray(r.tituloIds) && r.tituloIds.some((v) => conjunto.has(txt(v)))) ||
      (Array.isArray(r.itens) && r.itens.some((it) => cruzaRefs(it, conjunto)))
    );
    for (const r of recibos) for (const x of refs(r)) conjunto.add(x);

    const movimentos = base.caixa.movimentos.filter((m) => cruzaRefs(m, conjunto));
    const pagoFonte = [fin, men, ...recs, ...recibos, ...movimentos].find((x) => x && statusPago(x));
    const pagData =
      [fin, ...recs, men, ...recibos, ...movimentos]
        .map((x) => x ? dataPagamento(x) || dataISO(x.data) : "")
        .find(Boolean) || "";

    const ven =
      vencimento(fin || {}) ||
      vencimento(men || {}) ||
      recs.map(vencimento).find(Boolean) ||
      "";

    const status = statusItem(fin || men || recs[0] || {});
    const valor = valorItem(fin || men || recs[0] || {});
    const registroId = fin ? `fin:${id(fin)}` : `men:${id(men)}`;

    registros.push({
      id: registroId,
      financeiroId: fin ? id(fin) : "",
      mensalidadeId: men ? id(men) : "",
      descricao: txt(
        fin?.descricao || men?.descricao ||
        `Mensalidade ${men?.competencia || ven.slice(0, 7) || ""}`
      ),
      competencia: txt(men?.competencia || fin?.competencia || ven.slice(0, 7)),
      vencimento: ven,
      dataPagamento: pagData,
      pago: Boolean(pagoFonte),
      status,
      valor,
      recebimentoIds: recs.map(id).filter(Boolean),
      reciboIds: recibos.map(id).filter(Boolean),
      movimentoCaixaIds: movimentos.map(id).filter(Boolean)
    });
  }

  for (const fin of fins) {
    let men = null;
    const mid = txt(fin.mensalidadeId);
    if (mid) men = mens.find((m) => id(m) === mid) || null;
    if (!men) {
      men = mens.find((m) =>
        txt(m.lancamentoFinanceiroId || m.financeiroId) === id(fin)
      ) || null;
    }
    incluir(fin, men);
    usadosF.add(id(fin));
    if (men) usadosM.add(id(men));
  }

  for (const men of mens) {
    if (usadosM.has(id(men))) continue;
    incluir(null, men);
  }

  return registros.sort((a, b) =>
    String(b.dataPagamento || b.vencimento || "").localeCompare(String(a.dataPagamento || a.vencimento || ""))
  );
}

function localizarRegistro(base, alunoId, registroId) {
  const registros = montarRegistros(base, alunoId);
  const reg = registros.find((r) => r.id === txt(registroId));
  if (!reg) throw erro("Lançamento financeiro do aluno não encontrado.", 404, "REGISTRO_NAO_ENCONTRADO");
  return reg;
}

function atualizarCamposData(obj, campos, novaData, quando) {
  const out = { ...obj };
  for (const campo of campos) out[campo] = novaData;
  out.atualizadoEm = quando;
  return out;
}

export async function listarDatasFinanceirasAluno(alunoId) {
  const base = await lerBase();
  const aluno = localizarAluno(base, alunoId);
  if (!aluno) throw erro("Aluno não encontrado.", 404, "ALUNO_NAO_ENCONTRADO");

  const registros = montarRegistros(base, alunoId);
  return {
    ok: true,
    aluno: { id: txt(alunoId), nome: nomeAluno(aluno) },
    registros,
    regras: {
      vencimento: "Pode ser corrigido após a matrícula, sem alterar valor ou status.",
      pagamento: "A data de pagamento pode ser corrigida em lançamento já pago/parcial, com motivo obrigatório.",
      auditoria: "Toda alteração fica registrada com antes/depois, operador e horário."
    }
  };
}

export async function alterarDatasFinanceirasAluno(alunoId, payload = {}) {
  const registroId = txt(payload.registroId || payload.id);
  if (!registroId) throw erro("Informe o lançamento que será alterado.");

  const novoVencimento = payload.novoVencimento === undefined
    ? null
    : dataISO(payload.novoVencimento);
  const novaDataPagamento = payload.novaDataPagamento === undefined
    ? null
    : dataISO(payload.novaDataPagamento);

  if (payload.novoVencimento !== undefined && !novoVencimento) {
    throw erro("Informe um vencimento válido.");
  }
  if (payload.novaDataPagamento !== undefined && !novaDataPagamento) {
    throw erro("Informe uma data de pagamento válida.");
  }
  if (!novoVencimento && !novaDataPagamento) {
    throw erro("Nenhuma alteração de data foi informada.");
  }

  const motivo = txt(payload.motivo);
  if (novaDataPagamento && motivo.length < 5) {
    throw erro("Informe o motivo da correção da data de pagamento (mínimo 5 caracteres).");
  }

  return executarTransacaoJson(async () => {
    const base = await lerBase();
    const aluno = localizarAluno(base, alunoId);
    if (!aluno) throw erro("Aluno não encontrado.", 404, "ALUNO_NAO_ENCONTRADO");

    const reg = localizarRegistro(base, alunoId, registroId);

    if (novaDataPagamento && !reg.pago) {
      throw erro("Data de pagamento só pode ser corrigida em lançamento já pago ou parcial.", 409, "LANCAMENTO_NAO_PAGO");
    }

    const quando = new Date().toISOString();
    const operador = txt(payload.usuario || payload.operador || "Administrador");
    const antes = {
      vencimento: reg.vencimento || "",
      dataPagamento: reg.dataPagamento || ""
    };

    const alvoRefs = new Set([
      reg.financeiroId,
      reg.mensalidadeId,
      ...reg.recebimentoIds,
      ...reg.reciboIds,
      ...reg.movimentoCaixaIds
    ].map(txt).filter(Boolean));

    const fi = reg.financeiroId
      ? base.financeiro.findIndex((x) => id(x) === reg.financeiroId)
      : -1;
    const mi = reg.mensalidadeId
      ? base.mensalidades.findIndex((x) => id(x) === reg.mensalidadeId)
      : -1;

    if (novoVencimento) {
      if (fi >= 0) {
        base.financeiro[fi] = atualizarCamposData(
          base.financeiro[fi],
          ["vencimento", "dataVencimento"],
          novoVencimento,
          quando
        );
      }
      if (mi >= 0) {
        base.mensalidades[mi] = atualizarCamposData(
          base.mensalidades[mi],
          ["vencimento", "dataVencimento"],
          novoVencimento,
          quando
        );
      }

      base.recebimentos = base.recebimentos.map((r) =>
        cruzaRefs(r, alvoRefs)
          ? atualizarCamposData(r, ["vencimento"], novoVencimento, quando)
          : r
      );

      // Se o "próximo vencimento" persistido apontava exatamente para a data antiga,
      // acompanha a correção. O dia recorrente do contrato não é alterado silenciosamente.
      for (let i = 0; i < base.matriculas.length; i += 1) {
        const m = base.matriculas[i];
        if (!pertenceAluno(m, alunoId)) continue;
        if (dataISO(m.proximoVencimento) === antes.vencimento) {
          base.matriculas[i] = {
            ...m,
            proximoVencimento: novoVencimento,
            atualizadoEm: quando
          };
        }
      }
      for (let i = 0; i < base.alunos.length; i += 1) {
        const a = base.alunos[i];
        if (id(a) !== txt(alunoId) && txt(a.alunoId) !== txt(alunoId)) continue;
        if (dataISO(a.proximoVencimento) === antes.vencimento) {
          base.alunos[i] = {
            ...a,
            proximoVencimento: novoVencimento,
            atualizadoEm: quando
          };
        }
      }
    }

    if (novaDataPagamento) {
      if (fi >= 0) {
        base.financeiro[fi] = atualizarCamposData(
          base.financeiro[fi],
          ["dataPagamento", "pagamento", "dataRecebimento"],
          novaDataPagamento,
          quando
        );
      }
      if (mi >= 0) {
        base.mensalidades[mi] = atualizarCamposData(
          base.mensalidades[mi],
          ["dataPagamento", "pagamento"],
          novaDataPagamento,
          quando
        );
      }

      // Recebimento, recibo e movimento físico do caixa precisam acompanhar a mesma
      // data para BI/relatórios não enxergarem dias diferentes para o mesmo pagamento.
      base.recebimentos = base.recebimentos.map((r) =>
        cruzaRefs(r, alvoRefs)
          ? atualizarCamposData(
              r,
              ["dataRecebimento", "dataPagamento", "pagamento"],
              novaDataPagamento,
              quando
            )
          : r
      );

      base.recibos = base.recibos.map((r) => {
        const ligado =
          cruzaRefs(r, alvoRefs) ||
          (Array.isArray(r.tituloIds) && r.tituloIds.some((v) => alvoRefs.has(txt(v)))) ||
          (Array.isArray(r.itens) && r.itens.some((it) => cruzaRefs(it, alvoRefs)));
        return ligado
          ? atualizarCamposData(r, ["data", "dataPagamento", "dataRecebimento"], novaDataPagamento, quando)
          : r;
      });

      base.caixa.movimentos = base.caixa.movimentos.map((m) =>
        cruzaRefs(m, alvoRefs)
          ? atualizarCamposData(m, ["data", "dataPagamento"], novaDataPagamento, quando)
          : m
      );
    }

    const auditoria = {
      id: `ajdata_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      alunoId: txt(alunoId),
      alunoNome: nomeAluno(aluno),
      registroId,
      financeiroId: reg.financeiroId || "",
      mensalidadeId: reg.mensalidadeId || "",
      antes,
      depois: {
        vencimento: novoVencimento || antes.vencimento,
        dataPagamento: novaDataPagamento || antes.dataPagamento
      },
      motivo: motivo || "Correção administrativa de vencimento",
      usuario: operador,
      criadoEm: quando
    };
    base.auditoria.push(auditoria);

    await salvarJsonMultiplosAtomico({
      [COL.alunos]: base.alunos,
      [COL.matriculas]: base.matriculas,
      [COL.mensalidades]: base.mensalidades,
      [COL.financeiro]: base.financeiro,
      [COL.recebimentos]: base.recebimentos,
      [COL.recibos]: base.recibos,
      [COL.caixa]: base.caixa,
      [COL.auditoria]: base.auditoria
    }, {
      operacaoId: `ajuste-datas-financeiras-${txt(alunoId)}-${Date.now()}`
    });

    return {
      ok: true,
      auditoria,
      ...(await listarDatasFinanceirasAluno(alunoId))
    };
  }, {
    operacaoId: `ajuste-datas-financeiras-aluno-${txt(alunoId)}-${Date.now()}`
  });
}

// DIA VENCIMENTO MENSAL ALUNO SERVICE 20260826
function statusEncerradoRegraMensal20260826(item = {}) {
  const s = norm(item.status || item.statusPagamento || item.situacao);
  return [
    "pago","paga","recebido","recebida","quitado","quitada","baixado","baixada",
    "parcial","recebido parcial","pago parcial",
    "cancelado","cancelada","estornado","estornada","excluido","excluida"
  ].includes(s) || statusPago(item);
}

function matriculaRegraMensal20260826(base, aluno = {}, alunoId = "") {
  const alunoAlvo = txt(alunoId);
  const matriculaId = txt(aluno.matriculaId || aluno.matricula_id);
  if (matriculaId) {
    const direta = base.matriculas.find((m) => id(m) === matriculaId);
    if (direta) return direta;
  }

  const candidatas = base.matriculas.filter((m) => pertenceAluno(m, alunoAlvo));
  const ativa = candidatas.find((m) => {
    const s = norm(m.status || m.statusMatricula || m.matriculaStatus || m.situacao);
    return ["ativa","ativo","active","paga","pago"].includes(s);
  });
  return ativa || candidatas.sort((a, b) =>
    String(b.atualizadoEm || b.criadoEm || b.dataMatricula || "")
      .localeCompare(String(a.atualizadoEm || a.criadoEm || a.dataMatricula || ""))
  )[0] || null;
}

function hojeLocalRegraMensal20260826() {
  try {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: process.env.FUSION_TIMEZONE || "America/Maceio",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function dataComDiaRegraMensal20260826(data = "", dia = 1) {
  const base = dataISO(data);
  if (!base) return "";
  return `${base.slice(0, 8)}${String(dia).padStart(2, "0")}`;
}

function proximaDataRegraMensal20260826(dia = 1, referencia = "") {
  const hoje = hojeLocalRegraMensal20260826();
  const base = dataISO(referencia);
  if (base) return dataComDiaRegraMensal20260826(base, dia);

  let ano = Number(hoje.slice(0, 4));
  let mes = Number(hoje.slice(5, 7));
  const diaHoje = Number(hoje.slice(8, 10));
  if (dia <= diaHoje) {
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function primeiroVencimentoFuturoRegraMensal20260826(base, alunoId = "") {
  const hoje = hojeLocalRegraMensal20260826();
  const itens = [
    ...base.mensalidades.filter((x) => pertenceAluno(x, alunoId)),
    ...base.financeiro.filter((x) => pertenceAluno(x, alunoId))
  ]
    .filter((x) => !statusEncerradoRegraMensal20260826(x))
    .map((x) => vencimento(x))
    .filter((d) => d && d >= hoje)
    .sort();
  return itens[0] || "";
}

export async function obterDiaVencimentoMensalAluno(alunoId) {
  const base = await lerBase();
  const aluno = localizarAluno(base, alunoId);
  if (!aluno) throw erro("Aluno não encontrado.", 404, "ALUNO_NAO_ENCONTRADO");

  const matricula = matriculaRegraMensal20260826(base, aluno, alunoId);
  const futuro = primeiroVencimentoFuturoRegraMensal20260826(base, alunoId);
  const dia = Number(
    matricula?.diaVencimento ||
    aluno.diaVencimento ||
    (futuro ? futuro.slice(8, 10) : 0)
  );

  const proximoVencimento =
    dataISO(matricula?.proximoVencimento) ||
    dataISO(aluno.proximoVencimento) ||
    futuro ||
    (dia >= 1 && dia <= 28 ? proximaDataRegraMensal20260826(dia) : "");

  return {
    ok: true,
    aluno: { id: txt(alunoId), nome: nomeAluno(aluno) },
    matriculaId: matricula ? id(matricula) : "",
    diaVencimento: dia >= 1 && dia <= 28 ? dia : null,
    proximoVencimento,
    limiteDia: 28
  };
}

export async function alterarDiaVencimentoMensalAluno(alunoId, payload = {}) {
  const dia = Number(payload.diaVencimento ?? payload.dia ?? 0);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    throw erro("O dia de vencimento mensal deve ficar entre 1 e 28.", 400, "DIA_VENCIMENTO_INVALIDO");
  }

  return executarTransacaoJson(async () => {
    const base = await lerBase();
    const aluno = localizarAluno(base, alunoId);
    if (!aluno) throw erro("Aluno não encontrado.", 404, "ALUNO_NAO_ENCONTRADO");

    const matricula = matriculaRegraMensal20260826(base, aluno, alunoId);
    if (!matricula) {
      throw erro("Nenhuma matrícula do aluno foi encontrada para definir o vencimento mensal.", 409, "MATRICULA_NAO_ENCONTRADA");
    }

    const hoje = hojeLocalRegraMensal20260826();
    const quando = new Date().toISOString();
    const operador = txt(payload.usuario || payload.operador || "Administrador");
    const diaAnterior = Number(matricula.diaVencimento || aluno.diaVencimento || 0) || null;

    const referenciaProxima =
      dataISO(matricula.proximoVencimento) ||
      dataISO(aluno.proximoVencimento) ||
      primeiroVencimentoFuturoRegraMensal20260826(base, alunoId);

    const proximoVencimento = proximaDataRegraMensal20260826(dia, referenciaProxima);

    let alunoAlterado = false;
    base.alunos = base.alunos.map((a) => {
      if (id(a) !== txt(alunoId) && txt(a.alunoId) !== txt(alunoId)) return a;
      alunoAlterado = true;
      return {
        ...a,
        diaVencimento: dia,
        proximoVencimento,
        atualizadoEm: quando
      };
    });

    const matriculasAlteradas = [];
    base.matriculas = base.matriculas.map((m) => {
      if (id(m) !== id(matricula)) return m;
      matriculasAlteradas.push(id(m));
      return {
        ...m,
        diaVencimento: dia,
        proximoVencimento,
        atualizadoEm: quando
      };
    });

    const mensalidadesAlteradas = [];
    base.mensalidades = base.mensalidades.map((m) => {
      if (!pertenceAluno(m, alunoId) || statusEncerradoRegraMensal20260826(m)) return m;
      const ven = vencimento(m);
      if (!ven || ven < hoje) return m;
      const novo = dataComDiaRegraMensal20260826(ven, dia);
      if (!novo || novo === ven) return m;
      mensalidadesAlteradas.push(id(m));
      return {
        ...m,
        diaVencimento: dia,
        vencimento: novo,
        dataVencimento: novo,
        atualizadoEm: quando
      };
    });

    const financeiroAlterados = [];
    base.financeiro = base.financeiro.map((f) => {
      if (!pertenceAluno(f, alunoId) || statusEncerradoRegraMensal20260826(f)) return f;
      const ven = vencimento(f);
      if (!ven || ven < hoje) return f;
      const novo = dataComDiaRegraMensal20260826(ven, dia);
      if (!novo || novo === ven) return f;
      financeiroAlterados.push(id(f));
      return {
        ...f,
        diaVencimento: dia,
        vencimento: novo,
        dataVencimento: novo,
        atualizadoEm: quando
      };
    });

    const recebimentosAlterados = [];
    base.recebimentos = base.recebimentos.map((r) => {
      if (!pertenceAluno(r, alunoId) || statusEncerradoRegraMensal20260826(r)) return r;
      const ven = vencimento(r);
      if (!ven || ven < hoje) return r;
      const novo = dataComDiaRegraMensal20260826(ven, dia);
      if (!novo || novo === ven) return r;
      recebimentosAlterados.push(id(r));
      return {
        ...r,
        diaVencimento: dia,
        vencimento: novo,
        atualizadoEm: quando
      };
    });

    if (!alunoAlterado) {
      throw erro("Aluno não encontrado para persistir o vencimento mensal.", 404, "ALUNO_NAO_ENCONTRADO");
    }

    const auditoria = {
      id: `ajdia_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      tipo: "alterar_dia_vencimento_mensal",
      alunoId: txt(alunoId),
      alunoNome: nomeAluno(aluno),
      matriculaId: id(matricula),
      diaAnterior,
      diaNovo: dia,
      proximoVencimentoAnterior: referenciaProxima || "",
      proximoVencimentoNovo: proximoVencimento,
      mensalidadesAlteradas,
      financeiroAlterados,
      recebimentosAlterados,
      motivo: txt(payload.motivo || "Alteração da regra mensal de vencimento"),
      usuario: operador,
      criadoEm: quando
    };
    base.auditoria.push(auditoria);

    await salvarJsonMultiplosAtomico({
      [COL.alunos]: base.alunos,
      [COL.matriculas]: base.matriculas,
      [COL.mensalidades]: base.mensalidades,
      [COL.financeiro]: base.financeiro,
      [COL.recebimentos]: base.recebimentos,
      [COL.auditoria]: base.auditoria
    }, {
      operacaoId: `dia-vencimento-mensal-${txt(alunoId)}-${Date.now()}`
    });

    return {
      ...(await obterDiaVencimentoMensalAluno(alunoId)),
      auditoria
    };
  }, {
    operacaoId: `dia-vencimento-mensal-aluno-${txt(alunoId)}-${Date.now()}`
  });
}

