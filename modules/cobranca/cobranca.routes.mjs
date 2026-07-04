import express from "express";
import {
  executarMotorCobranca,
  gerarProximaMensalidadeAposPagamento,
  previsaoCobrancaAluno,
  statusMotorCobranca
} from "./cobranca.service.mjs";

const router = express.Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    erro: err.message || "Erro no motor de cobrança."
  });
}

router.get("/status", async (req, res) => {
  try {
    return res.json(await statusMotorCobranca());
  } catch (err) {
    return erro(res, err);
  }
});

router.get("/previsao/:alunoId", async (req, res) => {
  try {
    return res.json(await previsaoCobrancaAluno(req.params.alunoId));
  } catch (err) {
    return erro(res, err);
  }
});

router.post("/gerar-proxima", async (req, res) => {
  try {
    return res.json(await gerarProximaMensalidadeAposPagamento(req.body || {}));
  } catch (err) {
    return erro(res, err);
  }
});

router.post("/executar", async (req, res) => {
  try {
    return res.json(await executarMotorCobranca(req.body || {}));
  } catch (err) {
    return erro(res, err);
  }
});

export default router;
