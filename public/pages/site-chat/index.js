const $ = (id) => document.getElementById(id);
const estado = { conversas: [], conversa: null, mensagens: [] };

function esc(valor){ return String(valor ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fetchAuth(url,opcoes={}){ const fn=window.FusionAuth?.fetchAuth?window.FusionAuth.fetchAuth.bind(window.FusionAuth):window.fetch.bind(window); return fn(url,{cache:"no-store",...opcoes}); }
async function jsonOk(resp,msg){ const json=await resp.json().catch(()=>({})); if(!resp.ok||json.ok===false) throw new Error(json.erro||json.mensagem||msg); return json; }
function dataHora(v){ if(!v)return"-";const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,16):d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function origemNome(v){return({portal_aluno:"Portal do aluno",portal_professor:"Portal do professor",matricula_online:"Matrícula online",promocao:"Promoções",site:"Site"})[v]||v||"Site";}
function statusNome(v){return({aguardando:"Aguardando",em_atendimento:"Em atendimento",resolvida:"Resolvida",encerrada:"Encerrada"})[v]||v||"Aguardando";}
function tipoMsg(m){return m.remetente==="atendimento"?"atendimento":m.remetente==="sistema"?"sistema":"usuario";}
function nomeRemetente(m){return m.remetente==="atendimento"?(m.operadorNome||"Recepção"):m.remetente==="sistema"?"Sistema":(m.nome||"Aluno/visitante");}

function aplicarFiltros(){
  const busca=String($("busca").value||"").toLowerCase();
  const origem=$("origem").value;
  const status=$("filtroStatus").value;
  return estado.conversas.filter(c=>{
    if(origem&&c.origem!==origem)return false;
    if(status&&(c.statusAtendimento||"aguardando")!==status)return false;
    return !busca||[c.nome,c.contato,c.protocolo,c.ultimaMensagem,c.assunto].join(" ").toLowerCase().includes(busca);
  });
}

function renderConversas(){
  const dados=aplicarFiltros(),lista=$("listaConversas");
  if(!dados.length){lista.innerHTML='<div class="empty">Nenhuma conversa encontrada.</div>';return;}
  lista.innerHTML=dados.map(c=>`
    <button class="conversa-item ${estado.conversa?.conversaId===c.conversaId?"ativa":""}" data-id="${esc(c.conversaId)}" type="button">
      <div class="conversa-titulo"><strong>${esc(c.nome||"Sem nome")}</strong>${Number(c.pendentes||0)>0?`<b class="badge-pendente">${Number(c.pendentes)}</b>`:""}</div>
      <span>${esc(c.ultimaMensagem||"")}</span>
      <div class="conversa-meta"><em>${esc(origemNome(c.origem))}</em><em>${esc(dataHora(c.atualizadoEm))}</em></div>
      <div class="conversa-tags"><i class="tag ${esc(c.statusAtendimento||"aguardando")}">${esc(statusNome(c.statusAtendimento||"aguardando"))}</i><i class="tag ${esc(c.prioridade||"normal")}">${esc(c.prioridade||"normal")}</i></div>
    </button>`).join("");
}

function renderCabecalho(){
  const el=$("cabecalhoConversa"),acoes=$("acoesConversa");
  if(!estado.conversa){el.querySelector("div:first-child").innerHTML='<strong>Selecione uma conversa</strong><span>As mensagens de alunos e visitantes aparecem aqui.</span>';acoes.hidden=true;return;}
  el.querySelector("div:first-child").innerHTML=`<strong>${esc(estado.conversa.nome||"Sem nome")}</strong><span>${esc(origemNome(estado.conversa.origem))} | ${esc(estado.conversa.contato||estado.conversa.protocolo||"sem contato")}${estado.conversa.operadorNome?` | Responsável: ${esc(estado.conversa.operadorNome)}`:""}</span>`;
  acoes.hidden=false;
  $("statusAtendimento").value=estado.conversa.statusAtendimento||"aguardando";
  $("prioridade").value=estado.conversa.prioridade||"normal";
}

function renderConteudoMensagem(m){
  const texto=String(m.mensagem||"");
  const url=texto.match(/Comprovante:\s*(\/uploads\/emergency-receipts\/[^\s]+)/i)?.[1]||"";
  const solicitacao=texto.match(/Solicitação:\s*([^\s]+)/i)?.[1]||"";
  return `<div>${esc(texto).replace(/\n/g,"<br>")}</div>`+
    (url?`<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Comprovante" style="max-width:280px;max-height:280px;border-radius:10px;margin-top:8px;display:block"></a>`:"")+
    (solicitacao?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" data-emerg-action="confirmado" data-emerg-id="${esc(solicitacao)}">Confirmar pagamento</button><button type="button" data-emerg-action="recusado" data-emerg-id="${esc(solicitacao)}">Recusar</button><button type="button" data-emerg-action="baixado" data-emerg-id="${esc(solicitacao)}">Marcar como baixado</button></div>`:"");
}

function renderMensagens(){
  const area=$("mensagens");
  if(!estado.conversa){area.innerHTML='<div class="empty">Selecione uma conversa na lista.</div>';return;}
  if(!estado.mensagens.length){area.innerHTML='<div class="empty">Nenhuma mensagem registrada.</div>';return;}
  area.innerHTML=estado.mensagens.map(m=>`<div class="msg ${esc(tipoMsg(m))}"><small>${esc(nomeRemetente(m))} | ${esc(dataHora(m.criadoEm))}</small>${renderConteudoMensagem(m)}</div>`).join("");
  area.scrollTop=area.scrollHeight;
}

async function carregarConversas(){
  const json=await jsonOk(await fetchAuth("/api/site-chat/conversas"),"Não foi possível carregar as conversas.");
  estado.conversas=json.conversas||[];
  if(estado.conversa)estado.conversa=estado.conversas.find(c=>c.conversaId===estado.conversa.conversaId)||estado.conversa;
  renderConversas();renderCabecalho();
}

async function abrirConversa(id){
  estado.conversa=estado.conversas.find(c=>c.conversaId===id)||null;
  renderConversas();renderCabecalho();
  if(!estado.conversa){estado.mensagens=[];renderMensagens();return;}
  const json=await jsonOk(await fetchAuth(`/api/site-chat/mensagens?conversaId=${encodeURIComponent(id)}&limite=120`),"Não foi possível carregar as mensagens.");
  estado.mensagens=json.mensagens||[];renderMensagens();
  await fetchAuth(`/api/site-chat/conversas/${encodeURIComponent(id)}/leitura`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leitor:"atendimento"})}).catch(()=>{});
}

