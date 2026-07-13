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
    style('/assets/css/fusion-no-sidebar.css');
    if(window.FusionLayout && typeof window.FusionLayout.init === 'function') window.FusionLayout.init();
    else load('/assets/js/fusion-layout.js');
    load('/assets/js/fusion-no-sidebar.js');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarMenu);
  else aplicarMenu();
  window.FusionMenuGlobal = { aplicarMenu };
})();
