(function(){
  'use strict';
  if (window.__FusionNoSidebarLoaded) return;
  window.__FusionNoSidebarLoaded = true;

  function ensureStyle(){
    var href = '/assets/css/fusion-no-sidebar.css';
    if (!document.querySelector('link[href="' + href + '"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function removeMenus(){
    document.body.classList.add('fusion-no-sidebar');
    document.body.classList.remove('fusion-ui-menu-open','fusion-menu-open');
    var selectors = [
      '.fusion-ui-sidebar', '.fusion-sidebar', 'aside[data-fusion-sidebar]', 'aside.sidebar',
      'body > aside', '.sidebar', '.side-menu', '.menu-lateral', '.layout-sidebar', '.app-sidebar',
      '.fusion-clean-sidebar', '.fusion-menu-global', '.fusion-mobile-final-bar', '.fusion-mobile-final-overlay',
      '.fusion-mobile-menu-button', '.fusion-mobile-overlay', '.fusion-mobile-backdrop', '.fusion-ui-backdrop',
      '[data-fusion-ui-menu]', '[data-fusion-sidebar]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function(el){
      if (!el.closest('.modal, .modal-card, .modal-content, [role="dialog"]')) el.remove();
    });
    document.querySelectorAll('[data-fusion-menu-toggle],[data-fusion-mobile-menu]').forEach(function(el){ el.remove(); });
  }

  function normalizeLayout(){
    var shell = document.querySelector('.fusion-shell');
    if (!shell) return;
    var main = shell.querySelector(':scope > .fusion-main') || document.querySelector('.fusion-main');
    if (main) {
      main.style.marginLeft = '0';
      main.style.width = '100%';
      main.style.maxWidth = '100%';
    }
  }

  function run(){
    ensureStyle();
    if (document.body) {
      removeMenus();
      normalizeLayout();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.addEventListener('load', run);
  setTimeout(run, 50);
  setTimeout(run, 250);
  setTimeout(run, 800);
  window.FusionNoSidebar = { run: run };
})();
