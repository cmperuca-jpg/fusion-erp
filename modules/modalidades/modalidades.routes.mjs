import express from "express";
import { obterAparencia, salvarAparencia, salvarImagem } from "../aparencia/aparencia.service.mjs";
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

const responderAparencia = (res, error) =>
  res.status(error.status || 500).json({
    ok: false,
    mensagem: error.message || "Erro ao configurar a identidade da academia."
  });

router.get("/onboarding/aparencia", async (_req, res) => {
  try {
    res.json({ ok: true, aparencia: await obterAparencia() });
  } catch (error) {
    responderAparencia(res, error);
  }
});

router.put("/onboarding/aparencia", async (req, res) => {
  try {
    res.json({ ok: true, aparencia: await salvarAparencia(req.body || {}) });
  } catch (error) {
    responderAparencia(res, error);
  }
});

router.post("/onboarding/aparencia/imagem", async (req, res) => {
  try {
    res.status(201).json({ ok: true, ...(await salvarImagem(req.body || {})) });
  } catch (error) {
    responderAparencia(res, error);
  }
});


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
