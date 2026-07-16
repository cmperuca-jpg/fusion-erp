import path from "node:path";
import { lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";
import { criarNotificacao } from "../notificacoes/notificacoes.service.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CHAT_FILE = path.join(DATA_DIR, "site_chat.json");

async function lerMensagens() {
  return lerJsonDuravel(CHAT_FILE, []);
}

async function salvarMensagens(mensagens) {
  return salvarJsonDuravel(CHAT_FILE, mensagens);
}

function id(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function texto(valor, limite = 1200) {
  return String(valor ?? "").trim().slice(0, limite);
}

function normalizar(valor) {
  return texto(valor, 2000).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function chaveParticipante(payload = {}) {
  const origem = texto(payload.origem || "site", 80);
  const alunoId = texto(payload.alunoId || payload.aluno_id || "", 120);
  const clienteId = texto(payload.clienteId || payload.visitanteId || "", 160);
  const contato = normalizar(payload.contato || payload.telefone || payload.whatsapp || payload.email || "");

  if (origem === "portal_aluno" && alunoId) return `aluno:${alunoId}`;
  if (clienteId) return `visitante:${clienteId}`;
  if (contato) return `contato:${contato}`;
  return "";
}

function assuntoDaMensagem(mensagem) {
  const m = normalizar(mensagem);
  if (/(pagamento|pagar|mensalidade|divida|debito|pix|cartao|boleto|receber|recebimento|recibo|comprovante)/.test(m)) return "pagamentos";
  if (/(horario|funciona|funcionamento|abre|fecha|domingo|sabado|feriado|dia)/.test(m)) return "horarios";
  if (/(matricula|plano|valor|taxa|turma|contrato)/.test(m)) return "matricula";
  if (/(catraca|acesso|bloqueio|liberar|digital|biometria)/.test(m)) return "acesso";
  return "geral";
}

function respostaAutomatica({ assunto, origem }) {
  const base = origem === "portal_aluno"
    ? "Recebemos sua mensagem no portal do aluno."
    : "Recebemos sua mensagem da matricula online.";

  if (assunto === "pagamentos") {
    return `${base} Para pagamentos e recebimentos, a recepcao confere o valor em aberto, registra a baixa no financeiro e entrega o comprovante. Aguarde o atendimento ou procure a recepcao com seu nome/CPF.`;
  }
  if (assunto === "horarios") {
    return `${base} Sobre dias e horarios de funcionamento, confirme com a recepcao nesta conversa. A equipe pode responder aqui e deixar registrado no sistema.`;
  }
  if (assunto === "matricula") {
    return `${base} Na matricula inicial o sistema soma taxa de matricula + plano mensal, desconta abatimentos e envia o total para recebimento. A equipe pode conferir valores e planos por aqui.`;
  }
  if (assunto === "acesso") {
    return `${base} Sobre catraca, liberacao e bloqueio, a recepcao vai conferir financeiro, matricula e limite diario antes de liberar o acesso.`;
  }
  return `${base} A equipe recebeu sua duvida e pode responder por aqui. Informe nome, CPF ou telefone para agilizar.`;
}

function montarMensagem(payload = {}, extras = {}) {
  const agora = new Date().toISOString();
  const origem = texto(payload.origem || "site", 80);
  const conversaId = texto(payload.conversaId || payload.chatId || "", 120) || id("chat");
  const mensagem = texto(payload.mensagem || payload.texto || "", 1200);
  if (!mensagem) {
    const erro = new Error("Informe a mensagem do chat.");
    erro.status = 400;
    throw erro;
  }

  return {
    id: id("msg"),
    conversaId,
    origem,
    remetente: texto(payload.remetente || extras.remetente || "visitante", 40),
    nome: texto(payload.nome || payload.aluno || payload.cliente || "Visitante", 140),
    alunoId: texto(payload.alunoId || payload.aluno_id || "", 120),
    protocolo: texto(payload.protocolo || "", 120),
    contato: texto(payload.contato || payload.telefone || payload.whatsapp || payload.email || "", 160),
    clienteId: texto(payload.clienteId || payload.visitanteId || "", 160),
    participanteChave: chaveParticipante(payload),
    mensagem,
    assunto: extras.assunto || assuntoDaMensagem(mensagem),
    status: extras.status || "novo",
    criadoEm: agora,
    atualizadoEm: agora
  };
}

function filtrarMensagens(mensagens, filtros = {}) {
  let lista = [...mensagens];
  if (filtros.conversaId) lista = lista.filter(m => String(m.conversaId) === String(filtros.conversaId));
  if (filtros.origem) lista = lista.filter(m => String(m.origem) === String(filtros.origem));
  if (filtros.alunoId) lista = lista.filter(m => String(m.alunoId) === String(filtros.alunoId));
  if (filtros.protocolo) lista = lista.filter(m => String(m.protocolo) === String(filtros.protocolo));
  if (filtros.participanteChave) lista = lista.filter(m => String(m.participanteChave || "") === String(filtros.participanteChave));
  return lista.sort((a, b) => String(a.criadoEm || "").localeCompare(String(b.criadoEm || "")));
}

export async function listarMensagensChat(filtros = {}) {
  const mensagens = filtrarMensagens(await lerMensagens(), filtros);
  const limite = Math.max(1, Math.min(200, Number(filtros.limite || 100)));
  return { ok: true, total: mensagens.length, mensagens: mensagens.slice(-limite) };
}

export async function listarConversasChat() {
  const mensagens = await lerMensagens();
  const mapa = new Map();

  for (const msg of mensagens) {
    const atual = mapa.get(msg.conversaId) || {
      conversaId: msg.conversaId,
      origem: msg.origem,
      nome: msg.nome,
      alunoId: msg.alunoId || "",
      protocolo: msg.protocolo || "",
      contato: msg.contato || "",
      clienteId: msg.clienteId || "",
      participanteChave: msg.participanteChave || "",
      assunto: msg.assunto || "geral",
      total: 0,
      pendentes: 0,
      ultimaMensagem: "",
      atualizadoEm: msg.criadoEm
    };
    atual.total += 1;
    if (!["atendimento", "sistema"].includes(String(msg.remetente))) atual.pendentes += 1;
    atual.nome = msg.nome || atual.nome;
    atual.contato = msg.contato || atual.contato;
    atual.clienteId = msg.clienteId || atual.clienteId;
    atual.participanteChave = msg.participanteChave || atual.participanteChave;
    atual.protocolo = msg.protocolo || atual.protocolo;
    atual.assunto = msg.assunto || atual.assunto;
    atual.ultimaMensagem = msg.mensagem;
    atual.atualizadoEm = msg.criadoEm || atual.atualizadoEm;
    mapa.set(msg.conversaId, atual);
  }

  const conversas = [...mapa.values()].sort((a, b) => String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || "")));
  return { ok: true, total: conversas.length, conversas };
}

export async function enviarMensagemChat(payload = {}) {
  const mensagens = await lerMensagens();
  const usuario = montarMensagem(payload);

  if (payload.conversaId) {
    const existentes = mensagens.filter(m => String(m.conversaId) === String(usuario.conversaId));
    const donoRegistrado = existentes.find(m => m.participanteChave)?.participanteChave || "";
    if (donoRegistrado && usuario.participanteChave && donoRegistrado !== usuario.participanteChave) {
      const erro = new Error("Esta conversa pertence a outro usuario. Uma nova conversa deve ser iniciada.");
      erro.status = 409;
      throw erro;
    }
  }

  const mensagensAnteriores = mensagens.filter(m => String(m.conversaId) === String(usuario.conversaId));
  const primeiraFalaDoUsuario = !mensagensAnteriores.some(m => !["atendimento", "sistema"].includes(String(m.remetente)));
  mensagens.push(usuario);

  let resposta = null;
  const deveResponderAutomaticamente =
    usuario.origem !== "portal_aluno" &&
    primeiraFalaDoUsuario &&
    !["atendimento", "sistema"].includes(String(usuario.remetente));

  if (deveResponderAutomaticamente) {
    resposta = montarMensagem({
      ...payload,
      conversaId: usuario.conversaId,
      remetente: "sistema",
      nome: "Atendimento Fusion",
      mensagem: respostaAutomatica({ assunto: usuario.assunto, origem: usuario.origem })
    }, { remetente: "sistema", assunto: usuario.assunto, status: "automatico" });
    mensagens.push(resposta);
  }

  await salvarMensagens(mensagens);
  if (!["atendimento", "sistema"].includes(String(usuario.remetente))) {
    await criarNotificacao({
      eventoId: `chat:${usuario.id}`,
      tipo: "chat",
      prioridade: "alta",
      titulo: `Nova mensagem de ${usuario.nome || "visitante"}`,
      mensagem: usuario.mensagem,
      contato: usuario.contato,
      referenciaId: usuario.conversaId,
      link: `/pages/site-chat/index.html?conversaId=${encodeURIComponent(usuario.conversaId)}`,
      destinatarios: ["admin", "recepcao", "comercial", "site_chat"]
    }).catch(erro => console.error(`[Notificações] Chat salvo, mas o aviso falhou: ${erro.message}`));
  }
  return {
    ok: true,
    conversaId: usuario.conversaId,
    mensagem: usuario,
    resposta,
    mensagens: resposta ? [usuario, resposta] : [usuario]
  };
}
