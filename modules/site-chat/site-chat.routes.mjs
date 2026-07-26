import express from "express";
import { validarToken } from "../auth/auth.service.mjs";
import {
  enviarMensagemChat,
  listarConversasChat,
  listarMensagensChat,
  listarMensagensChatPublico
} from "./site-chat.service.mjs";

const router = express.Router();

function erro(res, e) {
  res.status(e.status || 500).json({
    ok: false,
    erro: e.message || "Erro no chat."
  });
}

async function usuarioAutenticado(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization) return null;
  try {
    return await validarToken(authorization);
  } catch {
    return null;
  }
}

function payloadPublico(payload = {}) {
  const origem = String(payload.origem || "site").trim();
  return {
    ...payload,
    origem,
    remetente: origem === "portal_aluno" ? "aluno" : "visitante"
  };
}

router.get("/conversas", async (req, res) => {
  try {
    res.json(await listarConversasChat(req.query || {}));
  } catch (e) {
    erro(res, e);
  }
});

router.get("/mensagens", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    const resposta = usuario
      ? await listarMensagensChat(req.query || {})
      : await listarMensagensChatPublico(req.query || {});
    res.json(resposta);
  } catch (e) {
    erro(res, e);
  }
});

router.post("/mensagens", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    const payload = usuario ? (req.body || {}) : payloadPublico(req.body || {});
    res.status(201).json(await enviarMensagemChat(payload));
  } catch (e) {
    erro(res, e);
  }
});

router.get("/", async (req, res) => {
  try {
    res.json(await listarConversasChat(req.query || {}));
  } catch (e) {
    erro(res, e);
  }
});

router.post("/", async (req, res) => {
  try {
    const usuario = await usuarioAutenticado(req);
    const payload = usuario ? (req.body || {}) : payloadPublico(req.body || {});
    res.status(201).json(await enviarMensagemChat(payload));
  } catch (e) {
    erro(res, e);
  }
});

export default router;
