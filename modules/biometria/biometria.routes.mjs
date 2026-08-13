import { Router } from 'express';
import { executarBiometria, enfileirarBiometria, consultarComandoBiometria } from './biometria-bridge.service.mjs';

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
    if (!alunoId) return res.status(400).json({ ok: false, mensagem: 'alunoId obrigatorio.' });

    const command = await enfileirarBiometria('biometria_enroll', { alunoId }, 120);
    res.status(202).json({
      ok: true,
      commandId: command.id,
      status: command.status,
      progresso: {
        percentual: 2,
        etapa: 'fila',
        mensagem: 'Cadastro enviado ao computador da academia.',
        atividade: 0
      }
    });
  } catch (error) {
    tratar(res, error);
  }
});

router.get('/sdk/comandos/:commandId', async (req, res) => {
  try {
    const command = await consultarComandoBiometria(req.params.commandId);
    const result = command.result && typeof command.result === 'object' ? command.result : {};
    const progress = result.progress && typeof result.progress === 'object' ? result.progress : null;

    if (command.status === 'completed') {
      const qualidade = Number(result.qualidade || 0);
      return res.json({
        ok: true,
        status: command.status,
        commandId: command.id,
        progresso: {
          percentual: 100,
          etapa: 'concluido',
          mensagem: 'Biometria cadastrada e salva.',
          atividade: 3
        },
        biometria: {
          alunoId: String(result.alunoId || ''),
          cadastrada: true,
          qualidade: qualidade > 0 ? qualidade : undefined,
          qualidadeMedia: qualidade > 0 ? qualidade : undefined,
          armazenamento: 'local-dpapi',
          tenantIsolado: true,
          templateExposto: false
        },
        mensagem: 'Biometria Futronic cadastrada no computador da academia.'
      });
    }

    return res.json({
      ok: true,
      status: command.status,
      commandId: command.id,
      progresso: progress,
      erro: command.status === 'failed' ? (command.error || 'Falha no cadastro biometrico.') : '',
      mensagem: command.status === 'failed' ? (command.error || 'Falha no cadastro biometrico.') : ''
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
