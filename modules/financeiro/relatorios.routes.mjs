import express from 'express';
import { movimentoDiarioCaixa, biFinanceiro } from './relatorios.service.mjs';

const router = express.Router();

function erro(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    mensagem: err.message || 'Erro ao gerar relatório financeiro.'
  });
}

router.get('/movimento-diario', async (req, res) => {
  try {
    return res.json(await movimentoDiarioCaixa(req.query || {}));
  } catch (err) {
    return erro(res, err);
  }
});

router.get('/bi-financeiro', async (req, res) => {
  try {
    return res.json(await biFinanceiro(req.query || {}));
  } catch (err) {
    return erro(res, err);
  }
});

export default router;
