import { Router } from "express";
import * as modelosTreinoService from "./modelos-treino.service.mjs";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const modelos = await modelosTreinoService.listar();
    res.json(modelos);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const modelo = await modelosTreinoService.buscar(req.params.id);

    if (!modelo) {
      return res.status(404).json({ erro: "Modelo de treino não encontrado" });
    }

    res.json(modelo);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const modelo = await modelosTreinoService.criar(req.body);
    res.status(201).json(modelo);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const modelo = await modelosTreinoService.atualizar(req.params.id, req.body);

    if (!modelo) {
      return res.status(404).json({ erro: "Modelo de treino não encontrado" });
    }

    res.json(modelo);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const excluido = await modelosTreinoService.excluir(req.params.id);

    if (!excluido) {
      return res.status(404).json({ erro: "Modelo de treino não encontrado" });
    }

    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;
