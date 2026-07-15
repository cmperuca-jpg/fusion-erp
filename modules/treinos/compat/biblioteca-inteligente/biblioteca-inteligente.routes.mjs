import { Router } from 'express';
import {
  statusBibliotecaInteligente,
  dashboardBiblioteca,
  listarExercicios,
  obterExercicio,
  atualizarExercicio,
  organizarBiblioteca,
  validarBiblioteca
} from './biblioteca-inteligente.service.mjs';

const router = Router();

function erro(res, err) {
  res.status(err.status || 500).json({ ok:false, mensagem: err.message || 'Erro na Biblioteca Inteligente.' });
}

router.get('/status', async (req,res) => { try { res.json(await statusBibliotecaInteligente()); } catch(err) { erro(res,err); } });
router.get('/dashboard', async (req,res) => { try { res.json(await dashboardBiblioteca()); } catch(err) { erro(res,err); } });
router.get('/exercicios', async (req,res) => { try { res.json(await listarExercicios(req.query || {})); } catch(err) { erro(res,err); } });
router.get('/exercicios/:id', async (req,res) => { try { res.json(await obterExercicio(req.params.id)); } catch(err) { erro(res,err); } });
router.put('/exercicios/:id', async (req,res) => { try { res.json(await atualizarExercicio(req.params.id, req.body || {})); } catch(err) { erro(res,err); } });
router.post('/organizar', async (req,res) => { try { res.json(await organizarBiblioteca()); } catch(err) { erro(res,err); } });
router.post('/atualizar', async (req,res) => { try { res.json(await organizarBiblioteca()); } catch(err) { erro(res,err); } });
router.post('/validar', async (req,res) => { try { res.json(await validarBiblioteca()); } catch(err) { erro(res,err); } });

export default router;
