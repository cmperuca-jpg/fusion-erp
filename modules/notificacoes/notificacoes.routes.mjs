import express from "express";
import { validarToken } from "../auth/auth.service.mjs";
import { listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas } from "./notificacoes.service.mjs";

const router = express.Router();

async function autenticar(req, res, next) {
  try {
    req.usuario = await validarToken(req.headers.authorization || "");
    next();
  } catch (erro) {
    res.status(erro.status || 401).json({ ok: false, mensagem: erro.message || "Autenticação necessária." });
  }
}

router.use(autenticar);

router.get("/", async (req, res) => {
  try {
    res.json({ ok: true, ...(await listarNotificacoes({
      usuario: req.usuario,
      limite: req.query.limite,
      somenteNaoLidas: String(req.query.naoLidas || "") === "1"
    })) });
  } catch (erro) {
    res.status(erro.status || 500).json({ ok: false, mensagem: erro.message || "Erro ao listar notificações." });
  }
});

router.post("/:id/ler", async (req, res) => {
  try {
    res.json({ ok: true, notificacao: await marcarNotificacaoLida(req.params.id, req.usuario) });
  } catch (erro) {
    res.status(erro.status || 500).json({ ok: false, mensagem: erro.message || "Erro ao atualizar notificação." });
  }
});

router.post("/ler-todas", async (req, res) => {
  try {
    res.json({ ok: true, ...(await marcarTodasLidas(req.usuario)) });
  } catch (erro) {
    res.status(erro.status || 500).json({ ok: false, mensagem: erro.message || "Erro ao atualizar notificações." });
  }
});

export default router;
