import * as accessRepo from '../access-engine/access-engine.repository.mjs';
import {
  listarCheckins,
  salvarCheckins,
  buscarCheckinPorId
} from "./checkin.repository.mjs";
import { listarFrequencias, salvarFrequencias } from "../frequencia/frequencia.repository.mjs";
import { lerJsonDuravel } from "../core/persistence/durable-json.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";
import { obterSupabaseAdmin } from "../../config/supabase.mjs";

const ARQUIVOS = {
  contratos: [
    "contratos.json",
    "comercial_contratos.json"
  ],
  servicosContratados: [
    "servicos_contratados.json",
    "comercial_servicos_contratados.json"
  ],
  alunos: ["alunos.json"],
  matriculas: ["matriculas.json"],
  mensalidades: ["mensalidades.json"],
  financeiro: ["financeiro.json"],
  acessos: ["access_logs.json"]
};

const TIMEZONE_SISTEMA = process.env.FUSION_TIMEZONE || "America/Maceio";
let filaSincronizacaoAcessos = Promise.resolve();
let sincronizacaoCheckinEmSegundoPlano = null;
let ultimaSincronizacaoCheckinEm = 0;
const INTERVALO_SINCRONIZACAO_CHECKIN_MS = Math.max(
  Number(process.env.FUSION_CHECKIN_SYNC_INTERVAL_MS || 5000),
  5000
);

