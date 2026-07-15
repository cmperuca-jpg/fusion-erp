import { Router } from "express";
import * as exerciciosService from "./exercicios.service.mjs";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const exercicios = await exerciciosService.listar();
    res.json(exercicios);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const exercicio = await exerciciosService.buscar(req.params.id);

    if (!exercicio) {
      return res.status(404).json({ erro: "Exercício não encontrado" });
    }

    res.json(exercicio);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const exercicio = await exerciciosService.criar(req.body);
    res.status(201).json(exercicio);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const exercicio = await exerciciosService.atualizar(req.params.id, req.body);

    if (!exercicio) {
      return res.status(404).json({ erro: "Exercício não encontrado" });
    }

    res.json(exercicio);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const excluido = await exerciciosService.excluir(req.params.id);

    if (!excluido) {
      return res.status(404).json({ erro: "Exercício não encontrado" });
    }

    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;