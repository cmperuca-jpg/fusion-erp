import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "public", "pages");
const ASSETS_JS = path.join(ROOT, "public", "assets", "js");
const ASSETS_CSS = path.join(ROOT, "public", "assets", "css");
const LAYOUT_JS = path.join(ASSETS_JS, "fusion-layout.js");
const APP_CSS = path.join(ASSETS_CSS, "fusion-app.css");
const BACKUP_DIR = path.join(ROOT, "data", "backups", `layout-unico-v4-${Date.now()}`);

function exists(p){ return fs.existsSync(p); }
function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p,c){ ensureDir(path.dirname(p)); fs.writeFileSync(p,c); }
function backup(p){
  if(!exists(p)) return;
  const rel = path.relative(ROOT, p);
  const dest = path.join(BACKUP_DIR, rel);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(p, dest);
}

const layoutJs = String.raw`(function () {
  const PUBLIC_PATHS = [
    "/pages/login/",
    "/pages/login/index.html"
  ];

  const MENU_DEFINITION = [
    { group: "PRINCIPAL", items: [
      ["dashboard", "🏠", "Dashboard", "/pages/dashboard/index.html"]
    ]},
    { group: "PESSOAS", items: [
      ["alunos", "👥", "Alunos", "/pages/alunos/index.html"],
      ["professores", "🧑‍🏫", "Professores", "/pages/professores/index.html"]
    ]},
    { group: "ACADEMIA", items: [
      ["modalidades", "🏊", "Modalidades", "/pages/modalidades/index.html"],
      ["planos", "📦", "Planos", "/pages/planos/index.html"],
      ["turmas", "🏫", "Turmas", "/pages/turmas/index.html"],
      ["agenda", "🗓️", "Agenda", "/pages/agenda/index.html"],
      ["checkin", "✅", "Check-in", "/pages/checkin/index.html"],
      ["avaliacoes", "📊", "Avaliações", "/pages/avaliacoes/index.html"],
      ["treinos", "💪", "Treinos", "/pages/treinos/index.html"],
      ["exercicios", "🏋️", "Exercícios", "/pages/exercicios/index.html"]
    ]},
    { group: "FINANCEIRO", items: [
      ["financeiro", "💰", "Financeiro", "/pages/financeiro/index.html"],
      ["mensalidades", "🧾", "Mensalidades", "/pages/mensalidades/index.html"],
      ["caixa", "🏦", "Caixa", "/pages/caixa/index.html"],
      ["relatorios-caixa", "📄", "Relatório Diário", "/pages/relatorios-caixa/index.html"]
    ]},
    { group: "BUSINESS INTELLIGENCE", items: [
      ["bi", "📈", "BI e Rankings", "/pages/bi/index.html"],
      ["bi-financeiro", "📊", "BI Financeiro", "/pages/bi-financeiro/index.html"],
      ["bi-operacional", "📋", "BI Operacional", "/pages/bi-operacional/index.html"],
      ["bi-comercial", "🎯", "BI Comercial", "/pages/bi-comercial/index.html"]
    ]},
    { group: "SISTEMA", items: [
      ["relatorios", "🗂️", "Relatórios", "/pages/relatorios/index.html"],
      ["configuracoes", "⚙️", "Configurações", "/pages/configuracoes/index.html"]
    ]}
  ];

  function isPublicPage() {
    const p = location.pathname.toLowerCase();
    return PUBLIC_PATHS.some(x => p === x || p.startsWith(x));
  }

  function moduleFromPath(pathname) {
    const match = String(pathname || "").match(/\/pages\/([^\/]+)(?:\/|$)/);
    return match ? match[1] : "dashboard";
  }

  function titleFromModule(moduleName) {
    const map = {
      dashboard: "Dashboard",
      alunos: "Alunos",
      professores: "Professores",
      modalidades: "Modalidades",
      planos: "Planos",
      turmas: "Turmas",
      agenda: "Agenda",
      checkin: "Check-in",
      avaliacoes: "Avaliações",
      treinos: "Treinos",
      exercicios: "Exercícios",
      financeiro: "Financeiro",
      mensalidades: "Mensalidades",
      caixa: "Caixa",
      "relatorios-caixa": "Relatório Diário",
      bi: "BI e Rankings",
      "bi-financeiro": "BI Financeiro",
      "bi-operacional": "BI Operacional",
      "bi-comercial": "BI Comercial",
      relatorios: "Relatórios",
      configuracoes: "Configurações"
    };
    return map[moduleName] || document.title.replace(/^Fusion ERP\s*-\s*/i, "").replace(/\s*-\s*Fusion ERP$/i, "") || "Fusion ERP";
  }

  function knownExistingPages() {
    const meta = document.querySelector('meta[name="fusion-existing-pages"]');
    if (!meta) return null;
    return new Set(meta.content.split(",").map(x => x.trim()).filter(Boolean));
  }

  function buildMenuHtml() {
    const existing = knownExistingPages();
    let html = '<aside class="fusion-sidebar" data-fusion-sidebar><div class="fusion-brand">Fusion ERP</div><nav class="fusion-menu" aria-label="Menu principal">';
    for (const group of MENU_DEFINITION) {
      const items = group.items.filter(([module,, ,href]) => !existing || existing.has(module));
      if (!items.length) continue;
      html += '<div class="fusion-menu-group">' + group.group + '</div>';
      for (const [module, icon, label, href] of items) {
        html += '<a href="' + href + '" data-module="' + module + '"><span class="fusion-menu-icon">' + icon + '</span><span>' + label + '</span></a>';
      }
    }
    html += '</nav><div class="fusion-sidebar-footer">Layout global</div></aside>';
    return html;
  }

  function removeLegacyLayout() {
    document.querySelectorAll(".fusion-sidebar, aside.sidebar, .sidebar").forEach(el => el.remove());
    document.querySelectorAll(".fusion-topbar").forEach(el => el.remove());
    document.querySelectorAll("body > header").forEach(el => el.remove());
  }

  function ensureShellAndMain() {
    removeLegacyLayout();

    let existingMain =
      document.querySelector("body > main.fusion-main") ||
      document.querySelector("body > main.main") ||
      document.querySelector("body > main");

    let shell = document.querySelector("body > .fusion-shell");

    if (!shell) {
      shell = document.createElement("div");
      shell.className = "fusion-shell";
      document.body.insertBefore(shell, document.body.firstChild);
    }

    let main = shell.querySelector(":scope > .fusion-main");
    if (!main) {
      main = document.createElement("main");
      main.className = "fusion-main";
      shell.appendChild(main);
    }

    if (existingMain && existingMain !== main) {
      existingMain.querySelectorAll(":scope > header").forEach(el => el.remove());
      existingMain.classList.add("fusion-page-content");
      main.appendChild(existingMain);
    }

    Array.from(document.body.childNodes).forEach(node => {
      if (node === shell) return;
      if (node.nodeType === 1 && node.tagName === "SCRIPT") return;
      if (node.nodeType === 1 && node.tagName === "STYLE") return;
      if (node.nodeType === 3 && !node.textContent.trim()) return;
      main.appendChild(node);
    });

    return { shell, main };
  }

  function renderSidebar(shell) {
    shell.querySelectorAll(":scope > .fusion-sidebar").forEach(el => el.remove());
    const tmp = document.createElement("div");
    tmp.innerHTML = buildMenuHtml();
    shell.insertBefore(tmp.firstElementChild, shell.firstChild);
  }

  function renderTopbar(main, moduleName) {
    main.querySelectorAll(":scope > .fusion-topbar").forEach(el => el.remove());
    const topbar = document.createElement("header");
    topbar.className = "fusion-topbar";
    topbar.innerHTML = '<div class="fusion-title">' + titleFromModule(moduleName) + '</div><div class="fusion-userbar"><span data-fusion-user></span><button type="button" data-fusion-logout>Sair</button></div>';
    main.insertBefore(topbar, main.firstChild);
  }

  function highlight(moduleName) {
    document.querySelectorAll(".fusion-menu a").forEach(link => {
      const active = link.getAttribute("data-module") === moduleName;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function setUser() {
    const el = document.querySelector("[data-fusion-user]");
    if (!el) return;
    let usuario = null;
    try {
      usuario = window.FusionAuth && window.FusionAuth.getUsuario
        ? window.FusionAuth.getUsuario()
        : JSON.parse(localStorage.getItem("fusion_usuario") || "null");
    } catch {}
    el.textContent = usuario ? [usuario.nome, usuario.perfil].filter(Boolean).join(" · ") : "Sessão local";
    const btn = document.querySelector("[data-fusion-logout]");
    if (btn) btn.onclick = () => {
      if (window.FusionAuth && window.FusionAuth.sair) window.FusionAuth.sair();
      else location.href = "/pages/login/index.html";
    };
  }

  function preserveMenuScroll() {
    const menu = document.querySelector(".fusion-menu");
    if (!menu) return;
    const key = "fusion_menu_scroll_top";
    const saved = Number(sessionStorage.getItem(key) || "0");
    if (saved > 0) requestAnimationFrame(() => { menu.scrollTop = saved; });
    menu.addEventListener("scroll", () => sessionStorage.setItem(key, String(menu.scrollTop)), { passive: true });
    menu.addEventListener("click", () => sessionStorage.setItem(key, String(menu.scrollTop)), true);
  }

  function init() {
    if (isPublicPage()) {
      document.body.classList.add("fusion-public-page");
      return;
    }
    const moduleName = moduleFromPath(location.pathname);
    const { shell, main } = ensureShellAndMain();
    renderSidebar(shell);
    renderTopbar(main, moduleName);
    highlight(moduleName);
    setUser();
    preserveMenuScroll();
    document.body.classList.add("fusion-layout-ready");
  }

  window.FusionLayout = { init, moduleFromPath };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();`;

