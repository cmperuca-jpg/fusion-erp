(function(){
  'use strict';

  function qs(sel){ return document.querySelector(sel); }
  function hasMenu(){
    return qs('.fusion-ui-sidebar,.fusion-sidebar,.sidebar,.side-menu,.menu-lateral,aside,.app-sidebar,.layout-sidebar,.menu-global,.nav-sidebar');
  }
  function titleText(){
    var h = qs('h1');
    if (h && h.textContent.trim()) return h.textContent.trim();
    return (document.title || 'Fusion ERP').replace(/\s*[-|].*$/,'').trim() || 'Fusion ERP';
  }
  function ensureTopbar(){
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
      if (!p || p.classList.contains('table-wrap') || p.classList.contains('table-responsive') || p.classList.contains('tabela-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      p.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
  }
  function init(){
    document.body.classList.add('fusion-mobile-ready');
    if (hasMenu()) ensureTopbar();
    wrapTables();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
