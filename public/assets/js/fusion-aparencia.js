(function(){
  const normalizarRota = valor => String(valor || "").replace(/\/+$/, "") || "/";
  function setVar(nome, valor){ if(valor !== undefined && valor !== null) document.documentElement.style.setProperty(nome, valor); }
  function aplicarElemento(config){
    if(!config?.seletor) return;
    document.querySelectorAll(config.seletor).forEach(el => {
      el.hidden = config.visivel === false;
      if(config.texto !== undefined && config.texto !== null && !el.matches("input,select,textarea")) el.textContent = config.texto;
    });
  }
  function aplicar(a){
    if(!a) return;
    const t=a.tema||{}, m=a.marca||{};
    setVar("--fusion-primary",t.corPrimaria);
    setVar("--fusion-primary-dark",t.corPrimariaHover);
    setVar("--fusion-bg",t.corFundo);
    setVar("--fusion-panel",t.corPainel);
    setVar("--fusion-text",t.corTexto);
    setVar("--fusion-dark",t.corMenu);
    setVar("--fusion-button-radius",`${t.raioBotao ?? 12}px`);
    setVar("--fusion-card-radius",`${t.raioCard ?? 18}px`);
    document.documentElement.classList.toggle("fusion-sem-sombra",t.sombra===false);
    document.querySelectorAll(".fusion-brand strong,.site-brand strong").forEach(el=>{if(m.nome)el.textContent=m.nome;});
    document.querySelectorAll(".fusion-brand small,.site-brand small").forEach(el=>{if(m.subtitulo)el.textContent=m.subtitulo;});
    document.querySelectorAll(".brand-mark").forEach(mark=>{ if(m.logoUrl){mark.innerHTML=`<img src="${m.logoUrl}" alt="Logo">`;mark.classList.add("tem-logo");} });
    if(m.bannerUrl) setVar("--fusion-commercial-banner",`url('${m.bannerUrl}')`);
    const atual=normalizarRota(location.pathname);
    Object.values(a.paginas||{}).forEach(pagina=>{
      const rota=normalizarRota(pagina.rota);
      if(atual===rota || atual===normalizarRota(rota.replace(/\/index\.html$/, ""))) Object.values(pagina.elementos||{}).forEach(aplicarElemento);
    });
  }
  async function carregar(){
    try{const r=await fetch('/api/aparencia',{cache:'no-store'});const j=await r.json();if(r.ok&&j.aparencia)aplicar(j.aparencia);}catch{}
  }
  window.FusionAparencia={carregar,aplicar};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',carregar);else carregar();
})();