async function atualizarConversa(dados){
  if(!estado.conversa)return;
  const json=await jsonOk(await fetchAuth(`/api/site-chat/conversas/${encodeURIComponent(estado.conversa.conversaId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(dados)}),"Não foi possível atualizar a conversa.");
  estado.conversa={...estado.conversa,...(json.conversa||{})};
  await carregarConversas();
}

async function responder(ev){
  ev.preventDefault();if(!estado.conversa)return alert("Selecione uma conversa.");
  const texto=$("textoResposta").value.trim();if(!texto)return alert("Digite a resposta.");
  const btn=ev.currentTarget.querySelector("button");btn.disabled=true;
  try{
    await jsonOk(await fetchAuth("/api/site-chat/mensagens",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      conversaId:estado.conversa.conversaId,origem:estado.conversa.origem,nome:"Recepção",remetente:"atendimento",
      alunoId:estado.conversa.alunoId||"",professorId:estado.conversa.professorId||"",clienteId:estado.conversa.clienteId||"",
      contato:estado.conversa.contato||"",protocolo:estado.conversa.protocolo||"",mensagem:texto
    })}),"Não foi possível enviar a resposta.");
    $("textoResposta").value="";const id=estado.conversa.conversaId;await carregarConversas();await abrirConversa(id);
  }catch(e){alert(e.message||"Erro ao responder.");}finally{btn.disabled=false;}
}

document.addEventListener("DOMContentLoaded",async()=>{
  const inicial=new URLSearchParams(location.search).get("conversaId")||"";
  if(inicial)$("origem").value="";
  $("btnAtualizar").onclick=async()=>{try{const id=estado.conversa?.conversaId;await carregarConversas();if(id)await abrirConversa(id);}catch(e){alert(e.message);}};
  $("busca").oninput=renderConversas;$("origem").onchange=renderConversas;$("filtroStatus").onchange=renderConversas;
  $("listaConversas").onclick=ev=>{const btn=ev.target.closest("[data-id]");if(btn)abrirConversa(btn.dataset.id).catch(e=>alert(e.message));};
  $("formResposta").onsubmit=responder;
  $("statusAtendimento").onchange=ev=>atualizarConversa({statusAtendimento:ev.target.value}).catch(e=>alert(e.message));
  $("prioridade").onchange=ev=>atualizarConversa({prioridade:ev.target.value}).catch(e=>alert(e.message));
  $("btnAssumir").onclick=()=>atualizarConversa({statusAtendimento:"em_atendimento"}).catch(e=>alert(e.message));
  $("btnResolver").onclick=()=>atualizarConversa({statusAtendimento:"resolvida"}).catch(e=>alert(e.message));
  try{await carregarConversas();if(inicial)await abrirConversa(inicial);renderMensagens();}catch(e){$("listaConversas").innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
  setInterval(async()=>{try{const id=estado.conversa?.conversaId;await carregarConversas();if(id)await abrirConversa(id);}catch{}},15000);
});

document.addEventListener("click",async ev=>{
  const btn=ev.target.closest("[data-emerg-action]");if(!btn)return;btn.disabled=true;
  try{await jsonOk(await fetchAuth(`/api/emergency-access/solicitacoes/${encodeURIComponent(btn.dataset.emergId)}/${encodeURIComponent(btn.dataset.emergAction)}`,{method:"POST",headers:{"Content-Type":"application/json"}}),"Não foi possível atualizar a solicitação.");await abrirConversa(estado.conversa.conversaId);}
  catch(e){alert(e.message||"Erro ao atualizar solicitação.");}finally{btn.disabled=false;}
});
