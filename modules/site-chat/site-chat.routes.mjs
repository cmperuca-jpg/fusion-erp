import express from "express";
import { validarToken } from "../auth/auth.service.mjs";
import {
  atualizarConversaChat,
  enviarMensagemChat,
  listarConversasChat,
  listarMensagensChat,
  listarMensagensChatPublico,
  marcarLeituraChat
} from "./site-chat.service.mjs";

const router = express.Router();
const erro = (res, e) => res.status(e.status || 500).json({ ok: false, erro: e.message || "Erro no chat." });

async function usuarioAutenticado(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization) return null;
  try { return await validarToken(authorization); } catch { return null; }
}

function payloadPublico(payload = {}) {
  const origem = String(payload.origem || "site").trim();
  return { ...payload, origem, remetente: origem === "portal_aluno" ? "aluno" : "visitante" };
}

router.get("/conversas", async (req, res) => {
  try { res.json(await listarConversasChat(req.query || {})); } catch (e) { erro(res, e); }
});

router.get("/mensagens", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    res.json(usuario ? await listarMensagensChat(req.query || {}) : await listarMensagensChatPublico(req.query || {}));
  } catch (e) { erro(res, e); }
});

router.post("/mensagens", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    const payload = usuario
      ? { ...(req.body || {}), operadorId: req.body?.operadorId || usuario.id || "", operadorNome: req.body?.operadorNome || usuario.nome || "" }
      : payloadPublico(req.body || {});
    res.status(201).json(await enviarMensagemChat(payload));
  } catch (e) { erro(res, e); }
});

router.post("/conversas/:id/leitura", async (req, res) => {
  try { res.json(await marcarLeituraChat(req.params.id, req.body?.leitor || "atendimento")); } catch (e) { erro(res, e); }
});

router.patch("/conversas/:id", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    if (!usuario) return res.status(401).json({ ok: false, erro: "Autenticação obrigatória." });
    res.json(await atualizarConversaChat(req.params.id, req.body || {}));
  } catch (e) { erro(res, e); }
});

router.get("/", async (req, res) => {
  try { res.json(await listarConversasChat(req.query || {})); } catch (e) { erro(res, e); }
});

router.post("/", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    const payload = usuario ? (req.body || {}) : payloadPublico(req.body || {});
    res.status(201).json(await enviarMensagemChat(payload));
  } catch (e) { erro(res, e); }
});

export default router;
