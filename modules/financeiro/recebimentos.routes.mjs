import express from 'express';
import {
  listarRecebimentos,
  resumoRecebimentos,
  criarRecebimento,
  confirmarRecebimento,
  obterRecebimento,
  atualizarRecebimento,
  estornarRecebimento,
  cancelarRecebimento,
  excluirRecebimento
} from './recebimentos.service.mjs';

const router = express.Router();

function tratarErro(res, erro) {
  res.status(erro.status || 500).json({
    erro: true,
    mensagem: erro.message || 'Erro interno.'
  });
}

router.get('/', async (req, res) => {
  try {
    res.json(await listarRecebimentos(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/resumo', async (req, res) => {
  try {
    res.json(await resumoRecebimentos(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});


router.get('/:id', async (req, res) => {
  try {
    res.json(await obterRecebimento(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await criarRecebimento(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await atualizarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});


router.post('/:id/baixar', async (req, res) => {
  try {
    res.json(await confirmarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/confirmar', async (req, res) => {
  try {
    res.json(await confirmarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/estornar', async (req, res) => {
  try {
    res.json(await estornarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/cancelar', async (req, res) => {
  try {
    res.json(await cancelarRecebimento(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await excluirRecebimento(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
