import { Router } from "express";
import { obterBiblioteca, obterTreinos, criarTreino, removerTreino, autenticarAlunoTreino } from "./treinos.service.mjs";

const router = Router();

router.get("/biblioteca", async (req, res) => {
  try { res.json({ ok: true, dados: await obterBiblioteca() }); }
  catch (erro) { res.status(500).json({ ok: false, mensagem: "Erro ao carregar biblioteca de exercícios", erro: erro.message }); }
});


router.post("/aluno-login", async (req, res) => {
  try { res.json({ ok: true, dados: await autenticarAlunoTreino(req.body || {}) }); }
  catch (erro) { res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao autenticar aluno" }); }
});

router.get("/", async (req, res) => {
  try { res.json({ ok: true, dados: await obterTreinos({ alunoId: req.query.alunoId }) }); }
  catch (erro) { res.status(500).json({ ok: false, mensagem: "Erro ao carregar treinos", erro: erro.message }); }
});

router.post("/", async (req, res) => {
  try { res.status(201).json({ ok: true, dados: await criarTreino(req.body || {}) }); }
  catch (erro) { res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao salvar treino" }); }
});

router.delete("/:id", async (req, res) => {
  try { res.json({ ok: true, dados: await removerTreino(req.params.id) }); }
  catch (erro) { res.status(500).json({ ok: false, mensagem: "Erro ao remover treino", erro: erro.message }); }
});

export default router;
