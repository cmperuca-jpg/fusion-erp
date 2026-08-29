import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { obterSupabaseAdmin } from '../../config/supabase.mjs';
import { DATABASE_CONFIG } from '../../config/database.config.mjs';
import { consultarPostgres } from '../../config/postgres.mjs';
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
const PUBLIC_ROOT = path.resolve(__dirname, '../../public');
const PUBLIC_PAGES_ROOT = path.resolve(PUBLIC_ROOT, 'pages');
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

const APP_MANIFEST_MAP = Object.freeze({
  aluno: 'manifest-aluno.webmanifest',
  professor: 'manifest-professor.webmanifest',
  recepcao: 'manifest-recepcao.webmanifest',
  administracao: 'manifest-administracao.webmanifest'
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

  if (DATABASE_CONFIG.provider === 'postgres') {
    const { rows } = await consultarPostgres(
      `SELECT tenant_id, slug, name, status
         FROM public.fusion_tenants
        WHERE tenant_id = $1 OR slug = $1
        ORDER BY tenant_id
        LIMIT 2`,
      [slug]
    );

    const ativos = (rows || []).filter(item =>
      ['active', 'trial'].includes(String(item.status || '').toLowerCase())
    );

    if (ativos.length !== 1) return null;
    return ativos[0];
  }

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


function corrigirAssetsRelativos(html = '', arquivoRelativo = '') {
  const pasta = path.posix.dirname(String(arquivoRelativo || '').replace(/\\/g, '/'));
  if (!pasta || pasta === '.') return html;

  return String(html).replace(
    /\b(href|src)=(["'])(?!\/|https?:\/\/|data:|blob:|#|mailto:|tel:|javascript:)([^"']+)\2/gi,
    (_match, atributo, aspas, recursoOriginal) => {
      const recurso = String(recursoOriginal || '');
      const indiceSufixo = recurso.search(/[?#]/);
      const caminho = indiceSufixo >= 0 ? recurso.slice(0, indiceSufixo) : recurso;
      const sufixo = indiceSufixo >= 0 ? recurso.slice(indiceSufixo) : '';

      const resolvido = path.posix.normalize(
        path.posix.join('/pages', pasta, caminho)
      );

      return `${atributo}=${aspas}${resolvido}${sufixo}${aspas}`;
    }
  );
}

function nomeAplicativoPerfil(perfil = '') {
  return ({
    aluno: 'Fusion Aluno',
    professor: 'Fusion Professor',
    recepcao: 'Fusion Recepção',
    administracao: 'Fusion Administração'
  })[String(perfil || '').toLowerCase()] || 'Fusion Sistema';
}

async function manifestoDaAcademia(academia = {}, perfil = '') {
  const chave = String(perfil || '').toLowerCase();
  const arquivoManifesto = APP_MANIFEST_MAP[chave];
  if (!arquivoManifesto) return null;

  const arquivo = path.resolve(PUBLIC_ROOT, arquivoManifesto);
  if (!arquivo.startsWith(PUBLIC_ROOT)) return null;

  const bruto = await fs.readFile(arquivo, 'utf8');
  const manifesto = JSON.parse(bruto);

  const slug = normalizarSlugPublico(academia.slug || academia.tenant_id);
  const nomeAcademia = String(academia.name || slug).trim();
  const nomeApp = nomeAplicativoPerfil(chave);
  const startUrl = `/${encodeURIComponent(slug)}/apps/${encodeURIComponent(chave)}`;

  manifesto.id = startUrl;
  manifesto.start_url = startUrl;
  manifesto.scope = '/';
  manifesto.name = `${nomeApp} — ${nomeAcademia}`;
  manifesto.short_name = `${nomeApp.replace(/^Fusion\s+/i, '')} · ${nomeAcademia}`;
  manifesto.description = `${nomeApp} da ${nomeAcademia}, com tecnologia Fusion Sistema.`;

  return manifesto;
}


function mapaLayoutPorArea() {
  return Object.fromEntries(
    Object.entries(APP_PAGE_MAP).map(([area, arquivo]) => [
      area,
      `/pages/${String(arquivo || '').replace(/^\/+/, '')}`
    ])
  );
}

function patchFusionLayoutParaTenant(conteudo = '', slug = '') {
  const mapa = mapaLayoutPorArea();
  const mapaJson = JSON.stringify(mapa);
  const slugSeguro = JSON.stringify(normalizarSlugPublico(slug));

  const funcaoOriginal = `  function normalizarPath(pathname) {
    let path = String(pathname || location.pathname || "/").split(/[?#]/)[0];
    const indicePages = path.indexOf("/pages/");
    if (indicePages >= 0) path = path.slice(indicePages);
    path = path.replace(/\\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path += "index.html";
    return path;
  }`;

  const funcaoNova = `  const FUSION_TENANT_LAYOUT_MAP = ${mapaJson};
  const FUSION_TENANT_LAYOUT_SLUG = ${slugSeguro};

  function normalizarPath(pathname) {
    let path = String(pathname || location.pathname || "/").split(/[?#]/)[0];
    path = path.replace(/\\/{2,}/g, "/");

    const slug = String(
      window.__FUSION_TENANT_CONTEXT__?.slug ||
      FUSION_TENANT_LAYOUT_SLUG ||
      ""
    ).trim();

    if (slug) {
      const prefixoApp = "/" + slug + "/app/";
      if (path.startsWith(prefixoApp)) {
        const area = decodeURIComponent(path.slice(prefixoApp.length).split("/")[0] || "");
        if (FUSION_TENANT_LAYOUT_MAP[area]) {
          return FUSION_TENANT_LAYOUT_MAP[area];
        }
      }

      if (path === "/" + slug || path === "/" + slug + "/") {
        return "/pages/promocao/index.html";
      }

      if (path === "/" + slug + "/matricula") {
        return "/pages/matricula-online/index.html";
      }
    }

    const indicePages = path.indexOf("/pages/");
    if (indicePages >= 0) path = path.slice(indicePages);
    if (path.length > 1 && path.endsWith("/")) path += "index.html";
    return path;
  }`;

  if (!String(conteudo).includes(funcaoOriginal)) {
    throw new Error("Não foi possível adaptar normalizarPath do fusion-layout.js.");
  }

  return String(conteudo).replace(funcaoOriginal, funcaoNova);
}

async function servirFusionLayoutTenant(req, res, next) {
  try {
    const academia = await resolverAcademiaPublica(req.params.slug);
    if (!academia) return next();

    const arquivo = path.resolve(PUBLIC_ROOT, 'assets/js/fusion-layout.js');
    let conteudo = await fs.readFile(arquivo, 'utf8');
    conteudo = patchFusionLayoutParaTenant(
      conteudo,
      academia.slug || academia.tenant_id
    );

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.send(conteudo);
  } catch (error) {
    console.error(`[Layout tenant] Falha em ${req.params.slug}: ${error.message}`);
    return next();
  }
}

async function servirPaginaTenant(req, res, next, arquivoRelativo, { persistirTenant = false, manifestPerfil = '' } = {}) {
  try {
    const academia = await resolverAcademiaPublica(req.params.slug);
    if (!academia) return next();

    const arquivo = path.resolve(PUBLIC_PAGES_ROOT, arquivoRelativo);
    if (!arquivo.startsWith(PUBLIC_PAGES_ROOT)) return next();

    let html = await fs.readFile(arquivo, 'utf8');
    html = corrigirAssetsRelativos(html, arquivoRelativo);

    const slugPublico = normalizarSlugPublico(academia.slug || academia.tenant_id);
    html = html.replace(
      /(<script\b[^>]*?src=(['"]))\/assets\/js\/fusion-layout\.js(?:\?[^"']*)?\2([^>]*><\/script>)/gi,
      (_match, inicio, aspas, fim) =>
        `${inicio}/${encodeURIComponent(slugPublico)}/assets/fusion-layout.js?v=20260811-layout-tenant-1${aspas}${fim}`
    );

    if (manifestPerfil && APP_MANIFEST_MAP[String(manifestPerfil).toLowerCase()]) {
      const manifestUrl = `/${encodeURIComponent(normalizarSlugPublico(academia.slug || academia.tenant_id))}/manifest/${encodeURIComponent(String(manifestPerfil).toLowerCase())}.webmanifest`;
      html = html.replace(
        /<link\b([^>]*?)rel=(['"])manifest\2([^>]*?)>/i,
        `<link rel="manifest" href="${manifestUrl}">`
      );
    }

    const contexto = scriptContextoTenant(academia, persistirTenant);
    const experiencia = '<script src="/assets/js/fusion-tenant-experience.js?v=20260811-tenant-4" defer></script>';

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
router.get('/:slug/assets/fusion-layout.js', servirFusionLayoutTenant);

router.get('/:slug/manifest/:perfil.webmanifest', async (req, res, next) => {
  try {
    const perfil = String(req.params.perfil || '').toLowerCase();
    if (!APP_MANIFEST_MAP[perfil]) return next();

    const academia = await resolverAcademiaPublica(req.params.slug);
    if (!academia) return next();

    const manifesto = await manifestoDaAcademia(academia, perfil);
    if (!manifesto) return next();

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    return res.json(manifesto);
  } catch (error) {
    console.error(`[Manifest PWA] Falha ao gerar manifesto de ${req.params.slug}: ${error.message}`);
    return next();
  }
});

router.get('/:slug/apps/:perfil', (req, res, next) => {
  const arquivo = APP_PROFILE_MAP[String(req.params.perfil || '').toLowerCase()];
  if (!arquivo) return next();
  return servirPaginaTenant(req, res, next, arquivo, { persistirTenant: true, manifestPerfil: req.params.perfil });
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
  const area = String(req.params.area || '').toLowerCase();
  const arquivo = APP_PAGE_MAP[area];
  if (!arquivo) return next();
  const manifestPerfil = APP_MANIFEST_MAP[area] ? area : '';
  return servirPaginaTenant(req, res, next, arquivo, { persistirTenant: true, manifestPerfil });
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
