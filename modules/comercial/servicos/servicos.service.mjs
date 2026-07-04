import { listarTodosServicos, salvarTodosServicos, buscarServico } from "./servicos.repository.mjs";
import { gerarId, dinheiro, texto, agoraISO, normalizar, lerJson } from "../base.repository.mjs";

function normalizarServico(dados = {}, existente = {}) {
  const nome = texto(dados.nome ?? dados.servico ?? existente.nome);
  if (!nome) {
    const erro = new Error("Nome do serviço é obrigatório.");
    erro.status = 400;
    throw erro;
  }
  return {
    ...existente,
    id: existente.id || dados.id || gerarId("srv"),
    nome,
    modalidade: texto(dados.modalidade ?? existente.modalidade ?? nome),
    descricao: texto(dados.descricao ?? existente.descricao),
    valorMensal: dinheiro(dados.valorMensal ?? existente.valorMensal),
    valorPrePago: dinheiro(dados.valorPrePago ?? existente.valorPrePago),
    valorDiarista: dinheiro(dados.valorDiarista ?? existente.valorDiarista),
    status: texto(dados.status ?? existente.status ?? "Ativo"),
    atualizadoEm: agoraISO(),
    criadoEm: existente.criadoEm || dados.criadoEm || agoraISO()
  };
}

export async function listarServicos(filtros = {}) {
  let lista = await listarTodosServicos();
  const busca = normalizar(filtros.busca || filtros.q || "");
  const status = normalizar(filtros.status || "");
  if (busca) lista = lista.filter(s => normalizar([s.nome, s.modalidade, s.descricao].join(" ")).includes(busca));
  if (status && status !== "todos") lista = lista.filter(s => normalizar(s.status) === status);
  return lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export async function obterServico(id) {
  const item = await buscarServico(id);
  if (!item) { const erro = new Error("Serviço não encontrado."); erro.status = 404; throw erro; }
  return item;
}

export async function criarServico(dados) {
  const lista = await listarTodosServicos();
  const novo = normalizarServico(dados);
  lista.push(novo);
  await salvarTodosServicos(lista);
  return novo;
}

export async function atualizarServico(id, dados) {
  const lista = await listarTodosServicos();
  const idx = lista.findIndex(s => String(s.id) === String(id));
  if (idx < 0) { const erro = new Error("Serviço não encontrado."); erro.status = 404; throw erro; }
  lista[idx] = normalizarServico(dados, lista[idx]);
  await salvarTodosServicos(lista);
  return lista[idx];
}

export async function removerServico(id) {
  const lista = await listarTodosServicos();
  const filtrada = lista.filter(s => String(s.id) !== String(id));
  if (filtrada.length === lista.length) { const erro = new Error("Serviço não encontrado."); erro.status = 404; throw erro; }
  await salvarTodosServicos(filtrada);
  return { removido: true };
}

export async function sincronizarServicosAPartirDasTurmas() {
  const turmas = await lerJson("turmas.json", []);
  const atuais = await listarTodosServicos();
  const porModalidade = new Map(atuais.map(s => [normalizar(s.modalidade || s.nome), s]));
  for (const turma of turmas) {
    const chave = normalizar(turma.modalidade || turma.nome);
    if (!chave) continue;
    const existente = porModalidade.get(chave) || {};
    porModalidade.set(chave, normalizarServico({
      id: existente.id || `srv_${chave.replace(/[^a-z0-9]+/g, "_")}`,
      nome: existente.nome || turma.modalidade || turma.nome,
      modalidade: turma.modalidade || turma.nome,
      descricao: existente.descricao || `Serviço originado da turma ${turma.nome || ""}`,
      valorMensal: existente.valorMensal || turma.valorMensal || turma.valor || 0,
      valorPrePago: existente.valorPrePago || turma.valorPrePago || turma.valorMensal || turma.valor || 0,
      valorDiarista: existente.valorDiarista || turma.valorDiarista || turma.valorAvulso || 0,
      status: existente.status || "Ativo",
      criadoEm: existente.criadoEm
    }, existente));
  }
  const lista = [...porModalidade.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  await salvarTodosServicos(lista);
  return lista;
}
