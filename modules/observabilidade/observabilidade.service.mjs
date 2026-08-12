import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { tenantAtual } from "../core/persistence/tenant-context.mjs";
import { criarNotificacao } from "../notificacoes/notificacoes.service.mjs";

const EVENTOS_COLECAO = "observabilidade_eventos";
const ALERTAS_NOTIFICAVEIS = new Set(["critico", "alto"]);
let notificadorTimer = null;
let notificadorExecutando = false;
let notificadorIntervaloMs = null;
let ultimoNotificadorResultado = null;
let ultimoNotificadorErro = "";

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function texto(valor, limite = 500) {
  return String(valor ?? "").trim().slice(0, limite);
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseMs(valor) {
  const raw = texto(valor, 80);
  if (!raw) return null;
  const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function iso(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function dataISO(valor) {
  return texto(valor, 80).slice(0, 10);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function status(item = {}) {
  return normalizar(item.status || item.situacao || item.estado || "");
}

function finalizado(item = {}) {
  return ["pago", "paga", "recebido", "recebida", "quitado", "quitada", "baixado", "baixada", "cancelado", "cancelada", "estornado", "estornada"].includes(status(item));
}

function aberto(item = {}) {
  return !finalizado(item) && !["programado", "programada", "agendado", "agendada", "previsto", "prevista"].includes(status(item));
}

function valor(item = {}) {
  const n = Number(String(item.valorRestante ?? item.saldoRestante ?? item.valor ?? item.total ?? 0).replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function agenteId(agent = {}) {
  return texto(agent.agent_id || agent.agentId || agent.id, 120);
}

function ultimoContatoAgente(agent = {}) {
  return parseMs(agent.last_seen_at || agent.lastSeenAt || agent.updatedAt || agent.atualizadoEm || agent.created_at);
}

function commandCreatedAt(command = {}) {
  return parseMs(command.createdAt || command.created_at);
}

function commandExpiresAt(command = {}) {
  return parseMs(command.expiresAt || command.expires_at);
}

function logCriadoEm(log = {}) {
  return parseMs(log.criadoEm || log.createdAt || log.created_at || log.timestamp);
}

function ordenadoRecente(items, getMs) {
  return [...items].sort((a, b) => (getMs(b) || 0) - (getMs(a) || 0));
}

function montarAgentes(agents, now, onlineMs) {
  const itens = ordenadoRecente(agents, ultimoContatoAgente).map(agent => {
    const lastMs = ultimoContatoAgente(agent);
    const idadeMs = Number.isFinite(lastMs) ? now - lastMs : null;
    const online = Number.isFinite(idadeMs) && idadeMs <= onlineMs;
    const details = agent.details && typeof agent.details === "object" ? agent.details : {};
    return {
      agentId: agenteId(agent),
      tenantId: texto(agent.tenant_id || agent.tenantId || details.tenantId || details.tenant_id, 120),
      equipmentIds: Array.isArray(agent.equipment_ids) ? agent.equipment_ids : (Array.isArray(agent.equipmentIds) ? agent.equipmentIds : []),
      online,
      status: texto(agent.status || details.state || details.status || (online ? "online" : "offline"), 80),
      ultimoContato: iso(lastMs),
      idadeSegundos: Number.isFinite(idadeMs) ? Math.max(0, Math.round(idadeMs / 1000)) : null
    };
  });

  return {
    total: itens.length,
    online: itens.filter(item => item.online).length,
    offline: itens.filter(item => !item.online).length,
    semContato: itens.filter(item => !item.ultimoContato).length,
    itens: itens.slice(0, 10)
  };
}

function montarComandos(commands, now) {
  const itens = lista(commands);
  const falhos = itens.filter(item => status(item) === "failed" || texto(item.error));
  const expirados = itens.filter(item => !["completed", "failed"].includes(status(item)) && Number.isFinite(commandExpiresAt(item)) && commandExpiresAt(item) < now);
  const pendentesAntigos = itens.filter(item => ["pending", "processing"].includes(status(item)) && Number.isFinite(commandCreatedAt(item)) && now - commandCreatedAt(item) > 120000);
  return {
    total: itens.length,
    pendentes: itens.filter(item => status(item) === "pending").length,
    processando: itens.filter(item => status(item) === "processing").length,
    concluidos: itens.filter(item => status(item) === "completed").length,
    falhos: falhos.length,
    expirados: expirados.length,
    pendentesAntigos: pendentesAntigos.length,
    ultimasFalhas: ordenadoRecente(falhos, commandCreatedAt).slice(0, 5).map(item => ({
      id: item.id,
      agentId: item.agentId || item.agent_id,
      equipmentId: item.equipmentId || item.equipment_id,
      erro: texto(item.error || item.erro || item.result?.erro || item.result?.error, 300),
      criadoEm: iso(commandCreatedAt(item)),
      finalizadoEm: iso(parseMs(item.finishedAt || item.finished_at))
    }))
  };
}

function montarAcessos(logs) {
  const hoje = hojeISO();
  const deHoje = logs.filter(log => dataISO(log.criadoEm || log.createdAt || log.timestamp) === hoje);
  const bloqueados = deHoje.filter(log => log.autorizado === false);
  const falhasCatraca = logs.filter(log =>
    log.catraca?.ok === false ||
    normalizar(log.motivo).includes("comando nao foi enfileirado") ||
    normalizar(log.motivo).includes("comando n") && normalizar(log.motivo).includes("enfileirado") ||
    texto(log.catraca?.erro || log.catraca?.error)
  );
  return {
    logsHoje: deHoje.length,
    liberadosHoje: deHoje.filter(log => log.autorizado === true).length,
    bloqueadosHoje: bloqueados.length,
    falhasCatraca: falhasCatraca.length,
    ultimosBloqueios: ordenadoRecente(bloqueados, logCriadoEm).slice(0, 5).map(log => ({
      id: log.id,
      alunoId: log.alunoId || null,
      alunoNome: log.alunoNome || "",
      motivo: texto(log.motivo, 250),
      criadoEm: iso(logCriadoEm(log))
    })),
    ultimasFalhasCatraca: ordenadoRecente(falhasCatraca, logCriadoEm).slice(0, 5).map(log => ({
      id: log.id,
      motivo: texto(log.motivo || log.catraca?.erro || log.catraca?.error, 250),
      commandId: log.catraca?.commandId || log.catraca?.command?.id || "",
      criadoEm: iso(logCriadoEm(log))
    }))
  };
}

function montarCobranca({ cobrancaLog, financeiro, mensalidades }) {
  const hoje = hojeISO();
  const falhasLog = cobrancaLog.filter(item => item.sucesso === false || item.ok === false || texto(item.erro || item.error));
  const financeiroVencido = financeiro.filter(item => aberto(item) && dataISO(item.vencimento || item.dataVencimento || item.data_vencimento) && dataISO(item.vencimento || item.dataVencimento || item.data_vencimento) < hoje);
  const mensalidadesVencidas = mensalidades.filter(item => aberto(item) && dataISO(item.vencimento || item.dataVencimento || item.data_vencimento) && dataISO(item.vencimento || item.dataVencimento || item.data_vencimento) < hoje);
  const programadas = mensalidades.filter(item => ["programado", "programada", "agendado", "agendada", "previsto", "prevista"].includes(status(item)) || item.programada === true);
  return {
    logs: cobrancaLog.length,
    falhasLog: falhasLog.length,
    financeiroVencido: financeiroVencido.length,
    valorFinanceiroVencido: Number(financeiroVencido.reduce((total, item) => total + valor(item), 0).toFixed(2)),
    mensalidadesVencidas: mensalidadesVencidas.length,
    mensalidadesProgramadas: programadas.length,
    ultimasFalhas: ordenadoRecente(falhasLog, item => parseMs(item.criadoEm || item.createdAt || item.data)).slice(0, 5).map(item => ({
      acao: texto(item.acao, 120),
      alunoId: item.alunoId || "",
      matriculaId: item.matriculaId || "",
      erro: texto(item.erro || item.error || item.motivo, 300),
      criadoEm: iso(parseMs(item.criadoEm || item.createdAt || item.data))
    }))
  };
}

function montarAlertas({ agentes, comandos, acessos, cobranca }) {
  const alertas = [];
  if (agentes.total > 0 && agentes.online === 0) {
    alertas.push({ nivel: "critico", codigo: "ACCESS_AGENT_OFFLINE", mensagem: "Nenhum agente de catraca esta online." });
  }
  if (comandos.falhos > 0 || comandos.expirados > 0) {
    alertas.push({ nivel: "critico", codigo: "ACCESS_COMMAND_FAILURES", mensagem: "Ha comandos de catraca falhos ou expirados." });
  }
  if (comandos.pendentesAntigos > 0) {
    alertas.push({ nivel: "alto", codigo: "ACCESS_COMMAND_STALE", mensagem: "Ha comandos de catraca pendentes ha mais de 2 minutos." });
  }
  if (acessos.falhasCatraca > 0) {
    alertas.push({ nivel: "alto", codigo: "ACCESS_RELEASE_QUEUE_FAILURE", mensagem: "Ha falhas recentes de enfileiramento/liberacao da catraca." });
  }
  if (cobranca.falhasLog > 0) {
    alertas.push({ nivel: "alto", codigo: "BILLING_JOB_FAILURE", mensagem: "Ha falhas registradas no motor de cobranca." });
  }
  if (cobranca.financeiroVencido > 0 || cobranca.mensalidadesVencidas > 0) {
    alertas.push({ nivel: "medio", codigo: "BILLING_OVERDUE", mensagem: "Ha cobrancas vencidas em aberto para acompanhamento." });
  }
  return alertas;
}

function prioridadeNotificacao(nivel = "") {
  return nivel === "critico" || nivel === "alto" ? "alta" : "normal";
}

function chaveEvento({ tenantId, alerta = {}, data = hojeISO() }) {
  return [
    "observabilidade",
    tenantId || "tenant",
    alerta.codigo || "alerta",
    data
  ].join(":");
}

function tituloAlerta(alerta = {}) {
  const codigo = texto(alerta.codigo, 120).replace(/_/g, " ");
  const nivel = texto(alerta.nivel, 40).toUpperCase();
  return `${nivel}: ${codigo}`;
}

function resumoEvento(alerta = {}, observabilidade = {}) {
  const partes = [
    alerta.mensagem,
    `Agentes online: ${observabilidade.agentes?.online ?? 0}/${observabilidade.agentes?.total ?? 0}`,
    `Comandos falhos/expirados: ${(observabilidade.accessBridge?.falhos ?? 0) + (observabilidade.accessBridge?.expirados ?? 0)}`,
    `Falhas de catraca: ${observabilidade.acessos?.falhasCatraca ?? 0}`,
    `Falhas de cobranca: ${observabilidade.cobranca?.falhasLog ?? 0}`
  ];
  return partes.filter(Boolean).join(" | ");
}

function flagAtiva(valor) {
  return ["1", "true", "sim", "yes", "on"].includes(String(valor || "").trim().toLowerCase());
}

async function registrarEventosOperacionais(observabilidade = {}) {
  const tenantId = observabilidade.tenantId || tenantAtual();
  const hoje = hojeISO();
  const agora = new Date().toISOString();
  const alertas = (observabilidade.alertas || []).filter(alerta => ALERTAS_NOTIFICAVEIS.has(alerta.nivel));
  if (!alertas.length) return [];

  return executarTransacaoJson(async () => {
    const eventos = await lerJsonDuravel(EVENTOS_COLECAO, []);
    const lista = Array.isArray(eventos) ? eventos : [];
    const registrados = [];

    for (const alerta of alertas) {
      const eventoId = chaveEvento({ tenantId, alerta, data: hoje });
      let evento = lista.find(item => item.eventoId === eventoId);
      if (evento) {
        evento.ocorrencias = Number(evento.ocorrencias || 0) + 1;
        evento.ultimoAlertaEm = agora;
        evento.mensagem = texto(alerta.mensagem, 600);
        evento.resumo = resumoEvento(alerta, observabilidade);
        evento.atualizadoEm = agora;
      } else {
        evento = {
          id: eventoId,
          eventoId,
          tenantId,
          tipo: "observabilidade",
          codigo: texto(alerta.codigo, 120),
          nivel: texto(alerta.nivel, 40),
          titulo: tituloAlerta(alerta),
          mensagem: texto(alerta.mensagem, 600),
          resumo: resumoEvento(alerta, observabilidade),
          primeiroAlertaEm: agora,
          ultimoAlertaEm: agora,
          ocorrencias: 1,
          status: "aberto",
          criadoEm: agora,
          atualizadoEm: agora
        };
        lista.unshift(evento);
      }
      registrados.push(evento);
    }

    await salvarJsonDuravel(EVENTOS_COLECAO, lista.slice(0, 1000));
    return registrados;
  }, { operacaoId: `observabilidade-eventos-${tenantId}-${hoje}` });
}

async function criarNotificacoesEventos(eventos = []) {
  const notificacoes = [];
  for (const evento of eventos) {
    const notificacao = await criarNotificacao({
      eventoId: evento.eventoId,
      tipo: "observabilidade",
      prioridade: prioridadeNotificacao(evento.nivel),
      titulo: evento.titulo,
      mensagem: evento.resumo || evento.mensagem,
      link: "/pages/dashboard/index.html",
      referenciaId: evento.eventoId,
      destinatarios: ["admin", "gerente"]
    });
    notificacoes.push(notificacao);
  }
  return notificacoes;
}

export async function observabilidadeSistema(opcoes = {}) {
  const now = Date.now();
  const onlineMs = Math.max(5000, Math.min(300000, Number(opcoes.onlineMs || process.env.FUSION_OBSERVABILITY_AGENT_ONLINE_MS || 30000)));
  const [
    agents,
    commands,
    accessLogs,
    cobrancaLog,
    financeiro,
    mensalidades
  ] = await Promise.all([
    lerJsonDuravel("access_bridge_agents.json", []),
    lerJsonDuravel("access_bridge_commands.json", []),
    lerJsonDuravel("access_logs.json", []),
    lerJsonDuravel("cobranca_log.json", []),
    lerJsonDuravel("financeiro.json", []),
    lerJsonDuravel("mensalidades.json", [])
  ]);

  const agentes = montarAgentes(lista(agents), now, onlineMs);
  const accessBridge = montarComandos(lista(commands), now);
  const acessos = montarAcessos(lista(accessLogs));
  const cobranca = montarCobranca({
    cobrancaLog: lista(cobrancaLog),
    financeiro: lista(financeiro),
    mensalidades: lista(mensalidades)
  });
  const alertas = montarAlertas({ agentes, comandos: accessBridge, acessos, cobranca });
  const criticos = alertas.filter(item => item.nivel === "critico");

  return {
    ok: criticos.length === 0,
    modulo: "observabilidade",
    tenantId: tenantAtual(),
    timestamp: new Date(now).toISOString(),
    janela: {
      agenteOnlineMs: onlineMs,
      hoje: hojeISO()
    },
    resumo: {
      alertas: alertas.length,
      criticos: criticos.length,
      agentesOnline: agentes.online,
      comandosFalhosOuExpirados: accessBridge.falhos + accessBridge.expirados,
      falhasCatraca: acessos.falhasCatraca,
      falhasCobranca: cobranca.falhasLog
    },
    agentes,
    accessBridge,
    acessos,
    cobranca,
    alertas
  };
}

export async function notificarAlertasObservabilidade(opcoes = {}) {
  const observabilidade = await observabilidadeSistema(opcoes);
  const eventos = await registrarEventosOperacionais(observabilidade);
  const notificacoes = await criarNotificacoesEventos(eventos);
  return {
    ok: true,
    modulo: "observabilidade",
    tenantId: observabilidade.tenantId,
    timestamp: new Date().toISOString(),
    alertasDetectados: observabilidade.alertas.length,
    eventosRegistrados: eventos.length,
    notificacoesCriadasOuAtualizadas: notificacoes.length,
    eventos,
    notificacoes
  };
}

function intervaloNotificadorMs(valor = process.env.FUSION_OBSERVABILITY_NOTIFY_INTERVAL_MS) {
  const n = Number(valor || 15 * 60 * 1000);
  const minimo = flagAtiva(process.env.FUSION_OBSERVABILITY_NOTIFY_TEST_INTERVALS) || process.env.NODE_ENV === "test" ? 200 : 60 * 1000;
  if (!Number.isFinite(n)) return 15 * 60 * 1000;
  return Math.max(minimo, Math.min(24 * 60 * 60 * 1000, Math.round(n)));
}

function atrasoInicialNotificadorMs(intervalo) {
  const minimo = flagAtiva(process.env.FUSION_OBSERVABILITY_NOTIFY_TEST_INTERVALS) || process.env.NODE_ENV === "test" ? 200 : 1000;
  return Math.min(5000, Math.max(minimo, Math.floor(intervalo / 4)));
}

export async function executarNotificadorObservabilidade({ origem = "agendador-observabilidade" } = {}) {
  if (notificadorExecutando) return ultimoNotificadorResultado || { ok: true, aguardando: true };
  notificadorExecutando = true;
  try {
    const resultado = await notificarAlertasObservabilidade({ origem });
    ultimoNotificadorResultado = {
      ...resultado,
      executadoEm: new Date().toISOString()
    };
    ultimoNotificadorErro = "";
    return ultimoNotificadorResultado;
  } catch (erro) {
    ultimoNotificadorErro = erro.message || String(erro);
    throw erro;
  } finally {
    notificadorExecutando = false;
  }
}

export function iniciarNotificadorObservabilidade({ ativo = false, executarAoIniciar = true, intervaloMs = undefined } = {}) {
  if (notificadorTimer) {
    return {
      ativo: true,
      jaIniciado: true,
      intervaloMs: notificadorIntervaloMs || intervaloNotificadorMs(intervaloMs),
      ultimoResultado: ultimoNotificadorResultado,
      ultimoErro: ultimoNotificadorErro
    };
  }
  if (!ativo) {
    return { ativo: false, intervaloMs: intervaloNotificadorMs(intervaloMs), ultimoResultado: null, ultimoErro: "" };
  }

  const intervalo = intervaloNotificadorMs(intervaloMs);
  notificadorIntervaloMs = intervalo;
  const executar = () => {
    executarNotificadorObservabilidade().catch(erro => {
      console.error(`[Observabilidade] Falha ao notificar alertas: ${erro.message}`);
    });
  };

  if (executarAoIniciar) setTimeout(executar, atrasoInicialNotificadorMs(intervalo)).unref?.();
  notificadorTimer = setInterval(executar, intervalo);
  notificadorTimer.unref?.();
  return { ativo: true, intervaloMs: intervalo, ultimoResultado: ultimoNotificadorResultado, ultimoErro: ultimoNotificadorErro };
}

export function statusNotificadorObservabilidade() {
  return {
    ativo: Boolean(notificadorTimer),
    executando: notificadorExecutando,
    intervaloMs: notificadorIntervaloMs,
    ultimoResultado: ultimoNotificadorResultado,
    ultimoErro: ultimoNotificadorErro
  };
}
