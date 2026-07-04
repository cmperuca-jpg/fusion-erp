(function(){
  // Compatibilidade: o menu oficial agora é gerado por /assets/js/fusion-layout.js.
  // Este arquivo permanece para páginas antigas que ainda o carregam.
  function aplicarMenu(){
    if (window.FusionLayout && typeof window.FusionLayout.init === 'function') {
      window.FusionLayout.init();
    }
  }
  document.addEventListener('DOMContentLoaded', aplicarMenu);
  window.FusionMenuGlobal = { aplicarMenu };
})();
