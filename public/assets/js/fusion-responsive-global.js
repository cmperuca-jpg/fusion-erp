// Fusion ERP 2.7.4 - ZIP 1 Responsividade Global
// Menu mobile e pequenos reforços de usabilidade. Não altera APIs nem dados.
(function(){
  'use strict';

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    if(!document.querySelector('.fusion-mobile-menu-button')){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fusion-mobile-menu-button';
      btn.setAttribute('aria-label','Abrir menu');
      btn.setAttribute('aria-expanded','false');
      btn.textContent = '☰';
      document.body.appendChild(btn);
    }

    if(!document.querySelector('.fusion-mobile-overlay')){
      var overlay = document.createElement('div');
      overlay.className = 'fusion-mobile-overlay';
      document.body.appendChild(overlay);
    }

    var button = document.querySelector('.fusion-mobile-menu-button');
    var overlayEl = document.querySelector('.fusion-mobile-overlay');

    function setOpen(open){
      document.body.classList.toggle('fusion-menu-open', open);
      if(button){
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? '×' : '☰';
      }
    }

    if(button){
      button.addEventListener('click', function(){
        setOpen(!document.body.classList.contains('fusion-menu-open'));
      });
    }
    if(overlayEl){
      overlayEl.addEventListener('click', function(){ setOpen(false); });
    }
    document.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape') setOpen(false);
    });

    document.querySelectorAll('table').forEach(function(table){
      var parent = table.parentElement;
      if(!parent || (!parent.classList.contains('table-responsive') && !parent.classList.contains('tabela-scroll') && !parent.classList.contains('table-wrap'))){
        var wrap = document.createElement('div');
        wrap.className = 'table-responsive';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  });
})();