const cssBlock = `
/* === FUSION_LAYOUT_UNICO_V3_START === */
:root {
  --fusion-sidebar-width: 278px;
  --fusion-sidebar-bg: #101826;
  --fusion-sidebar-text: #dbe4f0;
  --fusion-orange: #ff6600;
  --fusion-border: #d8dee8;
}
html, body { min-height: 100%; }
body {
  margin: 0 !important;
  font-family: Arial, Helvetica, sans-serif !important;
  background: #f4f6f9 !important;
  color: #1f2937;
}
body.fusion-public-page { background: #f4f6f9 !important; }
.fusion-shell {
  display: flex !important;
  min-height: 100vh !important;
  width: 100% !important;
  align-items: stretch !important;
}
.fusion-sidebar {
  width: var(--fusion-sidebar-width) !important;
  min-width: var(--fusion-sidebar-width) !important;
  max-width: var(--fusion-sidebar-width) !important;
  height: 100vh !important;
  position: sticky !important;
  top: 0 !important;
  left: 0 !important;
  overflow: hidden !important;
  background: var(--fusion-sidebar-bg) !important;
  color: #fff !important;
  display: flex !important;
  flex-direction: column !important;
  font-family: Arial, Helvetica, sans-serif !important;
  z-index: 20 !important;
}
.fusion-brand {
  height: 68px !important;
  min-height: 68px !important;
  padding: 0 20px !important;
  display: flex !important;
  align-items: center !important;
  color: var(--fusion-orange) !important;
  border-bottom: 1px solid rgba(255,255,255,.08) !important;
  font-size: 22px !important;
  line-height: 1 !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
}
.fusion-menu {
  flex: 1 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 12px 12px 18px !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.25) transparent;
  scroll-behavior: auto !important;
}
.fusion-menu-group {
  margin: 16px 10px 7px !important;
  color: #9aa4b2 !important;
  font-size: 11px !important;
  line-height: 1.1 !important;
  letter-spacing: .09em !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  white-space: nowrap !important;
}
.fusion-menu a {
  width: 100% !important;
  min-height: 42px !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px 12px !important;
  margin: 3px 0 !important;
  border-radius: 10px !important;
  color: var(--fusion-sidebar-text) !important;
  font-family: Arial, Helvetica, sans-serif !important;
  font-size: 14px !important;
  line-height: 1.2 !important;
  font-weight: 600 !important;
  text-decoration: none !important;
  white-space: nowrap !important;
  box-sizing: border-box !important;
  background: transparent !important;
}
.fusion-menu a span:last-child { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
.fusion-menu-icon {
  width: 24px !important; min-width: 24px !important; max-width: 24px !important;
  height: 22px !important;
  display: inline-flex !important; align-items: center !important; justify-content: center !important;
  font-size: 16px !important; line-height: 1 !important; text-align: center !important;
}
.fusion-menu a:hover,
.fusion-menu a.active,
.fusion-menu a[aria-current="page"] {
  background: var(--fusion-orange) !important;
  color: #fff !important;
}
.fusion-sidebar-footer {
  min-height: 50px !important;
  padding: 14px 16px !important;
  border-top: 1px solid rgba(255,255,255,.08) !important;
  color: #9aa4b2 !important;
  font-size: 12px !important;
  line-height: 1.3 !important;
  white-space: nowrap !important;
}
.fusion-main {
  flex: 1 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  margin: 0 !important;
  padding: 0 !important;
  width: auto !important;
  background: #f4f6f9 !important;
}
.fusion-topbar {
  height: 64px !important;
  min-height: 64px !important;
  background: #fff !important;
  border-bottom: 1px solid var(--fusion-border) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 24px !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  width: 100% !important;
}
.fusion-title { font-size: 20px !important; font-weight: 700 !important; line-height: 1.2 !important; color: #1f2937 !important; }
.fusion-userbar { display: inline-flex !important; align-items: center !important; gap: 10px !important; color: #6b7280 !important; font-size: 14px !important; }
.fusion-userbar button, .fusion-topbar button {
  border: 1px solid #cbd5e1 !important;
  background: #fff !important;
  border-radius: 8px !important;
  padding: 8px 11px !important;
  cursor: pointer !important;
  font: inherit !important;
  color: #0f172a !important;
}
.fusion-page-content,
.fusion-main > main.main,
.fusion-main > main {
  margin: 0 !important;
  margin-left: 0 !important;
  width: 100% !important;
  max-width: none !important;
  min-height: auto !important;
  padding: 24px !important;
  box-sizing: border-box !important;
  background: #f4f6f9 !important;
}
.fusion-content { padding: 24px !important; box-sizing: border-box !important; width: 100% !important; }
.fusion-card, .card {
  background: #fff;
  border: 1px solid var(--fusion-border);
  border-radius: 14px;
}
.fusion-button {
  background: var(--fusion-orange);
  color: #fff;
  border: 0;
  border-radius: 9px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 700;
}
.fusion-button.secondary { background: #172136; color: #fff; }

body.fusion-layout-ready > aside.sidebar,
body.fusion-layout-ready > .sidebar,
body.fusion-layout-ready .fusion-main aside.sidebar,
body.fusion-layout-ready .fusion-main .sidebar {
  display: none !important;
}

@media (max-width: 900px) {
  .fusion-shell { display: block !important; }
  .fusion-sidebar {
    position: relative !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    height: auto !important;
    max-height: 60vh !important;
  }
}
/* === FUSION_LAYOUT_UNICO_V3_END === */
`;

