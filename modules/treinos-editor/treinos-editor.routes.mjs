import { Router } from "express";
import {
  adicionarExercicio,
  atualizarCabecalhoTreino,
  atualizarExercicio,
  duplicarTreino,
  obterTreino,
  progressaoCarga,
  reordenarExercicios,
  removerExercicio,
  statusEditorTreinos,
  substituirExercicio
} from "./treinos-editor.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no editor de treinos."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusEditorTreinos()); } catch (err) { erro(res, err); }
});

router.get("/:id", async (req, res) => {
  try { res.json(await obterTreino(req.params.id)); } catch (err) { erro(res, err); }
});

router.put("/:id", async (req, res) => {
  try { res.json(await atualizarCabecalhoTreino(req.params.id, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/:id/exercicios", async (req, res) => {
  try { res.status(201).json(await adicionarExercicio(req.params.id, req.body || {})); } catch (err) { erro(res, err); }
});

router.put("/:id/exercicios/:exercicioId", async (req, res) => {
  try { res.json(await atualizarExercicio(req.params.id, req.params.exercicioId, req.body || {})); } catch (err) { erro(res, err); }
});

router.delete("/:id/exercicios/:exercicioId", async (req, res) => {
  try { res.json(await removerExercicio(req.params.id, req.params.exercicioId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/:id/exercicios/:exercicioId/substituir", async (req, res) => {
  try { res.json(await substituirExercicio(req.params.id, req.params.exercicioId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/:id/exercicios/:exercicioId/progressao", async (req, res) => {
  try { res.json(await progressaoCarga(req.params.id, req.params.exercicioId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/:id/reordenar", async (req, res) => {
  try { res.json(await reordenarExercicios(req.params.id, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/:id/duplicar", async (req, res) => {
  try { res.status(201).json(await duplicarTreino(req.params.id, req.body || {})); } catch (err) { erro(res, err); }
});

export default router;
