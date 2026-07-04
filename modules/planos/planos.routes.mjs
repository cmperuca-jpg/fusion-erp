import express from "express";
import {
  obterPlanos,
  criarPlano,
  atualizarPlano,
  removerPlano,
  obterResumoPlanos
} from "./planos.service.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const planos = await obterPlanos(req.query);
    res.json({ sucesso: true, dados: planos });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const resumo = await obterResumoPlanos();
    res.json({ sucesso: true, dados: resumo });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const plano = await criarPlano(req.body);
    res.status(201).json({ sucesso: true, dados: plano });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const plano = await atualizarPlano(req.params.id, req.body);
    res.json({ sucesso: true, dados: plano });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const resultado = await removerPlano(req.params.id);
    res.json({ sucesso: true, dados: resultado });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

export default router;
