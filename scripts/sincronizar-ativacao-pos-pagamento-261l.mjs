import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const LOGS = path.join(ROOT, "logs");

function n(v) {
  return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function pago(item = {}) {
  return ["pago", "recebido", "quitado", "baixado"].includes(n(item.status));
}

function entrada(item = {}) {
  const alvo = n([item.origem, item.categoria, item.descricao, item.recorrencia].join(" "));
  return Boolean(item.ativarMatriculaAoReceber) ||
    alvo.includes("matricula_inicial_unificada") ||
    alvo.includes("matricula inicial") ||
    alvo.includes("entrada matricula") ||
    alvo.includes("matricula + mensalidade") ||
    alvo.includes("matricula e mensalidade");
}

async function ler(nome, padrao = []) {
  try {
    const file = path.join(DATA, nome);
    const txt = await fs.readFile(file, "utf8");
    return txt.trim() ? JSON.parse(txt) : padrao;
  } catch {
    return padrao;
  }
}

async function salvar(nome, dados) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, nome), JSON.stringify(dados, null, 2), "utf8");
}

function addHist(matricula, acao, descricao, extra = {}) {
  matricula.historico = Array.isArray(matricula.historico) ? matricula.historico : [];
  matricula.historico.push({
    id: `hist_sync_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    acao,
    descricao,
    ...extra,
    criadoEm: new Date().toISOString()
  });
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });

  const alunos = await ler("alunos.json", []);
  const matriculas = await ler("matriculas.json", []);
  const financeiro = await ler("financeiro.json", []);
  const mensalidades = await ler("mensalidades.json", []);
  const checkins = await ler("checkins.json", []);

  const alteracoes = [];

  const pagosIniciais = financeiro.filter(f => f.tipo === "receber" && pago(f) && entrada(f));

  for (const fin of pagosIniciais) {
    const alunoId = String(fin.alunoId || "");
    const matriculaId = String(fin.matriculaId || "");
    if (!alunoId && !matriculaId) continue;

    let mat = matriculas.find(m => matriculaId && String(m.id) === matriculaId);

    if (!mat && alunoId) {
      mat = matriculas.find(m =>
        String(m.alunoId) === alunoId &&
        String(m.financeiroInicialId || "") === String(fin.id)
      );
    }

    if (!mat && alunoId) {
      mat = matriculas.find(m =>
        String(m.alunoId) === alunoId &&
        entrada({
          origem: "matricula_inicial_unificada",
          descricao: m.observacao || "",
          categoria: "Matrículas"
        }) &&
        !["cancelada", "cancelado"].includes(n(m.status))
      );
    }

    if (!mat) continue;

    if (["cancelada", "cancelado"].includes(n(mat.status))) continue;

    mat.status = "Ativa";
    mat.statusPagamento = "Pago";
    mat.statusFinanceiroInicial = "Pago";
    mat.financeiroInicialId = mat.financeiroInicialId || fin.id || "";
    mat.mensalidadeInicialId = mat.mensalidadeInicialId || fin.mensalidadeId || "";
    mat.formaPagamento = mat.formaPagamento || fin.formaPagamento || "";
    mat.ativadaEm = mat.ativadaEm || fin.dataPagamento || fin.pagamento || new Date().toISOString();
    mat.atualizadoEm = new Date().toISOString();

    addHist(mat, "ativacao_sincronizada_pos_pagamento", "Matrícula ativada por sincronização após baixa financeira paga.", {
      lancamentoFinanceiroId: fin.id,
      mensalidadeId: fin.mensalidadeId || ""
    });

    const aluno = alunos.find(a => String(a.id) === String(mat.alunoId || alunoId));
    if (aluno && !["inativo", "cancelado", "desligado"].includes(n(aluno.status))) {
      aluno.status = "ativo";
      aluno.statusMatricula = "Ativa";
      aluno.matriculaId = mat.id;
      aluno.numeroMatricula = mat.numero || aluno.numeroMatricula || "";
      aluno.planoId = mat.planoId || aluno.planoId || "";
      aluno.plano = mat.plano || aluno.plano || "";
      aluno.ativadoEm = aluno.ativadoEm || new Date().toISOString();
      aluno.atualizadoEm = new Date().toISOString();
    }

    for (const men of mensalidades) {
      if (String(men.id || "") !== String(fin.mensalidadeId || "") &&
          String(men.matriculaId || "") !== String(mat.id || "")) continue;
      if (!entrada(men)) continue;
      men.status = "pago";
      men.valorPago = Number(fin.valorPago ?? fin.valorRecebido ?? fin.valor ?? men.total ?? 0);
      men.valorRecebido = Number(fin.valorRecebido ?? fin.valorPago ?? fin.valor ?? men.total ?? 0);
      men.valorRestante = 0;
      men.statusFinanceiroInicial = "Pago";
      men.formaPagamento = men.formaPagamento || fin.formaPagamento || "";
      men.dataPagamento = men.dataPagamento || fin.dataPagamento || fin.pagamento || "";
      men.pagamento = men.pagamento || men.dataPagamento || "";
      men.atualizadoEm = new Date().toISOString();
    }

    for (const chk of checkins) {
      if (String(chk.alunoId || "") === String(mat.alunoId || alunoId) ||
          String(chk.matriculaId || "") === String(mat.id || "")) {
        chk.status = "Ativo";
        chk.motivoBloqueio = "";
        chk.atualizadoEm = new Date().toISOString();
      }
    }

    // Encerrar pendências duplicadas do mesmo aluno quando já existe uma matrícula ativa paga.
    for (const outra of matriculas) {
      if (String(outra.id) === String(mat.id)) continue;
      if (String(outra.alunoId) !== String(mat.alunoId)) continue;
      if (!["pendente", "pre-matriculado"].includes(n(outra.status))) continue;

      const finOutra = financeiro.find(f => String(f.id || "") === String(outra.financeiroInicialId || ""));
      if (finOutra && pago(finOutra)) continue;

      outra.status = "Encerrada";
      outra.statusFinanceiroInicial = outra.statusFinanceiroInicial || "Cancelado";
      outra.encerradaEm = outra.encerradaEm || new Date().toISOString();
      outra.motivoEncerramento = "Encerrada por duplicidade após ativação de matrícula paga.";
      outra.atualizadoEm = new Date().toISOString();
      addHist(outra, "encerramento_duplicidade_pos_pagamento", "Matrícula pendente duplicada encerrada após ativação da matrícula paga.", {
        matriculaAtivaId: mat.id
      });

      if (finOutra && !pago(finOutra)) {
        finOutra.status = "Cancelado";
        finOutra.valorRestante = 0;
        finOutra.motivoCancelamento = "Cancelado por duplicidade após ativação de matrícula paga.";
        finOutra.atualizadoEm = new Date().toISOString();
      }

      for (const men of mensalidades) {
        if (String(men.matriculaId || "") !== String(outra.id)) continue;
        if (pago(men)) continue;
        men.status = "cancelado";
        men.valorRestante = 0;
        men.motivoCancelamento = "Cancelada por duplicidade após ativação de matrícula paga.";
        men.atualizadoEm = new Date().toISOString();
      }
    }

    alteracoes.push({
      alunoId: mat.alunoId || alunoId,
      aluno: mat.aluno || fin.aluno || "",
      matriculaId: mat.id,
      financeiroInicialId: fin.id,
      status: "Ativa"
    });
  }

  await salvar("alunos.json", alunos);
  await salvar("matriculas.json", matriculas);
  await salvar("financeiro.json", financeiro);
  await salvar("mensalidades.json", mensalidades);
  await salvar("checkins.json", checkins);

  const relatorio = {
    ok: true,
    versao: "2.6.1-L",
    data: new Date().toISOString(),
    operacao: "sincronizar_ativacao_pos_pagamento",
    alteracoes
  };

  await fs.writeFile(path.join(LOGS, "sincronizar-ativacao-pos-pagamento-261l.json"), JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-L — Sincronização de Ativação");
  console.log(`Matrículas ativadas/sincronizadas: ${alteracoes.length}`);
  console.log("Relatório: logs/sincronizar-ativacao-pos-pagamento-261l.json");
}

main().catch(e => {
  console.error("Falha:", e.message);
  process.exit(1);
});
