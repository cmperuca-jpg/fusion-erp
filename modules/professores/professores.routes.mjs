import { Router } from 'express';
import * as service from './professores.service.mjs';
import * as pontoService from '../professor-ponto/professor-ponto.service.mjs';

const router = Router();
function tratar(res, e, status=500) { return res.status(e.status || status).json({ ok:false, erro:e.message, mensagem:e.message }); }

function ehAdminPainel(usuario = {}) {
  const perfil = String(usuario.perfil || '').toLowerCase();
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  return perfil === 'administrador' || perfil === 'admin' || permissoes.includes('*');
}

function solicitanteStatus(req) {
  const usuario = req.usuario || {};
  if (usuario.portal) {
    return {
      id: usuario.id,
      professorId: usuario.id,
      perfil: usuario.perfil,
      acessoTodosAlunos: usuario.acessoTodosAlunos === true
    };
  }
  if (ehAdminPainel(usuario)) {
    return {
      id: usuario.id,
      professorId: usuario.id,
      perfil: 'responsavel_tecnico',
      acessoTodosAlunos: true
    };
  }
  return {
    id: usuario.id,
    professorId: usuario.id,
    perfil: usuario.perfil,
    acessoTodosAlunos: false
  };
}

function semSenhaAdministrativa(professor = {}) {
  const { senha, senhaHash, senhaAcesso, senhaPortal, ...limpo } = professor;
  return limpo;
}

router.post('/login', async (req, res) => { try { res.json(await service.login(req.body || {})); } catch(e) { tratar(res,e, e.status || 401); } });
router.get('/sessao', async (req, res) => {
  try {
    const professor = await service.validarSessao(req.headers.authorization || '');
    res.json({ ok:true, professor });
  } catch(e) { tratar(res,e, e.status || 401); }
});
router.get('/', async (req, res) => { try { const lista = await service.listar(req.query || {}); res.json(req.usuario?.portal ? lista.map(semSenhaAdministrativa) : lista); } catch(e) { tratar(res,e); } });

