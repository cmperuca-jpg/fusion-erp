import { listarTodosServicosContratados, salvarTodosServicosContratados, buscarServicoContratado } from "./servicos-contratados.repository.mjs";
import { gerarId, dinheiro, texto, hojeISO, agoraISO, normalizar, lerJson } from "../base.repository.mjs";

function valorPorTipo(turma = {}, tipo = "Mensal") {
  const t = normalizar(tipo);
  if (t.includes("diar")) return dinheiro(turma.valorDiarista ?? turma.valorAvulso ?? turma.valorMensal ?? turma.valor ?? 0);
  if (t.includes("pre")) return dinheiro(turma.valorPrePago ?? turma.valorMensal ?? turma.valor ?? 0);
  return dinheiro(turma.valorMensal ?? turma.valor ?? 0);
}

async function normalizarItem(dados = {}, existente = {}) {
  const contratoId = texto(dados.contratoId ?? existente.contratoId);
  if (!contratoId) { const erro = new Error("contratoId é obrigatório."); erro.status = 400; throw erro; }
  const tipoCobranca = texto(dados.tipoCobranca ?? existente.tipoCobranca ?? "Mensal");
  let turma = null;
  if (dados.turmaId || existente.turmaId) {
    const turmas = await lerJson("turmas.json", []);
    turma = turmas.find(t => String(t.id) === String(dados.turmaId ?? existente.turmaId)) || null;
  }
  const valor = dinheiro(dados.valor ?? existente.valor ?? valorPorTipo(turma || {}, tipoCobranca));
  return {
    ...existente,
    id: existente.id || dados.id || gerarId("svc_ctr"),
    contratoId,
    alunoId: texto(dados.alunoId ?? existente.alunoId),
    matriculaId: texto(dados.matriculaId ?? existente.matriculaId),
    turmaId: texto(dados.turmaId ?? existente.turmaId ?? turma?.id),
    servicoId: texto(dados.servicoId ?? existente.servicoId),
    nome: texto(dados.nome ?? dados.servico ?? existente.nome ?? turma?.nome),
    modalidade: texto(dados.modalidade ?? existente.modalidade ?? turma?.modalidade),
    professor: texto(dados.professor ?? existente.professor ?? turma?.professor),
    diasSemana: texto(dados.diasSemana ?? existente.diasSemana ?? turma?.diasSemana),
    horario: texto(dados.horario ?? existente.horario ?? turma?.horario),
    sala: texto(dados.sala ?? existente.sala ?? turma?.sala),
    tipoCobranca,
    valor,
    status: texto(dados.status ?? existente.status ?? "Ativo"),
    dataInicio: texto(dados.dataInicio ?? existente.dataInicio ?? hojeISO()),
    dataFim: texto(dados.dataFim ?? existente.dataFim),
    origem: texto(dados.origem ?? existente.origem ?? "manual"),
    criadoEm: existente.criadoEm || dados.criadoEm || agoraISO(),
    atualizadoEm: agoraISO()
  };
}

export async function listarServicosContratados(filtros = {}) {
  let lista = await listarTodosServicosContratados();
  const contratoId = texto(filtros.contratoId);
  const alunoId = texto(filtros.alunoId);
  const matriculaId = texto(filtros.matriculaId);
  const status = normalizar(filtros.status || "");
  if (contratoId) lista = lista.filter(s => String(s.contratoId) === String(contratoId));
  if (alunoId) lista = lista.filter(s => String(s.alunoId) === String(alunoId));
  if (matriculaId) lista = lista.filter(s => String(s.matriculaId) === String(matriculaId));
  if (status && status !== "todos") lista = lista.filter(s => normalizar(s.status) === status);
  return lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}
export async function listarServicosContratadosPorContrato(contratoId) { return listarServicosContratados({ contratoId }); }
export async function obterServicoContratado(id) { const item = await buscarServicoContratado(id); if (!item) { const erro = new Error("Serviço contratado não encontrado."); erro.status = 404; throw erro; } return item; }
export async function contratarServico(dados) { const lista = await listarTodosServicosContratados(); const novo = await normalizarItem(dados); lista.push(novo); await salvarTodosServicosContratados(lista); return novo; }
export async function atualizarServicoContratado(id, dados) { const lista = await listarTodosServicosContratados(); const idx = lista.findIndex(s => String(s.id) === String(id)); if (idx < 0) { const erro = new Error("Serviço contratado não encontrado."); erro.status = 404; throw erro; } lista[idx] = await normalizarItem(dados, lista[idx]); await salvarTodosServicosContratados(lista); return lista[idx]; }
export async function removerServicoContratado(id, motivo = "") { return atualizarServicoContratado(id, { status: "Removido", dataFim: hojeISO(), motivo }); }
export async function removerTodosServicosDoContrato(contratoId, motivo = "Remoção em lote") { const lista = await listarTodosServicosContratados(); let alterados = 0; const agora = agoraISO(); const hoje = hojeISO(); for (const item of lista) { if (String(item.contratoId) === String(contratoId) && !["Removido", "Cancelado"].includes(String(item.status))) { item.status = "Removido"; item.dataFim = hoje; item.motivo = motivo; item.atualizadoEm = agora; alterados++; } } await salvarTodosServicosContratados(lista); return { alterados }; }
