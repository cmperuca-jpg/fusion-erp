import { Router } from "express";
import * as avaliacoesService from "./avaliacoes.service.mjs";

const router = Router();

function erro(res, error, status = 500) {
  return res.status(error.status || status).json({ ok: false, erro: error.message, mensagem: error.message });
}

router.get("/", async (req, res) => {
  try {
    const avaliacoes = await avaliacoesService.listar(req.query.aluno_id || req.query.alunoId);
    res.json(avaliacoes);
  } catch (error) { erro(res, error); }
});

router.get("/:id", async (req, res) => {
  try {
    const avaliacao = await avaliacoesService.buscar(req.params.id);
    if (!avaliacao) return res.status(404).json({ ok: false, erro: "Avaliação não encontrada", mensagem: "Avaliação não encontrada" });
    res.json(avaliacao);
  } catch (error) { erro(res, error); }
});

router.post("/", async (req, res) => {
  try {
    const avaliacao = await avaliacoesService.criar(req.body || {});
    res.status(201).json({ ok: true, avaliacao, mensagem: "Avaliação cadastrada com sucesso" });
  } catch (error) { erro(res, error, 400); }
});

router.put("/:id", async (req, res) => {
  try {
    const avaliacao = await avaliacoesService.atualizar(req.params.id, req.body || {});
    if (!avaliacao) return res.status(404).json({ ok: false, erro: "Avaliação não encontrada", mensagem: "Avaliação não encontrada" });
    res.json({ ok: true, avaliacao, mensagem: "Avaliação atualizada com sucesso" });
  } catch (error) { erro(res, error, 400); }
});

router.delete("/:id", async (req, res) => {
  try {
    const excluido = await avaliacoesService.excluir(req.params.id);
    if (!excluido) return res.status(404).json({ ok: false, erro: "Avaliação não encontrada", mensagem: "Avaliação não encontrada" });
    res.json({ ok: true, sucesso: true, mensagem: "Avaliação excluída com sucesso" });
  } catch (error) { erro(res, error); }
});

export default router;
