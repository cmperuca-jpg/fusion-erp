import fs from "node:fs/promises";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");
const LOGS = path.join(process.cwd(), "logs");

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
    const txt = await fs.readFile(path.join(DATA, nome), "utf8");
    return txt.trim() ? JSON.parse(txt) : padrao;
  } catch {
    return padrao;
  }
}

async function salvar(nome, dados) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, nome), JSON.stringify(dados, null, 2), "utf8");
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });

  const alunos = await ler("alunos.json", []);
  const matriculas = await ler("matriculas.json", []);
  const financeiro = await ler("financeiro.json", []);
  const mensalidades = await ler("mensalidades.json", []);
  const checkins = await ler("checkins.json", []);

  const alteracoes = [];

  for (const fin of financeiro.filter(f => f.tipo === "receber" && pago(f) && entrada(f))) {
    const mat = matriculas.find(m => String(m.id || "") === String(fin.matriculaId || ""));
    if (!mat) continue;

    if (["cancelada", "cancelado"].includes(n(mat.status))) continue;

    mat.status = "Ativa";
    mat.statusPagamento = "Pago";
    mat.statusFinanceiroInicial = "Pago";
    mat.financeiroInicialId = mat.financeiroInicialId || fin.id || "";
    mat.mensalidadeInicialId = mat.mensalidadeInicialId || fin.mensalidadeId || "";
    delete mat.encerradaEm;
    delete mat.canceladaEm;
    delete mat.motivoEncerramento;
    delete mat.motivoCancelamento;
    mat.ativadaEm = mat.ativadaEm || fin.dataPagamento || fin.pagamento || new Date().toISOString();
    mat.atualizadoEm = new Date().toISOString();
    mat.historico = Array.isArray(mat.historico) ? mat.historico : [];
    mat.historico.push({
      id: `hist_sync_seguro_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
      acao: "ativacao_segura_pos_pagamento",
      descricao: "Matrícula vinculada ao lançamento pago foi ativada sem cancelar outras pré-matrículas.",
      lancamentoFinanceiroId: fin.id,
      mensalidadeId: fin.mensalidadeId || "",
      criadoEm: new Date().toISOString()
    });

    const aluno = alunos.find(a => String(a.id || "") === String(mat.alunoId || fin.alunoId || ""));
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
      if (String(men.id || "") !== String(fin.mensalidadeId || "")) continue;
      men.status = "pago";
      men.valorRestante = 0;
      men.saldoRestante = 0;
      men.statusFinanceiroInicial = "Pago";
      men.atualizadoEm = new Date().toISOString();
    }

    for (const chk of checkins) {
      if (String(chk.alunoId || "") === String(mat.alunoId || fin.alunoId || "") ||
          String(chk.matriculaId || "") === String(mat.id || "")) {
        chk.status = "Ativo";
        chk.motivoBloqueio = "";
        chk.atualizadoEm = new Date().toISOString();
      }
    }

    alteracoes.push({ alunoId: mat.alunoId, matriculaId: mat.id, financeiroId: fin.id, status: "Ativa" });
  }

  await salvar("alunos.json", alunos);
  await salvar("matriculas.json", matriculas);
  await salvar("mensalidades.json", mensalidades);
  await salvar("checkins.json", checkins);

  const rel = {
    ok: true,
    versao: "2.6.1-N",
    data: new Date().toISOString(),
    regra: "Ativa somente a matrícula vinculada ao lançamento pago; não cancela outras pendências.",
    alteracoes
  };

  await fs.writeFile(path.join(LOGS, "sync-ativacao-segura-261n.json"), JSON.stringify(rel, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-N — Ativação segura");
  console.log(`Matrículas ativadas: ${alteracoes.length}`);
  console.log("Relatório: logs/sync-ativacao-segura-261n.json");
}

main().catch(e => {
  console.error("Falha:", e.message);
  process.exit(1);
});
