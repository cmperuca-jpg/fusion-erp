(function(){
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function ensureBackdrop(){
    var backdrop = qs('.fusion-mobile-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'fusion-mobile-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.addEventListener('click', closeMenu);
  }

  function openMenu(){
    document.body.classList.add('fusion-menu-open');
    var btn = qs('[data-fusion-mobile-menu]');
    if (btn) btn.setAttribute('aria-expanded','true');
  }

  function closeMenu(){
    document.body.classList.remove('fusion-menu-open');
    var btn = qs('[data-fusion-mobile-menu]');
    if (btn) btn.setAttribute('aria-expanded','false');
  }

  function toggleMenu(){
    if (document.body.classList.contains('fusion-menu-open')) closeMenu();
    else openMenu();
  }

  function ensureMobileButton(){
    var topbar = qs('.fusion-topbar');
    if (!topbar || qs('[data-fusion-mobile-menu]', topbar)) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fusion-mobile-toggle';
    btn.setAttribute('data-fusion-mobile-menu','');
    btn.setAttribute('aria-label','Abrir menu');
    btn.setAttribute('aria-expanded','false');
    btn.innerHTML = '<span aria-hidden="true">☰</span>';
    btn.addEventListener('click', toggleMenu);
    topbar.insertBefore(btn, topbar.firstChild);
  }

  function closeOnMenuClick(){
    qsa('.fusion-menu a').forEach(function(link){
      link.addEventListener('click', function(){
        if (window.matchMedia('(max-width: 900px)').matches) closeMenu();
      });
    });
  }

  function wrapTables(){
    qsa('table').forEach(function(table){
      if (table.parentElement && /table-wrap|tabela-wrap|table-responsive/.test(table.parentElement.className)) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-responsive fusion-mobile-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function markPrimaryActions(){
    qsa('a,button,input[type="submit"],input[type="button"]').forEach(function(el){
      if (!el.textContent && !el.value) return;
      el.setAttribute('data-fusion-touch-ready','true');
    });
  }

  function init(){
    document.body.classList.add('fusion-mobile-first-ready');
    ensureBackdrop();
    ensureMobileButton();
    closeOnMenuClick();
    wrapTables();
    markPrimaryActions();
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeMenu(); });
  }

  window.FusionMobileFirst = { init:init, openMenu:openMenu, closeMenu:closeMenu };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
