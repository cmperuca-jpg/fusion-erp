import {
  carregarBaseOperacao,
  salvarPresencas,
  salvarCheckins
} from "./operacao.repository.mjs";

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaAtual() {
  return new Date().toTimeString().slice(0, 5);
}

function agoraISO() {
  return new Date().toISOString();
}

function gerarId(prefixo = "op") {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function statusAtivo(status) {
  const s = normalizar(status || "Ativo");
  return ![
    "cancelado",
    "cancelada",
    "encerrado",
    "encerrada",
    "inativo",
    "inativa",
    "bloqueado",
    "bloqueada",
    "removido",
    "removida"
  ].includes(s);
}

function nomeAluno(aluno = {}) {
  return texto(aluno.nome || aluno.aluno || aluno.nomeCompleto || aluno.name || "");
}

function idAluno(aluno = {}) {
  return texto(aluno.id || aluno._id || aluno.alunoId || aluno.aluno_id || "");
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => idAluno(a) === String(alunoId)) || null;
}

function localizarTurma(turmas, turmaId) {
  return turmas.find((t) => String(t.id) === String(turmaId)) || null;
}

function localizarContratoAtivo(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find((c) => statusAtivo(c.status)) || null;
}

function servicosAtivosDoContrato(servicosContratados, contratoId) {
  return servicosContratados.filter((s) =>
    String(s.contratoId) === String(contratoId) && statusAtivo(s.status)
  );
}

function servicoPertenceTurma(servico = {}, turmaId = "") {
  if (!turmaId) return true;
  return String(servico.turmaId || servico.turma_id || "") === String(turmaId);
}

function indiceDiaSemana(dataISO) {
  const data = dataISO ? new Date(`${dataISO}T12:00:00`) : new Date();
  return data.getDay(); // 0 domingo, 1 segunda...
}

const DIAS = [
  ["domingo", "dom"],
  ["segunda", "seg"],
  ["terca", "ter", "terça"],
  ["quarta", "qua"],
  ["quinta", "qui"],
  ["sexta", "sex"],
  ["sabado", "sab", "sábado"]
];

function diasTextoParaIndices(textoDias = "") {
  const textoNormal = normalizar(textoDias);
  if (!textoNormal) return [];
  if (textoNormal.includes("livre") || textoNormal.includes("todos os dias")) return [0, 1, 2, 3, 4, 5, 6];

  if (textoNormal.includes("segunda a sabado") || textoNormal.includes("segunda a sábado")) {
    return [1, 2, 3, 4, 5, 6];
  }
  if (textoNormal.includes("segunda a sexta")) {
    return [1, 2, 3, 4, 5];
  }

  const encontrados = [];
  DIAS.forEach((nomes, idx) => {
    if (nomes.some((nome) => textoNormal.includes(normalizar(nome)))) encontrados.push(idx);
  });
  return [...new Set(encontrados)];
}

function servicoOcorreNaData(servico = {}, dataISO = hojeISO()) {
  const dias = diasTextoParaIndices(servico.diasSemana || servico.dias_semana || "");
  if (!dias.length) return true;
  return dias.includes(indiceDiaSemana(dataISO));
}

function professorChave(valor) {
  return normalizar(valor || "");
}

function professorMatch(servico = {}, professor = {}) {
  const alvo = professorChave(professor.id || professor.nome || professor.professor || "");
  if (!alvo) return false;
  return [
    servico.professorId,
    servico.professor_id,
    servico.professor,
    servico.professorNome
  ].some((v) => professorChave(v) === alvo || professorChave(v).includes(alvo) || alvo.includes(professorChave(v)));
}

function montarResumoServico(servico = {}, turma = null, dataISO = hojeISO()) {
  return {
    id: servico.id,
    contratoId: servico.contratoId || "",
    servicoContratadoId: servico.id || "",
    servicoId: servico.servicoId || "",
    alunoId: servico.alunoId || "",
    matriculaId: servico.matriculaId || "",
    turmaId: servico.turmaId || turma?.id || "",
    turma: servico.turma || servico.nome || turma?.nome || "",
    nome: servico.nome || servico.servico || turma?.nome || "",
    modalidade: servico.modalidade || turma?.modalidade || "",
    professorId: servico.professorId || servico.professor_id || "",
    professor: servico.professor || turma?.professor || "",
    diasSemana: servico.diasSemana || turma?.diasSemana || "",
    horario: servico.horario || turma?.horario || "",
    sala: servico.sala || turma?.sala || "",
    valor: Number(servico.valor || 0),
    tipoCobranca: servico.tipoCobranca || "Mensal",
    status: servico.status || "Ativo",
    ocorreHoje: servicoOcorreNaData(servico, dataISO)
  };
}

