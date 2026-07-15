import express from 'express';
import {
  listarSolicitacoes,
  criarSolicitacao,
  aprovarSolicitacao,
  rejeitarSolicitacao,
  solicitarCorrecao,
  validarCpfMatriculaOnline
} from './matricula-online.service.mjs';

const router = express.Router();

function erro(res, err) {
  res.status(err.status || 500).json({ ok: false, erro: err.message || 'Erro na matrícula online.' });
}


router.get('/validar-cpf', async (req, res) => {
  try { res.json(await validarCpfMatriculaOnline(req.query.cpf || req.query.documento || '')); }
  catch (err) { erro(res, err); }
});

router.get('/', async (req, res) => {
  try { res.json({ ok: true, dados: await listarSolicitacoes(req.query) }); }
  catch (err) { erro(res, err); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json(await criarSolicitacao(req.body || {})); }
  catch (err) { erro(res, err); }
});

router.post('/:id/aprovar', async (req, res) => {
  try { res.json(await aprovarSolicitacao(req.params.id, req.body || {})); }
  catch (err) { erro(res, err); }
});

router.post('/:id/rejeitar', async (req, res) => {
  try { res.json(await rejeitarSolicitacao(req.params.id, req.body || {})); }
  catch (err) { erro(res, err); }
});

router.post('/:id/solicitar-correcao', async (req, res) => {
  try { res.json(await solicitarCorrecao(req.params.id, req.body || {})); }
  catch (err) { erro(res, err); }
});

export default router;
