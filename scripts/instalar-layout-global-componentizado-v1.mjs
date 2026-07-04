import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, "backup_layout_global_componentizado_" + stamp);

const layoutJs = `(function () {
  const MENU_HTML = \`
    <aside class="fusion-sidebar" data-fusion-sidebar>
      <div class="fusion-brand">Fusion ERP</div>
      <nav class="fusion-menu" aria-label="Menu principal">
        <div class="fusion-menu-group">PRINCIPAL</div>
        <a href="/pages/dashboard/index.html" data-module="dashboard"><span class="fusion-menu-icon">🏠</span><span>Dashboard</span></a>

        <div class="fusion-menu-group">PESSOAS</div>
        <a href="/pages/alunos/index.html" data-module="alunos"><span class="fusion-menu-icon">👥</span><span>Alunos</span></a>
        <a href="/pages/professores/index.html" data-module="professores"><span class="fusion-menu-icon">🧑‍🏫</span><span>Professores</span></a>

        <div class="fusion-menu-group">ACADEMIA</div>
        <a href="/pages/modalidades/index.html" data-module="modalidades"><span class="fusion-menu-icon">🏊</span><span>Modalidades</span></a>
        <a href="/pages/planos/index.html" data-module="planos"><span class="fusion-menu-icon">📦</span><span>Planos</span></a>
        <a href="/pages/turmas/index.html" data-module="turmas"><span class="fusion-menu-icon">🏫</span><span>Turmas</span></a>
        <a href="/pages/agenda/index.html" data-module="agenda"><span class="fusion-menu-icon">🗓️</span><span>Agenda</span></a>
        <a href="/pages/checkin/index.html" data-module="checkin"><span class="fusion-menu-icon">✅</span><span>Check-in</span></a>
        <a href="/pages/avaliacoes/index.html" data-module="avaliacoes"><span class="fusion-menu-icon">📊</span><span>Avaliações</span></a>
        <a href="/pages/treinos/index.html" data-module="treinos"><span class="fusion-menu-icon">💪</span><span>Treinos</span></a>
        <a href="/pages/exercicios/index.html" data-module="exercicios"><span class="fusion-menu-icon">🏋️</span><span>Exercícios</span></a>

        <div class="fusion-menu-group">FINANCEIRO</div>
        <a href="/pages/financeiro/index.html" data-module="financeiro"><span class="fusion-menu-icon">💰</span><span>Financeiro</span></a>
        <a href="/pages/mensalidades/index.html" data-module="mensalidades"><span class="fusion-menu-icon">🧾</span><span>Mensalidades</span></a>
        <a href="/pages/caixa/index.html" data-module="caixa"><span class="fusion-menu-icon">🏦</span><span>Caixa</span></a>
        <a href="/pages/relatorios-caixa/index.html" data-module="relatorios-caixa"><span class="fusion-menu-icon">📄</span><span>Relatório Diário</span></a>

        <div class="fusion-menu-group">BUSINESS INTELLIGENCE</div>
        <a href="/pages/bi/index.html" data-module="bi"><span class="fusion-menu-icon">📈</span><span>BI e Rankings</span></a>
        <a href="/pages/bi-financeiro/index.html" data-module="bi-financeiro"><span class="fusion-menu-icon">📊</span><span>BI Financeiro</span></a>
        <a href="/pages/bi-operacional/index.html" data-module="bi-operacional"><span class="fusion-menu-icon">📋</span><span>BI Operacional</span></a>
        <a href="/pages/bi-comercial/index.html" data-module="bi-comercial"><span class="fusion-menu-icon">🎯</span><span>BI Comercial</span></a>

        <div class="fusion-menu-group">SISTEMA</div>
        <a href="/pages/relatorios/index.html" data-module="relatorios"><span class="fusion-menu-icon">🗂️</span><span>Relatórios</span></a>
        <a href="/pages/configuracoes/index.html" data-module="configuracoes"><span class="fusion-menu-icon">⚙️</span><span>Configurações</span></a>
      </nav>
      <div class="fusion-sidebar-footer">Layout global</div>
    </aside>\`;

  function moduleFromPath(pathname) {
    const match = String(pathname || "").match(/\\/pages\\/([^\\/]+)\\//);
    return match ? match[1] : "dashboard";
  }

  function ensureShell() {
    let shell = document.querySelector(".fusion-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "fusion-shell";
      while (document.body.firstChild) shell.appendChild(document.body.firstChild);
      document.body.appendChild(shell);
    }
    return shell;
  }

  function ensureMain(shell) {
    let main = shell.querySelector(".fusion-main");
    if (!main) {
      main = document.createElement("main");
      main.className = "fusion-main";
      Array.from(shell.childNodes).forEach((node) => {
        if (!(node.nodeType === 1 && node.matches(".fusion-sidebar"))) main.appendChild(node);
      });
      shell.appendChild(main);
    }
    return main;
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
    return map[moduleName] || document.title.replace("Fusion ERP - ", "") || "Fusion ERP";
  }

  function renderSidebar(shell) {
    const oldSidebars = Array.from(shell.querySelectorAll(".fusion-sidebar"));
    oldSidebars.forEach((el) => el.remove());

    const temp = document.createElement("div");
    temp.innerHTML = MENU_HTML.trim();
    const sidebar = temp.firstElementChild;
    shell.insertBefore(sidebar, shell.firstChild);
    return sidebar;
  }

  function renderTopbar(main, moduleName) {
    let topbar = main.querySelector(":scope > .fusion-topbar");
    if (!topbar) {
      topbar = document.createElement("header");
      topbar.className = "fusion-topbar";
      main.insertBefore(topbar, main.firstChild);
    }

    topbar.innerHTML = \`
      <div class="fusion-title">\${titleFromModule(moduleName)}</div>
      <div class="fusion-userbar"><span data-fusion-user></span> <button type="button" data-fusion-logout>Sair</button></div>
    \`;
  }

  function highlight(moduleName) {
    document.querySelectorAll(".fusion-menu a").forEach((link) => {
      const m = link.getAttribute("data-module");
      const active = m === moduleName;
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
      usuario = window.FusionAuth && window.FusionAuth.getUsuario ? window.FusionAuth.getUsuario() : JSON.parse(localStorage.getItem("fusion_usuario") || "null");
    } catch {}
    el.textContent = usuario ? [usuario.nome, usuario.perfil].filter(Boolean).join(" · ") : "Sessão local";

    const btn = document.querySelector("[data-fusion-logout]");
    if (btn) {
      btn.onclick = function () {
        if (window.FusionAuth && window.FusionAuth.sair) window.FusionAuth.sair();
        else location.href = "/pages/login/index.html";
      };
    }
  }

  function preserveMenuScroll() {
    const menu = document.querySelector(".fusion-menu");
    if (!menu) return;
    const key = "fusion_menu_scroll_top";
    const saved = Number(sessionStorage.getItem(key) || "0");
    if (saved > 0) menu.scrollTop = saved;
    menu.addEventListener("scroll", () => sessionStorage.setItem(key, String(menu.scrollTop)), { passive: true });
    menu.addEventListener("click", () => sessionStorage.setItem(key, String(menu.scrollTop)), true);
  }

  function init() {
    const moduleName = moduleFromPath(location.pathname);
    const shell = ensureShell();
    const main = ensureMain(shell);
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
const cssBlock = `/* Fusion Layout Global Componentizado */
:root {
  --fusion-sidebar-width: 278px;
  --fusion-sidebar-bg: #101826;
  --fusion-sidebar-text: #dbe4f0;
  --fusion-orange: #ff6600;
  --fusion-border: #d8dee8;
}

