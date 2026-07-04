import express from "express";
import {
  listarAgenda,
  obterResumoAgenda,
  criarAula,
  atualizarAula,
  excluirAula
} from "./agenda.service.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  const aulas = await listarAgenda(req.query);
  res.json({ ok: true, aulas });
});

router.get("/resumo", async (req, res) => {
  const resumo = await obterResumoAgenda();
  res.json({ ok: true, resumo });
});

router.post("/", async (req, res) => {
  const aula = await criarAula(req.body);
  res.status(201).json({ ok: true, aula });
});

router.put("/:id", async (req, res) => {
  const aula = await atualizarAula(req.params.id, req.body);

  if (!aula) {
    return res.status(404).json({
      ok: false,
      mensagem: "Aula não encontrada"
    });
  }

  res.json({ ok: true, aula });
});

router.delete("/:id", async (req, res) => {
  const aula = await excluirAula(req.params.id);

  if (!aula) {
    return res.status(404).json({
      ok: false,
      mensagem: "Aula não encontrada"
    });
  }

  res.json({ ok: true, aula });
});

export default router;
