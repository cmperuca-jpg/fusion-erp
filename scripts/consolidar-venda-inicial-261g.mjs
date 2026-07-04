import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const LOGS = path.join(ROOT, "logs");

const files = {
  alunos: path.join(DATA, "alunos.json"),
  matriculas: path.join(DATA, "matriculas.json"),
  mensalidades: path.join(DATA, "mensalidades.json"),
  financeiro: path.join(DATA, "financeiro.json"),
  recebimentos: path.join(DATA, "recebimentos.json"),
  caixa: path.join(DATA, "caixa.json"),
  checkins: path.join(DATA, "checkins.json")
};

function norm(v) {
  return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function num(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function addMes(d) {
  const x = new Date(`${d || hoje()}T12:00:00`);
  x.setMonth(x.getMonth() + 1);
  return x.toISOString().slice(0, 10);
}

function pago(i = {}) {
  return ["pago", "recebido", "quitado", "baixado"].includes(norm(i.status));
}

function entrada(i = {}) {
  const alvo = norm([i.origem, i.categoria, i.descricao, i.recorrencia].join(" "));
  return Boolean(i.ativarMatriculaAoReceber) ||
    alvo.includes("matricula_inicial_unificada") ||
    alvo.includes("entrada matricula") ||
    alvo.includes("entrada matrícula") ||
    alvo.includes("matricula + mensalidade") ||
    alvo.includes("matrícula + mensalidade") ||
    alvo.includes("matricula e mensalidade") ||
    alvo.includes("matrícula e mensalidade");
}

async function read(file, fallback) {
  try {
    if (!fssync.existsSync(file)) return fallback;
    const txt = await fs.readFile(file, "utf8");
    return txt.trim() ? JSON.parse(txt) : fallback;
  } catch {
    return fallback;
  }
}

async function write(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function novoId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function valorPlanoDaMatricula(matricula = {}, aluno = {}) {
  const candidatos = [
    matricula.valorPlano,
    matricula.valorMensal,
    matricula.valorMensalTotal,
    aluno.valorPlano,
    aluno.valorMensal,
    aluno.valorMensalTotal
  ];
  for (const c of candidatos) {
    const n = num(c);
    if (n > 0) return n;
  }
  return 0;
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });

  const alunos = await read(files.alunos, []);
  const matriculas = await read(files.matriculas, []);
  const mensalidades = await read(files.mensalidades, []);
  const financeiro = await read(files.financeiro, []);
  const recebimentos = await read(files.recebimentos, []);
  const caixa = await read(files.caixa, { caixas: [], movimentos: [] });
  const checkins = await read(files.checkins, []);

  const movimentos = Array.isArray(caixa.movimentos) ? caixa.movimentos : [];
  const alteracoes = [];

  for (const m of matriculas) {
    const aluno = alunos.find(a => String(a.id) === String(m.alunoId));
    const nome = m.aluno || aluno?.nome || "";
    const dataMatricula = m.dataMatricula || m.dataInicio || hoje();
    const vencimentoInicial = m.vencimentoInicial || dataMatricula;
    const proximoVencimento = m.proximoVencimento || addMes(vencimentoInicial);

    const taxaMatricula = num(m.valorMatricula ?? m.taxaMatricula ?? aluno?.valorMatricula ?? aluno?.taxaMatricula);
    const valorPlano = valorPlanoDaMatricula(m, aluno);
    const valorServicos = num(m.valorServicos);
    const desconto = num(m.descontoMatricula);
    const valorMensal = num(valorPlano + valorServicos);
    const totalInicial = num(taxaMatricula + valorMensal - desconto);

    if (!(totalInicial >= 0)) continue;

    let men = mensalidades.find(x => String(x.id) === String(m.mensalidadeInicialId || "")) ||
      mensalidades.find(x => String(x.matriculaId) === String(m.id) && entrada(x)) ||
      mensalidades.find(x =>
        String(x.alunoId) === String(m.alunoId) &&
        String(x.competencia || "").slice(0, 7) === dataMatricula.slice(0, 7) &&
        !norm(x.origem).includes("recorrencia")
      );

    if (!men) {
      men = { id: novoId("men_ini"), criadoEm: new Date().toISOString() };
      mensalidades.push(men);
      alteracoes.push({ tipo: "mensalidade_inicial_criada", matriculaId: m.id, mensalidadeId: men.id });
    }

    let fin = financeiro.find(x => String(x.id) === String(men.lancamentoFinanceiroId || "")) ||
      financeiro.find(x => String(x.mensalidadeId) === String(men.id)) ||
      financeiro.find(x => String(x.matriculaId) === String(m.id) && entrada(x));

    if (!fin) {
      fin = { id: novoId("fin_ini"), criadoEm: new Date().toISOString() };
      financeiro.push(fin);
      alteracoes.push({ tipo: "financeiro_inicial_criado", matriculaId: m.id, financeiroId: fin.id });
    }

    const movimento = movimentos.find(x =>
      String(x.lancamentoFinanceiroId || "") === String(fin.id) ||
      String(x.mensalidadeId || "") === String(men.id)
    );

    const jaPago = pago(fin) || pago(men) || Boolean(movimento);
    const valorBrutoPago = jaPago
      ? num(fin.valorBrutoRecebido || fin.valorPago || fin.valorRecebido || men.valorBrutoRecebido || men.valorPago || men.valorRecebido || movimento?.valor || totalInicial)
      : 0;

    const taxaOperadora = num(fin.taxaOperadoraValor ?? fin.taxaValor ?? men.taxaOperadoraValor ?? 0);
    const valorLiquido = jaPago ? Math.max(0, num(valorBrutoPago - taxaOperadora)) : 0;

    Object.assign(men, {
      alunoId: m.alunoId,
      aluno: nome,
      alunoNome: nome,
      matriculaId: m.id,
      numeroMatricula: m.numero,
      planoId: m.planoId,
      plano: m.plano,
      tipoPlano: m.tipoPlano || "Mensal",
      competencia: dataMatricula.slice(0, 7),
      vencimento: vencimentoInicial,
      descricao: `Entrada matrícula + mensalidade - ${nome}`,
      categoria: "Matrículas",
      valorMatricula: taxaMatricula,
      valorPlano,
      valorServicos,
      descontoMatricula: desconto,
      valor: valorMensal,
      valorOriginal: totalInicial,
      total: totalInicial,
      valorTotalInicial: totalInicial,
      valorDevido: totalInicial,
      valorPago: valorBrutoPago,
      valorRecebido: valorBrutoPago,
      valorBrutoRecebido: valorBrutoPago,
      valorLiquido,
      taxaOperadoraValor: taxaOperadora,
      valorRestante: jaPago ? 0 : totalInicial,
      status: jaPago || totalInicial === 0 ? "pago" : "aberto",
      origem: "matricula_inicial_unificada",
      recorrencia: "entrada_unica",
      ativarMatriculaAoReceber: true,
      lancamentoFinanceiroId: fin.id,
      financeiroInicialId: fin.id,
      atualizadoEm: new Date().toISOString()
    });

    Object.assign(fin, {
      tipo: "receber",
      descricao: `Entrada matrícula + mensalidade - ${nome}`,
      categoria: "Matrículas",
      centroCusto: "Academia",
      alunoId: m.alunoId,
      aluno: nome,
      pessoa: nome,
      alunoFornecedor: nome,
      pessoaFornecedor: nome,
      matriculaId: m.id,
      numeroMatricula: m.numero,
      planoId: m.planoId,
      plano: m.plano,
      mensalidadeId: men.id,
      valor: totalInicial,
      valorBruto: totalInicial,
      total: totalInicial,
      valorMatricula: taxaMatricula,
      valorPlano,
      valorMensal,
      valorServicos,
      descontoMatricula: desconto,
      vencimento: vencimentoInicial,
      origem: "matricula_inicial_unificada",
      ativarMatriculaAoReceber: true,
      status: jaPago || totalInicial === 0 ? "Pago" : "Aberto",
      valorPago: valorBrutoPago,
      valorRecebido: valorBrutoPago,
      valorBrutoRecebido: valorBrutoPago,
      valorLiquido,
      valorRestante: jaPago || totalInicial === 0 ? 0 : totalInicial,
      taxaOperadoraValor: taxaOperadora,
      taxaValor: taxaOperadora,
      atualizadoEm: new Date().toISOString()
    });

    if (movimento) {
      movimento.descricao = `Entrada matrícula + mensalidade - ${nome}`;
      movimento.categoria = "Matrículas";
      movimento.pessoa = nome;
      movimento.valor = valorBrutoPago || totalInicial;
      movimento.origem = "matricula_inicial_unificada";
      movimento.mensalidadeId = men.id;
      movimento.lancamentoFinanceiroId = fin.id;
      movimento.atualizadoEm = new Date().toISOString();
    }

    let rec = recebimentos.find(x =>
      String(x.lancamentoFinanceiroId || "") === String(fin.id) ||
      String(x.mensalidadeId || "") === String(men.id)
    );

    if (!rec) {
      rec = { id: `rec_${fin.id}`, criadoEm: fin.criadoEm || new Date().toISOString() };
      recebimentos.push(rec);
      alteracoes.push({ tipo: "recebimento_inicial_criado", matriculaId: m.id, recebimentoId: rec.id });
    }

    Object.assign(rec, {
      descricao: `Entrada matrícula + mensalidade - ${nome}`,
      categoria: "Matrículas",
      centroCusto: "Academia",
      pessoa: nome,
      cliente: nome,
      aluno: nome,
      alunoId: m.alunoId,
      matriculaId: m.id,
      mensalidadeId: men.id,
      formaPagamento: fin.formaPagamento || rec.formaPagamento || "",
      valorBruto: totalInicial,
      taxaValor: taxaOperadora,
      valorLiquido,
      valorRecebido: valorBrutoPago,
      valorRestante: jaPago || totalInicial === 0 ? 0 : totalInicial,
      vencimento: vencimentoInicial,
      dataRecebimento: jaPago ? (fin.dataPagamento || fin.pagamento || rec.dataRecebimento || hoje()) : "",
      status: jaPago || totalInicial === 0 ? "recebido" : "aberto",
      lancamentoFinanceiroId: fin.id,
      origem: "matricula_inicial_unificada",
      ativarMatriculaAoReceber: true,
      atualizadoEm: new Date().toISOString(),
      sincronizadoDoFinanceiro: true
    });

    m.mensalidadeInicialId = men.id;
    m.financeiroInicialId = fin.id;
    m.valorMatricula = taxaMatricula;
    m.valorPlano = valorPlano;
    m.valorMensal = valorMensal;
    m.valorMensalTotal = valorMensal;
    m.valorTotalInicial = totalInicial;
    m.vencimentoInicial = vencimentoInicial;
    m.proximoVencimento = proximoVencimento;
    m.status = jaPago || totalInicial === 0 ? "Ativa" : "Pendente";
    m.statusPagamento = jaPago || totalInicial === 0 ? "Pago" : "Pendente";
    m.atualizadoEm = new Date().toISOString();

    if (aluno) {
      aluno.status = jaPago || totalInicial === 0 ? "ativo" : "pre-matriculado";
      aluno.statusMatricula = m.status;
      aluno.valorMatricula = taxaMatricula;
      aluno.valorPlano = valorPlano;
      aluno.valorMensal = valorMensal;
      aluno.valorMensalTotal = valorMensal;
      aluno.atualizadoEm = new Date().toISOString();
    }

    let vinc = checkins.find(x => String(x.alunoId) === String(m.alunoId) && x.tipo === "vinculo_matricula");
    if (!vinc) {
      vinc = { id: novoId("chk_vinc"), tipo: "vinculo_matricula", alunoId: m.alunoId, aluno: nome, criadoEm: new Date().toISOString() };
      checkins.push(vinc);
    }
    vinc.status = jaPago || totalInicial === 0 ? "Ativo" : "Bloqueado";
    vinc.matriculaId = m.id;
    vinc.numeroMatricula = m.numero;
    vinc.planoId = m.planoId;
    vinc.plano = m.plano;
    vinc.atualizadoEm = new Date().toISOString();

    alteracoes.push({
      tipo: "venda_inicial_consolidada",
      matriculaId: m.id,
      aluno: nome,
      totalInicial,
      valorPago: valorBrutoPago,
      status: m.status
    });
  }

  await write(files.alunos, alunos);
  await write(files.matriculas, matriculas);
  await write(files.mensalidades, mensalidades);
  await write(files.financeiro, financeiro);
  await write(files.recebimentos, recebimentos);
  await write(files.caixa, caixa);
  await write(files.checkins, checkins);

  const relatorio = {
    ok: true,
    versao: "2.6.1-G",
    data: new Date().toISOString(),
    operacao: "consolidacao-venda-inicial",
    resumo: {
      matriculas: matriculas.length,
      alteracoes: alteracoes.length
    },
    alteracoes
  };

  await write(path.join(LOGS, "consolidacao-venda-inicial-261g.json"), relatorio);

  console.log("Fusion ERP 2.6.1-G — Consolidação da Venda Inicial");
  console.log(`Alterações: ${alteracoes.length}`);
  console.log("Relatório: logs/consolidacao-venda-inicial-261g.json");
}

main().catch((erro) => {
  console.error("Falha na consolidação da venda inicial:", erro.message);
  process.exit(1);
});