async function lerPrimeiroJson(candidatos, padrao = []) {
  for (const colecao of candidatos) {
    try {
      const dados = await lerJsonDuravel(colecao, padrao);
      if (Array.isArray(dados) ? dados.length : dados && Object.keys(dados).length) return dados;
    } catch {}
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

function dataHoraLocal(valor) {
  const data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) {
    return { data: hojeISO(), hora: horaAtual() };
  }

  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_SISTEMA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(data);
    const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
    return {
      data: `${mapa.year}-${mapa.month}-${mapa.day}`,
      hora: `${mapa.hour}:${mapa.minute}`
    };
  } catch {
    return {
      data: data.toISOString().slice(0, 10),
      hora: data.toISOString().slice(11, 16)
    };
  }
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

function tipoPessoaCheckin(log = {}) {
  const tipo = normalizar(log.pessoaTipo || log.pessoa_tipo || log.tipoPessoa || log.tipo_pessoa || "");
  const role = normalizar(log.role || log.perfil || "");

  if (
    tipo === "professor" ||
    tipo === "funcionario" ||
    tipo === "usuario" ||
    tipo === "equipe" ||
    tipo === "colaborador" ||
    ["admin", "professor", "recepcao", "gerente"].includes(role)
  ) return "funcionario";

  return "aluno";
}

function idPessoaCheckin(log = {}) {
  return texto(
    log.pessoaId || log.pessoa_id ||
    log.funcionarioId || log.funcionario_id ||
    log.professorId || log.professor_id ||
    log.usuarioId || log.usuario_id ||
    log.alunoId || log.aluno_id ||
    log.studentId || log.student_id || ""
  );
}

function acessoElegivelParaCheckin(log = {}) {
  const pessoaId = idPessoaCheckin(log);
  const origem = normalizar(log.origem);
  const movimento = normalizar(log.movimento || log.direcao || "entrada") === "saida" ? "saida" : "entrada";
  const fechamentoAdministrativo = movimento === "saida" && origem.includes("checkin-fechamento-administrativo");
  const acessoReal = Boolean(
    log.catraca ||
    origem.includes("portal-aluno") ||
    origem.includes("henry") ||
    origem.includes("biometr") ||
    origem.includes("checkin") ||
    origem.includes("access-engine")
  );
  const diagnostico = origem.includes("teste") || origem.includes("diagnostico") || origem.includes("simulador");
  const fisicoConfirmado = log.physicalConfirmed !== false && log.physical_confirmed !== false;

  // Fechamento administrativo pode encerrar uma sessão aberta no histórico,
  // mas continua não sendo contado como saída física nos KPIs.
  return (
    log.autorizado === true &&
    Boolean(pessoaId) &&
    acessoReal &&
    !diagnostico &&
    (fisicoConfirmado || fechamentoAdministrativo)
  );
}

function localizarPessoaEquipe(usuarios = [], professores = [], pessoaId = "", tipo = "") {
  const alvo = String(pessoaId || "");
  const listaPreferida = normalizar(tipo) === "professor"
    ? [...professores, ...usuarios]
    : [...usuarios, ...professores];

  return listaPreferida.find((p = {}) =>
    String(p.id || p._id || p.usuarioId || p.professorId || p.recordId || "") === alvo
  ) || {};
}

function registroAutomaticoEdge(item = {}) {
  const origem = normalizar(item.origem || "");
  const accessLogId = texto(item.accessLogId || "");
  return (
    origem.includes("fusion-biometria-local") ||
    origem.includes("fusion-edge") ||
    accessLogId.startsWith("edge:")
  );
}

function consolidarRegistrosEdgeDoDia(registros = [], dataAlvo = "") {
  const grupos = new Map();

  registros.forEach((item, indice) => {
    if (!registroAutomaticoEdge(item)) return;
    if (String(item.data || "").slice(0, 10) !== dataAlvo) return;

    const pessoaId = texto(item.pessoaId || item.alunoId || item.aluno_id || "");
    if (!pessoaId) return;

    const chave = `${tipoPessoaCheckin(item)}:${pessoaId}:${dataAlvo}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ item, indice });
  });

  const remover = new Set();
  let consolidados = 0;

  for (const grupo of grupos.values()) {
    if (!grupo.length) continue;

    grupo.sort((a, b) => {
      const aa = `${a.item.data || ""}T${a.item.horaEntrada || ""}|${a.item.criadoEm || ""}`;
      const bb = `${b.item.data || ""}T${b.item.horaEntrada || ""}|${b.item.criadoEm || ""}`;
      return aa.localeCompare(bb);
    });

    const principal = grupo[0].item;
    const eventos = new Set(
      grupo.flatMap(({ item }) => [
        ...(Array.isArray(item.accessEventIds) ? item.accessEventIds : []),
        item.accessLogId,
        item.accessExitLogId
      ]).map(String).filter(Boolean)
    );

    const entradas = grupo.map(({ item }) => texto(item.horaEntrada)).filter(Boolean).sort();
    const saidas = grupo.map(({ item }) => texto(item.horaSaida)).filter(Boolean).sort();

    const movimentos = [];
    grupo.forEach(({ item }) => {
      if (texto(item.horaEntrada)) movimentos.push({ ordem: `${item.data || ""}T${item.horaEntrada}`, tipo: "entrada" });
      if (texto(item.horaSaida)) movimentos.push({ ordem: `${item.data || ""}T${item.horaSaida}`, tipo: "saida" });
    });
    movimentos.sort((a, b) => a.ordem.localeCompare(b.ordem));

    principal.horaEntrada = entradas[0] || principal.horaEntrada || "";
    principal.horaSaida = saidas.at(-1) || "";
    principal.ultimoMovimento = movimentos.at(-1)?.tipo || principal.ultimoMovimento || "entrada";
    principal.accessEventIds = [...eventos];
    principal.atualizadoEm = new Date().toISOString();

    grupo.slice(1).forEach(({ indice }) => remover.add(indice));
    if (grupo.length > 1) consolidados += grupo.length - 1;
  }

  if (remover.size) {
    for (let i = registros.length - 1; i >= 0; i -= 1) {
      if (remover.has(i)) registros.splice(i, 1);
    }
  }

  return consolidados;
}

async function executarSincronizacaoCheckinsComAcessos() {
  const agora = new Date();
  const hoje = dataHoraLocal(agora).data;
  const inicioEdge = new Date(agora.getTime() - (36 * 60 * 60 * 1000)).toISOString();
  const fimEdge = new Date(agora.getTime() + (2 * 60 * 60 * 1000)).toISOString();

  const [logsLegados, alunos, matriculas, usuarios, professores, registros, eventosEdge] = await Promise.all([
    lerPrimeiroJson(ARQUIVOS.acessos, []),
    lerPrimeiroJson(ARQUIVOS.alunos, []),
    lerPrimeiroJson(ARQUIVOS.matriculas, []),
    lerPrimeiroJson(["usuarios.json"], []),
    lerPrimeiroJson(["professores.json"], []),
    listarCheckins(),
    listarEventosEdgeCheckin(inicioEdge, fimEdge).catch((erro) => {
      console.warn(`[Checkin/Historico] ${String(erro?.message || erro).slice(0, 260)}`);
      return null;
    })
  ]);

  const eventosEdgeHoje = (Array.isArray(eventosEdge) ? eventosEdge : [])
    .filter((log) => {
      const momento = log.criadoEm || log.at || log.timestamp || "";
      return momento && dataHoraLocal(momento).data === hoje;
    });

  const logs = eventosEdgeHoje.length
    ? eventosEdgeHoje
    : (Array.isArray(logsLegados) ? logsLegados : []);

  let alterados = consolidarRegistrosEdgeDoDia(registros, hoje);

  if (!logs.length) {
    if (alterados) await salvarCheckins(registros);
    return { importados: 0, saidas: 0, consolidados: alterados };
  }

  const eventosJaProcessados = new Set(
    registros.flatMap((item) => [
      ...(Array.isArray(item.accessEventIds) ? item.accessEventIds : []),
      item.accessLogId,
      item.accessExitLogId
    ]).map(String).filter(Boolean)
  );

  let importados = 0;
  let saidas = 0;

  const ordenados = logs
    .filter(acessoElegivelParaCheckin)
    .sort((a, b) => String(a.criadoEm || a.at || "").localeCompare(String(b.criadoEm || b.at || "")));

  for (const log of ordenados) {
    const accessLogId = texto(log.id || log.eventId || log.event_id);
    if (!accessLogId || eventosJaProcessados.has(accessLogId)) continue;

    const pessoaId = idPessoaCheckin(log);
    const pessoaTipo = tipoPessoaCheckin(log);
    const movimento = normalizar(log.movimento || log.direcao || "entrada") === "saida" ? "saida" : "entrada";
    const momento = log.criadoEm || log.at || log.timestamp || new Date().toISOString();
    const horario = dataHoraLocal(momento);

    let registroDia = registros.find((item) =>
      String(item.data || "").slice(0, 10) === horario.data &&
      String(item.pessoaId || item.alunoId || "") === String(pessoaId) &&
      tipoPessoaCheckin(item) === pessoaTipo &&
      registroAutomaticoEdge(item)
    );

    if (movimento === "saida") {
      if (registroDia) {
        registroDia.horaSaida = horario.hora;
        registroDia.accessExitLogId = registroDia.accessExitLogId || accessLogId;
        registroDia.ultimaSaidaEm = momento;
        registroDia.ultimaMovimentacaoEm = momento;
        registroDia.ultimoMovimento = "saida";
        registroDia.accessEventIds = [...new Set([...(registroDia.accessEventIds || []), accessLogId])];
        registroDia.atualizadoEm = new Date().toISOString();
        saidas += 1;
        alterados += 1;
      }
      eventosJaProcessados.add(accessLogId);
      continue;
    }

    if (registroDia) {
      registroDia.ultimaEntradaEm = momento;
      registroDia.ultimaMovimentacaoEm = momento;
      registroDia.ultimoMovimento = "entrada";
      registroDia.accessEventIds = [...new Set([...(registroDia.accessEventIds || []), accessLogId])];
      registroDia.atualizadoEm = new Date().toISOString();
      eventosJaProcessados.add(accessLogId);
      alterados += 1;
      continue;
    }

    const aluno = pessoaTipo === "aluno" ? (localizarAluno(alunos, pessoaId) || {}) : {};
    const matricula = pessoaTipo === "aluno" ? (localizarMatriculaAtiva(matriculas, {}, pessoaId) || {}) : {};
    const equipe = pessoaTipo === "funcionario" ? localizarPessoaEquipe(usuarios, professores, pessoaId, log.pessoaTipo) : {};

    const origem = texto(log.origem || "catraca");
    const peloPortal = normalizar(origem).includes("portal-aluno");
    const nomePessoa = texto(
      log.pessoaNome || log.alunoNome ||
      aluno.nome || matricula.aluno ||
      equipe.nome || equipe.nomeCompleto || equipe.nome_completo ||
      equipe.usuario || equipe.email ||
      (pessoaTipo === "funcionario" ? "Funcionário" : "")
    );

    const role = normalizar(log.role || equipe.perfil || equipe.role || "");
    const funcaoEquipe = role === "professor"
      ? "Professor"
      : role === "recepcao"
        ? "Recepção"
        : role === "gerente"
          ? "Gerente"
          : "Funcionário";

    registroDia = {
      id: gerarId(),
      pessoaId,
      pessoaTipo,
      role,
      alunoId: pessoaTipo === "aluno" ? pessoaId : "",
      aluno: nomePessoa,
      matricula: pessoaTipo === "aluno"
        ? (log.numeroMatricula || matricula.numero || matricula.numeroMatricula || aluno.numeroMatricula || "")
        : "-",
      matriculaId: pessoaTipo === "aluno" ? (matricula.id || aluno.matriculaId || "") : "",
      plano: pessoaTipo === "aluno" ? (matricula.plano || matricula.nomePlano || aluno.plano || "") : funcaoEquipe,
      planoId: pessoaTipo === "aluno" ? (matricula.planoId || aluno.planoId || "") : "",
      modalidade: pessoaTipo === "aluno" ? "Musculação" : "Equipe",
      turma: pessoaTipo === "aluno" ? "Musculação livre" : "Equipe",
      professor: pessoaTipo === "aluno" ? (aluno.professorNome || aluno.professor_responsavel || "") : "",
      data: horario.data,
      horaEntrada: horario.hora,
      horaSaida: "",
      ultimaEntradaEm: momento,
      ultimaMovimentacaoEm: momento,
      ultimoMovimento: "entrada",
      tipo: peloPortal ? "Catraca pelo App de Treino" : "Catraca",
      status: "Liberado",
      observacoes: `Entrada sincronizada automaticamente do controle de acesso (${origem}).`,
      origem,
      accessLogId,
      accessExitLogId: "",
      accessEventIds: [accessLogId],
      comandoCatracaId: log.catraca?.commandId || log.catraca?.command?.id || "",
      criadoEm: momento,
      sincronizadoEm: new Date().toISOString()
    };

    registros.push(registroDia);
    eventosJaProcessados.add(accessLogId);
    importados += 1;
    alterados += 1;
  }

  if (alterados) await salvarCheckins(registros);
  return { importados, saidas, consolidados: alterados };
}

let sincronizacaoCheckinAtiva = null;
let ultimaSincronizacaoCheckinConcluidaEm = 0;
const JANELA_REUSO_SINCRONIZACAO_CHECKIN_MS = 1000;

async function sincronizarCheckinsComAcessos() {
  if (sincronizacaoCheckinAtiva) return sincronizacaoCheckinAtiva;

  const agora = Date.now();
  if (
    ultimaSincronizacaoCheckinConcluidaEm &&
    agora - ultimaSincronizacaoCheckinConcluidaEm < JANELA_REUSO_SINCRONIZACAO_CHECKIN_MS
  ) {
    return { importados: 0, saidas: 0, reutilizada: true };
  }

  const tarefa = filaSincronizacaoAcessos.then(
    executarSincronizacaoCheckinsComAcessos,
    executarSincronizacaoCheckinsComAcessos
  );

  sincronizacaoCheckinAtiva = tarefa;
  filaSincronizacaoAcessos = tarefa.catch(() => undefined);

  try {
    return await tarefa;
  } finally {
    ultimaSincronizacaoCheckinConcluidaEm = Date.now();
    sincronizacaoCheckinAtiva = null;
  }
}

function dispararSincronizacaoCheckinsEmSegundoPlano() {
  const agora = Date.now();
  if (sincronizacaoCheckinEmSegundoPlano) return;
  if (agora - ultimaSincronizacaoCheckinEm < INTERVALO_SINCRONIZACAO_CHECKIN_MS) return;

  ultimaSincronizacaoCheckinEm = agora;
  sincronizacaoCheckinEmSegundoPlano = sincronizarCheckinsComAcessos()
    .catch((erro) => {
      console.warn(`[Checkin/SyncBackground] ${String(erro?.message || erro).slice(0, 260)}`);
    })
    .finally(() => {
      sincronizacaoCheckinEmSegundoPlano = null;
    });
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

function pendenciasFinanceiras(matriculaId, mensalidades = [], financeiro = []) {
  const data = hojeISO();
  const statusIgnorados = new Set([
    "cancelado", "cancelada",
    "pago", "paga",
    "recebido", "recebida",
    "quitado", "quitada",
    "baixado", "baixada"
  ]);

  const pertenceMatriculaAtiva = (item = {}) =>
    String(item.matriculaId || item.matricula_id || "") === String(matriculaId || "");

  const possuiStatusPendente = (item = {}) => {
    const status = normalizar(item.status);
    return !statusIgnorados.has(status);
  };

  const abertasMensalidades = mensalidades.filter((mensalidade) =>
    pertenceMatriculaAtiva(mensalidade) &&
    possuiStatusPendente(mensalidade) &&
    vencido(mensalidade, data)
  );

  const abertasFinanceiro = financeiro.filter((lancamento) => {
    const tipoReceber = !lancamento.tipo || normalizar(lancamento.tipo).includes("receber");

    return (
      tipoReceber &&
      pertenceMatriculaAtiva(lancamento) &&
      possuiStatusPendente(lancamento) &&
      vencido(lancamento, data)
    );
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
    "treinos_prescritos.json",
    "treinos_integrados.json",
    "treinos.json",
    "treinos-interno.json",
    "treinos_operacional.json"
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

  const pendencias = pendenciasFinanceiras(
    matricula.id,
    mensalidades,
    financeiro
  );
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
  // CHECKIN SYNC AGUARDADA PARA HISTORICO E KPIS 20260826
  // O Historico so e lido depois que os eventos fisicos da catraca foram sincronizados.
  await sincronizarCheckinsComAcessos();
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


async function listarEventosEdgeCheckin(inicioIso, fimIso) {
  const supabase = obterSupabaseAdmin();
  if (!supabase) return null;

  const tenantId = tenantAtual();
  const todos = [];
  const tamanhoPagina = 1000;

  for (let pagina = 0; pagina < 100; pagina += 1) {
    const inicio = pagina * tamanhoPagina;
    const fim = inicio + tamanhoPagina - 1;

    const { data, error } = await supabase
      .from("fusion_edge_access_events")
      .select("event_id,student_id,direction,authorized,physical_confirmed,occurred_at,source,payload")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", inicioIso)
      .lt("occurred_at", fimIso)
      .order("occurred_at", { ascending: true })
      .range(inicio, fim);

    if (error) {
      throw new Error(`Falha ao consultar eventos reais da catraca: ${error.message}`);
    }

    const paginaDados = Array.isArray(data) ? data : [];
    todos.push(...paginaDados);
    if (paginaDados.length < tamanhoPagina) break;
  }

  return todos.map((row = {}) => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {};
    const tipoInformado = String(payload.personType || payload.person_type || "").trim().toLowerCase();
    const role = String(payload.role || "").trim().toLowerCase();
    const pessoaTipo = tipoInformado || (role && role !== "aluno" ? "usuario" : "aluno");

    return {
      id: `edge:${row.event_id || ""}`,
      criadoEm: row.occurred_at || "",
      origem: row.source || "fusion-biometria-local",
      direcao: row.direction || "entrada",
      autorizado: row.authorized === true,
      physicalConfirmed: row.physical_confirmed === true,
      pessoaId: row.student_id || "",
      alunoId: pessoaTipo === "aluno" ? (row.student_id || "") : "",
      pessoaTipo,
      role,
      motivo: payload.reason || "",
      edge: true
    };
  });
}

export async function obterResumoCheckin() {
  // O resumo operacional precisa usar exatamente o mesmo estado ja sincronizado do Historico.
  await sincronizarCheckinsComAcessos();

  const hoje = dataHoraLocal(new Date()).data;
  const mes = hoje.slice(0, 7);
  const [anoMes, numeroMes] = mes.split("-").map(Number);

  const inicioConsulta = new Date(Date.UTC(anoMes, numeroMes - 1, 1) - (36 * 60 * 60 * 1000)).toISOString();
  const fimConsulta = new Date(Date.UTC(anoMes, numeroMes, 1) + (36 * 60 * 60 * 1000)).toISOString();

  const [registros, eventosEdge, alunosCadastro, usuariosCadastro, professoresCadastro] = await Promise.all([
    listarCheckins(),
    listarEventosEdgeCheckin(inicioConsulta, fimConsulta).catch((erro) => {
      console.warn(`[Checkin/Resumo] ${String(erro?.message || erro).slice(0, 260)}`);
      return null;
    }),
    lerPrimeiroJson(ARQUIVOS.alunos, []),
    lerPrimeiroJson(["usuarios.json"], []),
    lerPrimeiroJson(["professores.json"], [])
  ]);

  const logsAcesso = Array.isArray(eventosEdge) && eventosEdge.length
    ? eventosEdge
    : await accessRepo.listarLogs().catch(() => []);

  const dataDoLog = (log = {}) => {
    const bruto = String(log.criadoEm || log.createdAt || log.created_at || log.dataHora || log.timestamp || log.data || "").trim();
    if (!bruto) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
    const data = new Date(bruto);
    return Number.isNaN(data.getTime()) ? bruto.slice(0, 10) : dataHoraLocal(data).data;
  };

  const ehAcessoReal = (log = {}) => {
    const origem = normalizar(log.origem || "");
    const diagnostico = origem.includes("teste") || origem.includes("diagnostico") || origem.includes("simulador");
    const real = Boolean(
      log.catraca ||
      origem.includes("portal-aluno") ||
      origem.includes("henry") ||
      origem.includes("biometr") ||
      origem.includes("reconhecimento-facial") ||
      origem.includes("checkin") ||
      origem.includes("access-engine")
    );
    return real && !diagnostico;
  };

  const tipoPessoa = (log = {}) => {
    const tipo = normalizar(log.pessoaTipo || log.pessoa_tipo || log.tipoPessoa || log.tipo_pessoa || "");
    const motivo = normalizar(log.motivo || "");
    if (
      tipo === "professor" ||
      tipo === "funcionario" ||
      tipo === "usuario" ||
      tipo === "equipe" ||
      tipo === "colaborador" ||
      motivo.includes("acesso-professor") ||
      motivo.includes("acesso-funcionario")
    ) return "funcionario";
    return "aluno";
  };

  const pessoaId = (log = {}) => texto(
    log.pessoaId || log.pessoa_id ||
    log.funcionarioId || log.funcionario_id ||
    log.professorId || log.professor_id ||
    log.usuarioId || log.usuario_id ||
    log.alunoId || log.aluno_id || log.identificador || ""
  );

  const direcao = (log = {}) => {
    const valor = normalizar(log.direcao || log.sentido || log.movimento || "");
    return valor.includes("saida") ? "saida" : "entrada";
  };

  const instante = (log = {}, indice = 0) => {
    const bruto = log.criadoEm || log.createdAt || log.created_at || log.dataHora || log.timestamp || "";
    const ms = Date.parse(bruto);
    return Number.isFinite(ms) ? ms : indice;
  };

  const logsHoje = (Array.isArray(logsAcesso) ? logsAcesso : [])
    .filter((log) => dataDoLog(log) === hoje)
    .filter(ehAcessoReal);

  const negados = logsHoje.filter((log) => log.autorizado === false);

  const tipoRegistro = (item = {}) => {
    const tipo = normalizar(item.pessoaTipo || item.pessoa_tipo || item.tipoPessoa || item.tipo_pessoa || "");
    const role = normalizar(item.role || item.perfil || "");
    const plano = normalizar(item.plano || "");
    const modalidade = normalizar(item.modalidade || "");

    if (
      tipo === "professor" ||
      tipo === "funcionario" ||
      tipo === "usuario" ||
      tipo === "equipe" ||
      tipo === "colaborador" ||
      ["admin", "professor", "recepcao", "gerente"].includes(role) ||
      plano.includes("funcionario") ||
      modalidade === "equipe"
    ) return "funcionario";

    return "aluno";
  };

  const idRegistro = (item = {}) => texto(
    item.pessoaId || item.pessoa_id ||
    item.alunoId || item.aluno_id ||
    item.matriculaId || item.matricula_id ||
    item.matricula || item.aluno || item.id || ""
  );

  // PAINEL OPERACIONAL CHECKIN 6 COLUNAS 20260826
  const nomeDoCadastro = (id = "", tipo = "aluno") => {
    const alvo = texto(id);
    if (!alvo) return "";

    const localizar = (lista = []) => (Array.isArray(lista) ? lista : []).find((p = {}) =>
      texto(p.id || p._id || p.recordId || p.alunoId || p.usuarioId || p.professorId) === alvo
    ) || {};

    if (tipo === "funcionario") {
      const usuario = localizar(usuariosCadastro);
      const professor = localizar(professoresCadastro);
      const base = Object.keys(usuario).length ? usuario : professor;
      return texto(base.nome || base.nomeCompleto || base.nome_completo || base.usuario || base.email || "");
    }

    const aluno = localizar(alunosCadastro);
    return texto(aluno.nome || aluno.nomeCompleto || aluno.nome_completo || aluno.alunoNome || aluno.aluno || "");
  };

  const nomeRegistro = (item = {}, tipo = tipoRegistro(item)) => {
    const id = idRegistro(item);
    return texto(
      nomeDoCadastro(id, tipo) ||
      item.pessoaNome || item.pessoa_nome ||
      item.alunoNome || item.aluno_nome ||
      item.aluno || item.pessoa || item.nome || ""
    ) || (tipo === "funcionario" ? "Funcionário" : "Aluno");
  };

  const listaUnicaRegistros = (lista = [], tipoDesejado = "") => {
    const mapa = new Map();

    (Array.isArray(lista) ? lista : []).forEach((item) => {
      const tipo = tipoRegistro(item);
      if (tipoDesejado && tipo !== tipoDesejado) return;

      const id = idRegistro(item);
      if (!id) return;

      const chave = `${tipo}:${id}`;
      if (!mapa.has(chave)) mapa.set(chave, { id, tipo, nome: nomeRegistro(item, tipo) });
    });

    return [...mapa.values()].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    );
  };

  const registrosHoje = registros.filter(
    (item) => String(item.data || "").slice(0, 10) === hoje
  );

  const entradasRegistros = registrosHoje.filter(
    (item) => item.status === "Liberado" && texto(item.horaEntrada)
  );

  const saidasRegistros = entradasRegistros.filter(
    (item) => texto(item.horaSaida)
  );

  const alunosEntraramHoje = new Set(
    entradasRegistros
      .filter((item) => tipoRegistro(item) === "aluno")
      .map(idRegistro)
      .filter(Boolean)
  ).size;

  const alunosSairamHoje = new Set(
    saidasRegistros
      .filter((item) => tipoRegistro(item) === "aluno")
      .map(idRegistro)
      .filter(Boolean)
  ).size;

  const entradasHoje = alunosEntraramHoje;
  const saidasHoje = alunosSairamHoje;

  const funcionariosEntraramHoje = new Set(
    entradasRegistros
      .filter((item) => tipoRegistro(item) === "funcionario")
      .map(idRegistro)
      .filter(Boolean)
  ).size;

  // PRESENCA COERENTE COM HISTORICO CHECKIN 20260826
  // Usa entrada/saida visiveis no Historico como base e os timestamps de
  // ultima movimentacao apenas para distinguir uma reentrada posterior.
  const instanteMovimentoRegistro = (item = {}, tipo = "") => {
    const candidatos = tipo === "entrada"
      ? [
          item.ultimaEntradaEm,
          texto(item.data) && texto(item.horaEntrada)
            ? `${texto(item.data).slice(0, 10)}T${texto(item.horaEntrada)}`
            : ""
        ]
      : [
          item.ultimaSaidaEm,
          texto(item.data) && texto(item.horaSaida)
            ? `${texto(item.data).slice(0, 10)}T${texto(item.horaSaida)}`
            : ""
        ];

    let maior = Number.NEGATIVE_INFINITY;

    candidatos.filter(Boolean).forEach((valor) => {
      const ms = Date.parse(valor);
      if (Number.isFinite(ms) && ms > maior) maior = ms;
    });

    return maior;
  };

  const ordemEfetivaRegistro = (item = {}) => {
    const candidatos = [
      instanteMovimentoRegistro(item, "entrada"),
      instanteMovimentoRegistro(item, "saida"),
      Date.parse(item.ultimaMovimentacaoEm || "")
    ].filter(Number.isFinite);

    return candidatos.length ? Math.max(...candidatos) : 0;
  };

  const presentePeloHistorico = (item = {}) => {
    const temEntrada = Boolean(texto(item.horaEntrada));
    const temSaida = Boolean(texto(item.horaSaida));

    if (!temEntrada) return false;
    if (!temSaida) return true;

    const entradaMs = instanteMovimentoRegistro(item, "entrada");
    const saidaMs = instanteMovimentoRegistro(item, "saida");

    if (Number.isFinite(entradaMs) && Number.isFinite(saidaMs)) {
      return entradaMs > saidaMs;
    }

    return false;
  };

  const ultimoRegistroPessoa = new Map();

  entradasRegistros.forEach((item, indice) => {
    const id = idRegistro(item);
    if (!id) return;

    const tipo = tipoRegistro(item);
    const chave = `${tipo}:${id}`;
    const ordem = ordemEfetivaRegistro(item);
    const atual = ultimoRegistroPessoa.get(chave);

    if (!atual || ordem >= atual.ordem) {
      ultimoRegistroPessoa.set(chave, {
        id,
        tipo,
        nome: nomeRegistro(item, tipo),
        ordem,
        presente: presentePeloHistorico(item)
      });
    }
  });

  const presentes = [...ultimoRegistroPessoa.values()].filter((item) => item.presente);
  const alunosPresentesAgora = presentes.filter((item) => item.tipo === "aluno").length;
  const funcionariosPresentesAgora = presentes.filter((item) => item.tipo === "funcionario").length;

  const idsBloqueados = new Set();
  const pessoasBloqueadas = new Map();

  negados.forEach((log) => {
    const id = pessoaId(log) || texto(log.identificador || log.id || "");
    if (!id) return;

    idsBloqueados.add(id);
    const tipo = tipoPessoa(log);
    const nome = texto(
      nomeDoCadastro(id, tipo) ||
      log.pessoaNome || log.pessoa_nome ||
      log.alunoNome || log.aluno_nome || log.nome || ""
    ) || (tipo === "funcionario" ? "Funcionário" : "Aluno");

    if (!pessoasBloqueadas.has(id)) pessoasBloqueadas.set(id, { id, tipo, nome });
  });

  registrosHoje
    .filter((item) => item.status === "Bloqueado")
    .forEach((item) => {
      const id = idRegistro(item);
      if (!id) return;

      idsBloqueados.add(id);
      const tipo = tipoRegistro(item);
      if (!pessoasBloqueadas.has(id)) {
        pessoasBloqueadas.set(id, { id, tipo, nome: nomeRegistro(item, tipo) });
      }
    });

  const bloqueadosHoje = idsBloqueados.size;

  const registrosMesLiberados = registros.filter((item) =>
    String(item.data || "").slice(0, 7) === mes &&
    item.status === "Liberado" &&
    texto(item.horaEntrada)
  );

  const pessoasMesMapa = new Map();

  registrosMesLiberados.forEach((item) => {
    const id = idRegistro(item);
    if (!id) return;

    const tipo = tipoRegistro(item);
    const chave = `${tipo}:${id}`;

    if (!pessoasMesMapa.has(chave)) {
      pessoasMesMapa.set(chave, { id, tipo, nome: nomeRegistro(item, tipo) });
    }
  });

  const pessoasMes = pessoasMesMapa.size;

  return {
    total: registros.length,
    hoje: registrosHoje.length,
    liberados: registros.filter((item) => item.status === "Liberado").length,
    bloqueados: registros.filter((item) => item.status === "Bloqueado").length,
    entradasHoje,
    alunosEntraramHoje,
    funcionariosEntraramHoje,
    alunosPresentesAgora,
    funcionariosPresentesAgora,
    pessoasPresentesAgora: alunosPresentesAgora + funcionariosPresentesAgora,
    saidasHoje,
    bloqueadosHoje,
    pessoasMes,
    listas: {
      entradasHoje: listaUnicaRegistros(entradasRegistros, "aluno"),
      alunosPresentes: presentes
        .filter((item) => item.tipo === "aluno")
        .map((item) => ({ id: item.id, tipo: item.tipo, nome: item.nome }))
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")),
      funcionariosPresentes: presentes
        .filter((item) => item.tipo === "funcionario")
        .map((item) => ({ id: item.id, tipo: item.tipo, nome: item.nome }))
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")),
      saidasHoje: listaUnicaRegistros(saidasRegistros, "aluno"),
      bloqueadosHoje: [...pessoasBloqueadas.values()]
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")),
      pessoasMes: [...pessoasMesMapa.values()]
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
    }
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

  const instanteSaida = new Date().toISOString();
  registros[index].horaSaida = horaAtual();
  registros[index].ultimaSaidaEm = instanteSaida;
  registros[index].ultimaMovimentacaoEm = instanteSaida;
  registros[index].ultimoMovimento = "saida";
  registros[index].atualizadoEm = instanteSaida;
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
