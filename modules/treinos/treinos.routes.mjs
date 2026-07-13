import { Router } from "express";
import { obterBiblioteca, obterTreinos, criarTreino, atualizarTreino, removerTreino, autenticarAlunoTreino, liberarCatracaPortalAluno, obterContadorCatracaPortalAluno } from "./treinos.service.mjs";

const router = Router();

router.get("/biblioteca", async (req, res) => {
  try { res.json({ ok: true, dados: await obterBiblioteca() }); }
  catch (erro) { res.status(500).json({ ok: false, mensagem: "Erro ao carregar biblioteca de exercícios", erro: erro.message }); }
});


router.post("/aluno-login", async (req, res) => {
  try { res.json({ ok: true, dados: await autenticarAlunoTreino(req.body || {}) }); }
  catch (erro) { res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao autenticar aluno" }); }
});

router.post("/aluno-liberar-catraca", async (req, res) => {
  try { res.json({ ok: true, dados: await liberarCatracaPortalAluno(req.body || {}) }); }
  catch (erro) { res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao liberar catraca" }); }
});

router.get("/aluno-catraca-contador", async (req, res) => {
  try { res.json({ ok: true, dados: await obterContadorCatracaPortalAluno(req.query || {}) }); }
  catch (erro) { res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao consultar acessos da catraca" }); }
});

router.get("/", async (req, res) => {
  try { res.json({ ok: true, dados: await obterTreinos({ alunoId: req.query.alunoId }) }); }
  catch (erro) { res.status(500).json({ ok: false, mensagem: "Erro ao carregar treinos", erro: erro.message }); }
});

router.post("/", async (req, res) => {
  try { res.status(201).json({ ok: true, dados: await criarTreino(req.body || {}) }); }
  catch (erro) { res.status(erro.statusCode || 500).json({ ok: false, mensagem: erro.message || "Erro ao salvar treino" }); }
});


router.put("/:id", async (req, res) => {
  try {
    const treino = await atualizarTreino(req.params.id, req.body || {});
    if (!treino) return res.status(404).json({ ok:false, mensagem:"Treino não encontrado" });
    res.json({ ok:true, dados:treino, mensagem:"Treino atualizado com sucesso" });
  } catch (erro) { res.status(erro.statusCode || 400).json({ ok:false, mensagem:erro.message || "Erro ao atualizar treino" }); }
});

router.delete("/:id", async (req, res) => {
  try { res.json({ ok: true, dados: await removerTreino(req.params.id) }); }
  catch (erro) { res.status(500).json({ ok: false, mensagem: "Erro ao remover treino", erro: erro.message }); }
});

export default router;
