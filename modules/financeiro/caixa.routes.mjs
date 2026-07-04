import express from 'express';
import {
  obterCaixaAtual,
  listarCaixas,
  listarMovimentos,
  abrirCaixa,
  fecharCaixa,
  criarMovimento,
  cancelarMovimento,
  excluirMovimento
} from './caixa.service.mjs';

const router = express.Router();

function tratarErro(res, erro) {
  res.status(erro.status || 500).json({
    erro: true,
    mensagem: erro.message || 'Erro interno.'
  });
}

router.get('/atual', async (req, res) => {
  try {
    res.json(await obterCaixaAtual());
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/caixas', async (req, res) => {
  try {
    res.json(await listarCaixas(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/movimentos', async (req, res) => {
  try {
    res.json(await listarMovimentos(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/abrir', async (req, res) => {
  try {
    res.status(201).json(await abrirCaixa(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/fechar', async (req, res) => {
  try {
    res.json(await fecharCaixa(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/movimentos', async (req, res) => {
  try {
    res.status(201).json(await criarMovimento(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/movimentos/:id/cancelar', async (req, res) => {
  try {
    res.json(await cancelarMovimento(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete('/movimentos/:id', async (req, res) => {
  try {
    res.json(await excluirMovimento(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
