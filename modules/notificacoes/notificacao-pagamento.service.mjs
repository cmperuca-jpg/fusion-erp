import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const ARQ_LOG = "notificacoes_pagamento.json";
const LIMITE = 5000;
const RESERVA_MS = 5 * 60 * 1000;
const texto = (v, limite = 500) => String(v ?? "").trim().slice(0, limite);
const dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function emailValido(v) {
  const s = texto(v, 180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "";
}
function telefoneE164(v) {
  let d = texto(v, 40).replace(/\D/g, "");
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 && d.startsWith("55") ? `+${d}` : "";
}
function mascararEmail(email) {
  const [local = "", dominio = ""] = String(email || "").split("@");
  return local && dominio ? `${local.slice(0, 2)}***@${dominio}` : "";
}
function mascararTelefone(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  return d ? `***${d.slice(-4)}` : "";
}
function provedores() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.FUSION_EMAIL_FROM),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM)
  };
}
export function statusProvedoresPagamento() { return provedores(); }

async function localizarAluno(lancamento = {}) {
  const id = texto(lancamento.alunoId || lancamento.aluno_id || (String(lancamento.pessoaTipo || "").toLowerCase() === "aluno" ? lancamento.pessoaId : ""), 160);
  if (!id) return {};
  const alunos = await lerJsonDuravel("alunos.json", []);
  return alunos.find((a) => String(a.id || a.alunoId || "") === id) || {};
}
function nomePessoa(aluno = {}, lancamento = {}) {
  return texto(aluno.nome || aluno.nomeCompleto || aluno.aluno || lancamento.alunoFornecedor || lancamento.pessoa || "cliente", 120);
}
function contatoEmail(aluno = {}, lancamento = {}) {
  if (aluno.emailOptOut === true || aluno.autorizaEmail === false) return "";
  return emailValido(aluno.emailFinanceiro || aluno.emailResponsavel || aluno.responsavelEmail || aluno.email || lancamento.email || "");
}
function contatoSms(aluno = {}, lancamento = {}) {
  if (aluno.smsOptOut === true || aluno.autorizaSms === false) return "";
  return telefoneE164(aluno.telefoneFinanceiro || aluno.celularResponsavel || aluno.telefoneResponsavel || aluno.celular || aluno.telefone || aluno.whatsapp || aluno.fone || lancamento.telefone || "");
}

async function garantirEvento({ eventoId, referenciaId, alunoId, email, telefone }) {
  return executarTransacaoJson(async () => {
    const logs = await lerJsonDuravel(ARQ_LOG, []);
    let item = logs.find((x) => String(x.eventoId || "") === eventoId);
    if (!item) {
      const agora = new Date().toISOString();
      item = { eventoId, referenciaId: texto(referenciaId, 160), alunoId: texto(alunoId, 160), contatos: { email: mascararEmail(email), sms: mascararTelefone(telefone) }, canais: { email: { status: "pendente", tentativas: 0 }, sms: { status: "pendente", tentativas: 0 } }, criadoEm: agora, atualizadoEm: agora };
      logs.unshift(item);
      await salvarJsonDuravel(ARQ_LOG, logs.slice(0, LIMITE));
    }
    return item;
  }, { operacaoId: `notificacao-pagamento-evento-${eventoId}` });
}

async function reservarCanal(eventoId, canal, disponivel, temContato) {
  return executarTransacaoJson(async () => {
    const logs = await lerJsonDuravel(ARQ_LOG, []);
    const item = logs.find((x) => String(x.eventoId || "") === eventoId);
    if (!item) return { enviar: false, status: "evento_ausente" };
    item.canais ||= {};
    const atual = item.canais[canal] || { status: "pendente", tentativas: 0 };
    if (atual.status === "enviado") return { enviar: false, status: "enviado" };
    const agora = new Date().toISOString();
    if (!temContato) {
      item.canais[canal] = { ...atual, status: "sem_contato", atualizadoEm: agora };
      item.atualizadoEm = agora; await salvarJsonDuravel(ARQ_LOG, logs); return { enviar: false, status: "sem_contato" };
    }
    if (!disponivel) {
      item.canais[canal] = { ...atual, status: "nao_configurado", atualizadoEm: agora };
      item.atualizadoEm = agora; await salvarJsonDuravel(ARQ_LOG, logs); return { enviar: false, status: "nao_configurado" };
    }
    const anterior = Date.parse(atual.atualizadoEm || "");
    if (atual.status === "enviando" && Number.isFinite(anterior) && Date.now() - anterior < RESERVA_MS) return { enviar: false, status: "enviando" };
    item.canais[canal] = { status: "enviando", tentativas: Number(atual.tentativas || 0) + 1, atualizadoEm: agora };
    item.atualizadoEm = agora; await salvarJsonDuravel(ARQ_LOG, logs); return { enviar: true, status: "enviando" };
  }, { operacaoId: `notificacao-pagamento-reserva-${eventoId}-${canal}-${Date.now()}` });
}

