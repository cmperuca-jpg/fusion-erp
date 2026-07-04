import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const assetsJs = path.join(root, 'public', 'assets', 'js');
const assetsCss = path.join(root, 'public', 'assets', 'css');

async function existe(p){ try { await fs.access(p); return true; } catch { return false; } }
async function garantirDir(p){ await fs.mkdir(p, { recursive: true }); }
async function copiar(rel){
  const origem = path.join(root, rel);
  return origem;
}

const menuJs = `
(function(){
  const MENU_HTML = \`
    <div class="fusion-menu-group">PRINCIPAL</div>
    <a href="/pages/dashboard/index.html" data-module="dashboard">🏠 Dashboard</a>
    <div class="fusion-menu-group">PESSOAS</div>
    <a href="/pages/alunos/index.html" data-module="alunos">👥 Alunos</a>
    <a href="/pages/professores/index.html" data-module="professores">🧑‍🏫 Professores</a>
    <div class="fusion-menu-group">ACADEMIA</div>
    <a href="/pages/modalidades/index.html" data-module="modalidades">🏊 Modalidades</a>
    <a href="/pages/planos/index.html" data-module="planos">📦 Planos</a>
    <a href="/pages/turmas/index.html" data-module="turmas">🏫 Turmas</a>
    <a href="/pages/agenda/index.html" data-module="agenda">🗓️ Agenda</a>
    <a href="/pages/checkin/index.html" data-module="checkin">✅ Check-in</a>
    <a href="/pages/avaliacoes/index.html" data-module="avaliacoes">📊 Avaliações</a>
    <a href="/pages/treinos/index.html" data-module="treinos">💪 Treinos</a>
    <a href="/pages/exercicios/index.html" data-module="exercicios">🏋️ Exercícios</a>
    <div class="fusion-menu-group">FINANCEIRO</div>
    <a href="/pages/financeiro/index.html" data-module="financeiro">💰 Financeiro</a>
    <a href="/pages/mensalidades/index.html" data-module="mensalidades">🧾 Mensalidades</a>
    <a href="/pages/caixa/index.html" data-module="caixa">🏦 Caixa</a>
    <div class="fusion-menu-group">BUSINESS INTELLIGENCE</div>
    <a href="/pages/bi/index.html" data-module="bi">📈 Dashboard Executivo</a>
    <a href="/pages/bi-financeiro/index.html" data-module="bi-financeiro">💵 BI Financeiro</a>
    <a href="/pages/bi-academia-operacional/index.html" data-module="bi-academia-operacional">🧑‍🏫 BI Operacional</a>
    <a href="/pages/bi-comercial/index.html" data-module="bi-comercial">📊 BI Comercial</a>
    <div class="fusion-menu-group">SISTEMA</div>
    <a href="/pages/relatorios-caixa/index.html" data-module="relatorios-caixa">📄 Relatórios</a>
    <a href="/pages/configuracoes/index.html" data-module="configuracoes">⚙️ Configurações</a>
  \`;
  function moduloAtual(){ const partes = location.pathname.split('/').filter(Boolean); const i = partes.indexOf('pages'); return i >= 0 ? (partes[i+1] || '') : ''; }
  function aplicarMenu(){ const nav = document.querySelector('.fusion-menu'); if(!nav) return; nav.innerHTML = MENU_HTML; const atual = moduloAtual(); nav.querySelectorAll('a').forEach(a => { const ativo = a.dataset.module === atual; a.classList.toggle('active', ativo); ativo ? a.setAttribute('aria-current','page') : a.removeAttribute('aria-current'); }); }
  function aplicarUsuario(){ const el = document.querySelector('[data-fusion-user]'); if(!el || !window.FusionAuth) return; const u = window.FusionAuth.getUsuario && window.FusionAuth.getUsuario(); el.textContent = u ? ((u.nome || 'Administrador') + (u.perfil ? ' · ' + u.perfil : '')) : 'Sessão local'; }
  document.addEventListener('DOMContentLoaded', () => { aplicarMenu(); aplicarUsuario(); });
  window.FusionMenuGlobal = { aplicarMenu };
})();
`;
const menuCss = `.fusion-sidebar{width:260px!important;min-width:260px!important;max-width:260px!important;background:#101826!important;color:#fff!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}.fusion-brand{height:64px!important;display:flex!important;align-items:center!important;padding:0 18px!important;font-size:22px!important;font-weight:800!important;color:#ff6600!important;border-bottom:1px solid rgba(255,255,255,.08)!important;white-space:nowrap!important}.fusion-menu{flex:1!important;overflow-y:auto!important;overflow-x:hidden!important;padding:12px 10px!important}.fusion-menu-group{font-size:11px!important;letter-spacing:.14em!important;color:#8aa0bd!important;font-weight:800!important;margin:18px 6px 8px!important;text-transform:uppercase!important;white-space:nowrap!important}.fusion-menu a{height:38px!important;display:flex!important;align-items:center!important;gap:10px!important;padding:0 12px!important;border-radius:9px!important;color:#eef4ff!important;text-decoration:none!important;font-size:14px!important;font-weight:700!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin:3px 0!important;background:transparent!important}.fusion-menu a:hover{background:rgba(255,102,0,.20)!important;color:#fff!important}.fusion-menu a.active,.fusion-menu a[aria-current="page"]{background:#ff6600!important;color:#fff!important}.fusion-sidebar-footer{min-height:44px!important;padding:13px 14px!important;border-top:1px solid rgba(255,255,255,.08)!important;color:#95a3b8!important;font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.fusion-main{min-width:0!important;flex:1!important}.fusion-topbar{height:64px!important;min-height:64px!important}.fusion-topbar button{background:#ff6600!important;color:#fff!important;border:0!important;border-radius:9px!important;padding:9px 14px!important;font-weight:800!important;cursor:pointer!important}@media(max-width:900px){.fusion-sidebar{width:220px!important;min-width:220px!important;max-width:220px!important}.fusion-menu a{font-size:13px!important;padding:0 10px!important}}`;

