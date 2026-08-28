const txt = (v) => String(v ?? "").trim();
const norm = (v) => txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const lista = (v) => Array.isArray(v) ? v : (v === null || v === undefined || v === "" ? [] : [v]);

export function idsTurmasRegistro(registro = {}) {
  const ids = new Set();
  const add = (valor) => {
    for (const item of lista(valor)) {
      if (item && typeof item === "object") {
        add(item.id ?? item.turmaId ?? item.turma_id ?? item.codigo);
      } else if (txt(item)) {
        ids.add(txt(item));
      }
    }
  };
  add(registro.turmaId);
  add(registro.turma_id);
  add(registro.idTurma);
  add(registro.turmaIds);
  add(registro.turma_ids);
  add(registro.turmasIds);
  add(registro.turmasSelecionadas);
  add(registro.turmas);
  add(registro.servicos);
  add(registro.servicosContratados);
  return ids;
}

function nomesTurmasRegistro(registro = {}) {
  const nomes = new Set();
  const add = (valor) => {
    for (const item of lista(valor)) {
      if (item && typeof item === "object") {
        add(item.nome ?? item.turma ?? item.turmaNome ?? item.modalidade);
      } else if (norm(item)) {
        nomes.add(norm(item));
      }
    }
  };
  add(registro.turma);
  add(registro.turmas);
  add(registro.servicos);
  add(registro.servicosContratados);
  return nomes;
}

function detalhesDoAluno(aluno = {}, ids = new Set()) {
  const candidatos = [
    ...(Array.isArray(aluno.turmas) ? aluno.turmas : []),
    ...(Array.isArray(aluno.servicosContratados) ? aluno.servicosContratados : []),
    ...(Array.isArray(aluno.servicos) ? aluno.servicos : [])
  ].filter(item => item && typeof item === "object");

  const mapa = new Map();
  for (const item of candidatos) {
    const id = txt(item.id ?? item.turmaId ?? item.turma_id ?? item.codigo);
    if (id && ids.has(id) && !mapa.has(id)) mapa.set(id, { ...item });
  }
  return [...mapa.values()];
}

export function reconciliarTurmasMatriculaComAluno(aluno, matricula) {
  if (!aluno || !matricula) return { alterado: false, adicionadas: 0 };

  const idsAluno = idsTurmasRegistro(aluno);
  const idsMatricula = idsTurmasRegistro(matricula);

  // Regra conservadora: só completa quando a matrícula atual é subconjunto
  // do cadastro do aluno. Nunca troca uma turma por outra automaticamente.
  if (idsAluno.size < 2 || idsMatricula.size < 1 || idsAluno.size <= idsMatricula.size) {
    return { alterado: false, adicionadas: 0 };
  }
  if (![...idsMatricula].every(id => idsAluno.has(id))) {
    return { alterado: false, adicionadas: 0 };
  }

  const extras = [...idsAluno].filter(id => !idsMatricula.has(id));
  if (!extras.length) return { alterado: false, adicionadas: 0 };

  matricula.turmaIds = [...idsAluno];
  if (!txt(matricula.turmaId) || !idsAluno.has(txt(matricula.turmaId))) {
    matricula.turmaId = [...idsAluno][0] || "";
  }

  const detalhes = detalhesDoAluno(aluno, idsAluno);
  if (detalhes.length === idsAluno.size) {
    matricula.turmas = detalhes;
    matricula.servicos = detalhes.map(item => ({ ...item }));
  }

  for (const campo of ["turma", "modalidade", "professor", "horario", "sala"]) {
    if (txt(aluno[campo])) matricula[campo] = aluno[campo];
  }

  const agora = new Date().toISOString();
  matricula.historico = Array.isArray(matricula.historico) ? matricula.historico : [];
  matricula.historico.push({
    id: `hist_mat_turmas_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    acao: "reconciliacao_turmas_pos_financeiro",
    descricao: "Turmas reconciliadas com o cadastro atual do aluno apos evento financeiro.",
    dados: { turmasAdicionadas: extras.length },
    criadoEm: agora
  });
  matricula.atualizadoEm = agora;

  return { alterado: true, adicionadas: extras.length };
}

function idTurma(t = {}) {
  return txt(t.id ?? t.turmaId ?? t.turma_id ?? t.codigo);
}

function nomeTurma(t = {}) {
  return norm(t.nome ?? t.turma ?? t.turmaNome ?? t.modalidade);
}

function contaNaTurma(m = {}) {
  return [
    "ativa", "ativo", "active",
    "pendente", "pending",
    "trancada", "trancado",
    "suspensa", "suspenso"
  ].includes(norm(m.status ?? m.situacao ?? m.statusMatricula));
}

export function recalcularOcupacaoTurmas(turmas = [], matriculas = []) {
  const listaTurmas = Array.isArray(turmas) ? turmas : [];
  const listaMatriculas = Array.isArray(matriculas) ? matriculas : [];

  const ids = new Set(listaTurmas.map(idTurma).filter(Boolean));
  const porNome = new Map(
    listaTurmas.map(t => [nomeTurma(t), idTurma(t)]).filter(([nome, id]) => nome && id)
  );
  const ocupacao = new Map([...ids].map(id => [id, 0]));

  for (const matricula of listaMatriculas) {
    if (!contaNaTurma(matricula)) continue;
    const vinculadas = new Set();

    for (const id of idsTurmasRegistro(matricula)) {
      if (ocupacao.has(id)) vinculadas.add(id);
    }
    for (const nome of nomesTurmasRegistro(matricula)) {
      const id = porNome.get(nome);
      if (id) vinculadas.add(id);
    }
    for (const id of vinculadas) {
      ocupacao.set(id, (ocupacao.get(id) || 0) + 1);
    }
  }

  let alteradas = 0;
  for (const turma of listaTurmas) {
    const novo = ocupacao.get(idTurma(turma)) || 0;
    if (Number(turma.alunosMatriculados || 0) !== novo) {
      turma.alunosMatriculados = novo;
      turma.atualizadoEm = new Date().toISOString();
      alteradas += 1;
    }
  }

  return { alteradas };
}
