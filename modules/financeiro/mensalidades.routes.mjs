import express from 'express';
import {
  listarMensalidades,
  resumoMensalidades,
  criarMensalidade,
  gerarMensalidades,
  atualizarMensalidade,
  baixarMensalidade,
  estornarBaixaMensalidade,
  cancelarMensalidade,
  excluirMensalidade,
  historicoAluno
} from './mensalidades.service.mjs';

const router = express.Router();

function tratarErro(res, erro) {
  const status = erro.status || 500;
  res.status(status).json({
    erro: true,
    mensagem: erro.message || 'Erro interno.'
  });
}

router.get('/', async (req, res) => {
  try {
    res.json(await listarMensalidades(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/resumo', async (req, res) => {
  try {
    res.json(await resumoMensalidades(req.query));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.get('/aluno/:alunoId', async (req, res) => {
  try {
    res.json(await historicoAluno(req.params.alunoId));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await criarMensalidade(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/gerar', async (req, res) => {
  try {
    res.status(201).json(await gerarMensalidades(req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await atualizarMensalidade(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/baixar', async (req, res) => {
  try {
    res.json(await baixarMensalidade(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/estornar', async (req, res) => {
  try {
    res.json(await estornarBaixaMensalidade(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.post('/:id/cancelar', async (req, res) => {
  try {
    res.json(await cancelarMensalidade(req.params.id, req.body || {}));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    res.json(await excluirMensalidade(req.params.id));
  } catch (erro) {
    tratarErro(res, erro);
  }
});

export default router;
