// Fusion ERP - Avaliações legado desativado.
// A tela oficial única agora é /pages/avaliacoes/index.html.
// Este arquivo permanece apenas como ponte de compatibilidade para páginas antigas.
(function(){
  try {
    if (!location.pathname.includes('/pages/avaliacoes/')) {
      window.FusionAvaliacaoLegado = { oficial: '/pages/avaliacoes/index.html' };
      return;
    }
  } catch {}
})();
