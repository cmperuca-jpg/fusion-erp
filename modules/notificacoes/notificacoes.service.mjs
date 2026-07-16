import crypto from "node:crypto";
import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from "../core/persistence/durable-json.mjs";

const COLECAO = "notificacoes";
const LIMITE_HISTORICO = 500;

function texto(valor, limite = 500) {
  return String(valor ?? "").trim().slice(0, limite);
}

function normalizar(valor) {
  return texto(valor, 120).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
}

function perfis(destinatarios = []) {
  const lista = Array.isArray(destinatarios) ? destinatarios : [destinatarios];
  return [...new Set(lista.map(normalizar).filter(Boolean))];
}

function visivelPara(notificacao, usuario = {}) {
  const destinos = perfis(notificacao.destinatarios || []);
  if (!destinos.length || destinos.includes("todos")) return true;
  const perfil = normalizar(usuario.perfil || usuario.perfilOriginal || "");
  const permissoes = perfis(usuario.permissoes || []);
  if (["admin", "administrador"].includes(perfil) || permissoes.includes("*")) return true;
  return destinos.includes(perfil) || destinos.some(item => permissoes.includes(item));
}

export async function criarNotificacao(dados = {}) {
  return executarTransacaoJson(async () => {
    const lista = await lerJsonDuravel(COLECAO, []);
    const eventoId = texto(dados.eventoId || dados.evento_id, 180);
    if (eventoId) {
      const existente = lista.find(item => String(item.eventoId || "") === eventoId);
      if (existente) return existente;
    }

    const agora = new Date().toISOString();
    const notificacao = {
      id: crypto.randomUUID(),
      eventoId,
      tipo: normalizar(dados.tipo || "sistema"),
      prioridade: normalizar(dados.prioridade || "normal"),
      titulo: texto(dados.titulo || "Novo aviso", 140),
      mensagem: texto(dados.mensagem || dados.descricao || "", 600),
      contato: texto(dados.contato || dados.telefone || dados.whatsapp || "", 160),
      link: texto(dados.link || "/pages/dashboard/index.html", 300),
      referenciaId: texto(dados.referenciaId || dados.referencia_id || "", 160),
      destinatarios: perfis(dados.destinatarios?.length ? dados.destinatarios : ["admin", "recepcao", "comercial"]),
      lidaPor: [],
      criadoEm: agora,
      atualizadoEm: agora
    };

    lista.unshift(notificacao);
    await salvarJsonDuravel(COLECAO, lista.slice(0, LIMITE_HISTORICO));
    return notificacao;
  }, { operacaoId: `notificacao-${dados.eventoId || crypto.randomUUID()}` });
}

export async function listarNotificacoes({ usuario = {}, limite = 40, somenteNaoLidas = false } = {}) {
  const usuarioId = texto(usuario.id || usuario.email || "usuario", 160);
  const maximo = Math.max(1, Math.min(100, Number(limite || 40)));
  const lista = (await lerJsonDuravel(COLECAO, []))
    .filter(item => visivelPara(item, usuario))
    .map(item => ({ ...item, lida: Array.isArray(item.lidaPor) && item.lidaPor.includes(usuarioId) }));
  const filtrada = somenteNaoLidas ? lista.filter(item => !item.lida) : lista;
  return {
    notificacoes: filtrada.slice(0, maximo),
    total: filtrada.length,
    naoLidas: lista.filter(item => !item.lida).length
  };
}

export async function marcarNotificacaoLida(id, usuario = {}) {
  return executarTransacaoJson(async () => {
    const lista = await lerJsonDuravel(COLECAO, []);
    const item = lista.find(n => String(n.id) === String(id));
    if (!item || !visivelPara(item, usuario)) {
      throw Object.assign(new Error("Notificação não encontrada."), { status: 404 });
    }
    const usuarioId = texto(usuario.id || usuario.email || "usuario", 160);
    item.lidaPor = Array.isArray(item.lidaPor) ? item.lidaPor : [];
    if (!item.lidaPor.includes(usuarioId)) item.lidaPor.push(usuarioId);
    item.atualizadoEm = new Date().toISOString();
    await salvarJsonDuravel(COLECAO, lista);
    return item;
  }, { operacaoId: `notificacao-lida-${id}-${usuario.id || usuario.email || "usuario"}` });
}

export async function marcarTodasLidas(usuario = {}) {
  return executarTransacaoJson(async () => {
    const lista = await lerJsonDuravel(COLECAO, []);
    const usuarioId = texto(usuario.id || usuario.email || "usuario", 160);
    let alteradas = 0;
    for (const item of lista) {
      if (!visivelPara(item, usuario)) continue;
      item.lidaPor = Array.isArray(item.lidaPor) ? item.lidaPor : [];
      if (!item.lidaPor.includes(usuarioId)) {
        item.lidaPor.push(usuarioId);
        item.atualizadoEm = new Date().toISOString();
        alteradas += 1;
      }
    }
    if (alteradas) await salvarJsonDuravel(COLECAO, lista);
    return { alteradas };
  }, { operacaoId: `notificacoes-lidas-${usuario.id || usuario.email || "usuario"}-${Date.now()}` });
}
