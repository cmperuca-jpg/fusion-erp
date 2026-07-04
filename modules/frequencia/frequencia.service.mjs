import fs from "node:fs/promises";
import path from "node:path";
import { listarFrequencias, salvarFrequencias } from "./frequencia.repository.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COMERCIAL_DIR = path.join(DATA_DIR, "comercial");

const ARQUIVOS = {
  alunos: path.join(DATA_DIR, "alunos.json"),
  turmas: path.join(DATA_DIR, "turmas.json"),
  contratos: path.join(COMERCIAL_DIR, "contratos.json"),
  servicosContratados: path.join(COMERCIAL_DIR, "servicos_contratados.json")
};

async function lerJson(arquivo, padrao = []) {
  try {
    const raw = await fs.readFile(arquivo, "utf8");
    if (!raw.trim()) return padrao;
    const dados = JSON.parse(raw);
    return dados ?? padrao;
  } catch {
    return padrao;
  }
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function gerarId(prefixo = "freq") {
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

function statusFrequencia(status = "") {
  const s = normalizar(status);
  if (["presente", "entrada", "liberado", "compareceu"].includes(s)) return "Presente";
  if (["falta", "ausente", "faltou"].includes(s)) return "Falta";
  if (["justificado", "justificada"].includes(s)) return "Justificado";
  if (["cancelado", "cancelada"].includes(s)) return "Cancelado";
  return "Presente";
}

function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((c) => String(c.alunoId) === String(alunoId));
  return lista.find(ativo) || null;
}

function servicosAtivosDoContrato(servicos, contratoId) {
  return servicos.filter((s) => String(s.contratoId) === String(contratoId) && ativo(s));
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((a) => String(a.id || a._id || a.alunoId) === String(alunoId)) || null;
}

function localizarTurma(turmas, turmaId) {
  return turmas.find((t) => String(t.id) === String(turmaId)) || null;
}

function localizarServico(servicos, alunoId, turmaId = "") {
  return servicos.find((s) =>
    String(s.alunoId) === String(alunoId) &&
    ativo(s) &&
    (!turmaId || String(s.turmaId) === String(turmaId))
  ) || null;
}

function mesmoDia(registro, data) {
  return String(registro.data || "").slice(0, 10) === String(data || "").slice(0, 10);
}

async function carregarBase() {
  return {
    alunos: await lerJson(ARQUIVOS.alunos, []),
    turmas: await lerJson(ARQUIVOS.turmas, []),
    contratos: await lerJson(ARQUIVOS.contratos, []),
    servicosContratados: await lerJson(ARQUIVOS.servicosContratados, []),
    frequencias: await listarFrequencias()
  };
}

export async function statusFrequenciaComercial() {
  return {
    ok: true,
    modulo: "frequencia",
    versao: "Fusion ERP 2.2-C",
    status: "Online",
    conceito: "Frequência por serviço contratado e turma"
  };
}

export async function listar(filtros = {}) {
  let lista = await listarFrequencias();

  if (filtros.data) lista = lista.filter((f) => mesmoDia(f, filtros.data));
  if (filtros.alunoId || filtros.aluno_id) {
    const id = filtros.alunoId || filtros.aluno_id;
    lista = lista.filter((f) => String(f.alunoId) === String(id));
  }
  if (filtros.turmaId || filtros.turma_id) {
    const id = filtros.turmaId || filtros.turma_id;
    lista = lista.filter((f) => String(f.turmaId) === String(id));
  }
  if (filtros.professor) {
    const busca = normalizar(filtros.professor);
    lista = lista.filter((f) => normalizar(f.professor).includes(busca));
  }
  if (filtros.status) {
    lista = lista.filter((f) => normalizar(f.status) === normalizar(filtros.status));
  }

  return {
    ok: true,
    total: lista.length,
    dados: lista.sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")))
  };
}

export async function listarAlunosDaTurma(turmaId, filtros = {}) {
  const data = filtros.data || hojeISO();
  const base = await carregarBase();
  const turma = localizarTurma(base.turmas, turmaId);
  const servicos = base.servicosContratados.filter((s) => String(s.turmaId) === String(turmaId) && ativo(s));

  const alunos = servicos.map((servico) => {
    const aluno = localizarAluno(base.alunos, servico.alunoId);
    const contrato = base.contratos.find((c) => String(c.id) === String(servico.contratoId)) || null;
    const frequencia = base.frequencias.find((f) =>
      String(f.alunoId) === String(servico.alunoId) &&
      String(f.turmaId) === String(turmaId) &&
      mesmoDia(f, data) &&
      normalizar(f.status) !== "cancelado"
    ) || null;

    return {
      alunoId: servico.alunoId,
      aluno: alunoNome(aluno || { nome: servico.aluno }),
      contratoId: servico.contratoId,
      matriculaId: servico.matriculaId || contrato?.matriculaId || "",
      servicoContratadoId: servico.id || servico.servicoContratadoId,
      turmaId: String(turmaId),
      turma: servico.turma || servico.nome || turma?.nome || "",
      modalidade: servico.modalidade || turma?.modalidade || "",
      professor: servico.professor || turma?.professor || "",
      horario: servico.horario || turma?.horario || "",
      sala: servico.sala || turma?.sala || "",
      valor: Number(servico.valor || 0),
      statusFrequencia: frequencia?.status || "Pendente",
      frequenciaId: frequencia?.id || "",
      observacao: frequencia?.observacao || "",
      data
    };
  });

  return {
    ok: true,
    data,
    turma: turma || { id: turmaId },
    total: alunos.length,
    alunos
  };
}

export async function obterFrequenciaAluno(alunoId, filtros = {}) {
  const data = filtros.data || hojeISO();
  const base = await carregarBase();
  const aluno = localizarAluno(base.alunos, alunoId);
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  const servicos = contrato ? servicosAtivosDoContrato(base.servicosContratados, contrato.id) : [];

  const frequencias = base.frequencias.filter((f) =>
    String(f.alunoId) === String(alunoId) &&
    (!filtros.data || mesmoDia(f, data))
  );

  return {
    ok: true,
    data,
    aluno: aluno || { id: alunoId },
    contrato,
    servicosAtivos: servicos,
    frequencias,
    total: frequencias.length
  };
}

export async function registrar(dados = {}) {
  const alunoId = texto(dados.alunoId || dados.aluno_id);
  const turmaId = texto(dados.turmaId || dados.turma_id);
  const data = texto(dados.data) || hojeISO();

  if (!alunoId) throw Object.assign(new Error("Informe alunoId."), { status: 400 });
  if (!turmaId) throw Object.assign(new Error("Informe turmaId."), { status: 400 });

  const base = await carregarBase();
  const contrato = contratoAtivoAluno(base.contratos, alunoId);
  if (!contrato) throw Object.assign(new Error("Aluno sem contrato comercial ativo."), { status: 403 });

  const servico = localizarServico(base.servicosContratados, alunoId, turmaId);
  if (!servico) throw Object.assign(new Error("Aluno não possui serviço/turma ativa para registrar frequência."), { status: 403 });

  const aluno = localizarAluno(base.alunos, alunoId);
  const turma = localizarTurma(base.turmas, turmaId);

  const lista = base.frequencias;
  const existenteIndex = lista.findIndex((f) =>
    String(f.alunoId) === String(alunoId) &&
    String(f.turmaId) === String(turmaId) &&
    mesmoDia(f, data) &&
    normalizar(f.status) !== "cancelado"
  );

  const registro = {
    id: existenteIndex >= 0 ? lista[existenteIndex].id : gerarId(),
    data,
    alunoId,
    aluno: alunoNome(aluno || { nome: servico.aluno }),
    contratoId: contrato.id,
    matriculaId: servico.matriculaId || contrato.matriculaId || "",
    numeroMatricula: contrato.numeroMatricula || "",
    servicoContratadoId: servico.id || servico.servicoContratadoId || "",
    servicoId: servico.servicoId || "",
    servico: servico.servico || servico.nome || servico.modalidade || "",
    turmaId,
    turma: servico.turma || servico.nome || turma?.nome || "",
    modalidade: servico.modalidade || turma?.modalidade || "",
    professorId: servico.professorId || turma?.professorId || "",
    professor: servico.professor || turma?.professor || "",
    horario: servico.horario || turma?.horario || "",
    sala: servico.sala || turma?.sala || "",
    status: statusFrequencia(dados.status),
    origem: dados.origem || "frequencia_comercial",
    observacao: dados.observacao || dados.observacoes || "",
    usuario: dados.usuario || "Administrador",
    criadoEm: existenteIndex >= 0 ? lista[existenteIndex].criadoEm : agoraISO(),
    atualizadoEm: agoraISO()
  };

  if (existenteIndex >= 0) lista[existenteIndex] = { ...lista[existenteIndex], ...registro };
  else lista.push(registro);

  await salvarFrequencias(lista);
  return { ok: true, dados: registro, atualizado: existenteIndex >= 0 };
}

export async function chamadaTurma(turmaId, dados = {}) {
  const data = dados.data || hojeISO();
  const registros = Array.isArray(dados.registros) ? dados.registros : [];
  const resultados = [];

  for (const item of registros) {
    const alunoId = item.alunoId || item.aluno_id;
    if (!alunoId) continue;
    resultados.push(await registrar({
      alunoId,
      turmaId,
      data,
      status: item.status || "Presente",
      observacao: item.observacao || "",
      usuario: dados.usuario || item.usuario || "Administrador",
      origem: "chamada_turma"
    }));
  }

  return {
    ok: true,
    turmaId,
    data,
    total: resultados.length,
    resultados: resultados.map((r) => r.dados)
  };
}

export async function resumo(filtros = {}) {
  const data = filtros.data || hojeISO();
  const lista = (await listarFrequencias()).filter((f) => mesmoDia(f, data));
  const porStatus = lista.reduce((acc, item) => {
    const s = item.status || "Pendente";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const turmas = [...new Set(lista.map((f) => f.turma).filter(Boolean))];
  const professores = [...new Set(lista.map((f) => f.professor).filter(Boolean))];

  return {
    ok: true,
    data,
    total: lista.length,
    presentes: porStatus.Presente || 0,
    faltas: porStatus.Falta || 0,
    justificados: porStatus.Justificado || 0,
    turmas: turmas.length,
    professores: professores.length,
    porStatus
  };
}
