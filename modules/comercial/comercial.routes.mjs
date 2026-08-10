import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { obterSupabaseAdmin } from '../../config/supabase.mjs';
import { normalizarTenantId } from '../core/persistence/tenant-context.mjs';
import {
  atualizarServicoContrato,
  atualizarValorMatricula,
  incluirServicoContrato,
  listarContratos,
  listarServicos,
  listarServicosContratados,
  obterCentralAluno,
  obterResumoContrato,
  removerServicoContrato,
  salvarChecklistContrato,
  statusComercial
} from './comercial.service.mjs';
import {
  calcularContratoFinanceiro,
  gerarAjusteContratoFinanceiro,
  sincronizarContratoFinanceiro,
  sincronizarTodosContratosFinanceiro
} from './comercial.financeiro.service.mjs';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PAGES_ROOT = path.resolve(__dirname, '../../public/pages');
const SLUGS_RESERVADOS = new Set([
  'api', 'pages', 'assets', 'uploads', 'downloads',
  'favicon-ico', 'manifest-json', 'robots-txt'
]);

function erro(res, err) {
  return res.status(err.status || 500).json({ ok: false, erro: err.message || 'Erro no módulo comercial.' });
}

async function sincronizarSilencioso(contratoId) {
  try { if (contratoId) await sincronizarContratoFinanceiro(contratoId); } catch { /* não bloqueia a alteração comercial */ }
}

function normalizarSlugPublico(valor = '') {
  return normalizarTenantId(
    String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );
}

async function resolverAcademiaPublica(slugInformado = '') {
  const slug = normalizarSlugPublico(slugInformado);
  if (!slug || SLUGS_RESERVADOS.has(slug)) return null;

  const supabase = obterSupabaseAdmin({ obrigatorio: true });
  const { data, error } = await supabase
    .from('fusion_tenants')
    .select('tenant_id,slug,name,status')
    .or(`tenant_id.eq.${slug},slug.eq.${slug}`)
    .limit(2);

  if (error) throw error;

  const ativos = (data || []).filter(item =>
    ['active', 'trial'].includes(String(item.status || '').toLowerCase())
  );

  if (ativos.length !== 1) return null;
  return ativos[0];
}

async function paginaPublicaAcademia(req, res, next, pagina) {
  try {
    const academia = await resolverAcademiaPublica(req.params.slug);
    if (!academia) return next();

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Fusion-Public-Tenant', normalizarTenantId(academia.tenant_id));
    return res.sendFile(path.join(PUBLIC_PAGES_ROOT, pagina, 'index.html'));
  } catch (error) {
    console.error(`[Site público] Falha ao resolver ${req.params.slug}: ${error.message}`);
    return next();
  }
}

/*
 * PÁGINAS PÚBLICAS AUTOMÁTICAS POR ACADEMIA
 *
 * Uma academia ativa/trial cadastrada em fusion_tenants passa a responder
 * automaticamente em:
 *   /slug-da-academia
 *   /slug-da-academia/matricula
 *
 * Não há HTML individual por cliente. O tenant é confirmado no banco antes
 * de qualquer página ser entregue.
 */
router.get('/:slug/matricula', (req, res, next) =>
  paginaPublicaAcademia(req, res, next, 'matricula-online')
);

router.get('/:slug', (req, res, next) =>
  paginaPublicaAcademia(req, res, next, 'promocao')
);

router.get('/api/comercial/status', async (req, res) => res.json({ ...(await statusComercial()), rotas: [
  'GET /api/comercial/status',
  'GET /api/comercial/servicos',
  'GET /api/comercial/contratos',
  'GET /api/comercial/servicos-contratados',
  'GET /api/comercial/alunos/:alunoId/central',
  'GET /api/comercial/contratos/:id/resumo',
  'GET /api/comercial/contratos/:id/financeiro',
  'POST /api/comercial/contratos/:id/financeiro/sincronizar',
  'POST /api/comercial/contratos/:id/financeiro/ajuste',
  'POST /api/comercial/financeiro/sincronizar-todos',
  'POST /api/comercial/contratos/:id/servicos',
  'PUT /api/comercial/contratos/:id/servicos/:servicoContratadoId',
  'DELETE /api/comercial/contratos/:id/servicos/:servicoContratadoId',
  'PATCH /api/comercial/contratos/:id/valor-matricula',
  'PUT /api/comercial/contratos/:id/checklist'
] }));

router.get('/api/comercial/servicos', async (req, res) => { try { res.json(await listarServicos()); } catch (e) { erro(res, e); } });
router.get('/api/comercial/contratos', async (req, res) => { try { res.json(await listarContratos(req.query || {})); } catch (e) { erro(res, e); } });
router.get('/api/comercial/servicos-contratados', async (req, res) => { try { res.json(await listarServicosContratados(req.query || {})); } catch (e) { erro(res, e); } });
router.get('/api/comercial/alunos/:alunoId/central', async (req, res) => { try { res.json(await obterCentralAluno(req.params.alunoId)); } catch (e) { erro(res, e); } });
router.get('/api/comercial/contratos/:id/resumo', async (req, res) => { try { res.json(await obterResumoContrato(req.params.id)); } catch (e) { erro(res, e); } });

router.get('/api/comercial/contratos/:id/financeiro', async (req, res) => { try { res.json(await calcularContratoFinanceiro(req.params.id)); } catch (e) { erro(res, e); } });
router.post('/api/comercial/contratos/:id/financeiro/sincronizar', async (req, res) => { try { res.json(await sincronizarContratoFinanceiro(req.params.id, req.body || {})); } catch (e) { erro(res, e); } });
router.post('/api/comercial/contratos/:id/financeiro/ajuste', async (req, res) => { try { res.json(await gerarAjusteContratoFinanceiro(req.params.id, req.body || {})); } catch (e) { erro(res, e); } });
router.post('/api/comercial/financeiro/sincronizar-todos', async (req, res) => { try { res.json(await sincronizarTodosContratosFinanceiro(req.body || {})); } catch (e) { erro(res, e); } });

router.patch('/api/comercial/contratos/:id/valor-matricula', async (req, res) => {
  try {
    const resultado = await atualizarValorMatricula(req.params.id, req.body || {});
    await sincronizarSilencioso(req.params.id);
    res.json(resultado);
  } catch (e) { erro(res, e); }
});
router.post('/api/comercial/contratos/:id/servicos', async (req, res) => {
  try {
    const resultado = await incluirServicoContrato(req.params.id, req.body || {});
    await sincronizarSilencioso(req.params.id);
    res.status(201).json(resultado);
  } catch (e) { erro(res, e); }
});
router.put('/api/comercial/contratos/:id/servicos/:servicoContratadoId', async (req, res) => {
  try {
    const resultado = await atualizarServicoContrato(req.params.id, req.params.servicoContratadoId, req.body || {});
    await sincronizarSilencioso(req.params.id);
    res.json(resultado);
  } catch (e) { erro(res, e); }
});
router.delete('/api/comercial/contratos/:id/servicos/:servicoContratadoId', async (req, res) => {
  try {
    const resultado = await removerServicoContrato(req.params.id, req.params.servicoContratadoId, req.body || {});
    await sincronizarSilencioso(req.params.id);
    res.json(resultado);
  } catch (e) { erro(res, e); }
});
router.put('/api/comercial/contratos/:id/checklist', async (req, res) => {
  try {
    const resultado = await salvarChecklistContrato(req.params.id, req.body || {});
    await sincronizarSilencioso(req.params.id);
    res.json(resultado);
  } catch (e) { erro(res, e); }
});

export default router;
