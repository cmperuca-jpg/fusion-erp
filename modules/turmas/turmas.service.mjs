import { listarTurmas, buscarTurmaPorId, criarTurma, atualizarTurma, excluirTurma } from "./turmas.repository.mjs";
import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";
import { matriculaEstaAtiva, normalizarStatusMatricula } from "../matriculas/matricula-status.util.mjs";

function texto(v){ return String(v ?? "").trim(); }
function numero(v,p=0){ const n=Number(v); return Number.isFinite(n)?Number(n.toFixed(2)):p; }
function normalizar(v){ return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

function semCamposDePrecoTurma(item = {}) {
  const {
    valor,
    valorMensal,
    valor_mensal,
    valorPrePago,
    valor_pre_pago,
    valorDiarista,
    valor_diarista,
    valorAvulso,
    preco,
    mensalidade,
    tipoCobranca,
    ...restante
  } = item || {};
  return restante;
}

function statusAtivo(item = {}) {
  return matriculaEstaAtiva(item);
}

function idTurma(turma = {}) { return texto(turma.id ?? turma.turmaId ?? turma.turma_id ?? turma.codigo); }
function nomeTurma(turma = {}) { return normalizar(turma.nome ?? turma.turma ?? turma.turmaNome ?? turma.turma_nome); }

function valoresComoLista(valor) {
  if (Array.isArray(valor)) return valor;
  if (valor === null || valor === undefined || valor === "") return [];
  return [valor];
}

function idsTurmasMatricula(matricula = {}) {
  const ids = new Set();
  const adicionar = valor => {
    for (const item of valoresComoLista(valor)) {
      if (item && typeof item === "object") adicionar(item.id ?? item.turmaId ?? item.turma_id);
      else if (texto(item)) ids.add(texto(item));
    }
  };
  adicionar(matricula.turmaId);
  adicionar(matricula.turma_id);
  adicionar(matricula.idTurma);
  adicionar(matricula.turmaIds);
  adicionar(matricula.turma_ids);
  adicionar(matricula.turmasIds);
  adicionar(matricula.turmasSelecionadas);
  adicionar(matricula.turmas);
  return ids;
}

function nomesTurmasMatricula(matricula = {}) {
  const nomes = new Set();
  const adicionar = valor => {
    for (const item of valoresComoLista(valor)) {
      if (item && typeof item === "object") adicionar(item.nome ?? item.turma ?? item.turmaNome ?? item.turma_nome);
      else if (normalizar(item)) nomes.add(normalizar(item));
    }
  };
  adicionar(matricula.turmaNome);
  adicionar(matricula.turma_nome);
  adicionar(matricula.nomeTurma);
  adicionar(matricula.turmaNomes);
  adicionar(matricula.turma_nomes);
  adicionar(matricula.turmasNomes);
  adicionar(matricula.nomesTurmas);
  if (!matricula.turmaId && !matricula.turma_id) adicionar(matricula.turma);
  return nomes;
}

function chaveMatricula(matricula = {}, indice = 0) {
  return texto(matricula.id ?? matricula.matriculaId ?? matricula.matricula_id) ||
    `${texto(matricula.alunoId ?? matricula.aluno_id)}|${indice}`;
}

async function carregarMatriculas() {
  try {
    const dados = await lerJsonDuravel("matriculas.json", []);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function mapaOcupacaoPorTurma(turmas = []) {
  const matriculas = await carregarMatriculas();
  const mapa = new Map(turmas.map(turma => [idTurma(turma), new Set()]));
  const porNome = new Map(turmas.map(turma => [nomeTurma(turma), idTurma(turma)]).filter(([nome,id]) => nome && id));

  matriculas.forEach((matricula, indice) => {
    if (!statusAtivo(matricula)) return;
    const chave = chaveMatricula(matricula, indice);

    idsTurmasMatricula(matricula).forEach(id => {
      if (mapa.has(id)) mapa.get(id).add(chave);
    });

    nomesTurmasMatricula(matricula).forEach(nome => {
      const id = porNome.get(nome);
      if (id && mapa.has(id)) mapa.get(id).add(chave);
    });
  });

  return new Map([...mapa.entries()].map(([id, itens]) => [id, itens.size]));
}

function normalizarTurma(dados = {}, alunosMatriculados = 0) {
  return {
    nome: texto(dados.nome),
    modalidade: texto(dados.modalidade),
    professor: texto(dados.professor),
    sala: texto(dados.sala ?? dados.local),
    diasSemana: texto(dados.diasSemana ?? dados.dias_semana),
    horario: texto(dados.horario),
    capacidade: numero(dados.capacidade, 0),
    alunosMatriculados: numero(alunosMatriculados, 0),
    status: texto(dados.status) || "Ativa",
    observacoes: texto(dados.observacoes)
  };
}

function validarTurma(dados) {
  const t = normalizarTurma(dados, 0);
  const erros=[];
  if(!t.nome) erros.push("Nome da turma é obrigatório.");
  if(!t.modalidade) erros.push("Modalidade é obrigatória.");
  if(!t.professor) erros.push("Professor é obrigatório.");
  if(!t.diasSemana) erros.push("Dias da semana são obrigatórios.");
  if(!t.horario) erros.push("Horário é obrigatório.");
  if(!(t.capacidade > 0)) erros.push("Capacidade deve ser maior que zero.");
  if(erros.length){ const e=new Error(erros.join(" ")); e.statusCode=400; throw e; }
  return semCamposDePrecoTurma(t);
}

export async function obterTurmas(filtros = {}) {
  const busca = texto(filtros.busca || filtros.q).toLowerCase();
  const status = texto(filtros.status);
  const modalidade = texto(filtros.modalidade).toLowerCase();
  const turmas = await listarTurmas();
  const ocupacao = await mapaOcupacaoPorTurma(turmas);

  return turmas
    .map(t => semCamposDePrecoTurma({
      ...t,
      ...normalizarTurma(t, ocupacao.get(idTurma(t)) || 0)
    }))
    .filter(t => {
      const textoBusca=[t.nome,t.modalidade,t.professor,t.sala].join(" ").toLowerCase();
      return (!busca || textoBusca.includes(busca)) &&
        (!status || ["todos","todas"].includes(normalizarStatusMatricula(status)) || normalizarStatusMatricula(t.status) === normalizarStatusMatricula(status)) &&
        (!modalidade || String(t.modalidade).toLowerCase() === modalidade);
    });
}

export async function obterResumoTurmas() {
  const turmas = await obterTurmas();
  const ativas=turmas.filter(t=>matriculaEstaAtiva(t)).length;
  const vagas=turmas.reduce((total,t)=>total+Math.max(Number(t.capacidade||0)-Number(t.alunosMatriculados||0),0),0);
  return { total: turmas.length, ativas, inativas: turmas.length-ativas, vagas };
}

export async function obterTurma(id) {
  const turma = await buscarTurmaPorId(id);
  if(!turma){ const e=new Error("Turma não encontrada."); e.statusCode=404; throw e; }
  const ocupacao = await mapaOcupacaoPorTurma([turma]);
  return semCamposDePrecoTurma({
    ...turma,
    ...normalizarTurma(turma, ocupacao.get(idTurma(turma)) || 0)
  });
}

export async function cadastrarTurma(dados) {
  return criarTurma(validarTurma(dados));
}

export async function editarTurma(id,dados) {
  const turma = await atualizarTurma(id, validarTurma(dados));
  if(!turma){ const e=new Error("Turma não encontrada."); e.statusCode=404; throw e; }
  return obterTurma(id);
}

export async function removerTurma(id) {
  const ok=await excluirTurma(id);
  if(!ok){ const e=new Error("Turma não encontrada."); e.statusCode=404; throw e; }
  return { removida:true };
}
