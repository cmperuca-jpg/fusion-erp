import { carregarBaseBI } from "./bi.repository.mjs";

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  const bruto = String(valor).replace("R$", "").replace(/\s/g, "").trim();
  const temVirgula = bruto.includes(",");
  const limpo = temVirgula ? bruto.replace(/\./g, "").replace(",", ".") : bruto.replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function dataISO(valor) {
  return texto(valor).slice(0, 10);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dentroPeriodo(data, inicio, fim) {
  const d = dataISO(data);
  if (!d) return false;
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

function ativo(item = {}) {
  if (item.ativo === true || item.ativa === true || item.matriculaAtiva === true) return true;
  const st = normalizar(item.status ?? item.situacao ?? item.statusMatricula ?? item.matriculaStatus);
  return ["ativo", "ativa", "regular", "aprovado", "aprovada", "liberado", "liberada", "presente", "aberto", "aberta"].includes(st);
}

function chaveAluno(item = {}) {
  return normalizar(item.id ?? item.alunoId ?? item.aluno_id ?? item.cpf ?? item.email ?? item.nome);
}

function matriculasAtivasUnicas(matriculas = []) {
  const mapa = new Map();
  for (const matricula of matriculas.filter(ativo)) {
    const chave = texto(matricula.id) || `${chaveAluno(matricula)}|${texto(matricula.planoId ?? matricula.plano)}|${dataMatricula(matricula)}`;
    if (chave) mapa.set(chave, matricula);
  }
  return [...mapa.values()];
}

function alunosAtivosUnicos(alunos = [], matriculas = []) {
  const idsMatriculados = new Set(matriculasAtivasUnicas(matriculas).map(chaveAluno).filter(Boolean));
  const mapa = new Map();
  for (const aluno of alunos) {
    const chave = chaveAluno(aluno);
    if (chave && (ativo(aluno) || idsMatriculados.has(chave))) mapa.set(chave, aluno);
  }
  return [...mapa.values()];
}

function inativo(item = {}) {
  const st = normalizar(item.status ?? item.situacao);
  return ["inativo", "inativa", "bloqueado", "bloqueada"].includes(st);
}

function statusEh(item = {}, valores = []) {
  const st = normalizar(item.status ?? item.situacao);
  return valores.map(normalizar).includes(st);
}

function cancelado(item = {}) {
  return statusEh(item, ["cancelado", "cancelada", "estornado", "estornada"]);
}

function pago(item = {}) {
  return statusEh(item, ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"]);
}

function nomePessoa(item = {}, prefixo = "") {
  return texto(item[`${prefixo}Nome`] ?? item[`${prefixo}_nome`] ?? item[prefixo] ?? item.nome ?? item.aluno ?? item.pessoa ?? item.alunoFornecedor);
}

function alunoId(item = {}) {
  return texto(item.alunoId ?? item.aluno_id ?? item.idAluno ?? item.matriculaAlunoId);
}

function professorId(item = {}) {
  return texto(item.professorId ?? item.professor_id ?? item.idProfessor);
}

function professorNomeItem(item = {}) {
  return texto(item.professorNome ?? item.professor_nome ?? item.professor ?? item.nomeProfessor);
}

function turmaId(item = {}) {
  return texto(item.turmaId ?? item.turma_id ?? item.idTurma);
}

function turmaNomeItem(item = {}) {
  return texto(item.turmaNome ?? item.turma_nome ?? item.turma ?? item.nomeTurma);
}

function dataCadastroAluno(item = {}) {
  return dataISO(item.criadoEm ?? item.criado_em ?? item.dataCadastro ?? item.data_cadastro ?? item.data_matricula ?? item.dataMatricula);
}

function dataMatricula(item = {}) {
  return dataISO(item.dataMatricula ?? item.data_matricula ?? item.dataInicio ?? item.data_inicio ?? item.criadoEm ?? item.criado_em);
}

function dataPresenca(item = {}) {
  return dataISO(item.data ?? item.dataEntrada ?? item.data_entrada ?? item.criadoEm ?? item.criado_em);
}

function horaInicio(item = {}) {
  return texto(item.horaInicio ?? item.hora_inicio ?? item.horaEntrada ?? item.hora_entrada ?? item.hora);
}

function horaFim(item = {}) {
  return texto(item.horaFim ?? item.hora_fim ?? item.horaSaida ?? item.hora_saida);
}

function mesChave(data) {
  const d = dataISO(data);
  return d && d.length >= 7 ? d.slice(0, 7) : "Sem data";
}

function agruparPorMes(lista, campoData, campoValor = null) {
  const mapa = new Map();
  for (const item of lista) {
    const data = typeof campoData === "function" ? campoData(item) : item[campoData];
    const chave = mesChave(data);
    const valor = campoValor ? numero(typeof campoValor === "function" ? campoValor(item) : item[campoValor]) : 1;
    mapa.set(chave, Number(((mapa.get(chave) || 0) + valor).toFixed(2)));
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, valor]) => ({ mes, valor }));
}

function contarPorCampo(lista, campo, fallback = "Sem informação") {
  const mapa = new Map();
  for (const item of lista) {
    const valor = typeof campo === "function" ? campo(item) : item[campo];
    const chave = texto(valor) || fallback;
    mapa.set(chave, (mapa.get(chave) || 0) + 1);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome, valor]) => ({ nome, valor }));
}

