import fs from "node:fs/promises";
import path from "node:path";
import {
  listarCheckins,
  salvarCheckins,
  buscarCheckinPorId
} from "./checkin.repository.mjs";
import { listarFrequencias, salvarFrequencias } from "../frequencia/frequencia.repository.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COMERCIAL_DIR = path.join(DATA_DIR, "comercial");

const ARQUIVOS = {
  contratos: [
    path.join(COMERCIAL_DIR, "contratos.json"),
    path.join(DATA_DIR, "comercial_contratos.json")
  ],
  servicosContratados: [
    path.join(COMERCIAL_DIR, "servicos_contratados.json"),
    path.join(DATA_DIR, "comercial_servicos_contratados.json")
  ],
  alunos: [path.join(DATA_DIR, "alunos.json")],
  matriculas: [path.join(DATA_DIR, "matriculas.json")],
  mensalidades: [path.join(DATA_DIR, "mensalidades.json")],
  financeiro: [path.join(DATA_DIR, "financeiro.json")]
};

async function lerPrimeiroJson(candidatos, padrao = []) {
  for (const arquivo of candidatos) {
    try {
      const raw = await fs.readFile(arquivo, "utf8");
      return JSON.parse(raw || "null") ?? padrao;
    } catch (erro) {
      if (erro?.code !== "ENOENT") return padrao;
    }
  }
  return padrao;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaAtual() {
  return new Date().toTimeString().slice(0, 5);
}

function normalizar(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function statusAtivo(status) {
  const s = normalizar(status || "Ativo");
  return ![
    "cancelado", "cancelada",
    "encerrado", "encerrada",
    "inativo", "inativa",
    "bloqueado", "bloqueada",
    "removido", "removida"
  ].includes(s);
}

function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter((contrato) => String(contrato.alunoId) === String(alunoId));
  return lista.find((contrato) => statusAtivo(contrato.status)) || null;
}

function localizarContrato(contratos, dados = {}) {
  const contratoId = dados.contratoId || dados.contrato_id || "";
  const matriculaId = dados.matriculaId || dados.matricula_id || "";
  const alunoId = dados.alunoId || dados.aluno_id || "";

  if (contratoId) {
    return contratos.find((contrato) => String(contrato.id) === String(contratoId)) || null;
  }

  if (matriculaId) {
    return contratos.find((contrato) => String(contrato.matriculaId || "") === String(matriculaId)) || null;
  }

  if (alunoId) return contratoAtivoAluno(contratos, alunoId);
  return null;
}

function localizarAluno(alunos, alunoId) {
  return alunos.find((aluno) => String(aluno.id || aluno._id || "") === String(alunoId)) || null;
}

function servicosAtivosDoContrato(servicos, contratoId) {
  return servicos.filter((servico) =>
    String(servico.contratoId) === String(contratoId) && statusAtivo(servico.status)
  );
}

function mesmoServico(servico, alvo = {}) {
  const turmaId = texto(alvo.turmaId || alvo.turma_id);
  const servicoId = texto(alvo.servicoId || alvo.servico_id);
  const servicoContratadoId = texto(alvo.servicoContratadoId || alvo.servico_contratado_id);
  const modalidade = normalizar(alvo.modalidade);
  const nomeServico = normalizar(alvo.servico || alvo.nomeServico || alvo.nome);
  const turma = normalizar(alvo.turma || alvo.nomeTurma);

  if (servicoContratadoId && String(servico.id) === String(servicoContratadoId)) return true;
  if (turmaId && String(servico.turmaId || "") === String(turmaId)) return true;
  if (servicoId && String(servico.servicoId || "") === String(servicoId)) return true;
  if (modalidade && normalizar(servico.modalidade) === modalidade) return true;
  if (nomeServico && normalizar(servico.servico || servico.nome) === nomeServico) return true;
  if (turma && normalizar(servico.turma || servico.nome) === turma) return true;
  return false;
}

function existeAlvoDeServico(dados = {}) {
  return Boolean(
    dados.turmaId || dados.turma_id ||
    dados.servicoId || dados.servico_id ||
    dados.servicoContratadoId || dados.servico_contratado_id ||
    dados.modalidade || dados.servico || dados.nomeServico || dados.nome ||
    dados.turma || dados.nomeTurma
  );
}


function statusPago(status) {
  const s = normalizar(status);
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada"].includes(s);
}

function vencido(item = {}, dataBase = hojeISO()) {
  const venc = texto(item.vencimento || item.dataVencimento || item.data_vencimento || item.dataFim || item.data_fim);
  return Boolean(venc && venc.slice(0, 10) < dataBase && !statusPago(item.status));
}

function statusMatriculaAtiva(status) {
  const s = normalizar(status || "Ativa");
  return !["cancelada", "cancelado", "encerrada", "encerrado", "inativa", "inativo", "bloqueada", "bloqueado", "suspensa", "suspenso"].includes(s);
}

function localizarAlunoPorCodigo(alunos = [], codigo = "") {
  const alvo = normalizar(codigo).replace(/\D/g, "") || normalizar(codigo);
  if (!alvo) return null;

  return alunos.find((aluno) => {
    const candidatos = [
      aluno.id,
      aluno._id,
      aluno.alunoId,
      aluno.codigo,
      aluno.matricula,
      aluno.numeroMatricula,
      aluno.cpf,
      aluno.email,
      aluno.nome
    ];
    return candidatos.some((valor) => {
      const txt = texto(valor);
      if (!txt) return false;
      const n = normalizar(txt);
      const digitos = n.replace(/\D/g, "");
      return n === normalizar(codigo) || (digitos && digitos === alvo) || n.includes(normalizar(codigo));
    });
  }) || null;
}

function localizarMatriculaAtiva(matriculas = [], dados = {}, alunoId = "") {
  const matriculaId = texto(dados.matriculaId || dados.matricula_id);
  const numero = texto(dados.matricula || dados.numeroMatricula || dados.numero_matricula || dados.codigo);

  let lista = matriculas.filter((m) => {
    if (matriculaId && String(m.id) === String(matriculaId)) return true;
    if (numero && String(m.numero || m.numeroMatricula || "") === String(numero)) return true;
    if (alunoId && String(m.alunoId || m.aluno_id) === String(alunoId)) return true;
    return false;
  });

  lista = lista.sort((a, b) => String(b.criadoEm || b.dataMatricula || "").localeCompare(String(a.criadoEm || a.dataMatricula || "")));
  return lista.find((m) => statusMatriculaAtiva(m.status)) || lista[0] || null;
}

function matriculaPermiteMusculacao(matricula = {}, servicos = []) {
  const textoMatricula = normalizar([
    matricula.plano,
    matricula.nomePlano,
    Array.isArray(matricula.modalidades) ? matricula.modalidades.join(" ") : matricula.modalidades
  ].join(" "));

  if (textoMatricula.includes("musculacao") || textoMatricula.includes("academia") || textoMatricula.includes("combo")) return true;

  return servicos.some((servico) => {
    const txt = normalizar([servico.nome, servico.servico, servico.modalidade, servico.turma].join(" "));
    return txt.includes("musculacao") || txt.includes("treino") || txt.includes("funcional") || txt.includes("personal");
  });
}

function servicoPreferencialMusculacao(servicos = []) {
  return servicos.find((servico) => {
    const txt = normalizar([servico.nome, servico.servico, servico.modalidade, servico.turma].join(" "));
    return txt.includes("musculacao") || txt.includes("treino") || txt.includes("funcional") || txt.includes("personal");
  }) || servicos[0] || null;
}

function pendenciasFinanceiras(alunoId, mensalidades = [], financeiro = []) {
  const data = hojeISO();
  const abertasMensalidades = mensalidades.filter((m) => String(m.alunoId || m.aluno_id) === String(alunoId) && vencido(m, data));
  const abertasFinanceiro = financeiro.filter((f) => {
    const tipoReceber = !f.tipo || normalizar(f.tipo).includes("receber");
    return tipoReceber && String(f.alunoId || f.aluno_id) === String(alunoId) && vencido(f, data);
  });
  return [...abertasMensalidades, ...abertasFinanceiro];
}

async function registrarFrequenciaMusculacao({ aluno, contrato, matricula, servico, checkin, dados }) {
  const lista = await listarFrequencias();
  const data = dados.data || hojeISO();
  const alunoId = aluno.id || aluno._id || contrato.alunoId || matricula.alunoId;
  const turmaId = servico?.turmaId || dados.turmaId || "musculacao_livre";

  const existenteIndex = lista.findIndex((f) =>
    String(f.alunoId) === String(alunoId) &&
    String(f.turmaId || "musculacao_livre") === String(turmaId) &&
    String(f.data || "").slice(0, 10) === String(data).slice(0, 10) &&
    normalizar(f.status) !== "cancelado"
  );

  const registro = {
    id: existenteIndex >= 0 ? lista[existenteIndex].id : `freq_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    data,
    alunoId,
    aluno: aluno.nome || contrato.aluno || matricula.aluno || "",
    contratoId: contrato.id || "",
    matriculaId: matricula.id || contrato.matriculaId || "",
    numeroMatricula: matricula.numero || contrato.numeroMatricula || "",
    checkinId: checkin.id,
    servicoContratadoId: servico?.id || servico?.servicoContratadoId || "",
    servicoId: servico?.servicoId || "",
    servico: servico?.servico || servico?.nome || "Musculação",
    turmaId,
    turma: servico?.turma || servico?.nome || "Musculação livre",
    modalidade: servico?.modalidade || "Musculação",
    professorId: servico?.professorId || aluno.professorId || "",
    professor: servico?.professor || aluno.professorNome || aluno.professor_responsavel || "",
    horario: servico?.horario || "Livre",
    sala: servico?.sala || "Musculação",
    status: "Presente",
    origem: "checkin_musculacao_inteligente",
    observacao: dados.observacao || dados.observacoes || "Presença criada pelo check-in inteligente da musculação.",
    usuario: dados.usuario || "Administrador",
    criadoEm: existenteIndex >= 0 ? lista[existenteIndex].criadoEm : new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  if (existenteIndex >= 0) lista[existenteIndex] = { ...lista[existenteIndex], ...registro };
  else lista.push(registro);

  await salvarFrequencias(lista);
  return { registro, atualizado: existenteIndex >= 0 };
}

async function localizarTreinoAtivoAluno(alunoId) {
  const arquivosTreino = [
    path.join(DATA_DIR, "treinos.json"),
    path.join(DATA_DIR, "treinos-interno.json"),
    path.join(DATA_DIR, "treinos_operacional.json")
  ];

  const treinos = await lerPrimeiroJson(arquivosTreino, []);
  if (!Array.isArray(treinos)) return null;

  return treinos
    .filter((treino) => String(treino.alunoId || treino.aluno_id || "") === String(alunoId))
    .filter((treino) => {
      const status = normalizar(treino.status || "Ativo");
      const validade = texto(treino.dataValidade || treino.validade || treino.dataFim || treino.data_fim);
      return statusMatriculaAtiva(status) && (!validade || validade.slice(0, 10) >= hojeISO());
    })
    .sort((a, b) => String(b.criadoEm || b.dataInicio || b.data || "").localeCompare(String(a.criadoEm || a.dataInicio || a.data || "")))[0] || null;
}

async function iniciarExecucaoTreinoInterno(treinoId, dados = {}) {
  return {
    ok: true,
    dados: {
      id: `exec_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      treinoId,
      data: dados.data || hojeISO(),
      origem: dados.origem || "checkin",
      usuario: dados.usuario || "Sistema",
      status: "Iniciada",
      criadoEm: new Date().toISOString()
    }
  };
}