export async function statusOperacao() {
  return {
    ok: true,
    modulo: "operacao",
    versao: "Fusion ERP 2.2-B",
    status: "Online",
    conceito: "Motor operacional baseado em contrato comercial e serviços contratados"
  };
}

export async function obterOperacaoAluno(alunoId, opcoes = {}) {
  const data = opcoes.data || hojeISO();
  const turmaId = opcoes.turmaId || opcoes.turma_id || "";
  const base = await carregarBaseOperacao();

  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = localizarContratoAtivo(base.contratos, alunoId);
  const servicosContrato = contrato
    ? servicosAtivosDoContrato(base.servicosContratados, contrato.id)
    : [];

  const servicosAtivos = servicosContrato.map((servico) => {
    const turma = localizarTurma(base.turmas, servico.turmaId || servico.turma_id || "");
    return montarResumoServico(servico, turma, data);
  });

  const servicosHoje = servicosAtivos.filter((servico) => servico.ocorreHoje);
  const servicoSelecionado = turmaId
    ? servicosAtivos.find((servico) => servicoPertenceTurma(servico, turmaId))
    : null;

  const turmasHoje = servicosHoje.map((s) => ({
    turmaId: s.turmaId,
    turma: s.turma,
    modalidade: s.modalidade,
    professor: s.professor,
    horario: s.horario,
    sala: s.sala
  }));

  const professoresHoje = [...new Set(servicosHoje.map((s) => s.professor).filter(Boolean))];

  const autorizado = Boolean(contrato && (!turmaId || servicoSelecionado));
  const motivo = !contrato
    ? "Aluno sem contrato comercial ativo."
    : turmaId && !servicoSelecionado
      ? "Aluno não possui serviço contratado para esta turma."
      : "Aluno autorizado pelo motor operacional.";

  return {
    ok: true,
    autorizado,
    status: autorizado ? "Liberado" : "Bloqueado",
    motivo,
    data,
    aluno: aluno ? {
      id: idAluno(aluno),
      nome: nomeAluno(aluno),
      cpf: aluno.cpf || "",
      status: aluno.status || ""
    } : { id: alunoId, nome: "" },
    contrato,
    servicoSelecionado,
    servicosAtivos,
    servicosHoje,
    turmasHoje,
    professoresHoje,
    podeEntrar: autorizado,
    podeTreinar: autorizado,
    podeAvaliar: Boolean(contrato),
    totais: {
      servicosAtivos: servicosAtivos.length,
      servicosHoje: servicosHoje.length,
      turmasHoje: turmasHoje.length
    }
  };
}

export async function listarTurmasDoAluno(alunoId, opcoes = {}) {
  const operacao = await obterOperacaoAluno(alunoId, opcoes);
  return {
    ok: true,
    aluno: operacao.aluno,
    contrato: operacao.contrato,
    data: operacao.data,
    turmas: opcoes.hoje === false ? operacao.servicosAtivos : operacao.servicosHoje
  };
}

export async function listarAlunosDaTurma(turmaId, opcoes = {}) {
  const data = opcoes.data || hojeISO();
  const base = await carregarBaseOperacao();
  const contratosAtivos = base.contratos.filter((c) => statusAtivo(c.status));
  const servicos = base.servicosContratados.filter((s) =>
    servicoPertenceTurma(s, turmaId) && statusAtivo(s.status)
  );

  const alunos = servicos.map((servico) => {
    const contrato = contratosAtivos.find((c) => String(c.id) === String(servico.contratoId));
    if (!contrato) return null;
    const aluno = localizarAluno(base.alunos, contrato.alunoId);
    const turma = localizarTurma(base.turmas, turmaId);
    return {
      alunoId: contrato.alunoId,
      aluno: aluno ? nomeAluno(aluno) : contrato.aluno,
      contratoId: contrato.id,
      servicoContratadoId: servico.id,
      turmaId,
      turma: servico.turma || servico.nome || turma?.nome || "",
      modalidade: servico.modalidade || turma?.modalidade || "",
      professor: servico.professor || turma?.professor || "",
      horario: servico.horario || turma?.horario || "",
      ocorreHoje: servicoOcorreNaData(servico, data)
    };
  }).filter(Boolean);

  return {
    ok: true,
    data,
    turmaId,
    total: alunos.length,
    alunos
  };
}

