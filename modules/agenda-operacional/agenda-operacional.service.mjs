import { carregarBaseAgendaOperacional, salvarAgendaOperacional } from "./agenda-operacional.repository.mjs";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function gerarId(prefixo = "agop") {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function texto(v) {
  return String(v ?? "").trim();
}

function normalizar(v) {
  return texto(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function ativo(item) {
  return ![
    "cancelado", "cancelada",
    "encerrado", "encerrada",
    "inativo", "inativa",
    "bloqueado", "bloqueada",
    "removido", "removida"
  ].includes(normalizar(item?.status || "Ativo"));
}

function alunoNome(aluno = {}) {
  return texto(aluno.nome || aluno.aluno || aluno.name || aluno.nomeCompleto || "Aluno");
}

function dataDiaSemana(dataISO = hojeISO()) {
  const data = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);
  const nomes = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  return nomes[data.getDay()];
}

function ocorreNoDia(diasSemana = "", dataISO = hojeISO()) {
  const dias = normalizar(diasSemana);
  if (!dias) return true;
  if (dias.includes("livre") || dias.includes("segunda a sabado") || dias.includes("segunda a sexta")) {
    const dia = dataDiaSemana(dataISO);
    if (dias.includes("segunda a sexta")) return !["sabado", "domingo"].includes(dia);
    if (dias.includes("segunda a sabado")) return dia !== "domingo";
    return true;
  }
  const dia = dataDiaSemana(dataISO);
  return dias.includes(dia);
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function localizarProfessor(professores, nomeOuId = "") {
  const alvo = normalizar(nomeOuId);
  if (!alvo) return null;
  return professores.find((p) => String(p.id) === String(nomeOuId) || normalizar(p.nome).includes(alvo) || alvo.includes(normalizar(p.nome))) || null;
}

function servicosAtivos(servicos = []) {
  return servicos.filter(ativo);
}

function frequenciaDoAluno(frequencias, alunoId, turmaId, data) {
  return frequencias.find((f) =>
    String(f.alunoId) === String(alunoId) &&
    String(f.turmaId) === String(turmaId) &&
    String(f.data || "").slice(0, 10) === String(data).slice(0, 10) &&
    normalizar(f.status) !== "cancelado"
  ) || null;
}

function montarAulaDeServico(servico, base, data) {
  const aluno = localizarAluno(base.alunos, servico.alunoId);
  const professor = localizarProfessor(base.professores, servico.professor || servico.professorId);
  const freq = frequenciaDoAluno(base.frequencia, servico.alunoId, servico.turmaId, data);

  return {
    id: `agenda_${data}_${servico.turmaId}_${servico.id || servico.servicoContratadoId}`,
    data,
    alunoId: servico.alunoId,
    aluno: alunoNome(aluno || { nome: servico.aluno }),
    contratoId: servico.contratoId,
    matriculaId: servico.matriculaId || "",
    servicoContratadoId: servico.id || servico.servicoContratadoId || "",
    servico: servico.servico || servico.nome || servico.modalidade || "",
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
    valor: Number(servico.valor || 0),
    tipoCobranca: servico.tipoCobranca || "Mensal"
  };
}

function agruparPorTurma(aulas = []) {
  const mapa = new Map();
  for (const aula of aulas) {
    const key = String(aula.turmaId || aula.turma || "sem_turma");
    if (!mapa.has(key)) {
      mapa.set(key, {
        turmaId: aula.turmaId,
        turma: aula.turma,
        modalidade: aula.modalidade,
        professorId: aula.professorId,
        professor: aula.professor,
        horario: aula.horario,
        sala: aula.sala,
        alunos: [],
        totalAlunos: 0,
        presentes: 0,
        pendentes: 0,
        faltas: 0
      });
    }
    const item = mapa.get(key);
    item.alunos.push({
      alunoId: aula.alunoId,
      aluno: aula.aluno,
      contratoId: aula.contratoId,
      servicoContratadoId: aula.servicoContratadoId,
      statusFrequencia: aula.statusFrequencia,
      frequenciaId: aula.frequenciaId
    });
    item.totalAlunos += 1;
    if (normalizar(aula.statusFrequencia) === "presente") item.presentes += 1;
    else if (normalizar(aula.statusFrequencia) === "falta") item.faltas += 1;
    else item.pendentes += 1;
  }
  return [...mapa.values()].sort((a, b) => texto(a.horario).localeCompare(texto(b.horario)) || texto(a.turma).localeCompare(texto(b.turma)));
}

function agruparPorProfessor(aulas = []) {
  const mapa = new Map();
  for (const aula of aulas) {
    const key = aula.professorId || aula.professor || "sem_professor";
    if (!mapa.has(key)) {
      mapa.set(key, {
        professorId: aula.professorId,
        professor: aula.professor || "Sem professor",
        turmas: new Map(),
        totalAlunos: 0
      });
    }
    const prof = mapa.get(key);
    prof.totalAlunos += 1;
    const turmaKey = aula.turmaId || aula.turma || "sem_turma";
    if (!prof.turmas.has(turmaKey)) {
      prof.turmas.set(turmaKey, {
        turmaId: aula.turmaId,
        turma: aula.turma,
        modalidade: aula.modalidade,
        horario: aula.horario,
        sala: aula.sala,
        alunos: []
      });
    }
    prof.turmas.get(turmaKey).alunos.push({
      alunoId: aula.alunoId,
      aluno: aula.aluno,
      statusFrequencia: aula.statusFrequencia,
      frequenciaId: aula.frequenciaId
    });
  }
  return [...mapa.values()].map((p) => ({
    ...p,
    turmas: [...p.turmas.values()]
  }));
}

async function aulasOperacionais(data = hojeISO(), filtros = {}) {
  const base = await carregarBaseAgendaOperacional();
  let aulas = servicosAtivos(base.servicosContratados).map((s) => montarAulaDeServico(s, base, data));

  if (filtros.apenasHoje === true || filtros.apenasHoje === "true") {
    aulas = aulas.filter((a) => a.ocorreHoje);
  }
  if (filtros.turmaId) {
    aulas = aulas.filter((a) => String(a.turmaId) === String(filtros.turmaId));
  }
  if (filtros.alunoId) {
    aulas = aulas.filter((a) => String(a.alunoId) === String(filtros.alunoId));
  }
  if (filtros.professor) {
    const alvo = normalizar(filtros.professor);
    aulas = aulas.filter((a) => normalizar(a.professor).includes(alvo) || String(a.professorId) === String(filtros.professor));
  }
  if (filtros.modalidade) {
    const alvo = normalizar(filtros.modalidade);
    aulas = aulas.filter((a) => normalizar(a.modalidade).includes(alvo));
  }

  return aulas;
}

export async function statusAgendaOperacional() {
  return {
    ok: true,
    modulo: "agenda-operacional",
    versao: "Fusion ERP 2.2-D",
    status: "Online",
    conceito: "Agenda gerada por serviços contratados, turma e professor"
  };
}

export async function listarAgendaOperacional(filtros = {}) {
  const data = filtros.data || hojeISO();
  const aulas = await aulasOperacionais(data, filtros);
  return {
    ok: true,
    data,
    total: aulas.length,
    aulas: aulas.sort((a, b) => texto(a.horario).localeCompare(texto(b.horario)) || texto(a.aluno).localeCompare(texto(b.aluno)))
  };
}

export async function listarAgendaPorTurmas(filtros = {}) {
  const data = filtros.data || hojeISO();
  const aulas = await aulasOperacionais(data, filtros);
  return {
    ok: true,
    data,
    totalTurmas: new Set(aulas.map((a) => a.turmaId)).size,
    totalAlunos: aulas.length,
    turmas: agruparPorTurma(aulas)
  };
}

export async function listarAgendaPorProfessores(filtros = {}) {
  const data = filtros.data || hojeISO();
  const aulas = await aulasOperacionais(data, filtros);
  const professores = agruparPorProfessor(aulas);
  return {
    ok: true,
    data,
    totalProfessores: professores.length,
    totalAlunos: aulas.length,
    professores
  };
}

export async function obterAgendaAluno(alunoId, filtros = {}) {
  const data = filtros.data || hojeISO();
  const aulas = await aulasOperacionais(data, { ...filtros, alunoId });
  return {
    ok: true,
    data,
    alunoId,
    total: aulas.length,
    hoje: aulas.filter((a) => a.ocorreHoje),
    todosServicos: aulas
  };
}

export async function obterAgendaProfessor(professor, filtros = {}) {
  const data = filtros.data || hojeISO();
  const aulas = await aulasOperacionais(data, { ...filtros, professor });
  return {
    ok: true,
    data,
    professor,
    total: aulas.length,
    turmas: agruparPorTurma(aulas)
  };
}

export async function materializarAgendaDia(dados = {}) {
  const data = dados.data || hojeISO();
  const apenasHoje = dados.apenasHoje ?? true;
  const base = await carregarBaseAgendaOperacional();
  const aulas = await aulasOperacionais(data, { apenasHoje });
  const existentes = Array.isArray(base.agendaOperacional) ? base.agendaOperacional : [];
  const semDia = existentes.filter((a) => String(a.data || "").slice(0, 10) !== data);

  const agendaDia = agruparPorTurma(aulas).map((turma) => ({
    id: gerarId("agd"),
    data,
    turmaId: turma.turmaId,
    turma: turma.turma,
    modalidade: turma.modalidade,
    professorId: turma.professorId,
    professor: turma.professor,
    horario: turma.horario,
    sala: turma.sala,
    totalAlunos: turma.totalAlunos,
    presentes: turma.presentes,
    pendentes: turma.pendentes,
    faltas: turma.faltas,
    alunos: turma.alunos,
    origem: "agenda_operacional",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  }));

  await salvarAgendaOperacional([...semDia, ...agendaDia]);
  return {
    ok: true,
    data,
    total: agendaDia.length,
    agenda: agendaDia
  };
}

export async function resumoAgendaOperacional(filtros = {}) {
  const data = filtros.data || hojeISO();
  const aulas = await aulasOperacionais(data, filtros);
  const hoje = aulas.filter((a) => a.ocorreHoje);
  return {
    ok: true,
    data,
    totalVinculos: aulas.length,
    aulasHoje: hoje.length,
    turmasHoje: new Set(hoje.map((a) => a.turmaId)).size,
    professoresHoje: new Set(hoje.map((a) => a.professor || a.professorId).filter(Boolean)).size,
    pendentes: hoje.filter((a) => normalizar(a.statusFrequencia) === "pendente").length,
    presentes: hoje.filter((a) => normalizar(a.statusFrequencia) === "presente").length,
    faltas: hoje.filter((a) => normalizar(a.statusFrequencia) === "falta").length
  };
}
