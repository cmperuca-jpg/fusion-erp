import { Router } from "express";
import {
  arquivarTreinosAnteriores,
  criarCicloTreino,
  obterEvolucaoAluno,
  processarVencimentos,
  relatorioEvolucaoGeral,
  renovarCiclo,
  statusCicloTreino
} from "./treinos-ciclo.service.mjs";

const router = Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || "Erro no ciclo de treinos."
  });
}

router.get("/status", async (req, res) => {
  try { res.json(await statusCicloTreino()); } catch (err) { erro(res, err); }
});

router.get("/alunos/:alunoId/evolucao", async (req, res) => {
  try { res.json(await obterEvolucaoAluno(req.params.alunoId)); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/ciclos", async (req, res) => {
  try { res.status(201).json(await criarCicloTreino(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/arquivar-treinos", async (req, res) => {
  try { res.json(await arquivarTreinosAnteriores(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/alunos/:alunoId/renovar", async (req, res) => {
  try { res.status(201).json(await renovarCiclo(req.params.alunoId, req.body || {})); } catch (err) { erro(res, err); }
});

router.post("/processar-vencimentos", async (req, res) => {
  try { res.json(await processarVencimentos(req.body || {})); } catch (err) { erro(res, err); }
});

router.get("/relatorio/evolucao", async (req, res) => {
  try { res.json(await relatorioEvolucaoGeral()); } catch (err) { erro(res, err); }
});

export default router;
