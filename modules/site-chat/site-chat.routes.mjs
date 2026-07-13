import express from "express";
import {
  enviarMensagemChat,
  listarConversasChat,
  listarMensagensChat
} from "./site-chat.service.mjs";

const router = express.Router();

function erro(res, e) {
  res.status(e.status || 500).json({
    ok: false,
    erro: e.message || "Erro no chat."
  });
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
    res.json(await listarMensagensChat(req.query || {}));
  } catch (e) {
    erro(res, e);
  }
});

router.post("/mensagens", async (req, res) => {
  try {
    res.status(201).json(await enviarMensagemChat(req.body || {}));
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
    res.status(201).json(await enviarMensagemChat(req.body || {}));
  } catch (e) {
    erro(res, e);
  }
});

export default router;
