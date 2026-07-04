import { Router } from "express";
import * as presencasService from "./presencas.service.mjs";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const presencas = await presencasService.listar(req.query);
    res.json(presencas);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const presenca = await presencasService.buscar(req.params.id);

    if (!presenca) {
      return res.status(404).json({ erro: "Presença não encontrada" });
    }

    res.json(presenca);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const presenca = await presencasService.criar(req.body);
    res.status(201).json(presenca);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const presenca = await presencasService.atualizar(req.params.id, req.body);

    if (!presenca) {
      return res.status(404).json({ erro: "Presença não encontrada" });
    }

    res.json(presenca);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const excluido = await presencasService.excluir(req.params.id);

    if (!excluido) {
      return res.status(404).json({ erro: "Presença não encontrada" });
    }

    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;
