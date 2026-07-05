import { Router } from "express";
import * as treinosService from "./treinos.service.mjs";

const router = Router();

function responderErro(res, error, status = 500) {
  return res.status(error.status || status).json({
    ok: false,
    sucesso: false,
    erro: error.message,
    mensagem: error.message
  });
}

router.get("/", async (req, res) => {
  try {
    const treinos = await treinosService.listar(req.query || {});
    res.json({ ok: true, sucesso: true, treinos, dados: treinos });
  } catch (error) {
    responderErro(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const treino = await treinosService.buscar(req.params.id);
    if (!treino) {
      return res.status(404).json({ ok: false, sucesso: false, mensagem: "Treino não encontrado" });
    }
    res.json({ ok: true, sucesso: true, treino });
  } catch (error) {
    responderErro(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const treino = await treinosService.criar(req.body || {});
    res.status(201).json({ ok: true, sucesso: true, treino, mensagem: "Treino criado com sucesso" });
  } catch (error) {
    responderErro(res, error, 400);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const treino = await treinosService.atualizar(req.params.id, req.body || {});
    if (!treino) {
      return res.status(404).json({ ok: false, sucesso: false, mensagem: "Treino não encontrado" });
    }
    res.json({ ok: true, sucesso: true, treino, mensagem: "Treino atualizado com sucesso" });
  } catch (error) {
    responderErro(res, error, 400);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ok = await treinosService.excluir(req.params.id, req.body?.usuario || req.query?.usuario || "sistema");
    if (!ok) {
      return res.status(404).json({ ok: false, sucesso: false, mensagem: "Treino não encontrado" });
    }
    res.json({ ok: true, sucesso: true, mensagem: "Treino excluído com sucesso" });
  } catch (error) {
    responderErro(res, error);
  }
});

export default router;
