const TIMEZONE_SISTEMA = process.env.FUSION_TIMEZONE || "America/Fortaleza";

function texto(valor = "") {
  return String(valor ?? "").trim();
}

function normalizar(valor = "") {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dataHoraLocal(valor) {
  const data = valor ? new Date(valor) : new Date();
  const segura = Number.isNaN(data.getTime()) ? new Date() : data;
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_SISTEMA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(segura);
    const mapa = Object.fromEntries(partes.map(p => [p.type, p.value]));
    return {
      data: `${mapa.year}-${mapa.month}-${mapa.day}`,
      hora: `${mapa.hour}:${mapa.minute}`
    };
  } catch {
    return {
      data: segura.toISOString().slice(0, 10),
      hora: segura.toISOString().slice(11, 16)
    };
  }
}

function acessoReal(log = {}) {
  const origem = normalizar(log.origem);
  const diagnostico = ["teste", "diagnostico", "simulador"].some(v => origem.includes(v));
  const real = Boolean(
    log.catraca ||
    origem.includes("portal-aluno") ||
    origem.includes("henry") ||
    origem.includes("biometr") ||
    origem.includes("catraca") ||
    origem.includes("checkin")
  );
  return log.autorizado === true && texto(log.alunoId || log.aluno_id) && real && !diagnostico;
}

function idAluno(item = {}) {
  return texto(item.id || item._id || item.alunoId || item.aluno_id);
}

function localizarAluno(alunos = [], alunoId = "") {
  const alvo = texto(alunoId);
  return alunos.find(a => idAluno(a) === alvo) || {};
}

function localizarMatricula(matriculas = [], log = {}, aluno = {}) {
  const matriculaId = texto(log.matriculaId || log.matricula_id || aluno.matriculaId);
  const alunoId = texto(log.alunoId || log.aluno_id || idAluno(aluno));

  const candidatas = matriculas
    .filter(m => {
      if (matriculaId && texto(m.id) === matriculaId) return true;
      return alunoId && texto(m.alunoId || m.aluno_id) === alunoId;
    })
    .sort((a, b) => texto(b.atualizadoEm || b.criadoEm || b.dataMatricula)
      .localeCompare(texto(a.atualizadoEm || a.criadoEm || a.dataMatricula)));

  return candidatas[0] || {};
}

function checkinPorAccessLog(checkin = [], accessLogId = "") {
  return checkin.find(item => texto(item.accessLogId) === texto(accessLogId)) || null;
}

function vinculoCheckins(checkins = [], alunoId = "", matriculaId = "") {
  const candidatos = checkins
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => normalizar(item.tipo) === "vinculo_matricula")
    .filter(({ item }) => {
      if (matriculaId && texto(item.matriculaId) === matriculaId) return true;
      return alunoId && texto(item.alunoId) === alunoId;
    })
    .sort((a, b) => texto(b.item.atualizadoEm || b.item.criadoEm)
      .localeCompare(texto(a.item.atualizadoEm || a.item.criadoEm)));

  return candidatos[0] || null;
}

function comandoId(log = {}) {
  return texto(
    log.catraca?.commandId ||
    log.catraca?.command?.id ||
    log.comandoCatracaId
  );
}

function montarCheckinEntrada({ log, aluno, matricula, momento }) {
  const horario = dataHoraLocal(momento);
  const origem = texto(log.origem || "catraca");
  const peloPortal = normalizar(origem).includes("portal-aluno");
  const accessLogId = texto(log.id);
  const modalidade = texto(
    matricula.modalidade ||
    matricula.nomeModalidade ||
    aluno.modalidade ||
    matricula.plano ||
    aluno.plano ||
    ""
  );

  return {
    id: `chk_access_${accessLogId}`,
    alunoId: texto(log.alunoId || log.aluno_id),
    aluno: texto(log.alunoNome || aluno.nome || matricula.aluno),
    matricula: texto(log.numeroMatricula || matricula.numero || matricula.numeroMatricula || aluno.numeroMatricula),
    matriculaId: texto(log.matriculaId || matricula.id || aluno.matriculaId),
    plano: texto(matricula.plano || matricula.nomePlano || aluno.plano),
    planoId: texto(matricula.planoId || aluno.planoId),
    modalidade,
    turma: texto(matricula.turma || matricula.turmaNome || aluno.turma),
    professor: texto(aluno.professorNome || aluno.professor_responsavel || matricula.professor),
    data: horario.data,
    horaEntrada: horario.hora,
    horaSaida: "",
    tipo: peloPortal ? "Catraca pelo App de Treino" : "Catraca",
    status: "Liberado",
    observacoes: `Entrada sincronizada automaticamente do controle de acesso (${origem}).`,
    origem,
    accessLogId,
    comandoCatracaId: comandoId(log),
    criadoEm: momento,
    sincronizadoEm: new Date().toISOString()
  };
}

