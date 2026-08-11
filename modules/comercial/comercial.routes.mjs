import express from 'express';
import path from 'path';
import fs from 'fs/promises';
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
const APP_PAGE_MAP = Object.freeze({
  login: 'login/index.html',
  'configuracao-inicial': 'configuracao-inicial/index.html',
  dashboard: 'dashboard/index.html',
  admin: 'admin/index.html',
  alunos: 'alunos/index.html',
  professores: 'professores/index.html',
  modalidades: 'modalidades/index.html',
  planos: 'planos/index.html',
  turmas: 'turmas/index.html',
  agenda: 'agenda/index.html',
  checkin: 'checkin/index.html',
  catracas: 'access-engine/index.html',
  'reconhecimento-facial': 'reconhecimento-facial/admin.html',
  crm: 'comercial-painel/index.html',
  'matriculas-pendentes': 'matriculas-pendentes/index.html',
  'site-chat': 'site-chat/index.html',
  matriculas: 'matriculas/index.html',
  financeiro: 'financeiro/index.html',
  mensalidades: 'mensalidades/index.html',
  recebimentos: 'recebimentos/index.html',
  pagamentos: 'financeiro/pagamentos/index.html',
  caixa: 'caixa/index.html',
  'relatorios-caixa': 'relatorios-caixa/index.html',
  'bi-financeiro': 'bi-financeiro/index.html',
  'bi-academia': 'bi-academia/index.html',
  'bi-operacional': 'bi-academia-operacional/index.html',
  configuracoes: 'configuracoes/index.html',
  avaliacoes: 'avaliacoes/index.html',
  treinos: 'treinos/index.html',
  professor: 'professor-area/index.html',
  recepcao: 'recepcao-app/index.html',
  administracao: 'administracao-app/index.html'
});

const APP_PROFILE_MAP = Object.freeze({
  aluno: 'aluno-login/index.html',
  professor: 'professor-login/index.html',
  recepcao: 'recepcao-app/index.html',
  administracao: 'administracao-app/index.html'
});

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

function scriptContextoTenant(academia = {}, persistirTenant = false) {
  const contexto = {
    tenantId: normalizarTenantId(academia.tenant_id),
    slug: normalizarSlugPublico(academia.slug || academia.tenant_id),
    nome: String(academia.name || '').trim(),
    status: academia.status,
    persistirTenant: persistirTenant === true
  };

  const seguro = JSON.stringify(contexto)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<script>
window.__FUSION_TENANT_CONTEXT__=${seguro};
try{
  sessionStorage.setItem("fusionAcademiaSelecionadaNome",window.__FUSION_TENANT_CONTEXT__.nome||"");
  sessionStorage.setItem("fusionAcademiaSlug",window.__FUSION_TENANT_CONTEXT__.slug||"");
  if(window.__FUSION_TENANT_CONTEXT__.persistirTenant){
    localStorage.setItem("fusionTenantId",window.__FUSION_TENANT_CONTEXT__.tenantId||"");
    localStorage.setItem("fusionAcademiaSlug",window.__FUSION_TENANT_CONTEXT__.slug||"");
    localStorage.setItem("fusionAcademiaNome",window.__FUSION_TENANT_CONTEXT__.nome||"");
    if(location.pathname.includes("/apps/professor")){
      localStorage.setItem("fusion_professor_tenant",window.__FUSION_TENANT_CONTEXT__.tenantId||"");
    }
  }
}catch{}
</script>`;
}

async function servirPaginaTenant(req, res, next, arquivoRelativo, { persistirTenant = false } = {}) {
  try {
    const academia = await resolverAcademiaPublica(req.params.slug);
    if (!academia) return next();

    const arquivo = path.resolve(PUBLIC_PAGES_ROOT, arquivoRelativo);
    if (!arquivo.startsWith(PUBLIC_PAGES_ROOT)) return next();

    let html = await fs.readFile(arquivo, 'utf8');
    const contexto = scriptContextoTenant(academia, persistirTenant);
    const experiencia = '<script src="/assets/js/fusion-tenant-experience.js?v=20260811-tenant-1" defer></script>';

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, match => `${match}\n${contexto}`);
    } else {
      html = `${contexto}${html}`;
    }

    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${experiencia}\n</body>`);
    } else {
      html += experiencia;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Fusion-Public-Tenant', normalizarTenantId(academia.tenant_id));
    return res.send(html);
  } catch (error) {
    console.error(`[Site/Aplicativo] Falha ao resolver ${req.params.slug}: ${error.message}`);
    return next();
  }
}

async function paginaPublicaAcademia(req, res, next, pagina) {
  return servirPaginaTenant(req, res, next, `${pagina}/index.html`, { persistirTenant: false });
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
router.get('/:slug/apps/:perfil', (req, res, next) => {
  const arquivo = APP_PROFILE_MAP[String(req.params.perfil || '').toLowerCase()];
  if (!arquivo) return next();
  return servirPaginaTenant(req, res, next, arquivo, { persistirTenant: true });
});

router.get('/:slug/apps', (req, res, next) =>
  servirPaginaTenant(req, res, next, 'apps-academia/index.html', { persistirTenant: false })
);

router.get('/:slug/app', async (req, res, next) => {
  try {
    const academia = await resolverAcademiaPublica(req.params.slug);
    if (!academia) return next();
    return res.redirect(302, `/${encodeURIComponent(normalizarSlugPublico(academia.slug || academia.tenant_id))}/app/dashboard`);
  } catch {
    return next();
  }
});

router.get('/:slug/app/:area', (req, res, next) => {
  const arquivo = APP_PAGE_MAP[String(req.params.area || '').toLowerCase()];
  if (!arquivo) return next();
  return servirPaginaTenant(req, res, next, arquivo, { persistirTenant: true });
});

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