export async function listarTurmasDoProfessor(professorRef, opcoes = {}) {
  const data = opcoes.data || hojeISO();
  const base = await carregarBaseOperacao();

  const professor = base.professores.find((p) =>
    String(p.id) === String(professorRef) ||
    normalizar(p.nome) === normalizar(professorRef) ||
    normalizar(p.email) === normalizar(professorRef)
  ) || { id: professorRef, nome: professorRef };

  const servicos = base.servicosContratados
    .filter((s) => statusAtivo(s.status) && professorMatch(s, professor))
    .map((s) => montarResumoServico(s, localizarTurma(base.turmas, s.turmaId), data));

  const agrupado = new Map();
  for (const servico of servicos) {
    const chave = String(servico.turmaId || servico.turma || servico.modalidade || "sem_turma");
    const atual = agrupado.get(chave) || {
      turmaId: servico.turmaId,
      turma: servico.turma,
      modalidade: servico.modalidade,
      professor: servico.professor,
      horario: servico.horario,
      sala: servico.sala,
      alunos: []
    };
    atual.alunos.push({
      alunoId: servico.alunoId,
      contratoId: servico.contratoId,
      servicoContratadoId: servico.id,
      ocorreHoje: servico.ocorreHoje
    });
    agrupado.set(chave, atual);
  }

  return {
    ok: true,
    data,
    professor,
    totalTurmas: agrupado.size,
    turmas: [...agrupado.values()]
  };
}

export async function registrarPresencaOperacional(dados = {}) {
  const alunoId = dados.alunoId || dados.aluno_id;
  const turmaId = dados.turmaId || dados.turma_id;
  const data = dados.data || hojeISO();
  const horaEntrada = dados.horaEntrada || dados.hora || horaAtual();

  if (!alunoId) {
    const erro = new Error("Informe alunoId.");
    erro.status = 400;
    throw erro;
  }
  if (!turmaId) {
    const erro = new Error("Informe turmaId.");
    erro.status = 400;
    throw erro;
  }

  const base = await carregarBaseOperacao();
  const operacao = await obterOperacaoAluno(alunoId, { turmaId, data });

  if (!operacao.autorizado) {
    return {
      ok: false,
      autorizado: false,
      status: "Bloqueado",
      motivo: operacao.motivo,
      operacao
    };
  }

  const existente = base.presencas.find((p) =>
    String(p.alunoId || p.aluno_id) === String(alunoId) &&
    String(p.turmaId || p.turma_id) === String(turmaId) &&
    String(p.data || "").slice(0, 10) === data &&
    !["Cancelada", "Cancelado", "Excluida", "Excluída"].includes(String(p.status || ""))
  );

  if (existente) {
    return {
      ok: true,
      duplicada: true,
      presenca: existente,
      operacao,
      mensagem: "Presença já registrada para este aluno, turma e data."
    };
  }

  const servico = operacao.servicoSelecionado;
  const presenca = {
    id: gerarId("pre_op"),
    alunoId,
    aluno_id: alunoId,
    aluno: operacao.aluno?.nome || "",
    contratoId: operacao.contrato?.id || "",
    matriculaId: operacao.contrato?.matriculaId || "",
    servicoContratadoId: servico?.id || servico?.servicoContratadoId || "",
    turmaId,
    turma_id: turmaId,
    turma: servico?.turma || "",
    modalidade: servico?.modalidade || "",
    professor: servico?.professor || "",
    sala: servico?.sala || "",
    horario: servico?.horario || "",
    data,
    horaEntrada,
    horaSaida: dados.horaSaida || "",
    status: dados.status || "Presente",
    origem: "operacao_comercial",
    observacoes: dados.observacoes || dados.observacao || "",
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  base.presencas.push(presenca);
  await salvarPresencas(base.presencas);

  const checkin = {
    id: gerarId("chk_op"),
    alunoId,
    aluno: operacao.aluno?.nome || "",
    contratoId: operacao.contrato?.id || "",
    servicoContratadoId: presenca.servicoContratadoId,
    turmaId,
    turma: presenca.turma,
    modalidade: presenca.modalidade,
    professor: presenca.professor,
    data,
    horaEntrada,
    horaSaida: "",
    tipo: "Operacional",
    status: "Liberado",
    observacoes: "Gerado pelo Motor de Operação.",
    presencaId: presenca.id,
    criadoEm: agoraISO()
  };

  base.checkins.push(checkin);
  await salvarCheckins(base.checkins);

  return {
    ok: true,
    autorizado: true,
    status: "Liberado",
    presenca,
    checkin,
    operacao,
    mensagem: "Presença operacional registrada e check-in liberado."
  };
}