function atualizarVinculo(vinculo, { log, checkinId = "", momento, movimento }) {
  if (!vinculo) return false;
  const horario = dataHoraLocal(momento);
  const item = vinculo.item;
  item.ultimoAcessoEm = momento;
  item.ultimoAccessLogId = texto(log.id);
  item.ultimoAcessoStatus = "Liberado";
  item.ultimoAcessoOrigem = texto(log.origem || "catraca");
  item.ultimoAcessoMovimento = movimento;
  item.ultimoCheckinId = checkinId || texto(item.ultimoCheckinId);
  if (movimento === "saida") {
    item.ultimaSaidaData = horario.data;
    item.ultimaSaidaHora = horario.hora;
  } else {
    item.ultimaEntradaData = horario.data;
    item.ultimaEntradaHora = horario.hora;
  }
  item.atualizadoEm = new Date().toISOString();
  return true;
}

export function aplicarAccessLogNaFrequencia({
  log = {},
  alunos = [],
  matriculas = [],
  checkin = [],
  checkins = []
} = {}) {
  if (!acessoReal(log)) {
    return { alterado: false, motivo: "acesso_nao_elegivel", checkin, checkins };
  }

  const accessLogId = texto(log.id);
  if (!accessLogId) {
    return { alterado: false, motivo: "access_log_sem_id", checkin, checkins };
  }

  const alunoId = texto(log.alunoId || log.aluno_id);
  const aluno = localizarAluno(alunos, alunoId);
  const matricula = localizarMatricula(matriculas, log, aluno);
  const matriculaId = texto(log.matriculaId || matricula.id || aluno.matriculaId);
  const movimento = normalizar(log.movimento || log.direcao || "entrada") === "saida" ? "saida" : "entrada";
  const momento = texto(log.criadoEm || log.at || log.timestamp) || new Date().toISOString();

  let alteradoCheckin = false;
  let checkinId = "";
  const existente = checkinPorAccessLog(checkin, accessLogId);

  if (movimento === "entrada") {
    if (existente) {
      checkinId = texto(existente.id);
    } else {
      const registro = montarCheckinEntrada({ log, aluno, matricula, momento });
      checkin.push(registro);
      checkinId = registro.id;
      alteradoCheckin = true;
    }
  } else {
    const jaUsadoComoSaida = checkin.find(item => texto(item.accessExitLogId) === accessLogId);
    if (jaUsadoComoSaida) {
      checkinId = texto(jaUsadoComoSaida.id);
    } else {
      const aberto = [...checkin]
        .reverse()
        .find(item =>
          texto(item.alunoId) === alunoId &&
          !texto(item.horaSaida) &&
          normalizar(item.status) === "liberado"
        );
      if (aberto) {
        const horario = dataHoraLocal(momento);
        aberto.horaSaida = horario.hora;
        aberto.accessExitLogId = accessLogId;
        aberto.atualizadoEm = new Date().toISOString();
        checkinId = texto(aberto.id);
        alteradoCheckin = true;
      }
    }
  }

  const vinculo = vinculoCheckins(checkins, alunoId, matriculaId);
  const alteradoVinculo = atualizarVinculo(vinculo, {
    log,
    checkinId,
    momento,
    movimento
  });

  return {
    alterado: alteradoCheckin || alteradoVinculo,
    alteradoCheckin,
    alteradoVinculo,
    accessLogId,
    checkinId,
    movimento,
    checkin,
    checkins
  };
}
