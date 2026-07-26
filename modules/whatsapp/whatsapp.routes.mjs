import express from 'express';
import {
  campanhaInativos,
  executarLembretesVencimento,
  listarEnvios,
  listarInativos,
  obterConfiguracao,
  salvarConfiguracao
} from './whatsapp.service.mjs';

const router = express.Router();

function rota(fn, status = 200) {
  return async (req, res) => {
    try {
      res.status(status).json(await fn(req));
    } catch (e) {
      res.status(e.status || 400).json({ ok: false, mensagem: e.message || 'Erro no WhatsApp.' });
    }
  };
}

function podeGerenciarWhatsApp(usuario = {}) {
  const perfil = String(usuario.perfil || '').toLowerCase();
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return ['admin', 'administrador', 'gerente', 'comercial'].includes(perfil) ||
    permissoes.some((p) => ['*', 'whatsapp', 'comercial'].includes(String(p).toLowerCase()));
}

function usuarioOperacao(req) {
  const usuario = req.usuario || {};
  return usuario.email || usuario.nome || usuario.id || 'sessao_autenticada';
}

router.use((req, res, next) => {
  if (podeGerenciarWhatsApp(req.usuario)) return next();
  return res.status(403).json({ ok: false, mensagem: 'Sem permissao para gerenciar WhatsApp.' });
});

router.get('/configuracao', rota(() => obterConfiguracao()));
router.put('/configuracao', rota((req) => salvarConfiguracao({ ...(req.body || {}), usuario: usuarioOperacao(req) })));
router.get('/inativos', rota(() => listarInativos()));
router.post('/campanhas/inativos', rota((req) => campanhaInativos({ ...(req.body || {}), usuario: usuarioOperacao(req) }), 201));
router.post('/executar-lembretes', rota((req) => executarLembretesVencimento({ ...(req.body || {}), usuario: usuarioOperacao(req) })));
router.get('/envios', rota(() => listarEnvios()));

export default router;
