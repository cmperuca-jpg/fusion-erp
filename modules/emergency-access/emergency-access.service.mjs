import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { queueRelease } from "../access-bridge/access-bridge.service.mjs";
import { enviarMensagemChat } from "../chat/chat.service.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "emergency-access.json");
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "emergency-receipts");

const FILES = {
  alunos: path.join(DATA_DIR, "alunos.json"),
  mensalidades: path.join(DATA_DIR, "mensalidades.json"),
  financeiro: path.join(DATA_DIR, "financeiro.json")
};

function text(v = "") { return String(v ?? "").trim(); }
function number(v) {
  const n = Number(String(v ?? 0).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function normalize(v = "") { return text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function same(a, b) { return text(a) && text(a) === text(b); }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`; }
function monthKey(date = new Date()) { return date.toISOString().slice(0, 7); }
function nowIso() { return new Date().toISOString(); }

async function readJson(file, fallback = []) {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : fallback;
    return parsed;
  } catch { return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}
function studentId(a = {}) { return text(a.id || a._id || a.alunoId || a.aluno_id); }
function studentName(a = {}) { return text(a.nome || a.alunoNome || a.name || "Aluno"); }
function belongs(item = {}, aluno = {}) {
  const aid = studentId(aluno);
  if (same(item.alunoId || item.aluno_id, aid)) return true;
  const name = normalize(studentName(aluno));
  return name && [item.alunoNome, item.nomeAluno, item.aluno, item.pessoa, item.descricao].some(v => normalize(v).includes(name));
}
function isPaid(item = {}) { return ["pago", "paga", "recebido", "quitado", "baixado"].includes(normalize(item.status || item.statusPagamento)); }
function isCancelled(item = {}) { return ["cancelado", "cancelada", "estornado", "estornada", "excluido", "excluida"].includes(normalize(item.status || item.situacao)); }
function dueDate(item = {}) { return text(item.vencimento || item.dataVencimento || item.data_vencimento).slice(0, 10); }
function amount(item = {}) { return number(item.valorRestante ?? item.saldo ?? item.valorAberto ?? item.total ?? item.valorOriginal ?? item.valor); }

async function getStudent(alunoId) {
  const alunos = await readJson(FILES.alunos, []);
  return alunos.find(a => same(studentId(a), alunoId)) || null;
}
async function overdueDebt(aluno) {
  const [mensalidades, financeiro] = await Promise.all([
    readJson(FILES.mensalidades, []), readJson(FILES.financeiro, [])
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const all = [...mensalidades, ...financeiro]
    .filter(item => belongs(item, aluno))
    .filter(item => !isPaid(item) && !isCancelled(item))
    .filter(item => dueDate(item) && dueDate(item) < today && amount(item) > 0)
    .sort((a, b) => dueDate(a).localeCompare(dueDate(b)));
  const first = all[0] || null;
  return { item: first, total: Number(all.reduce((sum, item) => sum + amount(item), 0).toFixed(2)), count: all.length };
}
function pixConfiguration(value = 0) {
  const copyPaste = text(process.env.FUSION_PIX_COPY_PASTE);
  const key = text(process.env.FUSION_PIX_KEY);
  return {
    configured: Boolean(copyPaste || key),
    code: copyPaste || key,
    type: copyPaste ? "copia_cola" : "chave",
    receiver: text(process.env.FUSION_PIX_RECEIVER || "Academia"),
    city: text(process.env.FUSION_PIX_CITY),
    value
  };
}
async function loadRequests() {
  const data = await readJson(STORE_FILE, []);
  return Array.isArray(data) ? data : [];
}
async function saveReceipt(dataUrl, requestId) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) { const e = new Error("Envie um comprovante em PNG, JPG ou WEBP."); e.status = 400; throw e; }
  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) { const e = new Error("O comprovante deve ter no máximo 8 MB."); e.status = 400; throw e; }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${requestId}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/emergency-receipts/${filename}`;
}

export async function studentEmergencyStatus(alunoId) {
  const aluno = await getStudent(alunoId);
  if (!aluno) { const e = new Error("Aluno não encontrado."); e.status = 404; throw e; }
  const requests = await loadRequests();
  const currentMonth = monthKey();
  const used = requests.find(r => same(r.alunoId, alunoId) && r.competencia === currentMonth && r.status !== "cancelado");
  const active = [...requests].reverse().find(r => same(r.alunoId, alunoId) && r.acessoValidoAte && new Date(r.acessoValidoAte).getTime() > Date.now());
  const debt = await overdueDebt(aluno);
  return {
    ok: true,
    aluno: { id: studentId(aluno), nome: studentName(aluno) },
    elegivel: Boolean(debt.item && !used),
    motivo: used ? "A tentativa emergencial deste mês já foi utilizada." : !debt.item ? "Não existe mensalidade vencida elegível." : "",
    competencia: currentMonth,
    divida: debt,
    tentativa: used || null,
    acessoAtivo: active || null,
    pix: pixConfiguration(debt.item ? amount(debt.item) : 0)
  };
}

export async function sendEmergencyReceipt(payload = {}, context = {}) {
  const alunoId = text(payload.alunoId || context.alunoId);
  if (!alunoId) { const e = new Error("Aluno não informado."); e.status = 400; throw e; }
  const status = await studentEmergencyStatus(alunoId);
  if (!status.elegivel) { const e = new Error(status.motivo || "Liberação emergencial indisponível."); e.status = 409; throw e; }
  if (!status.pix.configured) { const e = new Error("PIX não configurado. Defina FUSION_PIX_KEY ou FUSION_PIX_COPY_PASTE."); e.status = 503; throw e; }

  const requests = await loadRequests();
  const requestId = id("emerg");
  const receiptUrl = await saveReceipt(payload.comprovanteBase64, requestId);
  const createdAt = nowIso();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const conversationId = `emergencia_${alunoId}_${status.competencia.replace("-", "")}`;
  const record = {
    id: requestId,
    alunoId,
    alunoNome: status.aluno.nome,
    competencia: status.competencia,
    status: "comprovante_enviado",
    mensalidadeId: text(status.divida.item?.id || status.divida.item?.mensalidadeId),
    valor: amount(status.divida.item),
    vencimento: dueDate(status.divida.item),
    comprovanteUrl: receiptUrl,
    conversaId: conversationId,
    criadoEm: createdAt,
    acessoLiberadoEm: createdAt,
    acessoValidoAte: validUntil,
    ip: text(context.ip),
    userAgent: text(context.userAgent).slice(0, 300)
  };
  requests.push(record);
  await writeJson(STORE_FILE, requests);

  const chat = await enviarMensagemChat({
    conversaId: conversationId,
    origem: "portal_aluno",
    remetente: "aluno",
    nome: status.aluno.nome,
    alunoId,
    mensagem: `LIBERAÇÃO EMERGENCIAL\nSolicitação: ${requestId}\nValor informado: R$ ${record.valor.toFixed(2).replace(".", ",")}\nVencimento: ${record.vencimento || "-"}\nComprovante: ${receiptUrl}\nAcesso temporário válido até: ${new Date(validUntil).toLocaleString("pt-BR")}`
  });

  let accessCommand = null;
  let accessError = "";
  try {
    accessCommand = await queueRelease({
      alunoId,
      alunoNome: status.aluno.nome,
      origem: "portal-aluno-emergencial",
      motivo: `comprovante-emergencial-${requestId}`,
      tempoSegundos: 5
    });
  } catch (error) { accessError = error.message || "Falha ao enfileirar abertura imediata."; }

  return { ok: true, solicitacao: record, chat, accessCommand, accessError };
}

export async function validateTemporaryEmergencyAccess(alunoId) {
  const requests = await loadRequests();
  const active = [...requests].reverse().find(r => same(r.alunoId, alunoId) && r.acessoValidoAte && new Date(r.acessoValidoAte).getTime() > Date.now());
  return { ok: true, permitido: Boolean(active), solicitacao: active || null };
}

export async function updateEmergencyRequest(idValue, action, operator = {}) {
  const requests = await loadRequests();
  const item = requests.find(r => same(r.id, idValue));
  if (!item) { const e = new Error("Solicitação não encontrada."); e.status = 404; throw e; }
  const allowed = ["confirmado", "recusado", "baixado"];
  if (!allowed.includes(action)) { const e = new Error("Ação inválida."); e.status = 400; throw e; }
  item.status = action;
  item.atualizadoEm = nowIso();
  item.operadorId = text(operator.id);
  item.operadorNome = text(operator.nome);
  await writeJson(STORE_FILE, requests);
  await enviarMensagemChat({
    conversaId: item.conversaId,
    origem: "portal_aluno",
    remetente: "sistema",
    nome: "Fusion ERP",
    alunoId: item.alunoId,
    mensagem: action === "confirmado" ? "Pagamento confirmado pela recepção." : action === "baixado" ? "Mensalidade marcada como baixada pela equipe." : "Comprovante recusado pela recepção. A tentativa mensal permanece consumida."
  });
  return { ok: true, solicitacao: item };
}
