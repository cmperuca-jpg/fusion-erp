import express from "express";
import {
  obterModalidades,
  criarModalidade,
  atualizarModalidade,
  removerModalidade,
  obterResumoModalidades,
  obterCategoriasModalidades,
  criarCategoriaModalidade
} from "./modalidades.service.mjs";

const router = express.Router();

router.get("/categorias", async (_req, res) => {
  try {
    res.json({ sucesso: true, dados: await obterCategoriasModalidades() });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.post("/categorias", async (req, res) => {
  try {
    res.status(201).json({ sucesso: true, dados: await criarCategoriaModalidade(req.body || {}) });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const modalidades = await obterModalidades(req.query);
    res.json({ sucesso: true, dados: modalidades });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const resumo = await obterResumoModalidades();
    res.json({ sucesso: true, dados: resumo });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const modalidade = await criarModalidade(req.body);
    res.status(201).json({ sucesso: true, dados: modalidade });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const modalidade = await atualizarModalidade(req.params.id, req.body);
    res.json({ sucesso: true, dados: modalidade });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const resultado = await removerModalidade(req.params.id);
    res.json({ sucesso: true, dados: resultado });
  } catch (error) {
    res.status(400).json({ sucesso: false, erro: error.message });
  }
});

export default router;
