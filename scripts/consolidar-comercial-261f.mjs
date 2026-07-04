import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const LOGS = path.join(ROOT, "logs");

const arquivos = {
  alunos: path.join(DATA, "alunos.json"),
  matriculas: path.join(DATA, "matriculas.json"),
  mensalidades: path.join(DATA, "mensalidades.json"),
  financeiro: path.join(DATA, "financeiro.json"),
  recebimentos: path.join(DATA, "recebimentos.json"),
  checkins: path.join(DATA, "checkins.json")
};

function normalizar(v) {
  return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function numero(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function addMes(dataISO) {
  const d = new Date(`${dataISO || hojeISO()}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function pago(item = {}) {
  return ["pago", "recebido", "quitado", "baixado"].includes(normalizar(item.status));
}

function entradaInicial(item = {}) {
  const alvo = normalizar([item.origem, item.categoria, item.descricao, item.recorrencia].join(" "));
  return Boolean(item.ativarMatriculaAoReceber) ||
    alvo.includes("matricula_inicial_unificada") ||
    alvo.includes("entrada matricula") ||
    alvo.includes("entrada matrícula") ||
    alvo.includes("matricula + mensalidade") ||
    alvo.includes("matrícula + mensalidade");
}

async function lerJson(arquivo, padrao = []) {
  try {
    if (!fssync.existsSync(arquivo)) return padrao;
    const txt = await fs.readFile(arquivo, "utf8");
    return txt.trim() ? JSON.parse(txt) : padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), "utf8");
}

function id(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });

  const alunos = await lerJson(arquivos.alunos, []);
  const matriculas = await lerJson(arquivos.matriculas, []);
  const mensalidades = await lerJson(arquivos.mensalidades, []);
  const financeiro = await lerJson(arquivos.financeiro, []);
  const recebimentos = await lerJson(arquivos.recebimentos, []);
  const checkins = await lerJson(arquivos.checkins, []);

  const alteracoes = [];

  for (const mat of matriculas) {
    const aluno = alunos.find((a) => String(a.id) === String(mat.alunoId));
    const nome = mat.aluno || aluno?.nome || "";
    const dataMatricula = mat.dataMatricula || mat.dataInicio || hojeISO();
    const vencimentoInicial = mat.vencimentoInicial || dataMatricula;
    const proximoVencimento = mat.proximoVencimento || addMes(vencimentoInicial);

    const valorMatricula = numero(mat.valorMatricula);
    const valorPlano = numero(mat.valorPlano ?? mat.valorMensal ?? mat.valorMensalTotal);
    const valorServicos = numero(mat.valorServicos);
    const desconto = numero(mat.descontoMatricula);
    const valorMensal = numero(valorPlano + valorServicos);
    const valorEntrada = numero(valorMatricula + valorMensal - desconto);

    if (!(valorEntrada > 0)) continue;

    let menInicial =
      mensalidades.find((m) => String(m.id) === String(mat.mensalidadeInicialId)) ||
      mensalidades.find((m) => String(m.matriculaId) === String(mat.id) && entradaInicial(m)) ||
      mensalidades.find((m) =>
        String(m.alunoId) === String(mat.alunoId) &&
        String(m.competencia || "").slice(0, 7) === dataMatricula.slice(0, 7) &&
        !normalizar(m.origem).includes("recorrencia")
      );

    if (!menInicial) {
      menInicial = { id: id("men_fix"), criadoEm: new Date().toISOString() };
      mensalidades.push(menInicial);
      alteracoes.push({ tipo: "mensalidade_inicial_criada", matriculaId: mat.id, mensalidadeId: menInicial.id });
    }

    Object.assign(menInicial, {
      alunoId: mat.alunoId,
      aluno: nome,
      alunoNome: nome,
      matriculaId: mat.id,
      numeroMatricula: mat.numero,
      planoId: mat.planoId,
      plano: mat.plano,
      tipoPlano: mat.tipoPlano || "Mensal",
      competencia: dataMatricula.slice(0, 7),
      vencimento: vencimentoInicial,
      descricao: `Entrada matrícula + mensalidade - ${nome}`,
      categoria: "Matrículas",
      valorMatricula,
      valorPlano,
      valorServicos,
      descontoMatricula: desconto,
      valor: valorMensal,
      valorOriginal: valorEntrada,
      total: valorEntrada,
      valorTotalInicial: valorEntrada,
      valorRestante: pago(menInicial) ? 0 : valorEntrada,
      origem: "matricula_inicial_unificada",
      recorrencia: "entrada_unica",
      ativarMatriculaAoReceber: true,
      atualizadoEm: new Date().toISOString()
    });

    let finInicial =
      financeiro.find((f) => String(f.id) === String(menInicial.lancamentoFinanceiroId || "")) ||
      financeiro.find((f) => String(f.mensalidadeId) === String(menInicial.id)) ||
      financeiro.find((f) => String(f.matriculaId) === String(mat.id) && entradaInicial(f));

    if (!finInicial) {
      finInicial = { id: id("fin_fix"), criadoEm: new Date().toISOString() };
      financeiro.push(finInicial);
      alteracoes.push({ tipo: "financeiro_inicial_criado", matriculaId: mat.id, financeiroId: finInicial.id });
    }

    const jaPago = pago(finInicial) || pago(menInicial);

    Object.assign(finInicial, {
      tipo: "receber",
      descricao: `Entrada matrícula + mensalidade - ${nome}`,
      categoria: "Matrículas",
      centroCusto: "Academia",
      alunoId: mat.alunoId,
      aluno: nome,
      pessoa: nome,
      alunoFornecedor: nome,
      matriculaId: mat.id,
      numeroMatricula: mat.numero,
      planoId: mat.planoId,
      plano: mat.plano,
      mensalidadeId: menInicial.id,
      valor: valorEntrada,
      valorBruto: valorEntrada,
      total: valorEntrada,
      valorMatricula,
      valorPlano,
      valorServicos,
      descontoMatricula: desconto,
      vencimento: vencimentoInicial,
      origem: "matricula_inicial_unificada",
      ativarMatriculaAoReceber: true,
      status: jaPago ? "Pago" : "Aberto",
      valorPago: jaPago ? numero(finInicial.valorPago || menInicial.valorPago || valorEntrada) : numero(finInicial.valorPago),
      valorRecebido: jaPago ? numero(finInicial.valorRecebido || finInicial.valorPago || menInicial.valorRecebido || menInicial.valorPago || valorEntrada) : numero(finInicial.valorRecebido),
      valorRestante: jaPago ? 0 : valorEntrada,
      atualizadoEm: new Date().toISOString()
    });

    menInicial.lancamentoFinanceiroId = finInicial.id;
    menInicial.financeiroInicialId = finInicial.id;
    mat.mensalidadeInicialId = menInicial.id;
    mat.financeiroInicialId = finInicial.id;
    mat.valorPlano = valorPlano;
    mat.valorMensal = valorMensal;
    mat.valorMensalTotal = valorMensal;
    mat.valorTotalInicial = valorEntrada;
    mat.vencimentoInicial = vencimentoInicial;
    mat.proximoVencimento = proximoVencimento;
    mat.status = jaPago ? "Ativa" : "Pendente";
    mat.statusPagamento = jaPago ? "Pago" : "Pendente";
    mat.atualizadoEm = new Date().toISOString();

    if (aluno) {
      aluno.status = jaPago ? "ativo" : "pre-matriculado";
      aluno.statusMatricula = mat.status;
      aluno.valorPlano = valorPlano;
      aluno.valorMensal = valorMensal;
      aluno.valorMensalTotal = valorMensal;
      aluno.atualizadoEm = new Date().toISOString();
    }

    let vinculo = checkins.find((c) => String(c.alunoId) === String(mat.alunoId) && c.tipo === "vinculo_matricula");
    if (!vinculo) {
      vinculo = { id: id("chk_vinc"), tipo: "vinculo_matricula", alunoId: mat.alunoId, aluno: nome, criadoEm: new Date().toISOString() };
      checkins.push(vinculo);
    }
    Object.assign(vinculo, {
      matriculaId: mat.id,
      numeroMatricula: mat.numero,
      planoId: mat.planoId,
      plano: mat.plano,
      status: jaPago ? "Ativo" : "Bloqueado",
      atualizadoEm: new Date().toISOString()
    });

    const compProx = proximoVencimento.slice(0, 7);
    let menProx = mensalidades.find((m) =>
      String(m.matriculaId) === String(mat.id) &&
      String(m.competencia) === compProx &&
      normalizar(m.origem).includes("recorrencia")
    );

    if (!menProx && valorMensal > 0) {
      menProx = {
        id: id("men_rec"),
        alunoId: mat.alunoId,
        aluno: nome,
        alunoNome: nome,
        matriculaId: mat.id,
        numeroMatricula: mat.numero,
        planoId: mat.planoId,
        plano: mat.plano,
        tipoPlano: mat.tipoPlano || "Mensal",
        competencia: compProx,
        vencimento: proximoVencimento,
        descricao: `Mensalidade ${compProx} - ${nome}`,
        categoria: "Mensalidades",
        valorMatricula: 0,
        valorPlano,
        valorServicos,
        valor: valorMensal,
        valorOriginal: valorMensal,
        total: valorMensal,
        valorPago: 0,
        valorRecebido: 0,
        valorRestante: valorMensal,
        status: "aberto",
        origem: "recorrencia_mensal",
        recorrencia: "proxima_mensalidade",
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      mensalidades.push(menProx);

      const finProx = {
        id: id("fin_rec"),
        tipo: "receber",
        descricao: `Mensalidade ${compProx} - ${nome}`,
        categoria: "Mensalidades",
        centroCusto: "Academia",
        alunoId: mat.alunoId,
        aluno: nome,
        pessoa: nome,
        alunoFornecedor: nome,
        matriculaId: mat.id,
        numeroMatricula: mat.numero,
        planoId: mat.planoId,
        plano: mat.plano,
        mensalidadeId: menProx.id,
        valor: valorMensal,
        valorBruto: valorMensal,
        total: valorMensal,
        valorMatricula: 0,
        valorPlano,
        valorServicos,
        valorPago: 0,
        valorRecebido: 0,
        valorRestante: valorMensal,
        vencimento: proximoVencimento,
        status: "Aberto",
        origem: "recorrencia_mensal",
        ativarMatriculaAoReceber: false,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      financeiro.push(finProx);
      menProx.lancamentoFinanceiroId = finProx.id;
      menProx.financeiroInicialId = finProx.id;
      mat.mensalidadeProximaId = menProx.id;
      mat.financeiroProximoId = finProx.id;

      alteracoes.push({ tipo: "recorrencia_criada", matriculaId: mat.id, mensalidadeId: menProx.id });
    }

    alteracoes.push({ tipo: "matricula_normalizada", matriculaId: mat.id, status: mat.status, entrada: valorEntrada });
  }

  // Recebimentos espelhados a partir do financeiro.
  const chavesRec = new Set();
  for (const r of recebimentos) {
    if (r.id) chavesRec.add(String(r.id));
    if (r.lancamentoFinanceiroId) chavesRec.add(String(r.lancamentoFinanceiroId));
  }

  for (const f of financeiro) {
    if (normalizar(f.tipo) !== "receber") continue;
    const recId = f.recebimentoId || `rec_${f.id}`;
    if (chavesRec.has(String(f.id)) || chavesRec.has(String(recId))) continue;

    recebimentos.push({
      id: recId,
      descricao: f.descricao,
      categoria: f.categoria || "Recebimentos",
      centroCusto: f.centroCusto || "Academia",
      pessoa: f.pessoa || f.aluno || f.alunoFornecedor || "",
      cliente: f.pessoa || f.aluno || f.alunoFornecedor || "",
      aluno: f.aluno || f.pessoa || "",
      alunoId: f.alunoId || "",
      matriculaId: f.matriculaId || "",
      mensalidadeId: f.mensalidadeId || "",
      formaPagamento: f.formaPagamento || "",
      valorBruto: numero(f.valor),
      valorLiquido: numero(f.valorLiquido || f.valorRecebido),
      valorRecebido: numero(f.valorRecebido || f.valorPago),
      valorRestante: numero(f.valorRestante ?? Math.max(0, numero(f.valor) - numero(f.valorRecebido || f.valorPago))),
      vencimento: f.vencimento || hojeISO(),
      dataRecebimento: f.dataPagamento || f.pagamento || "",
      status: pago(f) ? "recebido" : "aberto",
      lancamentoFinanceiroId: f.id,
      origem: f.origem || "financeiro",
      ativarMatriculaAoReceber: Boolean(f.ativarMatriculaAoReceber),
      criadoEm: f.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      sincronizadoDoFinanceiro: true
    });
    chavesRec.add(String(f.id));
    chavesRec.add(String(recId));
  }

  await salvarJson(arquivos.alunos, alunos);
  await salvarJson(arquivos.matriculas, matriculas);
  await salvarJson(arquivos.mensalidades, mensalidades);
  await salvarJson(arquivos.financeiro, financeiro);
  await salvarJson(arquivos.recebimentos, recebimentos);
  await salvarJson(arquivos.checkins, checkins);

  const relatorio = {
    ok: true,
    versao: "2.6.1-F",
    operacao: "consolidacao-comercial",
    data: new Date().toISOString(),
    resumo: {
      alteracoes: alteracoes.length,
      matriculas: matriculas.length,
      mensalidades: mensalidades.length,
      financeiro: financeiro.length,
      recebimentos: recebimentos.length
    },
    alteracoes
  };

  await salvarJson(path.join(LOGS, "consolidacao-comercial-261f.json"), relatorio);

  console.log("Fusion ERP 2.6.1-F — Consolidação Comercial");
  console.log(`Alterações: ${alteracoes.length}`);
  console.log("Relatório: logs/consolidacao-comercial-261f.json");
}

main().catch((erro) => {
  console.error("Falha na consolidação comercial:", erro.message);
  process.exit(1);
});
