import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as service from './access-engine.service.mjs';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.resolve(__dirname, '../..');
const instaladorAccessPath = path.join(raizProjeto, 'public', 'downloads', 'FusionAccessSetup.exe');

function tratar(res, e, status = 500) {
  return res.status(e.status || status).json({ ok: false, erro: e.message, mensagem: e.message });
}

function baixarInstalador(_req, res) {
  const stat = fs.statSync(instaladorAccessPath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    return res.status(404).json({ ok: false, mensagem: 'Instalador nao encontrado nesta distribuicao.' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.download(instaladorAccessPath, 'FusionAccessSetup.exe', (erro) => {
    if (erro && !res.headersSent) tratar(res, erro);
  });
}

router.get('/dashboard', async (req, res) => { try { res.json(await service.dashboard()); } catch (e) { tratar(res, e); } });
router.get('/drivers', async (req, res) => { try { res.json(await service.listarDriversDisponiveis()); } catch (e) { tratar(res, e); } });
router.get('/instalador', baixarInstalador);
router.get('/dispositivos', async (req, res) => { try { res.json({ ok: true, dados: await service.listarDispositivos() }); } catch (e) { tratar(res, e); } });
router.post('/dispositivos', async (req, res) => { try { res.status(201).json({ ok: true, dados: await service.salvarDispositivo(req.body || {}) }); } catch (e) { tratar(res, e, 400); } });
router.put('/dispositivos/:id', async (req, res) => { try { res.json({ ok: true, dados: await service.salvarDispositivo({ ...(req.body || {}), id: req.params.id }) }); } catch (e) { tratar(res, e, 400); } });
router.get('/logs', async (req, res) => { try { res.json({ ok: true, dados: await service.listarLogs(req.query || {}) }); } catch (e) { tratar(res, e); } });
router.post('/simular-acesso', async (req, res) => { try { res.json(await service.avaliarAcesso(req.body || {})); } catch (e) { tratar(res, e, 400); } });


router.get('/agente/status', async (req, res) => { try { res.json(await service.statusAgenteAcesso()); } catch (e) { tratar(res, e); } });
router.post('/liberar-remoto', async (req, res) => { try { res.status(202).json(await service.liberarRemoto(req.body || {})); } catch (e) { tratar(res, e, 400); } });
router.get('/comandos/:id', async (req, res) => { try { res.json(await service.consultarComandoRemoto(req.params.id)); } catch (e) { tratar(res, e); } });

router.get('/henry7x/status', async (req, res) => { try { res.json(await service.statusHenry7x(req.query || {})); } catch (e) { tratar(res, e); } });
router.post('/henry7x/evento', async (req, res) => { try { res.json(await service.eventoHenry7x(req.body || {})); } catch (e) { tratar(res, e, 400); } });

router.post('/henry7x/tcp-test', async (req, res) => { try { res.json(await service.testarTcpHenry7x(req.body || {})); } catch (e) { tratar(res, e, 400); } });
router.get('/henry7x/tcp-test', async (req, res) => { try { res.json(await service.testarTcpHenry7x(req.query || {})); } catch (e) { tratar(res, e, 400); } });
router.post('/henry7x/diagnostico-rede', async (req, res) => { try { res.json(await service.diagnosticoRedeHenry7x(req.body || {})); } catch (e) { tratar(res, e, 400); } });
router.get('/henry7x/diagnostico-rede', async (req, res) => { try { res.json(await service.diagnosticoRedeHenry7x(req.query || {})); } catch (e) { tratar(res, e, 400); } });


export default router;
