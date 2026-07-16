import crypto from "node:crypto";
import { lerJsonDuravel, salvarJsonDuravel, executarTransacaoJson } from "../core/persistence/durable-json.mjs";
import { buscarAlunoPorId } from "../alunos/alunos.repository.mjs";
import { avaliarAcessoAluno } from "../access-engine/access-engine.service.mjs";

const COLECAO_CADASTROS = "reconhecimento_facial_cadastros";
const COLECAO_EVENTOS = "reconhecimento_facial_eventos";
const TEMPO_TAREFA_MS = Math.max(10_000, Math.min(60_000, Number(process.env.FACIAL_TASK_TIMEOUT_MS || 35_000)));
const MAX_IMAGEM_BYTES = 1_500_000;
const tarefas = new Map();
const fila = [];
let agenteFacial = { vistoEm: null, estado: "offline", versao: "", motor: null };

function agora() { return new Date().toISOString(); }
function texto(valor, limite = 300) { return String(valor ?? "").trim().slice(0, limite); }
function numero(valor, padrao = 0) { const n = Number(valor); return Number.isFinite(n) ? n : padrao; }
function booleano(valor, padrao = false) {
  if (valor === undefined || valor === null || valor === "") return padrao;
  return ["1", "true", "sim", "yes", "on"].includes(String(valor).toLowerCase());
}
function erro(mensagem, status = 400) { const e = new Error(mensagem); e.status = status; throw e; }

export function configuracaoFacial() {
  return {
    habilitado: booleano(process.env.FACIAL_ENABLED, true),
    liberarCatraca: booleano(process.env.FACIAL_RELEASE_ENABLED, false),
    similaridadeMinima: Math.max(0.3, Math.min(0.95, numero(process.env.FACIAL_SIMILARITY_THRESHOLD, 0.45))),
    movimentoMinimo: Math.max(4, Math.min(30, numero(process.env.FACIAL_LIVENESS_MIN_YAW, 8))),
    terminalConfigurado: Boolean(segredoTerminal())
  };
}

function segredoTerminal() {
  const configurado = texto(process.env.FACIAL_TERMINAL_TOKEN, 500);
  if (configurado.length > 15) return configurado;
  const agente = texto(process.env.ACCESS_AGENT_TOKEN, 500);
  return agente.length > 15 ? crypto.createHash("sha256").update(`fusion-terminal:${agente}`).digest("hex") : "";
}

export function validarTokenTerminal(token) {
  const recebido = Buffer.from(texto(token, 500));
  const esperado = Buffer.from(segredoTerminal());
  return esperado.length > 15 && recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

export function tokenTerminal() { return segredoTerminal(); }

export function normalizarImagem(valor) {
  let base64 = texto(valor, Math.ceil(MAX_IMAGEM_BYTES * 1.5));
  base64 = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) erro("Captura facial inválida.");
  const bytes = Buffer.byteLength(base64, "base64");
  if (bytes < 5_000) erro("A captura facial está vazia ou pequena demais.");
  if (bytes > MAX_IMAGEM_BYTES) erro("A captura facial ultrapassa 1,5 MB.", 413);
  return base64;
}

function assuntoDoAluno(alunoId) {
  const tenant = texto(process.env.FUSION_TENANT_ID || "academia", 120);
  return `fusion_${crypto.createHash("sha256").update(`${tenant}:${alunoId}`).digest("hex").slice(0, 32)}`;
}

function limparExpiradas() {
  const limite = Date.now();
  for (const [id, item] of tarefas) {
    if (item.expiraEmMs > limite) continue;
    tarefas.delete(id);
    item.reject?.(Object.assign(new Error("O agente facial não respondeu no tempo esperado."), { status: 504 }));
  }
  while (fila.length && !tarefas.has(fila[0])) fila.shift();
}