async function concluirCanal(eventoId, canal, ok, detalhe = "") {
  return executarTransacaoJson(async () => {
    const logs = await lerJsonDuravel(ARQ_LOG, []);
    const item = logs.find((x) => String(x.eventoId || "") === eventoId);
    if (!item) return;
    const atual = item.canais?.[canal] || {};
    const agora = new Date().toISOString();
    item.canais ||= {};
    item.canais[canal] = { ...atual, status: ok ? "enviado" : "falhou", erro: ok ? "" : texto(detalhe, 220), atualizadoEm: agora };
    item.atualizadoEm = agora; await salvarJsonDuravel(ARQ_LOG, logs);
  }, { operacaoId: `notificacao-pagamento-conclusao-${eventoId}-${canal}-${Date.now()}` });
}

async function enviarEmail({ to, nome, valor, data, forma, recibo }) {
  const academia = texto(process.env.FUSION_NOME_ACADEMIA || "Fusion ERP", 120);
  const corpo = `${nome}, confirmamos o recebimento de ${dinheiro(valor)} em ${data || "hoje"}${forma ? ` via ${forma}` : ""}.${recibo ? ` Recibo ${recibo}.` : ""}`;
  const resp = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.FUSION_EMAIL_FROM, to: [to], subject: `Pagamento confirmado - ${academia}`, text: corpo, html: `<h2>Pagamento confirmado</h2><p>${corpo.replace(/[<>&"]/g, "")}</p>` }) });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.message || `Resend HTTP ${resp.status}`);
  return texto(json?.id, 160);
}

async function enviarSms({ to, valor, data, recibo }) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_SMS_FROM;
  const academia = texto(process.env.FUSION_NOME_ACADEMIA || "Fusion ERP", 50);
  const body = `${academia}: pagamento de ${dinheiro(valor)} confirmado${data ? ` em ${data}` : ""}${recibo ? `. Recibo ${recibo}` : ""}.`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: "POST", signal: AbortSignal.timeout(8000), headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.message || `Twilio HTTP ${resp.status}`);
  return texto(json?.sid, 160);
}

export async function notificarPagamentoConfirmado(dados = {}) {
  const lancamento = dados.lancamento || {}, recibo = dados.recibo || lancamento.recibo || {};
  const eventoId = texto(dados.eventoId || recibo.id || recibo.numero || dados.operacaoId, 180);
  if (!eventoId) return { ok: false, status: "sem_evento", canais: {} };
  const aluno = await localizarAluno(lancamento), email = contatoEmail(aluno, lancamento), telefone = contatoSms(aluno, lancamento), cfg = provedores();
  const nome = nomePessoa(aluno, lancamento), valor = Number(dados.valorPago || recibo.valorPago || lancamento.valorPago || lancamento.valorRecebido || 0);
  const data = texto(dados.dataPagamento || recibo.data || lancamento.pagamento || lancamento.dataPagamento || new Date().toISOString().slice(0, 10), 30);
  const forma = texto(dados.formaPagamento || lancamento.formaPagamento || "", 80), numeroRecibo = texto(recibo.numero || "", 80);
  await garantirEvento({ eventoId, referenciaId: lancamento.id || dados.referenciaId, alunoId: aluno.id || lancamento.alunoId, email, telefone });
  const canais = {};
  const re = await reservarCanal(eventoId, "email", cfg.email, Boolean(email)); canais.email = re.status;
  if (re.enviar) { try { await enviarEmail({ to: email, nome, valor, data, forma, recibo: numeroRecibo }); await concluirCanal(eventoId, "email", true); canais.email = "enviado"; } catch (e) { await concluirCanal(eventoId, "email", false, e.message); canais.email = "falhou"; } }
  const rs = await reservarCanal(eventoId, "sms", cfg.sms, Boolean(telefone)); canais.sms = rs.status;
  if (rs.enviar) { try { await enviarSms({ to: telefone, valor, data, recibo: numeroRecibo }); await concluirCanal(eventoId, "sms", true); canais.sms = "enviado"; } catch (e) { await concluirCanal(eventoId, "sms", false, e.message); canais.sms = "falhou"; } }
  const v = Object.values(canais);
  const status = v.includes("enviado") ? "enviado" : v.includes("falhou") ? "falhou" : v.includes("nao_configurado") ? "nao_configurado" : "sem_contato";
  return { ok: true, status, canais };
}