async function patchHtml(file){
  let html = await fs.readFile(file, 'utf-8');
  let changed = false;
  if (html.includes('class="fusion-shell"')) {
    if (!html.includes('/assets/css/fusion-menu-global.css')) {
      html = html.replace(/<link rel="stylesheet" href="\/assets\/css\/fusion-app\.css">/,
        '<link rel="stylesheet" href="/assets/css/fusion-app.css">\n  <link rel="stylesheet" href="/assets/css/fusion-menu-global.css">');
      changed = true;
    }
    if (!html.includes('/assets/js/fusion-menu-global.js')) {
      html = html.replace(/<\/body>/, '  <script src="/assets/js/fusion-menu-global.js"></script>\n</body>');
      changed = true;
    }
    if (changed) await fs.writeFile(file, html, 'utf-8');
  }
  return changed;
}

async function listarHtml(dir){
  const out = [];
  async function walk(d){
    if (!(await existe(d))) return;
    const items = await fs.readdir(d, { withFileTypes: true });
    for (const item of items) {
      const p = path.join(d, item.name);
      if (item.isDirectory()) await walk(p);
      else if (item.isFile() && item.name.endsWith('.html')) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

await garantirDir(assetsJs);
await garantirDir(assetsCss);
await fs.writeFile(path.join(assetsJs, 'fusion-menu-global.js'), menuJs.trim() + '\n', 'utf-8');
await fs.writeFile(path.join(assetsCss, 'fusion-menu-global.css'), menuCss + '\n', 'utf-8');

const files = await listarHtml(path.join(root, 'public', 'pages'));
let alterados = 0;
for (const file of files) {
  if (await patchHtml(file)) alterados++;
}
console.log('Menu completo global instalado:');
console.log(JSON.stringify({ arquivosHtmlVerificados: files.length, arquivosHtmlAlterados: alterados, css: '/assets/css/fusion-menu-global.css', js: '/assets/js/fusion-menu-global.js' }, null, 2));