function criarTarefa(acao, payload) {
  limparExpiradas();
  const id = `face_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  return new Promise((resolve, reject) => {
    tarefas.set(id, {
      id,
      acao,
      payload,
      status: "pendente",
      criadoEm: agora(),
      expiraEm: new Date(Date.now() + TEMPO_TAREFA_MS).toISOString(),
      expiraEmMs: Date.now() + TEMPO_TAREFA_MS,
      resolve,
      reject
    });
    fila.push(id);
    setTimeout(limparExpiradas, TEMPO_TAREFA_MS + 100).unref?.();
  });
}

export function obterTarefaFacial(agentId, detalhes = {}) {
  limparExpiradas();
  agenteFacial = {
    vistoEm: agora(),
    estado: "online",
    agentId: texto(agentId, 120),
    versao: texto(detalhes.versao || detalhes.version, 80),
    motor: detalhes.motor ?? agenteFacial.motor
  };
  while (fila.length) {
    const id = fila.shift();
    const tarefa = tarefas.get(id);
    if (!tarefa || tarefa.status !== "pendente") continue;
    tarefa.status = "processando";
    tarefa.agentId = agentId;
    return { id: tarefa.id, acao: tarefa.acao, payload: tarefa.payload, criadoEm: tarefa.criadoEm, expiraEm: tarefa.expiraEm };
  }
  return null;
}

export function finalizarTarefaFacial(id, agentId, resultado = {}) {
  const tarefa = tarefas.get(String(id));
  if (!tarefa || tarefa.agentId !== agentId) return null;
  tarefas.delete(tarefa.id);
  tarefa.payload = null;
  if (resultado.ok === false) {
    tarefa.reject(Object.assign(new Error(texto(resultado.erro || resultado.error || "Falha no reconhecimento local.", 600)), { status: 502 }));
  } else {
    tarefa.resolve(resultado.resultado || resultado.result || resultado);
  }
  agenteFacial = { ...agenteFacial, vistoEm: agora(), estado: "online" };
  return { id: tarefa.id, concluida: true };
}

async function registrarEvento(dados = {}) {
  return executarTransacaoJson(async () => {
    const eventos = await lerJsonDuravel(COLECAO_EVENTOS, []);
    const evento = {
      id: crypto.randomUUID(),
      criadoEm: agora(),
      tipo: texto(dados.tipo || "identificacao", 80),
      alunoId: texto(dados.alunoId, 160),
      alunoNome: texto(dados.alunoNome, 180),
      autorizado: dados.autorizado === true,
      reconhecido: dados.reconhecido === true,
      similaridade: Number(numero(dados.similaridade, 0).toFixed(4)),
      movimentoValido: dados.movimentoValido === true,
      motivo: texto(dados.motivo, 500),
      terminalId: texto(dados.terminalId || "terminal-01", 120),
      origem: texto(dados.origem || "terminal-facial", 100)
    };
    eventos.unshift(evento);
    await salvarJsonDuravel(COLECAO_EVENTOS, eventos.slice(0, 3000));
    return evento;
  }, { operacaoId: `facial-evento-${crypto.randomUUID()}` });
}

export async function cadastrarRosto({ alunoId, imagens, consentimento, usuario } = {}) {
  if (!consentimento) erro("Confirme o consentimento para uso da biometria facial.");
  const aluno = await buscarAlunoPorId(alunoId);
  if (!aluno) erro("Aluno não encontrado.", 404);
  const capturas = Array.isArray(imagens) ? imagens.map(normalizarImagem) : [];
  if (capturas.length < 3) erro("Não foi possível obter as amostras automáticas do rosto.");
  const subject = assuntoDoAluno(String(aluno.id || alunoId));
  const resultado = await criarTarefa("cadastrar", { subject, imagens: capturas.slice(0, 3) });

  const cadastro = await executarTransacaoJson(async () => {
    const lista = await lerJsonDuravel(COLECAO_CADASTROS, []);
    const existente = lista.find(item => String(item.alunoId) === String(aluno.id || alunoId));
    const registro = {
      id: existente?.id || crypto.randomUUID(),
      alunoId: String(aluno.id || alunoId),
      alunoNome: texto(aluno.nome, 180),
      subject,
      status: "ativo",
      exemplos: Array.isArray(resultado?.exemplos) ? resultado.exemplos.map(item => texto(item.imageId || item.image_id, 120)).filter(Boolean) : [],
      consentimento: true,
      consentidoEm: agora(),
      consentidoPor: texto(usuario?.nome || usuario?.email || usuario?.id, 180),
      criadoEm: existente?.criadoEm || agora(),
      atualizadoEm: agora()
    };
    if (existente) Object.assign(existente, registro); else lista.unshift(registro);
    await salvarJsonDuravel(COLECAO_CADASTROS, lista);
    return registro;
  }, { operacaoId: `facial-cadastro-${aluno.id || alunoId}` });

  await registrarEvento({ tipo: "cadastro", alunoId: cadastro.alunoId, alunoNome: cadastro.alunoNome, reconhecido: true, autorizado: false, motivo: "Biometria facial cadastrada." });
  return cadastro;
}

export async function removerRosto(alunoId, usuario = {}) {
  const lista = await lerJsonDuravel(COLECAO_CADASTROS, []);
  const cadastro = lista.find(item => String(item.alunoId) === String(alunoId) && item.status !== "removido");
  if (!cadastro) erro("Cadastro facial não encontrado.", 404);
  await criarTarefa("remover", { subject: cadastro.subject });
  cadastro.status = "removido";
  cadastro.removidoEm = agora();
  cadastro.removidoPor = texto(usuario?.nome || usuario?.email || usuario?.id, 180);
  cadastro.atualizadoEm = agora();
  await salvarJsonDuravel(COLECAO_CADASTROS, lista);
  await registrarEvento({ tipo: "remocao", alunoId: cadastro.alunoId, alunoNome: cadastro.alunoNome, motivo: "Biometria facial removida." });
  return cadastro;
}

export async function identificarRosto({ imagens, desafio, terminalId } = {}) {
  const config = configuracaoFacial();
  if (!config.habilitado) erro("Reconhecimento facial desativado.", 503);
  const capturas = Array.isArray(imagens) ? imagens.map(normalizarImagem) : [];
  if (capturas.length < 2) erro("São necessárias duas capturas para a prova de movimento.");
  const resultado = await criarTarefa("identificar", {
    imagens: capturas.slice(0, 2),
    desafio: ["esquerda", "direita"].includes(desafio) ? desafio : "movimento",
    similaridadeMinima: config.similaridadeMinima,
    movimentoMinimo: config.movimentoMinimo
  });

  const subject = texto(resultado?.subject, 120);
  const similaridade = numero(resultado?.similaridade, 0);
  const movimentoValido = resultado?.movimentoValido === true;
  const reconhecido = Boolean(subject && movimentoValido && similaridade >= config.similaridadeMinima);
  const cadastros = await lerJsonDuravel(COLECAO_CADASTROS, []);
  const cadastro = cadastros.find(item => item.subject === subject && item.status === "ativo");
  const aluno = cadastro ? await buscarAlunoPorId(cadastro.alunoId) : null;

  let resposta;
  if (!movimentoValido) {
    resposta = { reconhecido: false, autorizado: false, motivo: "Prova de movimento não confirmada. Tente novamente.", similaridade, movimentoValido };
  } else if (!reconhecido || !cadastro || !aluno) {
    resposta = { reconhecido: false, autorizado: false, motivo: "Rosto não reconhecido.", similaridade, movimentoValido };
  } else if (!config.liberarCatraca) {
    resposta = { reconhecido: true, autorizado: false, homologacao: true, motivo: "Rosto reconhecido. Liberação facial ainda está em homologação.", similaridade, movimentoValido, aluno: { id: aluno.id, nome: aluno.nome } };
  } else {
    const acesso = await avaliarAcessoAluno({ aluno, dispositivoId: "disp_henry7x_01", direcao: "entrada", origem: "reconhecimento-facial" });
    resposta = { reconhecido: true, autorizado: acesso.autorizado === true, motivo: acesso.motivo, similaridade, movimentoValido, aluno: { id: aluno.id, nome: aluno.nome }, comandoId: acesso.catraca?.commandId || null };
  }

  await registrarEvento({
    tipo: "identificacao",
    alunoId: aluno?.id || cadastro?.alunoId || "",
    alunoNome: aluno?.nome || cadastro?.alunoNome || "",
    reconhecido: resposta.reconhecido,
    autorizado: resposta.autorizado,
    similaridade,
    movimentoValido,
    motivo: resposta.motivo,
    terminalId
  });
  return resposta;
}

export async function listarCadastros() {
  return (await lerJsonDuravel(COLECAO_CADASTROS, [])).filter(item => item.status !== "removido");
}

export async function listarEventos(limite = 50) {
  return (await lerJsonDuravel(COLECAO_EVENTOS, [])).slice(0, Math.max(1, Math.min(200, Number(limite || 50))));
}

export async function listarAlunosParaCadastro() {
  const alunos = await lerJsonDuravel("alunos.json", []);
  return alunos.map(aluno => ({ id: aluno.id, nome: aluno.nome, cpf: aluno.cpf || "", status: aluno.statusMatricula || aluno.status || "" })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export function statusFacial() {
  const online = Boolean(agenteFacial.vistoEm && Date.now() - new Date(agenteFacial.vistoEm).getTime() < 30_000);
  return { configuracao: configuracaoFacial(), agente: { ...agenteFacial, online }, fila: fila.length, tarefas: tarefas.size };
}
