import { listarTodosContratos, salvarTodosContratos, buscarContrato } from "./contratos.repository.mjs";
import { listarServicosContratadosPorContrato } from "../servicos-contratados/servicos-contratados.service.mjs";
import { gerarId, dinheiro, texto, hojeISO, agoraISO, normalizar } from "../base.repository.mjs";

function mesesPorTipo(tipo) {
  const t = normalizar(tipo || "Mensal");
  if (t.includes("semes")) return 6;
  if (t.includes("anual")) return 12;
  if (t.includes("mensal")) return 1;
  return 0;
}

function addMeses(dataISO, meses) {
  if (!meses) return "";
  const d = new Date(`${dataISO || hojeISO()}T12:00:00`);
  d.setMonth(d.getMonth() + Number(meses || 0));
  return d.toISOString().slice(0, 10);
}

function normalizarContrato(dados = {}, existente = {}) {
  const alunoId = texto(dados.alunoId ?? existente.alunoId);
  if (!alunoId) { const erro = new Error("alunoId é obrigatório para criar contrato."); erro.status = 400; throw erro; }
  const tipoPlano = texto(dados.tipoPlano ?? existente.tipoPlano ?? "Mensal");
  const dataInicio = texto(dados.dataInicio ?? existente.dataInicio ?? hojeISO());
  const meses = Number(dados.periodicidadeMeses ?? existente.periodicidadeMeses ?? mesesPorTipo(tipoPlano));
  return {
    ...existente,
    id: existente.id || dados.id || gerarId("ctr"),
    alunoId,
    aluno: texto(dados.aluno ?? existente.aluno),
    matriculaId: texto(dados.matriculaId ?? existente.matriculaId),
    numeroMatricula: texto(dados.numeroMatricula ?? existente.numeroMatricula),
    tipoPlano,
    tipoCobranca: texto(dados.tipoCobranca ?? existente.tipoCobranca ?? tipoPlano),
    status: texto(dados.status ?? existente.status ?? "Ativo"),
    dataInicio,
    dataFim: texto(dados.dataFim ?? existente.dataFim ?? addMeses(dataInicio, meses)),
    periodicidadeMeses: meses,
    cobraMatricula: dados.cobraMatricula ?? existente.cobraMatricula ?? !["Pré-pago", "Diarista"].includes(tipoPlano),
    valorMatricula: dinheiro(dados.valorMatricula ?? existente.valorMatricula),
    renovacaoAutomatica: dados.renovacaoAutomatica ?? existente.renovacaoAutomatica ?? tipoPlano === "Mensal",
    bloquearAoVencer: dados.bloquearAoVencer ?? existente.bloquearAoVencer ?? ["Semestral", "Anual", "Pré-pago", "Diarista"].includes(tipoPlano),
    origem: texto(dados.origem ?? existente.origem ?? "manual"),
    observacao: texto(dados.observacao ?? existente.observacao),
    criadoEm: existente.criadoEm || dados.criadoEm || agoraISO(),
    atualizadoEm: agoraISO()
  };
}

export async function listarContratos(filtros = {}) {
  let lista = await listarTodosContratos();
  const alunoId = texto(filtros.alunoId);
  const status = normalizar(filtros.status || "");
  const busca = normalizar(filtros.busca || filtros.q || "");
  if (alunoId) lista = lista.filter(c => String(c.alunoId) === String(alunoId));
  if (status && status !== "todos") lista = lista.filter(c => normalizar(c.status) === status);
  if (busca) lista = lista.filter(c => normalizar([c.aluno, c.numeroMatricula, c.tipoPlano, c.status].join(" ")).includes(busca));
  return lista.sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
}

export async function obterContrato(id) {
  const contrato = await buscarContrato(id);
  if (!contrato) { const erro = new Error("Contrato não encontrado."); erro.status = 404; throw erro; }
  const servicos = await listarServicosContratadosPorContrato(id);
  const valorServicos = servicos.filter(s => !["Cancelado", "Removido"].includes(String(s.status))).reduce((t, s) => t + dinheiro(s.valor), 0);
  return { ...contrato, servicos, valorServicos: dinheiro(valorServicos), total: dinheiro((contrato.cobraMatricula ? contrato.valorMatricula : 0) + valorServicos) };
}

export async function criarContrato(dados) {
  const lista = await listarTodosContratos();
  const novo = normalizarContrato(dados);
  lista.push(novo);
  await salvarTodosContratos(lista);
  return novo;
}

export async function atualizarContrato(id, dados) {
  const lista = await listarTodosContratos();
  const idx = lista.findIndex(c => String(c.id) === String(id));
  if (idx < 0) { const erro = new Error("Contrato não encontrado."); erro.status = 404; throw erro; }
  lista[idx] = normalizarContrato(dados, lista[idx]);
  await salvarTodosContratos(lista);
  return lista[idx];
}

export async function encerrarContrato(id, motivo = "") {
  return atualizarContrato(id, { status: "Encerrado", dataFim: hojeISO(), observacao: motivo });
}
