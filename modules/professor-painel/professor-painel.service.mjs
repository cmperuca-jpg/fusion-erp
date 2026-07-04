import { registrar as registrarFrequencia, chamadaTurma } from "../frequencia/frequencia.service.mjs";
import { carregarBaseProfessorPainel } from "./professor-painel.repository.mjs";

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function agoraISO() { return new Date().toISOString(); }
function texto(v) { return String(v ?? "").trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function ativo(item) { return !["cancelado","cancelada","encerrado","encerrada","inativo","inativa","bloqueado","bloqueada","removido","removida"].includes(normalizar(item?.status || "Ativo")); }
function alunoNome(a = {}) { return texto(a.nome || a.aluno || a.name || a.nomeCompleto || "Aluno"); }
function numero(v) { const n = Number(String(v ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0] || 0); return Number.isFinite(n) ? n : 0; }
function seriesNumero(v) { const n = numero(v); return n > 0 ? n : 1; }
function calcularVolumeExercicio(ex = {}) { return numero(ex.cargaRealizada || ex.cargaPrevista || ex.carga) * numero(ex.repeticoesRealizadas || ex.repeticoes) * seriesNumero(ex.series); }
function calcularVolumeExecucao(exec = {}) { return (exec.exercicios || []).reduce((t, ex) => t + calcularVolumeExercicio(ex), 0); }
function dataItem(item = {}) { return String(item.data || item.dataEntrada || item.criadoEm || item.createdAt || "").slice(0, 10); }

function localizarProfessor(professores, chave = "") {
  const alvo = normalizar(chave);
  if (!alvo) return null;
  return professores.find((p) =>
    String(p.id) === String(chave) ||
    normalizar(p.nome) === alvo ||
    normalizar(p.nome).includes(alvo) ||
    alvo.includes(normalizar(p.nome))
  ) || null;
}

function validarProfessorObrigatorio(base, professorChave = "") {
  const chave = texto(professorChave);
  if (!chave || normalizar(chave) === "todos") {
    throw Object.assign(new Error("Selecione um professor para visualizar o dashboard."), { status: 400 });
  }
  const professor = localizarProfessor(base.professores, chave);
  if (!professor) {
    const existeServico = (base.servicosContratados || []).some((s) => professorBate(s, chave, null));
    if (!existeServico) throw Object.assign(new Error("Professor não encontrado."), { status: 404 });
  }
  return professor || { id: chave, nome: chave };
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function professorBate(item = {}, professorChave = "", professor = null) {
  const alvo = normalizar(professor?.nome || professorChave);
  if (!alvo) return true;
  const ids = [item.professorId, item.professor_id, item.professorResponsavelId].filter(Boolean).map(String);
  if (ids.includes(String(professorChave)) || (professor?.id && ids.includes(String(professor.id)))) return true;
  const nome = normalizar(item.professor || item.professorNome || item.professor_responsavel || "");
  return Boolean(nome && (nome === alvo || nome.includes(alvo) || alvo.includes(nome)));
}

function dataDiaSemana(dataISO = hojeISO()) {
  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);
  const nomes = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
  return nomes[data.getDay()];
}

function ocorreNoDia(diasSemana = "", dataISO = hojeISO()) {
  const dias = normalizar(diasSemana);
  if (!dias || dias.includes("livre")) return true;
  if (dias.includes("segunda a sexta")) return !["sabado","domingo"].includes(dataDiaSemana(dataISO));
  if (dias.includes("segunda a sabado")) return dataDiaSemana(dataISO) !== "domingo";
  return dias.includes(dataDiaSemana(dataISO));
}

function frequenciaDoAluno(frequencias, alunoId, turmaId, data) {
  return frequencias.find((f) =>
    String(f.alunoId) === String(alunoId) &&
    (!turmaId || String(f.turmaId) === String(turmaId)) &&
    String(f.data || "").slice(0, 10) === String(data).slice(0, 10) &&
    normalizar(f.status) !== "cancelado"
  ) || null;
}

function treinosAluno(treinos, alunoId) {
  return treinos.filter((t) =>
    String(t.alunoId || t.aluno_id) === String(alunoId) &&
    !["cancelado","inativo","arquivado"].includes(normalizar(t.status || "ativo"))
  );
}

function avaliacoesAluno(avaliacoes, alunoId) {
  return avaliacoes
    .filter((a) => String(a.alunoId || a.aluno_id) === String(alunoId))
    .sort((a, b) => String(b.data || b.criadoEm || "").localeCompare(String(a.data || a.criadoEm || "")));
}

function montarAula(servico, base, data) {
  const aluno = localizarAluno(base.alunos, servico.alunoId);
  const professor = localizarProfessor(base.professores, servico.professor || servico.professorId);
  const freq = frequenciaDoAluno(base.frequencia, servico.alunoId, servico.turmaId, data);
  const treinos = treinosAluno(base.treinos, servico.alunoId);
  const avaliacoes = avaliacoesAluno(base.avaliacoes, servico.alunoId);

  return {
    alunoId: servico.alunoId,
    aluno: alunoNome(aluno || { nome: servico.aluno }),
    contratoId: servico.contratoId,
    matriculaId: servico.matriculaId || "",
    servicoContratadoId: servico.id || servico.servicoContratadoId || "",
    turmaId: String(servico.turmaId || ""),
    turma: servico.turma || servico.nome || "",
    modalidade: servico.modalidade || "",
    professorId: professor?.id || servico.professorId || "",
    professor: professor?.nome || servico.professor || "",
    horario: servico.horario || "",
    sala: servico.sala || "",
    diasSemana: servico.diasSemana || "",
    ocorreHoje: ocorreNoDia(servico.diasSemana, data),
    statusFrequencia: freq?.status || "Pendente",
    frequenciaId: freq?.id || "",
    possuiTreinoAtivo: treinos.length > 0,
    totalTreinosAtivos: treinos.length,
    ultimaAvaliacao: avaliacoes[0] || null,
    totalAvaliacoes: avaliacoes.length
  };
}

function agruparTurmas(aulas = []) {
  const mapa = new Map();
  for (const aula of aulas) {
    const key = aula.turmaId || aula.turma || "sem_turma";
    if (!mapa.has(key)) {
      mapa.set(key, { turmaId: aula.turmaId, turma: aula.turma, modalidade: aula.modalidade, professorId: aula.professorId, professor: aula.professor, horario: aula.horario, sala: aula.sala, alunos: [], totalAlunos: 0, presentes: 0, pendentes: 0, faltas: 0 });
    }
    const turma = mapa.get(key);
    turma.totalAlunos += 1;
    const status = normalizar(aula.statusFrequencia);
    if (status === "presente") turma.presentes += 1;
    else if (status === "falta") turma.faltas += 1;
    else turma.pendentes += 1;
    turma.alunos.push({ alunoId: aula.alunoId, aluno: aula.aluno, contratoId: aula.contratoId, matriculaId: aula.matriculaId, servicoContratadoId: aula.servicoContratadoId, statusFrequencia: aula.statusFrequencia, frequenciaId: aula.frequenciaId, possuiTreinoAtivo: aula.possuiTreinoAtivo, totalTreinosAtivos: aula.totalTreinosAtivos, ultimaAvaliacao: aula.ultimaAvaliacao });
  }
  return [...mapa.values()].sort((a, b) => texto(a.horario).localeCompare(texto(b.horario)) || texto(a.turma).localeCompare(texto(b.turma)));
}

async function aulasDoProfessor(professorChave = "", filtros = {}) {
  const data = filtros.data || hojeISO();
  const base = await carregarBaseProfessorPainel();
  const prof = localizarProfessor(base.professores, professorChave);
  const alvo = normalizar(prof?.nome || professorChave);
  let aulas = base.servicosContratados.filter(ativo).map((s) => montarAula(s, base, data)).filter((a) => {
    if (!alvo) return true;
    return String(a.professorId) === String(professorChave) || normalizar(a.professor) === alvo || normalizar(a.professor).includes(alvo) || alvo.includes(normalizar(a.professor));
  });
  if (filtros.apenasHoje === true || filtros.apenasHoje === "true") aulas = aulas.filter((a) => a.ocorreHoje);
  if (filtros.turmaId) aulas = aulas.filter((a) => String(a.turmaId) === String(filtros.turmaId));
  return { professor: prof || { id: professorChave, nome: professorChave || "Todos" }, data, aulas, base };
}

function resumoExecucao(exec = {}) {
  const lista = Array.isArray(exec.exercicios) ? exec.exercicios : [];
  const total = lista.length;
  const concluidos = lista.filter((e) => e.concluido).length;
  return { total, concluidos, percentual: total ? Math.round((concluidos / total) * 100) : 0 };
}

function exercicioAtual(exec = {}) {
  const lista = exec.exercicios || [];
  return lista.find((e) => !e.concluido) || lista[lista.length - 1] || null;
}

function melhorExecucaoExercicio(base, alunoId, nomeExercicio) {
  const alvo = normalizar(nomeExercicio);
  let melhorCarga = 0;
  let melhorVolume = 0;
  let ultima = null;
  const historico = [];
  for (const exec of base.execucoes || []) {
    if (String(exec.alunoId) !== String(alunoId)) continue;
    for (const ex of exec.exercicios || []) {
      if (normalizar(ex.nome) !== alvo) continue;
      const carga = numero(ex.cargaRealizada || ex.cargaPrevista);
      const volume = calcularVolumeExercicio(ex);
      melhorCarga = Math.max(melhorCarga, carga);
      melhorVolume = Math.max(melhorVolume, volume);
      historico.push({ data: exec.data || dataItem(exec), carga, volume, repeticoes: numero(ex.repeticoesRealizadas || ex.repeticoes) });
    }
  }
  historico.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  ultima = historico[0] || null;
  return { melhorCarga, melhorVolume, ultima };
}

function statusCheckinAberto(checkin = {}) {
  const status = normalizar(checkin.status || checkin.situacao || "");
  return !["saida", "finalizado", "encerrado", "cancelado", "bloqueado"].includes(status);
}

function montarOperacionalProfessor(base, professorChave = "", filtros = {}) {
  const data = filtros.data || hojeISO();
  const prof = localizarProfessor(base.professores, professorChave);
  const execucoesDia = (base.execucoes || []).filter((e) => dataItem(e) === data && professorBate(e, professorChave, prof));
  const checkinsDia = (base.checkins || []).filter((c) => dataItem(c) === data && professorBate(c, professorChave, prof));
  const presentes = checkinsDia.filter(statusCheckinAberto);
  const emExecucao = execucoesDia.filter((e) => !["concluido", "concluído", "cancelado"].includes(normalizar(e.status)));
  const concluidos = execucoesDia.filter((e) => ["concluido", "concluído"].includes(normalizar(e.status)));

  const alunos = emExecucao.map((exec) => {
    const aluno = localizarAluno(base.alunos, exec.alunoId);
    const treino = base.treinos.find((t) => String(t.id) === String(exec.treinoId)) || {};
    const atual = exercicioAtual(exec);
    const resumo = resumoExecucao(exec);
    const volume = calcularVolumeExecucao(exec);
    const inicio = exec.iniciadoEm || exec.criadoEm || exec.dataHora || exec.dataEntrada || agoraISO();
    const min = Math.max(0, Math.round((Date.now() - new Date(inicio).getTime()) / 60000));
    const pr = atual ? melhorExecucaoExercicio(base, exec.alunoId, atual.nome) : { melhorCarga: 0, melhorVolume: 0, ultima: null };
    const alertas = [];
    if (min >= 90 && resumo.percentual < 100) alertas.push("Treino longo");
    if (atual && numero(atual.cargaRealizada) > 0 && numero(atual.cargaRealizada) >= pr.melhorCarga) alertas.push("Novo PR");
    if (atual && pr.ultima && numero(atual.cargaRealizada) > 0 && numero(atual.cargaRealizada) < pr.ultima.carga) alertas.push("Carga abaixo da anterior");
    if (resumo.percentual === 0 && min >= 15) alertas.push("Sem avanço");

    return {
      execucaoId: exec.id,
      treinoId: exec.treinoId,
      alunoId: exec.alunoId,
      aluno: exec.aluno || alunoNome(aluno || {}),
      professor: exec.professor || treino.professorNome || treino.professor || prof?.nome || professorChave,
      treino: treino.nome || treino.objetivo || exec.treino || "Treino",
      status: exec.status || "Em andamento",
      inicio,
      minutos: min,
      exercicioAtual: atual?.nome || "-",
      serie: atual?.series || "-",
      repeticoes: atual?.repeticoesRealizadas || atual?.repeticoes || "-",
      carga: atual?.cargaRealizada || atual?.cargaPrevista || "-",
      descanso: atual?.descanso || atual?.tempoDescanso || "-",
      progresso: resumo,
      volume: Math.round(volume),
      melhorCarga: pr.melhorCarga,
      melhorVolume: Math.round(pr.melhorVolume),
      alertas
    };
  });

  const rankings = {
    volume: [...alunos].sort((a, b) => b.volume - a.volume).slice(0, 10),
    progresso: [...alunos].sort((a, b) => b.progresso.percentual - a.progresso.percentual).slice(0, 10),
    pr: alunos.filter((a) => a.alertas.includes("Novo PR")).slice(0, 10)
  };

  return {
    data,
    professor: prof || { id: professorChave, nome: professorChave || "Todos" },
    kpis: {
      presentes: presentes.length,
      checkinsHoje: checkinsDia.length,
      emExecucao: emExecucao.length,
      concluidos: concluidos.length,
      volumeTotal: Math.round(execucoesDia.reduce((t, e) => t + calcularVolumeExecucao(e), 0)),
      alertas: alunos.reduce((t, a) => t + a.alertas.length, 0)
    },
    alunos,
    rankings,
    checkins: presentes.map((c) => ({ id: c.id, alunoId: c.alunoId, aluno: c.aluno || c.alunoNome || c.nomeAluno || "Aluno", entrada: c.horaEntrada || c.entrada || c.criadoEm || "", status: c.status || "Presente" })),
    concluidos: concluidos.map((e) => ({ execucaoId: e.id, alunoId: e.alunoId, aluno: e.aluno || "Aluno", volume: Math.round(calcularVolumeExecucao(e)), concluidoEm: e.concluidoEm || e.atualizadoEm || "" }))
  };
}

export async function statusPainelProfessor() {
  return { ok: true, modulo: "professor-painel", versao: "Fusion ERP 2.6-D", status: "Online", conceito: "Dashboard completo do professor integrado a check-in, execução assistida e progressão de cargas" };
}

export async function listarProfessoresPainel(filtros = {}) {
  const base = await carregarBaseProfessorPainel();
  const data = filtros.data || hojeISO();
  const mapa = new Map();

  for (const p of base.professores || []) {
    const id = String(p.id || p._id || p.professorId || p.professor_id || "");
    const nome = texto(p.nome || p.professor || p.name);
    if (!nome) continue;
    mapa.set(id || nome, { professor: nome, professorId: id, totalVinculos: 0, alunosHoje: 0, turmasHoje: 0 });
  }

  for (const s of base.servicosContratados.filter(ativo)) {
    const prof = localizarProfessor(base.professores, s.professor || s.professorId);
    const nome = texto(prof?.nome || s.professor || s.professorNome);
    if (!nome) continue;
    const id = String(prof?.id || s.professorId || nome);
    if (!mapa.has(id)) mapa.set(id, { professor: nome, professorId: prof?.id || s.professorId || "", totalVinculos: 0, alunosHoje: 0, turmasHoje: 0 });
  }

  const professores = [...mapa.values()].map((item) => {
    const dados = base.servicosContratados.filter((s) => ativo(s) && professorBate(s, item.professorId || item.professor, item.professorId ? localizarProfessor(base.professores, item.professorId) : null));
    const hoje = dados.filter((s) => ocorreNoDia(s.diasSemana, data));
    return { ...item, totalVinculos: dados.length, alunosHoje: hoje.length, turmasHoje: [...new Set(hoje.map((s) => s.turmaId))].length };
  }).sort((a, b) => texto(a.professor).localeCompare(texto(b.professor), "pt-BR"));

  return { ok: true, data, total: professores.length, professores };
}

export async function obterPainelProfessor(professorChave, filtros = {}) {
  const { professor, aulas, data } = await aulasDoProfessor(professorChave, filtros);
  const hoje = aulas.filter((a) => a.ocorreHoje);
  const turmas = agruparTurmas(filtros.apenasHoje === false || filtros.apenasHoje === "false" ? aulas : hoje);
  return { ok: true, data, professor, totalVinculos: aulas.length, alunosHoje: hoje.length, turmasHoje: turmas.length, presentes: turmas.reduce((t, x) => t + x.presentes, 0), pendentes: turmas.reduce((t, x) => t + x.pendentes, 0), faltas: turmas.reduce((t, x) => t + x.faltas, 0), turmas };
}

export async function obterDashboardProfessor(professorChave, filtros = {}) {
  const base = await carregarBaseProfessorPainel();
  const professorValidado = validarProfessorObrigatorio(base, professorChave);
  const chave = professorValidado.id || professorValidado.nome;
  const painel = await obterPainelProfessor(chave, { ...filtros, apenasHoje: filtros.apenasHoje ?? "true" });
  const operacional = montarOperacionalProfessor(base, chave, filtros);
  return { ok: true, ...painel, professor: professorValidado, operacional, atualizadoEm: agoraISO() };
}

export async function obterTurmaProfessor(professorChave, turmaId, filtros = {}) {
  const { professor, aulas, data } = await aulasDoProfessor(professorChave, { ...filtros, turmaId });
  return { ok: true, data, professor, turma: agruparTurmas(aulas)[0] || { turmaId, alunos: [] } };
}

export async function registrarPresencaProfessor(professorChave, dados = {}) {
  const turmaId = dados.turmaId || dados.turma_id;
  const alunoId = dados.alunoId || dados.aluno_id;
  if (!turmaId) throw Object.assign(new Error("Informe turmaId."), { status: 400 });
  if (!alunoId) throw Object.assign(new Error("Informe alunoId."), { status: 400 });
  const turma = await obterTurmaProfessor(professorChave, turmaId, { data: dados.data || hojeISO() });
  const alunoNaTurma = (turma.turma.alunos || []).find((a) => String(a.alunoId) === String(alunoId));
  if (!alunoNaTurma) throw Object.assign(new Error("Aluno não pertence a esta turma/professor."), { status: 403 });
  const resultado = await registrarFrequencia({ alunoId, turmaId, data: dados.data || hojeISO(), status: dados.status || "Presente", observacao: dados.observacao || "", usuario: dados.usuario || professorChave || "Professor", origem: "painel_professor" });
  return { ok: true, frequencia: resultado.dados, atualizado: resultado.atualizado };
}

export async function chamadaProfessorTurma(professorChave, turmaId, dados = {}) {
  const turma = await obterTurmaProfessor(professorChave, turmaId, { data: dados.data || hojeISO() });
  const alunosPermitidos = new Set((turma.turma.alunos || []).map((a) => String(a.alunoId)));
  const registros = (Array.isArray(dados.registros) ? dados.registros : []).filter((r) => alunosPermitidos.has(String(r.alunoId || r.aluno_id)));
  const resultado = await chamadaTurma(turmaId, { data: dados.data || hojeISO(), usuario: dados.usuario || professorChave || "Professor", registros });
  return { ok: true, professor: turma.professor, turma: turma.turma, chamada: resultado };
}
