(function(){
  let estado=null;
  const $=s=>document.querySelector(s);
  const get=(obj,path)=>path.split('.').reduce((a,k)=>a?.[k],obj);
  const set=(obj,path,val)=>{const partes=path.split('.');let atual=obj;partes.slice(0,-1).forEach(k=>atual=atual[k]||(atual[k]={}));atual[partes.at(-1)]=val;};
  function status(msg,erro=false){const el=$('#statusAparencia');el.textContent=msg;el.classList.toggle('erro',erro);}
  function preencher(a){
    estado=structuredClone(a);
    document.querySelectorAll('[data-ap]').forEach(el=>{const v=get(estado,el.dataset.ap);if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v??'';});
    document.querySelectorAll('[data-out]').forEach(el=>el.textContent=`${get(estado,el.dataset.out)} px`);
    document.querySelectorAll('[data-url]').forEach(el=>el.textContent=get(estado,el.dataset.url)||'Nenhuma imagem enviada');
    carregarPaginaSelecionada();preview();
  }
  function coletar(){
    const a=structuredClone(estado||{});
    document.querySelectorAll('[data-ap]').forEach(el=>{let v=el.type==='checkbox'?el.checked:el.value;if(el.type==='range')v=Number(v);set(a,el.dataset.ap,v);});
    salvarPaginaNoEstado(a);return a;
  }
  function preview(){
    if(!estado)return;const a=coletar();const p=$('.preview-card');
    p.style.setProperty('--p',a.tema.corPrimaria);p.style.setProperty('--bg',a.tema.corFundo);p.style.setProperty('--panel',a.tema.corPainel);p.style.setProperty('--txt',a.tema.corTexto);p.style.setProperty('--rb',`${a.tema.raioBotao}px`);p.style.setProperty('--rc',`${a.tema.raioCard}px`);p.classList.toggle('sem-sombra',!a.tema.sombra);
    $('[data-preview="nome"]').textContent=a.marca.nome;$('[data-preview="subtitulo"]').textContent=a.marca.subtitulo;
  }
  function paginaAtual(){return $('#paginaEditor')?.value||'comercial';}
  function salvarPaginaNoEstado(destino=estado){
    const id=paginaAtual(), pagina=destino?.paginas?.[id];if(!pagina)return;
    document.querySelectorAll('[data-pagina-elemento]').forEach(el=>{const item=pagina.elementos?.[el.dataset.paginaElemento];if(!item)return;if(el.dataset.campo==='visivel')item.visivel=el.checked;else item.texto=el.value;});
  }
  function carregarPaginaSelecionada(){
    const id=paginaAtual(),pagina=estado?.paginas?.[id],box=$('#elementosPagina');if(!pagina||!box)return;
    box.innerHTML=Object.entries(pagina.elementos).map(([chave,item])=>`<div class="pagina-elemento"><label>${chave}<input type="text" data-pagina-elemento="${chave}" data-campo="texto" value="${String(item.texto||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></label><label class="check"><input type="checkbox" data-pagina-elemento="${chave}" data-campo="visivel" ${item.visivel!==false?'checked':''}> Visível</label></div>`).join('');
    $('#abrirPaginaEditor').href=pagina.rota;
  }
  async function carregar(){const r=await fetch('/api/aparencia',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha ao carregar.');preencher(j.aparencia);}
  async function salvar(){status('Aplicando...');const dados=coletar();const r=await FusionAuth.fetchAuth('/api/aparencia',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha ao salvar.');preencher(j.aparencia);FusionAparencia.aplicar(j.aparencia);status('Alterações aplicadas.');}
  async function imagem(file,tipo){if(!file)return;status(`Enviando ${tipo}...`);const dataUrl=await new Promise((ok,fail)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=fail;fr.readAsDataURL(file);});const r=await FusionAuth.fetchAuth('/api/aparencia/imagem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl,tipo})});const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha no envio.');set(estado,`marca.${tipo}Url`,j.url);document.querySelector(`[data-url="marca.${tipo}Url"]`).textContent=j.url;status('Imagem carregada. Clique em Aplicar alterações.');}
  async function restaurar(){if(!confirm('Restaurar o padrão visual?'))return;const r=await FusionAuth.fetchAuth('/api/aparencia/restaurar',{method:'POST'});const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha ao restaurar.');preencher(j.aparencia);FusionAparencia.aplicar(j.aparencia);status('Padrão restaurado.');}
  document.addEventListener('input',e=>{if(e.target.matches('[data-ap]'))preview();});
  document.addEventListener('change',e=>{if(e.target.matches('[data-imagem]'))imagem(e.target.files[0],e.target.dataset.imagem).catch(x=>status(x.message,true));if(e.target.id==='paginaEditor'){salvarPaginaNoEstado();carregarPaginaSelecionada();}});
  $('#btnSalvarAparencia').onclick=()=>salvar().catch(e=>status(e.message,true));
  $('#btnRestaurarAparencia').onclick=()=>restaurar().catch(e=>status(e.message,true));
  carregar().catch(e=>status(e.message,true));
})();