function encontrarPorId(lista, id) {
  const alvo = texto(id);
  if (!alvo) return null;
  return lista.find(item => texto(item.id) === alvo) || null;
}

function encontrarProfessor(professores, item = {}) {
  const porId = encontrarPorId(professores, professorId(item));
  if (porId) return porId;
  const nome = normalizar(professorNomeItem(item));
  if (!nome) return null;
  return professores.find(p => normalizar(p.nome) === nome) || null;
}

function nomeProfessor(professores, itemOuId) {
  if (typeof itemOuId === "string" || typeof itemOuId === "number") {
    return encontrarPorId(professores, itemOuId)?.nome || texto(itemOuId) || "-";
  }
  const prof = encontrarProfessor(professores, itemOuId);
  return prof?.nome || professorNomeItem(itemOuId) || "-";
}

function nomeAluno(alunos, itemOuId) {
  if (typeof itemOuId === "string" || typeof itemOuId === "number") {
    return encontrarPorId(alunos, itemOuId)?.nome || texto(itemOuId) || "-";
  }
  const porId = encontrarPorId(alunos, alunoId(itemOuId));
  return porId?.nome || nomePessoa(itemOuId, "aluno") || "-";
}

function nomeTurma(turmas, itemOuId) {
  if (typeof itemOuId === "string" || typeof itemOuId === "number") {
    return encontrarPorId(turmas, itemOuId)?.nome || texto(itemOuId) || "-";
  }
  const porId = encontrarPorId(turmas, turmaId(itemOuId));
  return porId?.nome || turmaNomeItem(itemOuId) || "-";
}

function presencaReal(item = {}) {
  // checkins.json também guarda vínculos de matrícula. Esses vínculos não são presença real.
  if (normalizar(item.tipo) === "vinculo_matricula") return false;
  return Boolean(dataPresenca(item));
}

function valorFinanceiro(item = {}) {
  return numero(item.valor ?? item.valorBruto ?? item.total ?? item.valorTotal ?? item.valorDevido ?? item.valorOriginal);
}

function valorPagoFinanceiro(item = {}) {
  return numero(item.valorPago ?? item.valor_pago ?? item.valorRecebido ?? item.valorLiquido ?? item.totalPago ?? item.valorPagoTotal);
}