export async function autorizarCheckinMusculacao(dados = {}) {
  const [contratos, servicosContratados, alunos, matriculas, mensalidades, financeiro] = await Promise.all([
    lerPrimeiroJson(ARQUIVOS.contratos, []),
    lerPrimeiroJson(ARQUIVOS.servicosContratados, []),
    lerPrimeiroJson(ARQUIVOS.alunos, []),
    lerPrimeiroJson(ARQUIVOS.matriculas, []),
    lerPrimeiroJson(ARQUIVOS.mensalidades, []),
    lerPrimeiroJson(ARQUIVOS.financeiro, [])
  ]);

  const codigo = texto(dados.codigo || dados.qrCode || dados.qrcode || dados.cpf || dados.matricula || dados.alunoId || dados.aluno_id);
  let aluno = dados.alunoId || dados.aluno_id ? localizarAluno(alunos, dados.alunoId || dados.aluno_id) : null;
  if (!aluno && codigo) aluno = localizarAlunoPorCodigo(alunos, codigo);

  const alunoId = aluno?.id || aluno?._id || dados.alunoId || dados.aluno_id || "";
  const contrato = localizarContrato(contratos, { ...dados, alunoId });
  const matricula = localizarMatriculaAtiva(matriculas, dados, alunoId);
  const contratoFinal = contrato || (matricula?.contratoId ? contratos.find((c) => String(c.id) === String(matricula.contratoId)) : null) || {};

  if (!alunoId || !aluno) {
    return { ok: true, autorizado: false, status: "Bloqueado", motivo: "Aluno não localizado pelo código informado.", aluno: null, contrato: null, matricula: null };
  }

  if (!matricula || !statusMatriculaAtiva(matricula.status)) {
    return { ok: true, autorizado: false, status: "Bloqueado", motivo: "Aluno sem matrícula ativa para musculação.", aluno, contrato: contratoFinal || null, matricula: matricula || null };
  }

  if (contratoFinal?.id && !statusAtivo(contratoFinal.status)) {
    return { ok: true, autorizado: false, status: "Bloqueado", motivo: `Contrato ${contratoFinal.status || "inativo"}.`, aluno, contrato: contratoFinal, matricula };
  }

  const servicosAtivos = contratoFinal?.id ? servicosAtivosDoContrato(servicosContratados, contratoFinal.id) : [];
  if (!matriculaPermiteMusculacao(matricula, servicosAtivos)) {
    return { ok: true, autorizado: false, status: "Bloqueado", motivo: "Plano/matrícula sem musculação liberada.", aluno, contrato: contratoFinal, matricula, servicosAtivos };
  }

  const pendencias = pendenciasFinanceiras(alunoId, mensalidades, financeiro);
  if (pendencias.length) {
    return { ok: true, autorizado: false, status: "Bloqueado", motivo: "Aluno possui mensalidade ou lançamento financeiro vencido em aberto.", aluno, contrato: contratoFinal, matricula, servicosAtivos, pendenciasFinanceiras: pendencias };
  }

  const treinoAtivo = await localizarTreinoAtivoAluno(alunoId);
  const servico = servicoPreferencialMusculacao(servicosAtivos);

  return {
    ok: true,
    autorizado: true,
    status: "Liberado",
    motivo: treinoAtivo ? "Acesso liberado; treino ativo localizado." : "Acesso liberado; aluno sem treino ativo localizado.",
    aluno: { ...aluno, id: alunoId, nome: aluno.nome || matricula.aluno || contratoFinal.aluno || "" },
    contrato: contratoFinal?.id ? contratoFinal : null,
    matricula,
    servicoContratado: servico,
    servicosAtivos,
    treinoAtivo
  };
}

