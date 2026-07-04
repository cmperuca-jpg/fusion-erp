import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const cssPath = path.join(ROOT, 'public', 'assets', 'css', 'fusion-app.css');
const jsPath = path.join(ROOT, 'public', 'assets', 'js', 'fusion-layout.js');

async function exists(p){ try { await fs.access(p); return true; } catch { return false; } }
async function backup(p){ if (await exists(p)) await fs.copyFile(p, `${p}.bak-menu-v4-${Date.now()}`); }

const cssPatch = `

/* === Fusion ERP Menu Global v4: fonte, tamanho e scroll fixos === */
:root{
  --fusion-sidebar-width: 228px;
  --fusion-menu-font: Arial, Helvetica, sans-serif;
  --fusion-menu-font-size: 14px;
  --fusion-menu-line-height: 20px;
  --fusion-menu-item-height: 38px;
  --fusion-menu-icon-width: 22px;
}
html,body{
  font-family: Arial, Helvetica, sans-serif !important;
}
.fusion-shell{
  min-height: 100vh;
  display: flex;
  align-items: stretch;
}
.fusion-sidebar{
  width: var(--fusion-sidebar-width) !important;
  min-width: var(--fusion-sidebar-width) !important;
  max-width: var(--fusion-sidebar-width) !important;
  height: 100vh !important;
  position: sticky !important;
  top: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  font-family: var(--fusion-menu-font) !important;
}
.fusion-brand{
  flex: 0 0 auto !important;
  font-family: var(--fusion-menu-font) !important;
  font-size: 20px !important;
  line-height: 24px !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
}
.fusion-menu{
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 12px !important;
  margin: 0 !important;
  scroll-behavior: auto !important;
  scrollbar-gutter: stable !important;
}
.fusion-menu-group{
  display: block !important;
  margin: 14px 0 6px !important;
  padding: 0 2px !important;
  font-family: var(--fusion-menu-font) !important;
  font-size: 11px !important;
  line-height: 14px !important;
  font-weight: 700 !important;
  letter-spacing: .12em !important;
  text-transform: uppercase !important;
  color: #8fa1bb !important;
  white-space: nowrap !important;
}
.fusion-menu a{
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  width: 100% !important;
  min-height: var(--fusion-menu-item-height) !important;
  height: var(--fusion-menu-item-height) !important;
  padding: 0 12px !important;
  margin: 3px 0 !important;
  border-radius: 9px !important;
  box-sizing: border-box !important;
  font-family: var(--fusion-menu-font) !important;
  font-size: var(--fusion-menu-font-size) !important;
  line-height: var(--fusion-menu-line-height) !important;
  font-weight: 600 !important;
  color: #e5edf8 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  text-decoration: none !important;
}
.fusion-menu a .fusion-menu-icon,
.fusion-menu a .menu-icon{
  width: var(--fusion-menu-icon-width) !important;
  min-width: var(--fusion-menu-icon-width) !important;
  max-width: var(--fusion-menu-icon-width) !important;
  text-align: center !important;
  font-size: 15px !important;
  line-height: 1 !important;
}
.fusion-menu a:hover,
.fusion-menu a.active,
.fusion-menu a[aria-current="page"]{
  background: #ff6600 !important;
  color: #fff !important;
}
.fusion-sidebar-footer{
  flex: 0 0 auto !important;
  font-family: var(--fusion-menu-font) !important;
  font-size: 12px !important;
  line-height: 16px !important;
  white-space: nowrap !important;
}
.fusion-main{
  min-width: 0 !important;
  flex: 1 1 auto !important;
}
.fusion-topbar,
.fusion-title,
.fusion-content,
.fusion-card{
  font-family: Arial, Helvetica, sans-serif !important;
}
/* impede CSS local de páginas de alterar o menu */
body .fusion-sidebar .fusion-menu a,
body .fusion-sidebar .fusion-menu-group,
body .fusion-sidebar .fusion-brand,
body .fusion-sidebar .fusion-sidebar-footer{
  transform: none !important;
}
`;

const jsContent = String.raw`function fusionMenuAtivo() {
  const path = window.location.pathname;
  const menu = document.querySelector('.fusion-menu');
  const scrollAnterior = menu ? menu.scrollTop : 0;

  document.querySelectorAll('.fusion-menu a').forEach((link) => {
    const modulo = link.getAttribute('data-module') || '';
    const href = link.getAttribute('href') || '';
    const ativo = (modulo && path.includes('/' + modulo + '/')) || (href && path === href);
    link.classList.toggle('active', Boolean(ativo));
    if (ativo) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Corrige bug de rolagem do menu ao clicar/navegar: mantém posição anterior.
  if (menu) {
    requestAnimationFrame(() => { menu.scrollTop = scrollAnterior; });
  }
}

function fusionUsuarioTopo() {
  const el = document.querySelector('[data-fusion-user]');
  if (!el || !window.FusionAuth) return;
  const usuario = window.FusionAuth.getUsuario();
  el.textContent = usuario ? ((usuario.nome || '') + ' · ' + (usuario.perfil || '')) : 'Sessão local';
}

function fusionPreservarScrollMenu() {
  const menu = document.querySelector('.fusion-menu');
  if (!menu) return;
  const chave = 'fusion_menu_scroll_top';
  const salvo = Number(sessionStorage.getItem(chave) || 0);
  if (Number.isFinite(salvo)) menu.scrollTop = salvo;
  menu.addEventListener('scroll', () => sessionStorage.setItem(chave, String(menu.scrollTop)), { passive: true });
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('mousedown', () => sessionStorage.setItem(chave, String(menu.scrollTop)));
    a.addEventListener('click', () => sessionStorage.setItem(chave, String(menu.scrollTop)));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fusionPreservarScrollMenu();
  fusionMenuAtivo();
  fusionUsuarioTopo();
});
`;

if (!(await exists(cssPath))) throw new Error(`Arquivo não encontrado: ${cssPath}`);
await backup(cssPath);
let css = await fs.readFile(cssPath, 'utf-8');
css = css.replace(/\/\* === Fusion ERP Menu Global v4:[\s\S]*?body \.fusion-sidebar \.fusion-sidebar-footer\{[\s\S]*?\}\s*/g, '');
if (!css.includes('Fusion ERP Menu Global v4')) css += cssPatch;
await fs.writeFile(cssPath, css, 'utf-8');

await fs.mkdir(path.dirname(jsPath), { recursive: true });
if (await exists(jsPath)) await backup(jsPath);
await fs.writeFile(jsPath, jsContent, 'utf-8');

console.log('Menu global v4 instalado: fonte/tamanho padronizados e scroll preservado.');
