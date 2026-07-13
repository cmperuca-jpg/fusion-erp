import express from 'express';
import { importarCfg7x, importarLay7x } from './henry7x.config.mjs';
import {
  listarEquipamentos,
  cadastrarEquipamento,
  testarTCP,
  enviarHex,
  raw,
  listarLogs,
  listarComandos,
  liberarCatraca,
  liberarCatracaSca,
  liberarCatracaDiagnostico,
  compararPacotes
} from './henry7x.service.mjs';

export const henry7xRouter = express.Router();

function asyncRoute(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent) res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, erro: error.message });
    }
  };
}

henry7xRouter.get('/status', (req, res) => res.json({ ok: true, modulo: 'henry7x', versao: '0.5.0-liberacao-confirmada' }));
henry7xRouter.get('/equipamentos', (req, res) => res.json(listarEquipamentos()));
henry7xRouter.post('/equipamentos', (req, res) => res.json(cadastrarEquipamento(req.body || {})));
henry7xRouter.get('/logs', (req, res) => res.json(listarLogs()));
henry7xRouter.get('/comandos', (req, res) => res.json(listarComandos()));
henry7xRouter.post('/tcp-test', asyncRoute((req) => testarTCP(req.body || {})));
henry7xRouter.post('/send-hex', asyncRoute((req) => enviarHex(req.body || {})));
henry7xRouter.post('/raw', asyncRoute((req) => raw(req.body || {})));
henry7xRouter.post('/comparar-hex', (req, res) => res.json(compararPacotes(req.body || {})));
henry7xRouter.post('/liberar', asyncRoute((req) => liberarCatraca(req.body || {})));
henry7xRouter.post('/liberar-sca', asyncRoute((req) => liberarCatracaSca(req.body || {})));
henry7xRouter.post('/liberar-catraca-diagnostico', asyncRoute((req) => liberarCatracaDiagnostico(req.body || {})));
henry7xRouter.post('/importar-cfg7x', (req, res) => res.json(importarCfg7x(req.body.path)));
henry7xRouter.post('/importar-lay7x', (req, res) => res.json(importarLay7x(req.body.path)));

export default henry7xRouter;