export async function registrarCheckinMusculacaoInteligente(dados = {}) {
  const autorizacao = await autorizarCheckinMusculacao(dados);
  const aluno = autorizacao.aluno || {};
  const contrato = autorizacao.contrato || {};
  const matricula = autorizacao.matricula || {};
  const servico = autorizacao.servicoContratado || {};
  const registros = await listarCheckins();

  const registro = {
    id: gerarId(),
    alunoId: aluno.id || contrato.alunoId || matricula.alunoId || dados.alunoId || dados.aluno_id || "",
    aluno: aluno.nome || contrato.aluno || matricula.aluno || dados.aluno || "",
    matricula: matricula.numero || contrato.numeroMatricula || dados.matricula || "",
    matriculaId: matricula.id || contrato.matriculaId || dados.matriculaId || "",
    contratoId: contrato.id || dados.contratoId || "",
    plano: matricula.plano || contrato.tipoPlano || dados.plano || "",
    planoId: matricula.planoId || dados.planoId || "",
    modalidade: "Musculação",
    modalidades: matricula.modalidades || [],
    turmaId: servico.turmaId || dados.turmaId || "musculacao_livre",
    turma: servico.turma || servico.nome || dados.turma || "Musculação livre",
    professorId: servico.professorId || aluno.professorId || "",
    professor: servico.professor || aluno.professorNome || aluno.professor_responsavel || dados.professor || "",
    servicoContratadoId: servico.id || "",
    servicoId: servico.servicoId || "",
    servico: servico.servico || servico.nome || "Musculação",
    data: dados.data || hojeISO(),
    horaEntrada: dados.horaEntrada || horaAtual(),
    horaSaida: "",
    tipo: dados.tipo || "Check-in Inteligente Musculação",
    status: autorizacao.autorizado ? "Liberado" : "Bloqueado",
    motivoBloqueio: autorizacao.autorizado ? "" : autorizacao.motivo,
    observacoes: dados.observacoes || dados.observacao || autorizacao.motivo || "Check-in inteligente da musculação.",
    origem: "fusion_erp_2_6_a",
    treinoId: autorizacao.treinoAtivo?.id || "",
    treinoNome: autorizacao.treinoAtivo?.nome || autorizacao.treinoAtivo?.objetivo || "",
    execucaoTreinoId: "",
    frequenciaId: "",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  let frequencia = null;
  let execucao = null;

  if (autorizacao.autorizado) {
    const freq = await registrarFrequenciaMusculacao({ aluno, contrato, matricula, servico, checkin: registro, dados });
    frequencia = freq.registro;
    registro.frequenciaId = frequencia.id;

    if (autorizacao.treinoAtivo?.id) {
      const inicio = await iniciarExecucaoTreinoInterno(autorizacao.treinoAtivo.id, {
        data: registro.data,
        origem: "checkin_musculacao_inteligente",
        usuario: dados.usuario || "Check-in"
      });
      execucao = inicio.dados || null;
      registro.execucaoTreinoId = execucao?.id || "";
    }
  }

  registros.push(registro);
  await salvarCheckins(registros);

  return {
    ok: true,
    autorizado: autorizacao.autorizado,
    status: registro.status,
    mensagem: autorizacao.motivo,
    registro,
    frequencia,
    treinoAtivo: autorizacao.treinoAtivo || null,
    execucaoTreino: execucao,
    autorizacao
  };
}

export async function listarRegistros(filtros = {}) {
  let registros = await listarCheckins();

  if (filtros.status) {
    registros = registros.filter((item) => item.status === filtros.status);
  }

  if (filtros.data) {
    registros = registros.filter((item) => item.data === filtros.data);
  }

  if (filtros.contratoId) {
    registros = registros.filter((item) => String(item.contratoId || "") === String(filtros.contratoId));
  }

  if (filtros.alunoId) {
    registros = registros.filter((item) => String(item.alunoId || "") === String(filtros.alunoId));
  }

  if (filtros.busca) {
    const busca = filtros.busca.toLowerCase();
    registros = registros.filter((item) =>
      [item.aluno, item.matricula, item.plano, item.modalidade, item.professor, item.turma, item.servico]
        .join(" ")
        .toLowerCase()
        .includes(busca)
    );
  }

  return registros.sort((a, b) => {
    const da = `${a.data || ""}T${a.horaEntrada || ""}`;
    const db = `${b.data || ""}T${b.horaEntrada || ""}`;
    return db.localeCompare(da);
  });
}

export async function obterResumoCheckin() {
  const registros = await listarCheckins();
  const hoje = hojeISO();

  return {
    total: registros.length,
    hoje: registros.filter((item) => item.data === hoje).length,
    liberados: registros.filter((item) => item.status === "Liberado").length,
    bloqueados: registros.filter((item) => item.status === "Bloqueado").length
  };
}

export async function autorizarCheckinComercial(dados = {}) {
  const contratos = await lerPrimeiroJson(ARQUIVOS.contratos, []);
  const servicosContratados = await lerPrimeiroJson(ARQUIVOS.servicosContratados, []);
  const alunos = await lerPrimeiroJson(ARQUIVOS.alunos, []);

  const contrato = localizarContrato(contratos, dados);

  if (!contrato) {
    return {
      ok: true,
      autorizado: false,
      status: "Bloqueado",
      motivo: "Aluno sem contrato comercial ativo localizado.",
      contrato: null,
      servicoContratado: null,
      servicosAtivos: []
    };
  }

  if (!statusAtivo(contrato.status)) {
    return {
      ok: true,
      autorizado: false,
      status: "Bloqueado",
      motivo: `Contrato comercial ${contrato.status || "inativo"}.`,
      contrato,
      servicoContratado: null,
      servicosAtivos: []
    };
  }

  const servicosAtivos = servicosAtivosDoContrato(servicosContratados, contrato.id);

  if (!servicosAtivos.length) {
    return {
      ok: true,
      autorizado: false,
      status: "Bloqueado",
      motivo: "Contrato ativo, mas sem serviços contratados ativos.",
      contrato,
      servicoContratado: null,
      servicosAtivos
    };
  }

  let servicoContratado = null;
  if (existeAlvoDeServico(dados)) {
    servicoContratado = servicosAtivos.find((servico) => mesmoServico(servico, dados)) || null;
    if (!servicoContratado) {
      return {
        ok: true,
        autorizado: false,
        status: "Bloqueado",
        motivo: "O aluno não possui este serviço/turma contratado no contrato comercial ativo.",
        contrato,
        servicoContratado: null,
        servicosAtivos
      };
    }
  } else {
    servicoContratado = servicosAtivos[0];
  }

  const aluno = localizarAluno(alunos, contrato.alunoId) || {};

  return {
    ok: true,
    autorizado: true,
    status: "Liberado",
    motivo: "Acesso autorizado pelo contrato comercial e serviço contratado ativo.",
    aluno: {
      id: contrato.alunoId,
      nome: contrato.aluno || aluno.nome || ""
    },
    contrato,
    servicoContratado,
    servicosAtivos
  };
}

export async function registrarEntrada(dados) {
  const registros = await listarCheckins();

  const novoRegistro = {
    id: gerarId(),
    alunoId: dados.alunoId || dados.aluno_id || "",
    aluno: dados.aluno || "",
    matricula: dados.matricula || "",
    plano: dados.plano || "",
    modalidade: dados.modalidade || "",
    turma: dados.turma || "",
    professor: dados.professor || "",
    data: dados.data || hojeISO(),
    horaEntrada: dados.horaEntrada || horaAtual(),
    horaSaida: dados.horaSaida || "",
    tipo: dados.tipo || "Manual",
    status: dados.status || "Liberado",
    observacoes: dados.observacoes || "",
    criadoEm: new Date().toISOString()
  };

  registros.push(novoRegistro);
  await salvarCheckins(registros);

  return novoRegistro;
}

export async function registrarEntradaComercial(dados = {}) {
  const autorizacao = await autorizarCheckinComercial(dados);
  const contrato = autorizacao.contrato || {};
  const servico = autorizacao.servicoContratado || {};
  const registros = await listarCheckins();

  const registro = {
    id: gerarId(),
    alunoId: contrato.alunoId || dados.alunoId || dados.aluno_id || "",
    aluno: contrato.aluno || dados.aluno || autorizacao.aluno?.nome || "",
    matricula: contrato.numeroMatricula || dados.matricula || "",
    matriculaId: contrato.matriculaId || dados.matriculaId || "",
    contratoId: contrato.id || dados.contratoId || "",
    servicoContratadoId: servico.id || "",
    servicoId: servico.servicoId || dados.servicoId || "",
    servico: servico.servico || servico.nome || dados.servico || dados.nomeServico || "",
    modalidade: servico.modalidade || dados.modalidade || "",
    turmaId: servico.turmaId || dados.turmaId || dados.turma_id || "",
    turma: servico.turma || servico.nome || dados.turma || "",
    professor: servico.professor || dados.professor || "",
    data: dados.data || hojeISO(),
    horaEntrada: dados.horaEntrada || horaAtual(),
    horaSaida: dados.horaSaida || "",
    tipo: "Comercial",
    status: autorizacao.autorizado ? "Liberado" : "Bloqueado",
    motivoBloqueio: autorizacao.autorizado ? "" : autorizacao.motivo,
    observacoes: dados.observacoes || dados.observacao || autorizacao.motivo || "",
    criadoEm: new Date().toISOString()
  };

  registros.push(registro);
  await salvarCheckins(registros);

  return { ok: true, autorizado: autorizacao.autorizado, autorizacao, registro };
}

export async function registrarSaida(id) {
  const registros = await listarCheckins();
  const index = registros.findIndex((item) => String(item.id) === String(id));

  if (index === -1) {
    return null;
  }

  registros[index].horaSaida = horaAtual();
  registros[index].atualizadoEm = new Date().toISOString();

  await salvarCheckins(registros);
  return registros[index];
}

export async function atualizarRegistro(id, dados) {
  const registros = await listarCheckins();
  const index = registros.findIndex((item) => String(item.id) === String(id));

  if (index === -1) {
    return null;
  }

  registros[index] = {
    ...registros[index],
    ...dados,
    atualizadoEm: new Date().toISOString()
  };

  await salvarCheckins(registros);
  return registros[index];
}

export async function excluirRegistro(id) {
  const registros = await listarCheckins();
  const registro = await buscarCheckinPorId(id);

  if (!registro) {
    return null;
  }

  await salvarCheckins(registros.filter((item) => String(item.id) !== String(id)));
  return registro;
}