html, body {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif !important;
  background: #f4f6f9;
  color: #1f2937;
}

.fusion-shell {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

.fusion-sidebar {
  width: var(--fusion-sidebar-width) !important;
  min-width: var(--fusion-sidebar-width) !important;
  max-width: var(--fusion-sidebar-width) !important;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow: hidden;
  background: var(--fusion-sidebar-bg);
  color: #fff;
  display: flex;
  flex-direction: column;
  font-family: Arial, Helvetica, sans-serif !important;
}

.fusion-brand {
  height: 68px;
  min-height: 68px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  color: var(--fusion-orange);
  border-bottom: 1px solid rgba(255,255,255,.08);
  font-size: 22px !important;
  line-height: 1 !important;
  font-weight: 700 !important;
  white-space: nowrap;
}

.fusion-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 12px 18px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.25) transparent;
  scroll-behavior: auto !important;
}

.fusion-menu-group {
  margin: 16px 10px 7px;
  color: #778397;
  font-size: 11px !important;
  line-height: 1.1 !important;
  letter-spacing: .06em;
  font-weight: 800 !important;
  text-transform: uppercase;
  white-space: nowrap;
}

.fusion-menu a {
  width: 100%;
  min-height: 42px;
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
  box-sizing: border-box;
  transition: background .12s ease, color .12s ease;
}

.fusion-menu a span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fusion-menu-icon {
  width: 24px !important;
  min-width: 24px !important;
  max-width: 24px !important;
  height: 22px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 16px !important;
  line-height: 1 !important;
  text-align: center !important;
}

.fusion-menu a:hover,
.fusion-menu a.active,
.fusion-menu a[aria-current="page"] {
  background: var(--fusion-orange) !important;
  color: #fff !important;
}

.fusion-sidebar-footer {
  min-height: 50px;
  padding: 14px 16px;
  border-top: 1px solid rgba(255,255,255,.08);
  color: #9aa4b2;
  font-size: 12px !important;
  line-height: 1.3 !important;
  white-space: nowrap;
}

