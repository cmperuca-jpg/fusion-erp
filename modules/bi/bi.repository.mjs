import fs from "fs/promises";
import path from "path";

async function lerJSON(nomeArquivo, padrao = []) {
  const arquivo = path.resolve("data", nomeArquivo);

  try {
    const conteudo = await fs.readFile(arquivo, "utf8");
    const json = JSON.parse(conteudo || "null");
    return json ?? padrao;
  } catch {
    return padrao;
  }
}

function comoLista(valor, chaves = []) {
  if (Array.isArray(valor)) return valor;
  if (!valor || typeof valor !== "object") return [];
  for (const chave of chaves) {
    if (Array.isArray(valor[chave])) return valor[chave];
  }
  return [];
}

export async function carregarBaseBI() {
  const [
    alunosRaw,
    professoresRaw,
    turmasRaw,
    matriculasRaw,
    presencasRaw,
    checkinRaw,
    checkinsRaw,
    financeiroRaw,
    avaliacoesRaw,
    treinosRaw,
    exerciciosRaw,
    estoqueRaw,
    pdvRaw,
    agendaRaw
  ] = await Promise.all([
    lerJSON("alunos.json"),
    lerJSON("professores.json"),
    lerJSON("turmas.json"),
    lerJSON("matriculas.json"),
    lerJSON("presencas.json"),
    lerJSON("checkin.json"),
    lerJSON("checkins.json"),
    lerJSON("financeiro.json"),
    lerJSON("avaliacoes.json"),
    lerJSON("treinos.json"),
    lerJSON("exercicios.json"),
    lerJSON("estoque.json"),
    lerJSON("pdv.json"),
    lerJSON("agenda.json")
  ]);

  const presencas = comoLista(presencasRaw, ["presencas", "dados"]);
  const checkin = comoLista(checkinRaw, ["checkin", "checkins", "dados"]);
  const checkins = comoLista(checkinsRaw, ["checkins", "checkin", "dados"]);

  return {
    alunos: comoLista(alunosRaw, ["alunos", "dados"]),
    professores: comoLista(professoresRaw, ["professores", "dados"]),
    turmas: comoLista(turmasRaw, ["turmas", "dados"]),
    matriculas: comoLista(matriculasRaw, ["matriculas", "dados"]),
    presencas: [...presencas, ...checkin, ...checkins],
    checkin,
    checkins,
    financeiro: comoLista(financeiroRaw, ["financeiro", "lancamentos", "dados"]),
    avaliacoes: comoLista(avaliacoesRaw, ["avaliacoes", "dados"]),
    treinos: comoLista(treinosRaw, ["treinos", "dados"]),
    exercicios: comoLista(exerciciosRaw, ["exercicios", "dados"]),
    estoque: comoLista(estoqueRaw, ["estoque", "produtos", "dados"]),
    pdv: comoLista(pdvRaw, ["pdv", "vendas", "dados"]),
    agenda: comoLista(agendaRaw, ["agenda", "aulas", "dados"])
  };
}
