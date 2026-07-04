import { listarTurmas, buscarTurmaPorId, criarTurma, atualizarTurma, excluirTurma } from "./turmas.repository.mjs";
function texto(v){ return String(v ?? "").trim(); }
function numero(v,p=0){ const n=Number(v); return Number.isFinite(n)?Number(n.toFixed(2)):p; }
function normalizarTurma(dados = {}) {
  const valorMensal = numero(dados.valorMensal ?? dados.valor_mensal ?? dados.valor ?? 0);
  return {
    nome: texto(dados.nome),
    modalidade: texto(dados.modalidade),
    professor: texto(dados.professor),
    sala: texto(dados.sala ?? dados.local),
    diasSemana: texto(dados.diasSemana ?? dados.dias_semana),
    horario: texto(dados.horario),
    capacidade: numero(dados.capacidade, 0),
    alunosMatriculados: numero(dados.alunosMatriculados ?? dados.alunos_matriculados, 0),
    valorMensal,
    valorPrePago: numero(dados.valorPrePago ?? dados.valor_pre_pago ?? valorMensal, valorMensal),
    valorDiarista: numero(dados.valorDiarista ?? dados.valor_diarista ?? dados.valorAvulso ?? 0),
    tipoCobranca: texto(dados.tipoCobranca) || "Por contratação",
    status: texto(dados.status) || "Ativa",
    observacoes: texto(dados.observacoes)
  };
}
function validarTurma(dados) {
  const t = normalizarTurma(dados); const erros=[];
  if(!t.nome) erros.push("Nome da turma é obrigatório.");
  if(!t.modalidade) erros.push("Modalidade é obrigatória.");
  if(!t.professor) erros.push("Professor é obrigatório.");
  if(!t.diasSemana) erros.push("Dias da semana são obrigatórios.");
  if(!t.horario) erros.push("Horário é obrigatório.");
  if(!(t.capacidade > 0)) erros.push("Capacidade deve ser maior que zero.");
  if(erros.length){ const e=new Error(erros.join(" ")); e.statusCode=400; throw e; }
  return t;
}
export async function obterTurmas(filtros = {}) {
  const busca = texto(filtros.busca || filtros.q).toLowerCase(); const status = texto(filtros.status);
  const modalidade = texto(filtros.modalidade).toLowerCase();
  return (await listarTurmas()).map((t)=>({ ...t, ...normalizarTurma(t) })).filter((t)=>{
    const textoBusca=[t.nome,t.modalidade,t.professor,t.sala].join(" ").toLowerCase();
    return (!busca || textoBusca.includes(busca)) && (!status || status === "Todos" || t.status === status) && (!modalidade || String(t.modalidade).toLowerCase() === modalidade);
  });
}
export async function obterResumoTurmas() {
  const turmas = await obterTurmas(); const ativas=turmas.filter(t=>t.status==="Ativa").length;
  const vagas=turmas.reduce((total,t)=>total+Math.max(Number(t.capacidade||0)-Number(t.alunosMatriculados||0),0),0);
  return { total: turmas.length, ativas, inativas: turmas.length-ativas, vagas };
}
export async function obterTurma(id) { const t = await buscarTurmaPorId(id); if(!t){ const e=new Error("Turma não encontrada."); e.statusCode=404; throw e; } return { ...t, ...normalizarTurma(t) }; }
export async function cadastrarTurma(dados) { return criarTurma(validarTurma(dados)); }
export async function editarTurma(id,dados) { const turma = await atualizarTurma(id, validarTurma(dados)); if(!turma){ const e=new Error("Turma não encontrada."); e.statusCode=404; throw e; } return turma; }
export async function removerTurma(id) { const ok=await excluirTurma(id); if(!ok){ const e=new Error("Turma não encontrada."); e.statusCode=404; throw e; } return { removida:true }; }