// PROFESSOR PONTO ROTAS 20260826
function pontoNormalizar(v = '') {
  return String(v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function pontoPortalProfessor(req) {
  const u = req.usuario || {};
  return u.portal === true && pontoNormalizar(u.portalTipo || u.perfil) === 'professor';
}
function pontoPodeAdministrar(req) {
  const u = req.usuario || {};
  if (u.portal === true) return false;
  const perfil = pontoNormalizar(u.perfil || u.role);
  const permissoes = Array.isArray(u.permissoes) ? u.permissoes.map(pontoNormalizar) : [];
  return ['admin','administrador','gerente','responsavel_tecnico','responsavel-tecnico','responsavel tecnico'].includes(perfil)
    || permissoes.includes('*');
}
function pontoPodeLer(req, professorId) {
  if (pontoPortalProfessor(req)) return String(req.usuario?.id || '') === String(professorId || '');
  return pontoPodeAdministrar(req);
}
function pontoAtor(req) {
  const u = req.usuario || {};
  return { id: u.id || u.usuarioId || '', nome: u.nome || u.name || u.email || u.id || 'sistema', perfil: u.perfil || u.role || '' };
}

router.get('/:id/ponto', async (req, res) => {
  try {
    if (!pontoPodeLer(req, req.params.id)) return res.status(403).json({ ok:false, mensagem:'Sem permissão para consultar este ponto.' });
    res.json(await pontoService.obterPontoProfessor(req.params.id, req.query || {}));
  } catch(e) { tratar(res,e); }
});
router.put('/:id/ponto/config', async (req, res) => {
  try {
    if (!pontoPodeAdministrar(req)) return res.status(403).json({ ok:false, mensagem:'Somente a administração pode alterar jornada e remuneração.' });
    res.json(await pontoService.salvarConfigPontoProfessor(req.params.id, req.body || {}, pontoAtor(req)));
  } catch(e) { tratar(res,e,400); }
});
router.post('/:id/ponto/marcacoes', async (req, res) => {
  try {
    if (!pontoPodeAdministrar(req)) return res.status(403).json({ ok:false, mensagem:'Somente a administração pode ajustar marcações.' });
    res.status(201).json(await pontoService.lancarMarcacaoManual(req.params.id, req.body || {}, pontoAtor(req)));
  } catch(e) { tratar(res,e,400); }
});
router.post('/:id/ponto/banco-ajustes', async (req, res) => {
  try {
    if (!pontoPodeAdministrar(req)) return res.status(403).json({ ok:false, mensagem:'Somente a administração pode ajustar o banco de horas.' });
    res.status(201).json(await pontoService.lancarAjusteBancoProfessor(req.params.id, req.body || {}, pontoAtor(req)));
  } catch(e) { tratar(res,e,400); }
});
router.post('/:id/ponto/horas-aula', async (req, res) => {
  try {
    if (!pontoPodeAdministrar(req)) return res.status(403).json({ ok:false, mensagem:'Somente a administração pode lançar horas-aula.' });
    res.status(201).json(await pontoService.lancarHoraAulaProfessor(req.params.id, req.body || {}, pontoAtor(req)));
  } catch(e) { tratar(res,e,400); }
});
router.put('/:id/ponto/horas-aula/:lancamentoId', async (req, res) => {
  try {
    if (!pontoPodeAdministrar(req)) return res.status(403).json({ ok:false, mensagem:'Somente a administração pode aprovar ou cancelar horas-aula.' });
    res.json(await pontoService.atualizarHoraAulaProfessor(req.params.id, req.params.lancamentoId, req.body || {}, pontoAtor(req)));
  } catch(e) { tratar(res,e,400); }
});

router.get('/:id/prontuario', async (req, res) => { try { const r = await service.prontuario(req.params.id); if (!r) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json(r); } catch(e) { tratar(res,e); } });
router.get('/:id', async (req, res) => { try { const r = await service.buscar(req.params.id); if (!r) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json(r); } catch(e) { tratar(res,e); } });
router.post('/', async (req, res) => { try { const professor = await service.criar(req.body || {}); res.status(201).json({ ok:true, professor, mensagem:'Professor cadastrado com sucesso' }); } catch(e) { tratar(res,e,400); } });
router.put('/:id', async (req, res) => { try { const professor = await service.atualizar(req.params.id, req.body || {}); if (!professor) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json({ ok:true, professor, mensagem:'Professor atualizado com sucesso' }); } catch(e) { tratar(res,e,400); } });

router.put('/:id/foto', async (req, res) => {
  try {
    const usuario = req.usuario || {};
    if (usuario.portal === true && usuario.portalTipo === 'professor' && String(usuario.id || '') !== String(req.params.id || '')) {
      return res.status(403).json({ ok:false, mensagem:'O professor só pode alterar a própria foto.' });
    }
    const foto = req.body?.foto || req.body?.foto_base64 || '';
    const professor = await service.atualizarFoto(req.params.id, foto);
    if (!professor) return res.status(404).json({ ok:false, mensagem:'Professor nÃ£o encontrado' });
    res.json({ ok:true, professor, mensagem:'Foto do professor atualizada com sucesso' });
  } catch(e) { tratar(res,e, e.status || 400); }
});

router.put('/:id/status', async (req, res) => {
  try {
    const solicitante = solicitanteStatus(req);
    const professor = await service.alterarStatus(req.params.id, req.body?.status, solicitante);
    if (!professor) return res.status(404).json({ ok:false, mensagem:'Professor não encontrado' });
    res.json({ ok:true, professor, mensagem: professor.status === 'Ativo' ? 'Professor desbloqueado com sucesso' : 'Professor bloqueado com sucesso' });
  } catch(e) { tratar(res,e, e.status || 400); }
});

router.delete('/:id', async (req, res) => { try { const professor = await service.excluir(req.params.id); if (!professor) return res.status(404).json({ok:false,mensagem:'Professor não encontrado'}); res.json({ ok:true, professor, mensagem:'Professor excluído com sucesso' }); } catch(e) { tratar(res,e); } });

export default router;