.fusion-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.fusion-topbar {
  height: 64px;
  min-height: 64px;
  background: #fff;
  border-bottom: 1px solid var(--fusion-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-sizing: border-box;
}

.fusion-title {
  font-size: 20px !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  color: #1f2937;
}

.fusion-userbar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #6b7280;
  font-size: 14px !important;
}

.fusion-userbar button,
.fusion-topbar button {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 8px 11px;
  cursor: pointer;
  font: inherit;
  color: #0f172a;
}

.fusion-content {
  padding: 24px;
  box-sizing: border-box;
}

.fusion-card {
  background: #fff;
  border: 1px solid var(--fusion-border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 8px 20px rgba(16,24,38,.05);
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

.fusion-button.secondary {
  background: #172136;
  color: #fff;
}

@media (max-width: 900px) {
  .fusion-shell { display: block; }
  .fusion-sidebar {
    position: relative;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    height: auto;
    max-height: 60vh;
  }
}`;

const pages = [
  "public/pages/dashboard/index.html",
  "public/pages/alunos/index.html",
  "public/pages/professores/index.html",
  "public/pages/avaliacoes/index.html",
  "public/pages/treinos/index.html",
  "public/pages/financeiro/index.html",
  "public/pages/mensalidades/index.html",
  "public/pages/caixa/index.html",
  "public/pages/relatorios-caixa/index.html",
  "public/pages/modalidades/index.html",
  "public/pages/planos/index.html",
  "public/pages/turmas/index.html",
  "public/pages/agenda/index.html",
  "public/pages/checkin/index.html",
  "public/pages/exercicios/index.html",
  "public/pages/bi/index.html",
  "public/pages/configuracoes/index.html"
];

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function backup(file) {
  const src = path.join(ROOT, file);
  if (!(await exists(src))) return;
  const dst = path.join(backupDir, file);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}

function removeSidebar(html) {
  return html.replace(/\s*<aside\b[^>]*class=["'][^"']*fusion-sidebar[^"']*["'][\s\S]*?<\/aside>\s*/gi, "\n");
}

function ensureCss(html) {
  if (html.includes('/assets/css/fusion-app.css')) return html;
  return html.replace(/<\/head>/i, '  <link rel="stylesheet" href="/assets/css/fusion-app.css">\n</head>');
}

function ensureAuth(html) {
  if (html.includes('/assets/js/fusion-auth.js')) return html;
  return html.replace(/<\/head>/i, '  <script src="/assets/js/fusion-auth.js"></script>\n  <script>FusionAuth.proteger();</script>\n</head>');
}

function ensureLayoutScript(html) {
  html = html.replace(/\s*<script\s+src=["']\/assets\/js\/fusion-layout\.js["']\s*><\/script>\s*/gi, "\n");
  return html.replace(/<\/body>/i, '  <script src="/assets/js/fusion-layout.js"></script>\n</body>');
}

function ensureShell(html) {
  // Páginas antigas podem ter só <main class="main">. O JS cria shell/main quando necessário.
  // Páginas novas já têm fusion-shell. Não mexemos no conteúdo para reduzir risco.
  return html;
}

async function installLayoutJs() {
  const file = path.join(ROOT, "public/assets/js/fusion-layout.js");
  await backup("public/assets/js/fusion-layout.js");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, layoutJs, "utf-8");
}

async function installCss() {
  const fileRel = "public/assets/css/fusion-app.css";
  const file = path.join(ROOT, fileRel);
  await backup(fileRel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  let current = "";
  if (await exists(file)) current = await fs.readFile(file, "utf-8");
  const start = "/* === FUSION_LAYOUT_GLOBAL_COMPONENTIZADO_START === */";
  const end = "/* === FUSION_LAYOUT_GLOBAL_COMPONENTIZADO_END === */";
  const block = `${start}\n${cssBlock}\n${end}\n`;
  const re = new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n?", "g");
  if (re.test(current)) current = current.replace(re, block);
  else current += "\n\n" + block;
  await fs.writeFile(file, current, "utf-8");
}

async function normalizePages() {
  for (const rel of pages) {
    const file = path.join(ROOT, rel);
    if (!(await exists(file))) continue;
    await backup(rel);
    let html = await fs.readFile(file, "utf-8");
    html = removeSidebar(html);
    html = ensureCss(html);
    html = ensureAuth(html);
    html = ensureLayoutScript(html);
    html = ensureShell(html);
    await fs.writeFile(file, html, "utf-8");
  }
}

await fs.mkdir(backupDir, { recursive: true });
await installLayoutJs();
await installCss();
await normalizePages();

console.log("Layout global componentizado instalado.");
console.log("Backup criado em:", backupDir);
console.log("Arquivos principais:");
console.log("- public/assets/js/fusion-layout.js");
console.log("- public/assets/css/fusion-app.css");
console.log("As páginas agora não dependem mais de cópias locais do menu.");