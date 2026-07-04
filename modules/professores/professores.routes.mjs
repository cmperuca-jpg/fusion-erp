import { Router } from 'express';
import * as service from './professores.service.mjs';

const router = Router();
function tratar(res, e, status=500) { return res.status(e.status || status).json({ ok:false, erro:e.message, mensagem:e.message }); }

router.post('/login', async (req, res) => { try { res.json(await service.login(req.body || {})); } catch(e) { tratar(res,e, e.status || 401); } });
router.get('/', async (req, res) => { try { res.json(await service.listar(req.query || {})); } catch(e) { tratar(res,e); } });
router.get('/:id/prontuario', async (req, res) => { try { const r = await service.prontuario(req.params.id); if (!r) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json(r); } catch(e) { tratar(res,e); } });
router.get('/:id', async (req, res) => { try { const r = await service.buscar(req.params.id); if (!r) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json(r); } catch(e) { tratar(res,e); } });
router.post('/', async (req, res) => { try { const professor = await service.criar(req.body || {}); res.status(201).json({ ok:true, professor, mensagem:'Professor cadastrado com sucesso' }); } catch(e) { tratar(res,e,400); } });
router.put('/:id', async (req, res) => { try { const professor = await service.atualizar(req.params.id, req.body || {}); if (!professor) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json({ ok:true, professor, mensagem:'Professor atualizado com sucesso' }); } catch(e) { tratar(res,e,400); } });
router.delete('/:id', async (req, res) => { try { const professor = await service.excluir(req.params.id); if (!professor) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json({ ok:true, professor, mensagem:'Professor excluído com sucesso' }); } catch(e) { tratar(res,e); } });

export default router;