function valorLiquidoFinanceiro(item = {}) {
  const liquido = numero(item.valorLiquido ?? item.valorRecebidoLiquido);
  if (liquido > 0) return liquido;
  const bruto = numero(item.valorBrutoRecebido ?? item.valorRecebido ?? item.valorPago ?? item.valor ?? item.total);
  const taxa = numero(item.taxaOperadoraValor ?? item.taxaValor ?? item.taxa);
  return Math.max(0, Number((bruto - taxa).toFixed(2)));
}

function filtrarPeriodo(lista, getData, inicio, fim) {
  if (!inicio && !fim) return lista;
  return lista.filter(item => dentroPeriodo(getData(item), inicio, fim));
}

export async function gerarDashboardExecutivo(filtros = {}) {
  const base = await carregarBaseBI();
  const hoje = hojeISO();
  const presencasReais = base.presencas.filter(presencaReal);
  const matriculasAtivas = matriculasAtivasUnicas(base.matriculas);
  const alunosAtivos = alunosAtivosUnicos(base.alunos, matriculasAtivas);

  return {
    kpis: {
      totalAlunos: base.alunos.length,
      alunosAtivos: alunosAtivos.length,
      matriculasAtivas: matriculasAtivas.length,
      presentesHoje: presencasReais.filter(p => dataPresenca(p) === hoje).length
    },
    graficos: {
      alunosPorPlano: contarPorCampo(base.alunos, "plano", "Sem plano"),
      alunosPorStatus: contarPorCampo(base.alunos, "status", "Sem status")
    },
    alertas: [],
    ultimasAtividades: []
  };
}

export async function gerarBIFinanceiro(filtros = {}) {
  const base = await carregarBaseBI();
  let recebido = 0;
  let receber = 0;
  let pagoTotal = 0;
  let pagar = 0;

  for (const item of base.financeiro) {
    if (cancelado(item)) continue;
    const tipo = normalizar(item.tipo);
    const valor = valorFinanceiro(item);
    const valorPago = valorPagoFinanceiro(item) || valorLiquidoFinanceiro(item);

    if (tipo === "receber" && pago(item)) recebido += valorPago || valor;
    if (tipo === "receber" && !pago(item)) receber += Math.max(0, valor - valorPagoFinanceiro(item));
    if (tipo === "pagar" && pago(item)) pagoTotal += valorPago || valor;
    if (tipo === "pagar" && !pago(item)) pagar += Math.max(0, valor - valorPagoFinanceiro(item));
  }

  return {
    kpis: { recebido: Number(recebido.toFixed(2)), contasReceber: Number(receber.toFixed(2)), pago: Number(pagoTotal.toFixed(2)), contasPagar: Number(pagar.toFixed(2)) },
    graficos: {},
    tabelas: {}
  };
}

