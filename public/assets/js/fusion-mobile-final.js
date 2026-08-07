(function(){
  'use strict';

  function qs(sel){ return document.querySelector(sel); }

  function usaMenuSuperior(){
    return !!(
      qs('#fusionTopMenu') ||
      document.documentElement.classList.contains('fusion-menu-superior-ativo') ||
      document.body?.classList.contains('fusion-menu-superior-ativo') ||
      document.body?.classList.contains('fusion-layout-fullwidth')
    );
  }

  function hasMenu(){
    return qs('.fusion-ui-sidebar,.fusion-sidebar,.sidebar,.side-menu,.menu-lateral,.app-sidebar,.layout-sidebar,.menu-global,.nav-sidebar');
  }

  function titleText(){
    var h = qs('h1,.page-actions h2,.page-head h2,.section-head h2');
    if (h && h.textContent.trim()) return h.textContent.trim();
    return (document.title || 'Fusion Sistema').replace(/\s*[-|].*$/,'').trim() || 'Fusion Sistema';
  }

  function liberarRolagemDoMenuSuperior(){
    if (!usaMenuSuperior()) return;

    document.querySelectorAll('.fusion-mobile-final-bar,.fusion-mobile-final-overlay').forEach(function(el){
      el.remove();
    });

    [document.documentElement, document.body].filter(Boolean).forEach(function(el){
      el.classList.remove('fusion-menu-open','fusion-ui-menu-open');
      el.style.removeProperty('overflow');
      el.style.removeProperty('overflow-y');
      el.style.removeProperty('touch-action');
      el.style.removeProperty('height');
      el.style.removeProperty('max-height');
    });
  }

  function ensureTopbar(){
    if (usaMenuSuperior()) {
      liberarRolagemDoMenuSuperior();
      return;
    }
    if (document.querySelector('.fusion-mobile-final-bar')) return;

    var bar = document.createElement('div');
    bar.className = 'fusion-mobile-final-bar';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fusion-mobile-final-menu-btn';
    btn.setAttribute('aria-label','Abrir menu');
    btn.innerHTML = '☰';

    var title = document.createElement('div');
    title.className = 'fusion-mobile-final-title';
    title.textContent = titleText();

    bar.appendChild(btn);
    bar.appendChild(title);
    document.body.appendChild(bar);

    var overlay = document.createElement('div');
    overlay.className = 'fusion-mobile-final-overlay';
    document.body.appendChild(overlay);

    function close(){
      document.body.classList.remove('fusion-menu-open');
      btn.setAttribute('aria-label','Abrir menu');
      btn.setAttribute('aria-expanded','false');
      btn.innerHTML = '☰';
    }

    function toggle(){
      var aberto = document.body.classList.toggle('fusion-menu-open');
      btn.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
      btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      btn.innerHTML = aberto ? '×' : '☰';
    }

    btn.setAttribute('aria-expanded','false');
    btn.addEventListener('click', toggle);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') close(); });
    document.querySelectorAll('.sidebar a,.fusion-sidebar a,.side-menu a,.menu-lateral a').forEach(function(link){
      link.addEventListener('click', close);
    });
  }

  function wrapTables(){
    document.querySelectorAll('table').forEach(function(tbl){
      var p = tbl.parentElement;
      if (!p || p.classList.contains('table-wrap') || p.classList.contains('table-responsive') || p.classList.contains('tabela-wrap') || p.classList.contains('tabela-container')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      p.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
  }

  function init(){
    document.body.classList.add('fusion-mobile-ready');
    liberarRolagemDoMenuSuperior();
    if (!usaMenuSuperior() && hasMenu()) ensureTopbar();
    wrapTables();
  }

  window.addEventListener('pageshow', liberarRolagemDoMenuSuperior);
  window.addEventListener('orientationchange', liberarRolagemDoMenuSuperior);
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) liberarRolagemDoMenuSuperior();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
