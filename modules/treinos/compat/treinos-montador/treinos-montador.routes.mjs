import { Router } from "express";
import {
  montarTreino,
  obterModelosDivisao,
  simularMontagem,
  statusMontadorTreinos
} from "./treinos-montador.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no montador inteligente de treinos."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusMontadorTreinos()); } catch (err) { erro(res, err); }
});

router.get("/modelos", async (req, res) => {
  try { res.json(await obterModelosDivisao()); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/simular", async (req, res) => {
  try { res.json(await simularMontagem(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/montar", async (req, res) => {
  try { res.status(201).json(await montarTreino(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

export default router;
