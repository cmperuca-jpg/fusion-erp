import { Router } from 'express';
import { executarBiometria } from './biometria-bridge.service.mjs';

const router = Router();

function tratar(res, error) {
  res.status(error?.status || error?.statusCode || 500).json({
    ok: false,
    mensagem: error?.message || 'Erro biometrico.'
  });
}

router.get('/status', async (req, res) => {
  try {
    const { result } = await executarBiometria('biometria_status', {}, { ttlSeconds: 15, timeoutMs: 9000 });
    res.json({
      ok: true,
      local: {
        ok: result?.ok !== false,
        conectado: result?.conectado === true,
        monitorAtivo: result?.monitorAtivo === true,
        monitorSaudavel: result?.monitorSaudavel === true,
        sensor: result?.sensor || 'Futronic FS80',
        tenantId: result?.tenantId || '',
        templateExposto: false
      }
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get('/aluno/:alunoId', async (req, res) => {
  try {
    const { result } = await executarBiometria('biometria_exists', { alunoId: req.params.alunoId }, { ttlSeconds: 15, timeoutMs: 9000 });
    res.json({
      ok: true,
      biometria: result?.existe === true
        ? { alunoId: req.params.alunoId, cadastrada: true, armazenamento: 'local-dpapi', templateExposto: false }
        : null
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.post('/sdk/cadastrar', async (req, res) => {
  try {
    const alunoId = String(req.body?.alunoId || '').trim();
    const { command, result } = await executarBiometria('biometria_enroll', { alunoId }, { ttlSeconds: 120, timeoutMs: 95000 });
    res.status(201).json({
      ok: true,
      biometria: {
        alunoId,
        cadastrada: true,
        qualidade: Number(result?.qualidade || 0) || undefined,
        qualidadeMedia: Number(result?.qualidade || 0) || undefined,
        armazenamento: 'local-dpapi',
        tenantIsolado: true,
        templateExposto: false
      },
      commandId: command.id,
      mensagem: 'Biometria Futronic cadastrada no computador da academia.'
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.delete('/aluno/:alunoId', async (req, res) => {
  try {
    const { command, result } = await executarBiometria('biometria_delete', { alunoId: req.params.alunoId }, { ttlSeconds: 20, timeoutMs: 12000 });
    res.json({
      ok: true,
      removido: result?.removido === true,
      commandId: command.id,
      templateExposto: false
    });
  } catch (error) {
    tratar(res, error);
  }
});

export default router;
