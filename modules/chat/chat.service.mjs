import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CHAT_FILE = path.join(DATA_DIR, "site_chat.json");

async function garantirArquivo() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(CHAT_FILE); }
  catch { await fs.writeFile(CHAT_FILE, "[]\n", "utf8"); }
}
async function ler() {
  await garantirArquivo();
  try { const dados = JSON.parse(await fs.readFile(CHAT_FILE, "utf8") || "[]"); return Array.isArray(dados) ? dados : []; }
  catch { return []; }
}
async function salvar(lista) {
  const tmp = `${CHAT_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(lista, null, 2), "utf8");
  await fs.rename(tmp, CHAT_FILE);
}
const texto = (v, n = 1200) => String(v ?? "").trim().slice(0, n);
const normalizar = v => texto(v, 2000).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const id = p => `${p}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

function participante(payload = {}) {
  const origem = texto(payload.origem || "site", 80);
  const alunoId = texto(payload.alunoId || payload.aluno_id, 120);
  const professorId = texto(payload.professorId || payload.professor_id, 120);
  const usuarioId = texto(payload.usuarioId || payload.usuario_id, 120);
  const clienteId = texto(payload.clienteId || payload.visitanteId, 160);
  const contato = normalizar(payload.contato || payload.telefone || payload.whatsapp || payload.email);
  if (origem === "portal_aluno" && alunoId) return `aluno:${alunoId}`;
  if (origem === "portal_professor" && professorId) return `professor:${professorId}`;
  if (origem === "sistema" && usuarioId) return `usuario:${usuarioId}`;
  if (clienteId) return `visitante:${clienteId}`;
  if (contato) return `contato:${contato}`;
  return "";
}
function assunto(mensagem) {
  const m = normalizar(mensagem);
  if (/(pagamento|mensalidade|debito|pix|cartao|boleto|recibo)/.test(m)) return "pagamentos";
  if (/(horario|funcionamento|abre|fecha|domingo|sabado|feriado)/.test(m)) return "horarios";
  if (/(matricula|plano|valor|taxa|turma|contrato)/.test(m)) return "matricula";
  if (/(catraca|acesso|bloqueio|liberar|digital|biometria)/.test(m)) return "acesso";
  if (/(treino|exercicio|avaliacao|professor)/.test(m)) return "treino";
  return "geral";
}
function respostaAutomatica(tipo) {
  const respostas = {
    pagamentos: "Recebemos sua mensagem. A recepção verificará o financeiro e responderá nesta conversa.",
    horarios: "Recebemos sua mensagem. A equipe confirmará os dias e horários de funcionamento.",
    matricula: "Recebemos sua mensagem. A equipe comercial verificará plano, matrícula e valores.",
    acesso: "Recebemos sua mensagem. A recepção verificará matrícula, acesso e catraca.",
    geral: "Recebemos sua mensagem. A equipe responderá nesta conversa."
  };
  return respostas[tipo] || respostas.geral;
}
function criarMensagem(payload = {}, extras = {}) {
  const mensagem = texto(payload.mensagem || payload.texto);
  if (!mensagem) { const e = new Error("Informe a mensagem do chat."); e.status = 400; throw e; }
  const agora = new Date().toISOString();
  return {
    id: id("msg"), conversaId: texto(payload.conversaId || payload.chatId, 120) || id("chat"),
    origem: texto(payload.origem || "site", 80), remetente: texto(payload.remetente || extras.remetente || "visitante", 40),
    nome: texto(payload.nome || payload.alunoNome || payload.professorNome || "Visitante", 140),
    alunoId: texto(payload.alunoId || payload.aluno_id, 120), professorId: texto(payload.professorId || payload.professor_id, 120),
    usuarioId: texto(payload.usuarioId || payload.usuario_id, 120), contato: texto(payload.contato || payload.telefone || payload.email, 160),
    clienteId: texto(payload.clienteId || payload.visitanteId, 160), participanteChave: participante(payload),
    mensagem, assunto: extras.assunto || assunto(mensagem), status: extras.status || "enviado",
    lidoPorAtendimento: ["atendimento", "sistema"].includes(texto(payload.remetente || extras.remetente, 40)),
    lidoPorParticipante: !["atendimento", "sistema"].includes(texto(payload.remetente || extras.remetente, 40)),
    criadoEm: agora, atualizadoEm: agora
  };
}
function filtrar(lista, f = {}) {
  return lista.filter(m => !f.conversaId || String(m.conversaId) === String(f.conversaId))
    .filter(m => !f.origem || String(m.origem) === String(f.origem))
    .filter(m => !f.alunoId || String(m.alunoId) === String(f.alunoId))
    .filter(m => !f.professorId || String(m.professorId) === String(f.professorId))
    .sort((a,b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
}
export async function listarMensagensChat(filtros = {}) {
  const mensagens = filtrar(await ler(), filtros);
  const limite = Math.max(1, Math.min(300, Number(filtros.limite || 100)));
  return { ok: true, total: mensagens.length, mensagens: mensagens.slice(-limite) };
}
export async function listarConversasChat(filtros = {}) {
  const mensagens = filtrar(await ler(), filtros); const mapa = new Map();
  for (const m of mensagens) {
    const c = mapa.get(m.conversaId) || { conversaId:m.conversaId, origem:m.origem, nome:m.nome, alunoId:m.alunoId||"", professorId:m.professorId||"", usuarioId:m.usuarioId||"", contato:m.contato||"", participanteChave:m.participanteChave||"", assunto:m.assunto||"geral", total:0, pendentes:0, ultimaMensagem:"", atualizadoEm:m.criadoEm };
    c.total++; if (!m.lidoPorAtendimento && !["atendimento","sistema"].includes(m.remetente)) c.pendentes++;
    c.nome=m.nome||c.nome; c.contato=m.contato||c.contato; c.ultimaMensagem=m.mensagem; c.atualizadoEm=m.criadoEm||c.atualizadoEm; mapa.set(m.conversaId,c);
  }
  const conversas=[...mapa.values()].sort((a,b)=>String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
  return { ok:true, total:conversas.length, conversas };
}
export async function enviarMensagemChat(payload = {}) {
  const lista = await ler(); const msg = criarMensagem(payload);
  if (payload.conversaId) {
    const dono = lista.find(m => String(m.conversaId) === String(msg.conversaId) && m.participanteChave)?.participanteChave;
    if (dono && msg.participanteChave && dono !== msg.participanteChave && !["atendimento","sistema"].includes(msg.remetente)) { const e=new Error("Esta conversa pertence a outro usuário."); e.status=409; throw e; }
  }
  const anteriores = lista.filter(m => String(m.conversaId) === String(msg.conversaId)); lista.push(msg);
  let resposta = null;
  const publico = ["site","matricula_online","promocao"].includes(msg.origem);
  const primeira = !anteriores.some(m => !["atendimento","sistema"].includes(m.remetente));
  if (publico && primeira && !["atendimento","sistema"].includes(msg.remetente)) {
    resposta = criarMensagem({...payload, conversaId:msg.conversaId, remetente:"sistema", nome:"Atendimento Fusion", mensagem:respostaAutomatica(msg.assunto)}, {remetente:"sistema", assunto:msg.assunto, status:"automatico"}); lista.push(resposta);
  }
  await salvar(lista); return {ok:true, conversaId:msg.conversaId, mensagem:msg, resposta, mensagens:resposta?[msg,resposta]:[msg]};
}
export async function marcarLeituraChat(conversaId, leitor = "atendimento") {
  const lista = await ler(); let alteradas=0;
  for (const m of lista) if (String(m.conversaId) === String(conversaId)) {
    const campo = leitor === "participante" ? "lidoPorParticipante" : "lidoPorAtendimento";
    if (!m[campo]) { m[campo]=true; m.atualizadoEm=new Date().toISOString(); alteradas++; }
  }
  if (alteradas) await salvar(lista); return {ok:true, conversaId, alteradas};
}
