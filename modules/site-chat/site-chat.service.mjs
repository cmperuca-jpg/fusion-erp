import { criarNotificacao } from "../notificacoes/notificacoes.service.mjs";
import {
  atualizarConversaAtomica,
  gravarMensagemAtomica,
  listarConversasRepository,
  listarMensagensRepository,
  marcarMensagensLidasAtomico
} from "./site-chat.repository.mjs";

const texto = (valor, limite = 1200) => String(valor ?? "").trim().slice(0, limite);
const normalizar = valor => texto(valor, 2000).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const gerarId = prefixo => `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
const internos = new Set(["atendimento", "sistema"]);

function chaveParticipante(payload = {}) {
  const origem = texto(payload.origem || "site", 80);
  const alunoId = texto(payload.alunoId || payload.aluno_id, 120);
  const professorId = texto(payload.professorId || payload.professor_id, 120);
  const clienteId = texto(payload.clienteId || payload.visitanteId, 160);
  const contato = normalizar(payload.contato || payload.telefone || payload.whatsapp || payload.email);
  if (origem === "portal_aluno" && alunoId) return `aluno:${alunoId}`;
  if (origem === "portal_professor" && professorId) return `professor:${professorId}`;
  if (clienteId) return `visitante:${clienteId}`;
  if (contato) return `contato:${contato}`;
  return "";
}

function assuntoDaMensagem(mensagem) {
  const valor = normalizar(mensagem);
  if (/(pagamento|mensalidade|debito|pix|cartao|boleto|recibo)/.test(valor)) return "pagamentos";
  if (/(horario|funcionamento|abre|fecha|domingo|sabado|feriado)/.test(valor)) return "horarios";
  if (/(matricula|plano|valor|taxa|turma|contrato)/.test(valor)) return "matricula";
  if (/(catraca|acesso|bloqueio|liberar|digital|biometria)/.test(valor)) return "acesso";
  if (/(treino|exercicio|avaliacao|professor)/.test(valor)) return "treino";
  return "geral";
}

function respostaAutomatica(tipo) {
  return ({
    pagamentos: "Recebemos sua mensagem. A recepção verificará o financeiro e responderá nesta conversa.",
    horarios: "Recebemos sua mensagem. A equipe confirmará os dias e horários de funcionamento.",
    matricula: "Recebemos sua mensagem. A equipe comercial verificará plano, matrícula e valores.",
    acesso: "Recebemos sua mensagem. A recepção verificará matrícula, acesso e catraca.",
    treino: "Recebemos sua mensagem. A equipe técnica verificará treino, avaliação ou professor.",
    geral: "Recebemos sua mensagem. A equipe responderá nesta conversa."
  })[tipo] || "Recebemos sua mensagem. A equipe responderá nesta conversa.";
}

function montarMensagem(payload = {}, extras = {}) {
  const mensagem = texto(payload.mensagem || payload.texto);
  if (!mensagem) {
    const erro = new Error("Informe a mensagem do chat.");
    erro.status = 400;
    throw erro;
  }
  const remetente = texto(payload.remetente || extras.remetente || "visitante", 40);
  const agora = new Date().toISOString();
  return {
    id: gerarId("msg"),
    conversaId: texto(payload.conversaId || payload.chatId, 120) || gerarId("chat"),
    origem: texto(payload.origem || "site", 80),
    remetente,
    nome: texto(payload.nome || payload.alunoNome || payload.professorNome || "Visitante", 140),
    alunoId: texto(payload.alunoId || payload.aluno_id, 120),
    professorId: texto(payload.professorId || payload.professor_id, 120),
    usuarioId: texto(payload.usuarioId || payload.usuario_id, 120),
    contato: texto(payload.contato || payload.telefone || payload.whatsapp || payload.email, 160),
    clienteId: texto(payload.clienteId || payload.visitanteId, 160),
    protocolo: texto(payload.protocolo, 120),
    participanteChave: chaveParticipante(payload),
    mensagem,
    assunto: extras.assunto || assuntoDaMensagem(mensagem),
    status: extras.status || "enviado",
    operadorId: texto(payload.operadorId || payload.usuarioId, 120),
    operadorNome: texto(payload.operadorNome || (internos.has(remetente) ? payload.nome : ""), 140),
    lidoPorAtendimento: internos.has(remetente),
    lidoPorParticipante: !internos.has(remetente),
    criadoEm: agora,
    atualizadoEm: agora
  };
}

function filtrar(mensagens, filtros = {}) {
  return mensagens
    .filter(m => !filtros.conversaId || String(m.conversaId) === String(filtros.conversaId))
    .filter(m => !filtros.origem || String(m.origem) === String(filtros.origem))
    .filter(m => !filtros.alunoId || String(m.alunoId) === String(filtros.alunoId))
    .filter(m => !filtros.professorId || String(m.professorId) === String(filtros.professorId))
    .sort((a, b) => String(a.criadoEm || "").localeCompare(String(b.criadoEm || "")));
}

function resumoDerivado(mensagens) {
  const mapa = new Map();
  for (const m of mensagens) {
    const atual = mapa.get(m.conversaId) || {
      conversaId: m.conversaId, origem: m.origem, nome: m.nome, alunoId: m.alunoId || "",
      professorId: m.professorId || "", contato: m.contato || "", clienteId: m.clienteId || "",
      participanteChave: m.participanteChave || "", assunto: m.assunto || "geral",
      statusAtendimento: "aguardando", prioridade: "normal", etiquetas: [],
      total: 0, pendentes: 0, ultimaMensagem: "", atualizadoEm: m.criadoEm
    };
    atual.total += 1;
    if (!m.lidoPorAtendimento && !internos.has(String(m.remetente))) atual.pendentes += 1;
    atual.nome = m.nome || atual.nome;
    atual.contato = m.contato || atual.contato;
    atual.ultimaMensagem = m.mensagem;
    atual.atualizadoEm = m.criadoEm || atual.atualizadoEm;
    mapa.set(m.conversaId, atual);
  }
  return mapa;
}

export async function listarMensagensChat(filtros = {}) {
  const mensagens = filtrar(await listarMensagensRepository(), filtros);
  const limite = Math.max(1, Math.min(300, Number(filtros.limite || 100)));
  return { ok: true, total: mensagens.length, mensagens: mensagens.slice(-limite) };
}

export async function listarMensagensChatPublico(filtros = {}) {
  const conversaId = texto(filtros.conversaId || filtros.chatId, 120);
  const participante = chaveParticipante(filtros);
  if (!conversaId || !participante) {
    const erro = new Error("Informe a identificação da conversa.");
    erro.status = 401;
    throw erro;
  }
  const mensagens = filtrar(await listarMensagensRepository(), { conversaId });
  const dono = mensagens.find(m => m.participanteChave)?.participanteChave || "";
  if (!dono || dono !== participante) {
    const erro = new Error("Conversa não encontrada para este participante.");
    erro.status = 403;
    throw erro;
  }
  const limite = Math.max(1, Math.min(100, Number(filtros.limite || 80)));
  return { ok: true, total: mensagens.length, mensagens: mensagens.slice(-limite) };
}

export async function listarConversasChat(filtros = {}) {
  const mensagens = filtrar(await listarMensagensRepository(), filtros);
  const derivados = resumoDerivado(mensagens);
  const metadados = await listarConversasRepository();

  for (const meta of metadados) {
    const atual = derivados.get(meta.conversaId) || { conversaId: meta.conversaId, total: 0, pendentes: 0 };
    derivados.set(meta.conversaId, { ...atual, ...meta, total: atual.total, pendentes: atual.pendentes });
  }

  let conversas = [...derivados.values()];
  if (filtros.statusAtendimento) conversas = conversas.filter(c => c.statusAtendimento === filtros.statusAtendimento);
  if (filtros.prioridade) conversas = conversas.filter(c => c.prioridade === filtros.prioridade);
  conversas.sort((a, b) => String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || "")));
  return { ok: true, total: conversas.length, conversas };
}

export async function enviarMensagemChat(payload = {}) {
  const existentes = await listarMensagensRepository();
  const mensagem = montarMensagem(payload);

  if (payload.conversaId) {
    const dono = existentes.find(m => String(m.conversaId) === String(mensagem.conversaId) && m.participanteChave)?.participanteChave;
    if (dono && mensagem.participanteChave && dono !== mensagem.participanteChave && !internos.has(mensagem.remetente)) {
      const erro = new Error("Esta conversa pertence a outro usuário.");
      erro.status = 409;
      throw erro;
    }
  }

  const anteriores = existentes.filter(m => String(m.conversaId) === String(mensagem.conversaId));
  const primeira = !anteriores.some(m => !internos.has(String(m.remetente)));
  const publico = ["site", "matricula_online", "promocao"].includes(mensagem.origem);
  let resposta = null;

  if (publico && primeira && !internos.has(mensagem.remetente)) {
    resposta = montarMensagem({
      ...payload, conversaId: mensagem.conversaId, remetente: "sistema",
      nome: "Atendimento Fusion", mensagem: respostaAutomatica(mensagem.assunto)
    }, { remetente: "sistema", assunto: mensagem.assunto, status: "automatico" });
  }

  const agora = new Date().toISOString();
  const conversa = {
    conversaId: mensagem.conversaId,
    origem: mensagem.origem,
    nome: mensagem.nome,
    alunoId: mensagem.alunoId,
    professorId: mensagem.professorId,
    contato: mensagem.contato,
    clienteId: mensagem.clienteId,
    participanteChave: mensagem.participanteChave,
    assunto: mensagem.assunto,
    statusAtendimento: internos.has(mensagem.remetente) ? "em_atendimento" : "aguardando",
    prioridade: texto(payload.prioridade || "normal", 20),
    etiquetas: Array.isArray(payload.etiquetas) ? payload.etiquetas.map(x => texto(x, 40)).filter(Boolean) : [],
    operadorId: mensagem.operadorId || "",
    operadorNome: mensagem.operadorNome || "",
    criadoEm: anteriores[0]?.criadoEm || agora,
    atualizadoEm: agora
  };

  await gravarMensagemAtomica({ mensagem, resposta, conversa });

  if (!internos.has(mensagem.remetente)) {
    await criarNotificacao({
      eventoId: `chat:${mensagem.id}`, tipo: "chat", prioridade: "alta",
      titulo: `Nova mensagem de ${mensagem.nome || "visitante"}`,
      mensagem: mensagem.mensagem, contato: mensagem.contato,
      referenciaId: mensagem.conversaId,
      link: `/pages/site-chat/index.html?conversaId=${encodeURIComponent(mensagem.conversaId)}`,
      destinatarios: ["admin", "recepcao", "comercial", "site_chat"]
    }).catch(erro => console.error(`[Notificações] Chat salvo, mas o aviso falhou: ${erro.message}`));
  }

  return { ok: true, conversaId: mensagem.conversaId, mensagem, resposta, mensagens: resposta ? [mensagem, resposta] : [mensagem] };
}

export async function marcarLeituraChat(conversaId, leitor = "atendimento") {
  const alteradas = await marcarMensagensLidasAtomico(conversaId, leitor);
  return { ok: true, conversaId, alteradas };
}

export async function atualizarConversaChat(conversaId, dados = {}) {
  const permitidos = ["statusAtendimento", "prioridade", "operadorId", "operadorNome"];
  const atualizada = await atualizarConversaAtomica(conversaId, atual => {
    const nova = { ...atual };
    for (const campo of permitidos) if (dados[campo] !== undefined) nova[campo] = texto(dados[campo], 140);
    if (Array.isArray(dados.etiquetas)) nova.etiquetas = dados.etiquetas.map(x => texto(x, 40)).filter(Boolean);
    nova.atualizadoEm = new Date().toISOString();
    return nova;
  });
  return { ok: true, conversa: atualizada };
}
