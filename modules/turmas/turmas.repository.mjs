import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQUIVO = "turmas.json";

function listaSegura(dados) {
  return Array.isArray(dados) ? dados : [];
}

export async function listarTurmas() {
  return listaSegura(await lerJsonDuravel(ARQUIVO, []));
}

export async function salvarTurmas(turmas) {
  const lista = listaSegura(turmas);
  await salvarJsonDuravel(ARQUIVO, lista);
  return lista;
}

export async function buscarTurmaPorId(id) {
  const turmas = await listarTurmas();
  return turmas.find((turma) => String(turma.id) === String(id)) || null;
}

export async function criarTurma(dados) {
  const turmas = await listarTurmas();
  const novaTurma = {
    id: Date.now(),
    status: "Ativa",
    alunosMatriculados: 0,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...dados
  };

  turmas.push(novaTurma);
  await salvarTurmas(turmas);
  return novaTurma;
}

export async function atualizarTurma(id, dados) {
  const turmas = await listarTurmas();
  const index = turmas.findIndex((turma) => String(turma.id) === String(id));

  if (index === -1) return null;

  turmas[index] = {
    ...turmas[index],
    ...dados,
    atualizadoEm: new Date().toISOString()
  };

  await salvarTurmas(turmas);
  return turmas[index];
}

export async function excluirTurma(id) {
  const turmas = await listarTurmas();
  const filtradas = turmas.filter((turma) => String(turma.id) !== String(id));

  if (filtradas.length === turmas.length) return false;

  await salvarTurmas(filtradas);
  return true;
}
