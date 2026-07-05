(function () {
  const PUBLIC_PATHS = ['/pages/login/', '/pages/login/index.html'];

  function isPublicPage() {
    const p = location.pathname.toLowerCase();
    return PUBLIC_PATHS.some(x => p === x || p.startsWith(x));
  }

  const MENU = [
    { group: 'CADASTROS', key: 'cadastros', items: [
      ['alunos', '👥', 'Alunos', '/pages/alunos/index.html'],
      ['professores', '🧑‍🏫', 'Professores', '/pages/professores/index.html']
    ]},
    { group: 'ACADEMIA', key: 'academia', items: [
      ['modalidades', '🏊', 'Modalidades', '/pages/modalidades/index.html'],
      ['planos', '📦', 'Planos', '/pages/planos/index.html'],
      ['matriculas', '📝', 'Matrículas', '/pages/matriculas/index.html'],
      ['agenda', '🗓️', 'Agenda', '/pages/agenda/index.html'],
      ['turmas', '🏫', 'Turmas', '/pages/turmas/index.html'],
      ['presencas', '📋', 'Presenças', '/pages/presencas/index.html'],
      ['checkin', '✅', 'Check-in', '/pages/checkin/index.html'],
      ['avaliacoes', '📊', 'Avaliações', '/pages/avaliacoes/index.html'],
      ['natacao-professor', '🏊‍♂️', 'Natação', '/pages/natacao-professor/index.html']
    ]},
    { group: 'FINANCEIRO', key: 'financeiro', items: [
      ['caixa', '🏦', 'Caixa', '/pages/caixa/index.html'],
      ['financeiro', '💰', 'Financeiro', '/pages/financeiro/index.html'],
      ['mensalidades', '🧾', 'Mensalidades', '/pages/mensalidades/index.html'],
      ['recebimentos', '💵', 'Recebimentos', '/pages/recebimentos/index.html'],
      ['pagamentos', '💸', 'Pagamentos', '/pages/pagamentos/index.html'],
      ['relatorios-caixa', '📄', 'Relatório Caixa', '/pages/relatorios-caixa/index.html']
    ]},
    { group: 'PORTAIS', key: 'portais', items: [
      ['professor-painel', '🧑‍🏫', 'Portal do Professor', '/pages/professor-painel/index.html'],
      ['portal-aluno', '👤', 'Portal do Aluno', '/pages/portal-aluno/index.html']
    ]},
    { group: 'BUSINESS INTELLIGENCE', key: 'business-intelligence', items: [
      ['bi-financeiro', '📊', 'BI Financeiro', '/pages/bi-financeiro/index.html'],
      ['bi-academia', '🎯', 'BI Comercial', '/pages/bi-academia/index.html'],
      ['bi-academia-operacional', '📋', 'BI Operacional', '/pages/bi-academia-operacional/index.html'],
      ['bi', '📈', 'BI e Rankings', '/pages/bi/index.html']
    ]},
    { group: 'SISTEMA', key: 'sistema', items: [
      ['configuracoes', '⚙️', 'Configurações', '/pages/configuracoes/index.html'],
      ['biblioteca-inteligente', '📚', 'Biblioteca Inteligente', '/pages/biblioteca-inteligente/index.html']
    ]}
  ];

  const TITLES = {
    alunos: 'Alunos',
    professores: 'Professores',
    modalidades: 'Modalidades',
    planos: 'Planos',
    matriculas: 'Matrículas',
    agenda: 'Agenda',
    turmas: 'Turmas',
    presencas: 'Presenças',
    checkin: 'Check-in',
    avaliacoes: 'Avaliações',
    'natacao-professor': 'Natação',
    'natacao-aluno': 'Portal do Aluno Natação',
    caixa: 'Caixa',
    financeiro: 'Financeiro',
    mensalidades: 'Mensalidades',
    recebimentos: 'Recebimentos',
    pagamentos: 'Pagamentos',
    'relatorios-caixa': 'Relatório Caixa',
    'professor-painel': 'Portal do Professor',
    'portal-aluno': 'Portal do Aluno',
    'bi-financeiro': 'BI Financeiro',
    'bi-academia': 'BI Comercial',
    'bi-academia-operacional': 'BI Operacional',
    bi: 'BI e Rankings',
    configuracoes: 'Configurações',
    'biblioteca-inteligente': 'Biblioteca Inteligente'
  };

  const STORAGE_KEY = 'fusion_menu_groups_open_v2';

  function moduleFromPath(pathname) {
    const match = String(pathname || '').match(/\/pages\/([^\/]+)\/?/);
    return match ? match[1] : 'dashboard';
  }

  function getOpenGroups(activeModule) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
    const open = new Set(Array.isArray(saved) ? saved : []);

    const activeGroup = MENU.find(group => group.items.some(item => item[0] === activeModule));
    if (activeGroup) open.add(activeGroup.key);

    if (!saved) {
      ['cadastros', 'academia', 'financeiro'].forEach(key => open.add(key));
    }

    return open;
  }

  function saveOpenGroups() {
    const open = Array.from(document.querySelectorAll('.fusion-menu-section.is-open'))
      .map(section => section.getAttribute('data-group'))
      .filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  }

  function menuHtml(activeModule) {
    const openGroups = getOpenGroups(activeModule);
    let html = '<aside class="fusion-sidebar" data-fusion-sidebar><div class="fusion-brand">Fusion ERP</div><nav class="fusion-menu" aria-label="Menu principal">';

    MENU.forEach(group => {
      const isActiveGroup = group.items.some(item => item[0] === activeModule);
      const isOpen = openGroups.has(group.key) || isActiveGroup;
      html += '<section class="fusion-menu-section ' + (isOpen ? 'is-open' : 'is-collapsed') + '" data-group="' + group.key + '">';
      html += '<button class="fusion-menu-group" type="button" aria-expanded="' + String(isOpen) + '" data-fusion-menu-toggle="' + group.key + '">';
      html += '<span class="fusion-menu-caret">▸</span><span>' + group.group + '</span>';
      html += '</button>';
      html += '<div class="fusion-menu-items">';
      group.items.forEach(item => {
        html += '<a href="' + item[3] + '" data-module="' + item[0] + '"><span class="fusion-menu-icon">' + item[1] + '</span><span>' + item[2] + '</span></a>';
      });
      html += '</div></section>';
    });

    html += '</nav></aside>';
    return html;
  }

  function ensureShell() {
    let shell = document.querySelector('.fusion-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'fusion-shell';
      while (document.body.firstChild) shell.appendChild(document.body.firstChild);
      document.body.appendChild(shell);
    }
    return shell;
  }

  function ensureMain(shell) {
    Array.from(shell.querySelectorAll(':scope > .sidebar, :scope > .fusion-sidebar, :scope > aside.sidebar')).forEach(el => el.remove());
    let main = shell.querySelector(':scope > .fusion-main');
    if (!main) {
      main = document.createElement('main');
      main.className = 'fusion-main';
      const nodes = Array.from(shell.childNodes);
      nodes.forEach(node => {
        if (node.nodeType === 1 && (node.matches('.fusion-sidebar') || node.matches('.sidebar'))) return;
        main.appendChild(node);
      });
      shell.appendChild(main);
    }
    Array.from(main.querySelectorAll('.sidebar, .fusion-sidebar')).forEach(el => el.remove());
    return main;
  }

  function renderSidebar(shell, moduleName) {
    Array.from(document.querySelectorAll('.fusion-sidebar, .sidebar')).forEach(el => el.remove());
    const tmp = document.createElement('div');
    tmp.innerHTML = menuHtml(moduleName);
    shell.insertBefore(tmp.firstElementChild, shell.firstChild);
  }

  function renderTopbar(main, moduleName) {
    Array.from(main.querySelectorAll(':scope > header:not(.fusion-topbar)')).forEach(el => el.remove());
    let topbar = main.querySelector(':scope > .fusion-topbar');
    if (!topbar) {
      topbar = document.createElement('header');
      topbar.className = 'fusion-topbar';
      main.insertBefore(topbar, main.firstChild);
    }
    topbar.innerHTML = '<div class="fusion-title">' + (TITLES[moduleName] || 'Fusion ERP') + '</div><div class="fusion-userbar"><span data-fusion-user></span> <button type="button" data-fusion-logout>Sair</button></div>';
  }

  function highlight(moduleName) {
    document.querySelectorAll('.fusion-menu a').forEach(link => {
      const active = link.getAttribute('data-module') === moduleName;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function bindAccordion() {
    document.querySelectorAll('[data-fusion-menu-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.closest('.fusion-menu-section');
        if (!section) return;

        const willOpen = !section.classList.contains('is-open');
        section.classList.toggle('is-open', willOpen);
        section.classList.toggle('is-collapsed', !willOpen);
        button.setAttribute('aria-expanded', String(willOpen));
        saveOpenGroups();
      });
    });
  }

  function setUser() {
    const el = document.querySelector('[data-fusion-user]');
    let usuario = null;
    try {
      usuario = window.FusionAuth && window.FusionAuth.getUsuario ? window.FusionAuth.getUsuario() : JSON.parse(localStorage.getItem('fusion_usuario') || 'null');
    } catch {}
    if (el) el.textContent = usuario ? [usuario.nome, usuario.perfil].filter(Boolean).join(' · ') : 'Sessão local';
    const btn = document.querySelector('[data-fusion-logout]');
    if (btn) btn.onclick = function () { if (window.FusionAuth && window.FusionAuth.sair) window.FusionAuth.sair(); else location.href = '/pages/login/index.html'; };
  }

  function preserveMenuScroll() {
    const menu = document.querySelector('.fusion-menu');
    if (!menu) return;
    const key = 'fusion_menu_scroll_top';
    const saved = Number(sessionStorage.getItem(key) || '0');
    if (saved > 0) requestAnimationFrame(() => { menu.scrollTop = saved; });
    menu.addEventListener('scroll', () => sessionStorage.setItem(key, String(menu.scrollTop)), { passive: true });
    menu.addEventListener('click', () => sessionStorage.setItem(key, String(menu.scrollTop)), true);
  }

  function ensureStyle(href) {
    if (!document.querySelector('link[href="' + href + '"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function ensureScript(src) {
    if (!document.querySelector('script[src="' + src + '"]')) {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      document.body.appendChild(script);
    }
  }

  function ensureMobileFirstAssets() {
    ensureStyle('/assets/css/fusion-mobile-first.css');
    ensureStyle('/assets/css/fusion-menu-accordion.css');
    ensureScript('/assets/js/fusion-mobile-first.js');
  }

  function init() {
    if (isPublicPage()) return;
    ensureMobileFirstAssets();
    const moduleName = moduleFromPath(location.pathname);
    const shell = ensureShell();
    const main = ensureMain(shell);
    renderSidebar(shell, moduleName);
    renderTopbar(main, moduleName);
    highlight(moduleName);
    bindAccordion();
    setUser();
    preserveMenuScroll();
    document.body.classList.add('fusion-layout-ready');
  }

  window.FusionLayout = { init, moduleFromPath };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
