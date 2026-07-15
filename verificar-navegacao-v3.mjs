import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  js: 'public/assets/js/fusion-layout.js',
  css: 'public/assets/css/fusion-v3-layout.css'
};
const missing = Object.values(files).filter((file) => !fs.existsSync(path.join(root, file)));
const read = (file) => missing.includes(file) ? '' : fs.readFileSync(path.join(root, file), 'utf8');
const js = read(files.js);
const css = read(files.css);

const checks = {
  requiredFiles: missing.length === 0,
  finalMarker: js.includes('__FUSION_V3_NAVIGATION_FINAL__'),
  canonicalMenu: /const\s+ITENS_MENU/.test(js) && /function\s+montarMenu/.test(js),
  permissionFiltering: /podeVer\s*\(item,\s*user\)/.test(js),
  collapsibleGroups: /fusion-menu-group-caret/.test(js) && /fusion_menu_grupo_/.test(js) && /classList\.toggle\(["']collapsed/.test(js),
  activeNavigation: /aria-current/.test(js) && /function\s+itemAtivo/.test(js),
  breadcrumb: /function\s+montarBreadcrumb/.test(js) && /fusion-breadcrumb/.test(css),
  publicNewTabs: /noopener noreferrer/.test(js) && /novaAba/.test(js),
  mobileNavigation: /fusion-v3-menu-toggle/.test(js) && /@media\s*\(max-width:\s*900px\)/.test(css)
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const result = {
  ok: failed.length === 0,
  version: '3.0.0-navigation-final-r2',
  canonicalMenu: files.js,
  checks,
  missing,
  failed
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
