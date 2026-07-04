(function () {
  const PUBLIC_PATHS = ['/pages/login/', '/pages/login/index.html'];
  function isPublicPage() {
    const p = location.pathname.toLowerCase();
    return PUBLIC_PATHS.some(x => p === x || p.startsWith(x));
  }

  const MENU = [
    { group: 'PRINCIPAL', items: [
      ['dashboard', '🏠', 'Dashboard', '/pages/dashboard/index.html']
    ]},
    { group: 'PESSOAS', items: [
      ['alunos', '👥', 'Alunos', '/pages/alunos/index.html'],
      ['professores', '🧑‍🏫', 'Professores', '/pages/professores/index.html']
    ]},
    { group: 'ACADEMIA', items: [
      ['modalidades', '🏊', 'Modalidades', '/pages/modalidades/index.html'],
      ['planos', '📦', 'Planos', '/pages/planos/index.html'],
      ['turmas', '🏫', 'Turmas', '/pages/turmas/index.html'],
      ['agenda', '🗓️', 'Agenda', '/pages/agenda/index.html'],
      ['matriculas', '📝', 'Matrículas', '/pages/matriculas/index.html'],
      ['presencas', '📋', 'Presenças', '/pages/presencas/index.html'],
      ['checkin', '✅', 'Check-in', '/pages/checkin/index.html'],
      ['avaliacoes', '📊', 'Avaliações', '/pages/avaliacoes/index.html'],
      ['treinos', '💪', 'Treinos', '/pages/treinos/index.html'],
      ['modelos-treino', '📚', 'Modelos de treino', '/pages/modelos-treino/index.html'],
      ['exercicios', '🏋️', 'Exercícios', '/pages/exercicios/index.html']
    ]},
    { group: 'FINANCEIRO', items: [
      ['financeiro', '💰', 'Financeiro', '/pages/financeiro/index.html'],
      ['mensalidades', '🧾', 'Mensalidades', '/pages/mensalidades/index.html'],
      ['caixa', '🏦', 'Caixa', '/pages/caixa/index.html'],
      ['recebimentos', '💵', 'Recebimentos', '/pages/recebimentos/index.html'],
      ['pagamentos', '💸', 'Pagamentos', '/pages/pagamentos/index.html'],
      ['relatorios-caixa', '📄', 'Relatório Caixa', '/pages/relatorios-caixa/index.html']
    ]},
    { group: 'BUSINESS INTELLIGENCE', items: [
      ['bi', '📈', 'BI e Rankings', '/pages/bi/index.html'],
      ['bi-financeiro', '📊', 'BI Financeiro', '/pages/bi-financeiro/index.html'],
      ['bi-academia-operacional', '📋', 'BI Operacional', '/pages/bi-academia-operacional/index.html'],
      ['bi-academia', '🎯', 'BI Comercial', '/pages/bi-academia/index.html']
    ]},
    { group: 'SISTEMA', items: [
      ['configuracoes', '⚙️', 'Configurações', '/pages/configuracoes/index.html']
    ]}
  ];

  const TITLES = {
    dashboard: 'Dashboard', alunos: 'Alunos', professores: 'Professores', modalidades: 'Modalidades', planos: 'Planos', turmas: 'Turmas', agenda: 'Agenda', matriculas: 'Matrículas', presencas: 'Presenças', checkin: 'Check-in', avaliacoes: 'Avaliações', treinos: 'Treinos', 'modelos-treino': 'Modelos de treino', exercicios: 'Exercícios', financeiro: 'Financeiro', mensalidades: 'Mensalidades', caixa: 'Caixa', recebimentos: 'Recebimentos', pagamentos: 'Pagamentos', 'relatorios-caixa': 'Relatório Caixa', bi: 'BI e Rankings', 'bi-financeiro': 'BI Financeiro', 'bi-academia-operacional': 'BI Operacional', 'bi-academia': 'BI Comercial', configuracoes: 'Configurações', estoque: 'Estoque', 'portal-aluno': 'Portal do aluno'
  };

  function moduleFromPath(pathname) {
    const match = String(pathname || '').match(/\/pages\/([^\/]+)\/?/);
    return match ? match[1] : 'dashboard';
  }

  function menuHtml() {
    let html = '<aside class="fusion-sidebar" data-fusion-sidebar><div class="fusion-brand">Fusion ERP</div><nav class="fusion-menu" aria-label="Menu principal">';
    MENU.forEach(group => {
      html += '<div class="fusion-menu-group">' + group.group + '</div>';
      group.items.forEach(item => {
        html += '<a href="' + item[3] + '" data-module="' + item[0] + '"><span class="fusion-menu-icon">' + item[1] + '</span><span>' + item[2] + '</span></a>';
      });
    });
    html += '</nav><div class="fusion-sidebar-footer">Layout global</div></aside>';
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

  function renderSidebar(shell) {
    Array.from(document.querySelectorAll('.fusion-sidebar, .sidebar')).forEach(el => el.remove());
    const tmp = document.createElement('div');
    tmp.innerHTML = menuHtml();
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

  function init() {
    if (isPublicPage()) return;
    const moduleName = moduleFromPath(location.pathname);
    const shell = ensureShell();
    const main = ensureMain(shell);
    renderSidebar(shell);
    renderTopbar(main, moduleName);
    highlight(moduleName);
    setUser();
    preserveMenuScroll();
    document.body.classList.add('fusion-layout-ready');
  }

  window.FusionLayout = { init, moduleFromPath };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
