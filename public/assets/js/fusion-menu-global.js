(function(){
  'use strict';
  function load(src, cb){
    if(document.querySelector('script[src="'+src+'"]')) { if(cb) cb(); return; }
    var s=document.createElement('script'); s.src=src; s.defer=true; if(cb) s.onload=cb; document.body.appendChild(s);
  }
  function style(href){
    if(document.querySelector('link[href="'+href+'"]')) return;
    var l=document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l);
  }
  function aplicarMenu(){
    /* Este arquivo e usado apenas nas paginas internas. O comportamento antigo
       carregava o modo sem sidebar e removia o proprio menu que deveria criar. */
    style('/assets/css/fusion-menu-global.css');
    document.body && document.body.classList.remove('fusion-no-sidebar');

    if(typeof window.carregarLayout === 'function') window.carregarLayout();
    else load('/assets/js/fusion-layout.js', function(){
      if(typeof window.carregarLayout === 'function') window.carregarLayout();
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarMenu);
  else aplicarMenu();
  window.FusionMenuGlobal = { aplicarMenu };
})();