export async function gerarBIAcademia(filtros = {}) {
  const base = await carregarBaseBI();
  const inicio = filtros.inicio || filtros.dataInicio || "";
  const fim = filtros.fim || filtros.dataFim || "";
  const hoje = hojeISO();
  const matriculasAtivas = matriculasAtivasUnicas(base.matriculas);
  const alunosAtivos = alunosAtivosUnicos(base.alunos, matriculasAtivas);

  const matriculasPeriodo = filtrarPeriodo(base.matriculas, dataMatricula, inicio, fim);
  const presencasReais = base.presencas.filter(presencaReal);
  const presencasPeriodo = filtrarPeriodo(presencasReais, dataPresenca, inicio, fim);
  const alunosNovosPeriodo = (!inicio && !fim)
    ? base.alunos.length
    : base.alunos.filter(a => dentroPeriodo(dataCadastroAluno(a), inicio, fim)).length;

  const rankingAlunosMap = new Map();
  const rankingTurmasMap = new Map();
  for (const p of presencasPeriodo) {
    const aluno = nomeAluno(base.alunos, p);
    const turma = nomeTurma(base.turmas, p);
    if (aluno && aluno !== "-") rankingAlunosMap.set(aluno, (rankingAlunosMap.get(aluno) || 0) + 1);
    if (turma && turma !== "-") rankingTurmasMap.set(turma, (rankingTurmasMap.get(turma) || 0) + 1);
  }

  const alunosComPresenca = new Set(presencasPeriodo.map(p => normalizar(alunoId(p) || nomeAluno(base.alunos, p))).filter(Boolean));
  const alunosSemPresenca = alunosAtivos
    .filter(a => !alunosComPresenca.has(normalizar(a.id)) && !alunosComPresenca.has(normalizar(a.nome)))
    .map(a => ({ nome: a.nome || "-", telefone: a.telefone || a.whatsapp || "-", status: a.status || "-" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    filtros: { inicio, fim },
    kpis: {
      totalAlunos: base.alunos.length,
      alunosAtivos: alunosAtivos.length,
      alunosInativos: base.alunos.filter(inativo).length,
      alunosNovosPeriodo,
      totalMatriculas: base.matriculas.length,
      matriculasAtivas: matriculasAtivas.length,
      matriculasTrancadas: base.matriculas.filter(m => statusEh(m, ["trancado", "trancada", "suspenso", "suspensa"])).length,
      matriculasEncerradas: base.matriculas.filter(m => statusEh(m, ["encerrado", "encerrada", "finalizado", "finalizada"])).length,
      matriculasCanceladas: base.matriculas.filter(cancelado).length,
      presencasPeriodo: presencasPeriodo.length,
      presencasHoje: presencasReais.filter(p => dataPresenca(p) === hoje).length,
      checkinsAbertos: presencasReais.filter(p => dataPresenca(p) === hoje && ativo(p) && !horaFim(p)).length
    },
    graficos: {
      alunosPorPlano: contarPorCampo(base.alunos, item => item.plano || item.planoNome || item.plano_nome, "Sem plano"),
      alunosPorCidade: contarPorCampo(base.alunos, "cidade", "Sem cidade").slice(0, 10),
      matriculasPorStatus: contarPorCampo(base.matriculas, "status", "Sem status"),
      presencasPorMes: agruparPorMes(presencasPeriodo, dataPresenca),
      matriculasPorMes: agruparPorMes(matriculasPeriodo, dataMatricula),
      alunosNovosPorMes: agruparPorMes(base.alunos, dataCadastroAluno)
    },
    tabelas: {
      rankingAlunosFrequencia: [...rankingAlunosMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([aluno, presencas]) => ({ aluno, presencas })),
      rankingTurmasFrequencia: [...rankingTurmasMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([turma, presencas]) => ({ turma, presencas })),
      alunosSemPresenca
    }
  };
}

export async function gerarBIAcademiaOperacional(filtros = {}) {
  const base = await carregarBaseBI();
  const inicio = filtros.inicio || filtros.dataInicio || "";
  const fim = filtros.fim || filtros.dataFim || "";
  const hoje = hojeISO();

  const agendaPeriodo = filtrarPeriodo(base.agenda, item => item.data ?? item.dataInicio ?? item.data_inicio, inicio, fim);
  const agendaHoje = base.agenda.filter(a => dataISO(a.data ?? a.dataInicio ?? a.data_inicio) === hoje);

  const turmasAtivas = base.turmas.filter(ativo);
  const turmasInativas = base.turmas.filter(inativo);
  const turmasEncerradas = base.turmas.filter(t => statusEh(t, ["encerrado", "encerrada", "finalizado", "finalizada"]));
  const professoresAtivos = base.professores.filter(ativo);
  const professoresInativos = base.professores.filter(inativo);

  const mapaTurmasProfessor = new Map();
  for (const turma of base.turmas) {
    const professor = nomeProfessor(base.professores, turma);
    if (!professor || professor === "-") continue;
    mapaTurmasProfessor.set(professor, (mapaTurmasProfessor.get(professor) || 0) + 1);
  }

  const rankingProfessoresTurmas = [...mapaTurmasProfessor.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 10)
    .map(([professor, turmas]) => ({ professor, turmas }));

  const mapaAgendaProfessor = new Map();
  for (const item of agendaPeriodo) {
    const professor = nomeProfessor(base.professores, item);
    if (!professor || professor === "-") continue;
    mapaAgendaProfessor.set(professor, (mapaAgendaProfessor.get(professor) || 0) + 1);
  }

  const rankingProfessoresAgenda = [...mapaAgendaProfessor.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 10)
    .map(([professor, agendamentos]) => ({ professor, agendamentos }));

  const turmasSemProfessor = base.turmas
    .filter(turma => !professorId(turma) && !professorNomeItem(turma))
    .map(turma => ({ id: turma.id, nome: turma.nome || "-", modalidade: turma.modalidade || "-", status: turma.status || "-" }))
    .slice(0, 20);

  const agendaHojeTabela = agendaHoje
    .sort((a, b) => horaInicio(a).localeCompare(horaInicio(b)))
    .map(item => ({
      id: item.id,
      titulo: item.titulo || item.nome || "Agenda",
      tipo: item.tipo || item.modalidade || "-",
      horario: `${horaInicio(item) || "-"}${horaFim(item) ? " às " + horaFim(item) : ""}`,
      aluno: nomeAluno(base.alunos, item),
      professor: nomeProfessor(base.professores, item),
      status: item.status || "-"
    }));

  const capacidadeTotal = base.turmas.reduce((soma, turma) => soma + Number(turma.capacidade ?? turma.capacidadeMaxima ?? 0), 0);

  const turmasComCapacidade = base.turmas
    .map(turma => {
      const capacidade = Number(turma.capacidade ?? turma.capacidadeMaxima ?? 0);
      let matriculasAtivas = Number(turma.alunosMatriculados ?? turma.inscritos ?? 0);
      if (!matriculasAtivas) {
        const id = turmaId(turma) || texto(turma.id);
        const nome = normalizar(turma.nome);
        matriculasAtivas = base.matriculas.filter(m => ativo(m) && (texto(turmaId(m)) === id || normalizar(turmaNomeItem(m)) === nome)).length;
      }
      const ocupacao = capacidade > 0 ? Math.round((matriculasAtivas / capacidade) * 100) : 0;
      return { id: turma.id, nome: turma.nome || "-", modalidade: turma.modalidade || "-", capacidade, matriculasAtivas, ocupacao };
    })
    .sort((a, b) => b.ocupacao - a.ocupacao)
    .slice(0, 20);

  return {
    filtros: { inicio, fim },
    kpis: {
      totalTurmas: base.turmas.length,
      turmasAtivas: turmasAtivas.length,
      turmasInativas: turmasInativas.length,
      turmasEncerradas: turmasEncerradas.length,
      capacidadeTotal,
      totalProfessores: base.professores.length,
      professoresAtivos: professoresAtivos.length,
      professoresInativos: professoresInativos.length,
      agendamentosPeriodo: agendaPeriodo.length,
      agendamentosHoje: agendaHoje.length
    },
    graficos: {
      turmasPorModalidade: contarPorCampo(base.turmas, "modalidade", "Sem modalidade"),
      turmasPorStatus: contarPorCampo(base.turmas, "status", "Sem status"),
      professoresPorEspecialidade: contarPorCampo(base.professores, item => item.especialidade || (Array.isArray(item.especialidades) ? item.especialidades.join(", ") : ""), "Sem especialidade"),
      professoresPorStatus: contarPorCampo(base.professores, "status", "Sem status"),
      agendaPorTipo: contarPorCampo(agendaPeriodo, item => item.tipo || item.modalidade, "Sem tipo"),
      agendaPorStatus: contarPorCampo(agendaPeriodo, "status", "Sem status"),
      agendaPorMes: agruparPorMes(agendaPeriodo, item => item.data ?? item.dataInicio ?? item.data_inicio)
    },
    tabelas: {
      rankingProfessoresTurmas,
      rankingProfessoresAgenda,
      turmasSemProfessor,
      agendaHoje: agendaHojeTabela,
      turmasComCapacidade
    }
  };
}
