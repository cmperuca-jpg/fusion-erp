import { Router } from "express";
import {
  atualizarExercicio,
  dashboardBiblioteca,
  listarExercicios,
  obterExercicio,
  organizarBiblioteca,
  statusBibliotecaInteligente,
  validarBiblioteca
} from "./biblioteca-inteligente.service.mjs";

const router = Router();

function responderErro(res, erro) {
  const status = Number(erro?.status || erro?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    mensagem: erro?.message || "Erro na Biblioteca Inteligente."
  });
}

router.get("/status", async (_req, res) => {
  try {
    res.json(await statusBibliotecaInteligente());
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.get("/dashboard", async (_req, res) => {
  try {
    res.json(await dashboardBiblioteca());
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.get("/exercicios", async (req, res) => {
  try {
    res.json(await listarExercicios(req.query || {}));
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.get("/exercicios/:id", async (req, res) => {
  try {
    res.json(await obterExercicio(req.params.id));
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.put("/exercicios/:id", async (req, res) => {
  try {
    res.json(await atualizarExercicio(req.params.id, req.body || {}));
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.post("/organizar", async (_req, res) => {
  try {
    res.json(await organizarBiblioteca());
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.post("/atualizar", async (_req, res) => {
  try {
    res.json(await organizarBiblioteca());
  } catch (erro) {
    responderErro(res, erro);
  }
});

router.post("/validar", async (_req, res) => {
  try {
    res.json(await validarBiblioteca());
  } catch (erro) {
    responderErro(res, erro);
  }
});

export default router;
