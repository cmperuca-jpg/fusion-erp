const etapas = [
  ['novo','Novos'],['contatado','Contato'],['agendado','Agendados'],['aula_experimental','Aula experimental'],['matricula_online','Matrícula online'],['convertido','Convertidos'],['perdido','Perdidos']
];
let leads=[];
const pipeline=document.getElementById('pipeline');
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function abrirModal(){document.getElementById('modalLead').classList.remove('hidden');}
function fecharModal(){document.getElementById('modalLead').classList.add('hidden');document.getElementById('formLead').reset();document.getElementById('leadId').value='';}
function etapaLabel(e){return etapas.find(x=>x[0]===e)?.[1]||e;}

async function carregar(){
  const q=document.getElementById('busca').value.trim();
  const params=new URLSearchParams(); if(q) params.set('q',q);
  const resp=await fetch(`/api/leads?${params.toString()}`,{cache:'no-store'}); const json=await resp.json().catch(()=>({}));
  leads=json.dados||[]; renderizar(); carregarResumo();
}
async function carregarResumo(){
  const resp=await fetch('/api/leads/resumo',{cache:'no-store'}); const json=await resp.json().catch(()=>({})); const r=json.resumo||{};
  document.getElementById('kpiHoje').textContent=r.leadsHoje||0; document.getElementById('kpiMes').textContent=r.leadsMes||0; document.getElementById('kpiConversao').textContent=`${r.taxaConversao||0}%`; document.getElementById('kpiReceita').textContent=moeda(r.receitaPrevista||0); document.getElementById('kpiPendentes').textContent=r.pendentesMatricula||0;
}
function renderizar(){
  pipeline.innerHTML=etapas.map(([id,label])=>{const itens=leads.filter(l=>l.etapa===id);return `<div class="col" data-etapa="${id}"><h2>${label}<span>${itens.length}</span></h2>${itens.map(card).join('')||'<p class="empty">Sem registros</p>'}</div>`}).join('');
}
function card(l){
 const zap=(l.whatsapp||l.telefone||'').replace(/\D/g,'');
 return `<article class="lead"><strong>${esc(l.nome)}</strong><small>${esc(l.plano||l.modalidade||'-')}</small><div>${esc(l.telefone||'-')}</div><div class="valor">${moeda(l.valorPrevisto||0)}</div><div class="card-actions"><button onclick="editar('${esc(l.id)}')">Editar</button>${zap?`<a target="_blank" href="https://wa.me/55${zap}">WhatsApp</a>`:''}<button onclick="avancar('${esc(l.id)}')">Avançar</button></div></article>`;
}
window.editar=function(id){const l=leads.find(x=>x.id===id);if(!l)return; abrirModal(); ['leadId','nome','telefone','email','cpf','origem','etapa','valorPrevisto','plano','dataAgendada','horarioAgendado','observacao'].forEach(k=>{const el=document.getElementById(k); if(!el)return; const prop=k==='leadId'?'id':k; el.value=l[prop]||'';});}
window.avancar=async function(id){const l=leads.find(x=>x.id===id); if(!l)return; const idx=etapas.findIndex(e=>e[0]===l.etapa); const prox=etapas[Math.min(idx+1,etapas.length-1)][0]; await fetch(`/api/leads/${encodeURIComponent(id)}/mover`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({etapa:prox,usuario:'operador'})}); carregar();}

const etapaSelect=document.getElementById('etapa'); etapaSelect.innerHTML=etapas.map(e=>`<option value="${e[0]}">${e[1]}</option>`).join('');
document.getElementById('btnNovo').addEventListener('click',abrirModal); document.getElementById('btnFechar').addEventListener('click',fecharModal); document.getElementById('btnBuscar').addEventListener('click',carregar);
document.getElementById('formLead').addEventListener('submit',async ev=>{ev.preventDefault();const id=document.getElementById('leadId').value;const payload={nome:nome.value,telefone:telefone.value,email:email.value,cpf:cpf.value,origem:origem.value,etapa:etapa.value,valorPrevisto:valorPrevisto.value,plano:plano.value,dataAgendada:dataAgendada.value,horarioAgendado:horarioAgendado.value,observacao:observacao.value,usuario:'operador'};const url=id?`/api/leads/${encodeURIComponent(id)}`:'/api/leads';await fetch(url,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});fecharModal();carregar();});
document.getElementById('btnContato').addEventListener('click',async()=>{const id=document.getElementById('leadId').value;if(!id)return alert('Salve o lead primeiro.');const obs=prompt('Resumo do contato:');if(obs===null)return;await fetch(`/api/leads/${encodeURIComponent(id)}/contatos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:'whatsapp',resultado:obs,usuario:'operador'})});fecharModal();carregar();});
carregar();
