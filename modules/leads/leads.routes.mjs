import express from 'express';
import {
  listarLeads,
  obterLead,
  criarLead,
  atualizarLead,
  moverLead,
  registrarContato,
  excluirLead,
  resumoComercial
} from './leads.service.mjs';

const router = express.Router();

function erro(res, err) {
  res.status(err.status || 500).json({ ok: false, erro: err.message || 'Erro no CRM comercial.' });
}

router.get('/', async (req, res) => {
  try { res.json({ ok: true, dados: await listarLeads(req.query) }); }
  catch (err) { erro(res, err); }
});

router.get('/resumo', async (req, res) => {
  try { res.json({ ok: true, resumo: await resumoComercial(req.query) }); }
  catch (err) { erro(res, err); }
});

router.get('/:id', async (req, res) => {
  try { res.json({ ok: true, dados: await obterLead(req.params.id) }); }
  catch (err) { erro(res, err); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json({ ok: true, lead: await criarLead(req.body || {}) }); }
  catch (err) { erro(res, err); }
});

router.put('/:id', async (req, res) => {
  try { res.json({ ok: true, lead: await atualizarLead(req.params.id, req.body || {}) }); }
  catch (err) { erro(res, err); }
});

router.post('/:id/mover', async (req, res) => {
  try { res.json({ ok: true, lead: await moverLead(req.params.id, req.body || {}) }); }
  catch (err) { erro(res, err); }
});

router.post('/:id/contatos', async (req, res) => {
  try { res.json({ ok: true, lead: await registrarContato(req.params.id, req.body || {}) }); }
  catch (err) { erro(res, err); }
});

router.delete('/:id', async (req, res) => {
  try { res.json(await excluirLead(req.params.id)); }
  catch (err) { erro(res, err); }
});

export default router;