function replaceMarkedBlock(content, start, end, replacement) {
  const re = new RegExp(`${start}[\\s\\S]*?${end}`, "g");
  if (re.test(content)) return content.replace(re, replacement);
  return content.trimEnd() + "\n\n" + replacement + "\n";
}

function removeOldMarkedBlocks(content) {
  return content
    .replace(/\/\* === FUSION_LAYOUT_GLOBAL_COMPONENTIZADO_START === \*\/[\s\S]*?\/\* === FUSION_LAYOUT_GLOBAL_COMPONENTIZADO_END === \*\//g, "")
    .replace(/\/\* === FUSION_LAYOUT_UNICO_V3_START === \*\/[\s\S]*?\/\* === FUSION_LAYOUT_UNICO_V3_END === \*\//g, "")
    .replace(/\/\* Fusion Layout Global Componentizado \*\/[\s\S]*?(?=\/\* ===|$)/g, "");
}

function pageModuleName(pageDir) {
  return path.basename(pageDir);
}

function listExistingPageModules() {
  if (!exists(PAGES_DIR)) return [];
  return fs.readdirSync(PAGES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && exists(path.join(PAGES_DIR, d.name, "index.html")))
    .map(d => d.name)
    .sort();
}

function processHtmlFile(file, existingModules) {
  let html = read(file);
  const original = html;
  backup(file);

  const isLogin = file.replaceAll("\\","/").includes("/public/pages/login/");
  if (isLogin) {
    html = html.replace(/<script[^>]+src=["']\/assets\/js\/fusion-layout\.js["'][^>]*><\/script>\s*/gi, "");
    write(file, html);
    return original !== html;
  }

  if (!/<link[^>]+\/assets\/css\/fusion-app\.css/i.test(html)) {
    html = html.replace(/<\/head>/i, '  <link rel="stylesheet" href="/assets/css/fusion-app.css">\n</head>');
  }

  if (!/<script[^>]+\/assets\/js\/fusion-auth\.js/i.test(html)) {
    html = html.replace(/<\/head>/i, '  <script src="/assets/js/fusion-auth.js"></script>\n  <script>FusionAuth.proteger();</script>\n</head>');
  }

  html = html.replace(/<script[^>]+src=["']\/js\/layout\.js["'][^>]*><\/script>\s*/gi, "");
  html = html.replace(/<script>\s*carregarLayout\([^)]*\);\s*<\/script>\s*/gi, "");

  // Remove old direct sidebar blocks. The global layout recreates one sidebar.
  html = html.replace(/<aside\s+class=["']sidebar["'][\s\S]*?<\/aside>\s*/i, "");
  html = html.replace(/<aside\s+class=["']fusion-sidebar["'][\s\S]*?<\/aside>\s*/i, "");

  const metaContent = existingModules.join(",");
  if (/<meta\s+name=["']fusion-existing-pages["']/i.test(html)) {
    html = html.replace(/<meta\s+name=["']fusion-existing-pages["'][^>]*>/i, `<meta name="fusion-existing-pages" content="${metaContent}">`);
  } else {
    html = html.replace(/<\/head>/i, `  <meta name="fusion-existing-pages" content="${metaContent}">\n</head>`);
  }

  html = html.replace(/<script[^>]+src=["']\/assets\/js\/fusion-layout\.js["'][^>]*><\/script>\s*/gi, "");
  html = html.replace(/<\/body>/i, '  <script src="/assets/js/fusion-layout.js"></script>\n</body>');

  write(file, html);
  return original !== html;
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) out.push(p);
  }
  return out;
}

ensureDir(ASSETS_JS);
ensureDir(ASSETS_CSS);
backup(LAYOUT_JS);
write(LAYOUT_JS, layoutJs);

backup(APP_CSS);
let css = exists(APP_CSS) ? read(APP_CSS) : "";
css = removeOldMarkedBlocks(css);
css = replaceMarkedBlock(css, "/\\* === FUSION_LAYOUT_UNICO_V3_START === \\*/", "/\\* === FUSION_LAYOUT_UNICO_V3_END === \\*/", cssBlock.trim());
write(APP_CSS, css.trim() + "\n");

const existingModules = listExistingPageModules();
const htmlFiles = walk(PAGES_DIR);
let altered = 0;
for (const file of htmlFiles) {
  if (processHtmlFile(file, existingModules)) altered++;
}

console.log("Layout único v3 aplicado.");
console.log(JSON.stringify({
  backup: path.relative(ROOT, BACKUP_DIR),
  paginasEncontradas: existingModules.length,
  modulosMenu: existingModules,
  htmlAtualizados: altered,
  layoutJs: path.relative(ROOT, LAYOUT_JS),
  css: path.relative(ROOT, APP_CSS)
}, null, 2));
