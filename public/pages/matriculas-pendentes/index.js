const tabela = document.getElementById('tabela');
const cards = document.getElementById('cards');
const total = document.getElementById('total');
const modal = document.getElementById('modalDetalhes');
const detalhes = document.getElementById('detalhesConteudo');
let solicitacoes = [];
let todasSolicitacoes = [];

function esc(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dataBR(v){ const s=String(v||'').slice(0,10); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '-'; }
function moeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function telefoneLink(v){ const n = String(v||'').replace(/\D/g,''); return n ? `https://wa.me/55${n}` : '#'; }
function ehImagem(base64=''){ return String(base64).startsWith('data:image/'); }
function base64Link(item){ return item?.base64 || ''; }
function docNome(item, padrao){ return item?.nome || padrao; }

async function carregarTodosParaKpis(){
  try{
    const resp = await fetch('/api/matricula-online?status=todos', {cache:'no-store'});
    const json = await resp.json().catch(()=>({}));
    todasSolicitacoes = json.dados || [];
    atualizarKpis();
  }catch{ /* silencioso */ }
}
function atualizarKpis(){
  const aguardando = todasSolicitacoes.filter(s => String(s.status).toLowerCase() === 'aguardando');
  document.getElementById('kpiAguardando').textContent = aguardando.length;
  document.getElementById('kpiCorrecao').textContent = todasSolicitacoes.filter(s => String(s.status).toLowerCase() === 'correcao_solicitada').length;
  document.getElementById('kpiAprovadas').textContent = todasSolicitacoes.filter(s => String(s.status).toLowerCase() === 'aprovada').length;
  document.getElementById('kpiReceita').textContent = moeda(aguardando.reduce((t,s)=>t+Number(s.valorPlano||0),0));
}

async function carregar(){
  const params = new URLSearchParams();
  const status = document.getElementById('status').value;
  const busca = document.getElementById('busca').value.trim();
  if(status && status !== 'todos') params.set('status', status);
  if(busca) params.set('q', busca);
  try{
    await carregarTodosParaKpis();
    const resp = await fetch(`/api/matricula-online?${params.toString()}`, {cache:'no-store'});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Erro ao carregar.');
    solicitacoes = json.dados || [];
    renderizar();
  }catch(e){ tabela.innerHTML = `<tr><td colspan="6">${esc(e.message)}</td></tr>`; cards.innerHTML=''; }
}

function botoes(s){
  const comum = `<button onclick="verDetalhes('${esc(s.id)}')">Ver</button><a class="btn-link" href="${telefoneLink(s.telefone || s.whatsapp)}" target="_blank">WhatsApp</a>`;
  if(String(s.status).toLowerCase() !== 'aguardando'){
    const link = s.financeiroId ? `<button onclick="abrirFinanceiro('${esc(s.financeiroId)}')">Financeiro</button>` : '';
    return `${comum}${link || ''}`;
  }
  return `${comum}<button onclick="aprovar('${esc(s.id)}')">Aprovar</button><button class="warning" onclick="solicitarCorrecao('${esc(s.id)}')">Corrigir</button><button class="danger" onclick="rejeitar('${esc(s.id)}')">Rejeitar</button>`;
}

function renderizar(){
  total.textContent = `${solicitacoes.length} registro(s)`;
  if(!solicitacoes.length){ tabela.innerHTML = '<tr><td colspan="6">Nenhuma solicitação encontrada.</td></tr>'; cards.innerHTML=''; return; }
  tabela.innerHTML = solicitacoes.map(s=>`<tr>
    <td>${dataBR(s.criadoEm)}<br><small>${esc(s.protocolo)}</small></td>
    <td><strong>${esc(s.nome)}</strong><br><small>CPF: ${esc(s.cpf)}</small></td>
    <td>${esc(s.telefone || s.whatsapp)}<br><small>${esc(s.email || '-')}</small></td>
    <td>${esc(s.plano || '-')}<br><small>${moeda(s.valorPlano)}</small></td>
    <td><span class="badge ${esc(s.status)}">${esc(s.status)}</span></td>
    <td><div class="acoes">${botoes(s)}</div></td>
  </tr>`).join('');
  cards.innerHTML = solicitacoes.map(s=>`<article class="sol-card">
    <div><strong>${esc(s.nome)}</strong><span class="badge ${esc(s.status)}">${esc(s.status)}</span></div>
    <p>${esc(s.plano || '-')} · ${moeda(s.valorPlano)}<br>CPF: ${esc(s.cpf)} · ${esc(s.telefone || '-')}</p>
    <div class="acoes">${botoes(s)}</div>
  </article>`).join('');
}

window.verDetalhes = function(id){
  const s = solicitacoes.find(x=>String(x.id)===String(id)) || todasSolicitacoes.find(x=>String(x.id)===String(id));
  if(!s) return alert('Solicitação não encontrada.');
  const docs = s.documentos || {};
  const docCard = (key, label) => {
    const item = docs[key];
    const link = base64Link(item);
    if(!link) return `<div><span>${label}</span><b>Não enviado</b></div>`;
    return `<div><span>${label}</span><a href="${esc(link)}" target="_blank">${esc(docNome(item,label))}</a></div>`;
  };
  detalhes.innerHTML = `<div class="detalhes-grid">
    <div class="foto-detalhe">${s.fotoBase64 ? `<img src="${esc(s.fotoBase64)}" alt="Foto">` : 'Sem foto'}</div>
    <div>
      <h3>${esc(s.nome)}</h3>
      <p><strong>Protocolo:</strong> ${esc(s.protocolo)}<br><strong>CPF:</strong> ${esc(s.cpf)}<br><strong>Nascimento:</strong> ${dataBR(s.dataNascimento)}<br><strong>Telefone:</strong> ${esc(s.telefone || '-')}<br><strong>E-mail:</strong> ${esc(s.email || '-')}</p>
      <p><strong>Endereço:</strong> ${esc([s.endereco, s.numero, s.complemento, s.bairro, s.cidade, s.estado].filter(Boolean).join(', '))}</p>
      <p><strong>Plano:</strong> ${esc(s.plano || '-')} · ${moeda(s.valorPlano)}<br><strong>Modalidade:</strong> ${esc(s.modalidade || '-')}<br><strong>Horário:</strong> ${esc(s.horarioPreferido || '-')}</p>
      <p><strong>Objetivo:</strong> ${esc(s.objetivo || '-')}<br><strong>Restrições:</strong> ${esc(s.restricoes || '-')}<br><strong>Observação:</strong> ${esc(s.observacao || '-')}</p>
    </div>
  </div>
  <h3>Documentos</h3>
  <div class="docs-detalhes">${docCard('rgFrente','RG frente')}${docCard('rgVerso','RG verso')}${docCard('comprovanteResidencia','Comprovante')}${docCard('atestadoMedico','Atestado')}</div>
  <h3>Assinatura</h3>
  <div class="assinatura-detalhe">${s.assinaturaBase64 ? `<img src="${esc(s.assinaturaBase64)}" alt="Assinatura">` : 'Sem assinatura'}</div>`;
  modal.classList.remove('hidden');
};

window.aprovar = async function(id){
  if(!confirm('Aprovar esta matrícula e criar pré-matrícula/cobrança?')) return;
  try{
    const resp = await fetch(`/api/matricula-online/${encodeURIComponent(id)}/aprovar`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:'operador'})});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Erro ao aprovar.');
    alert(json.mensagem || 'Solicitação aprovada.');
    await carregar();
    if(json.financeiroId && confirm('Abrir financeiro para receber agora?')) abrirFinanceiro(json.financeiroId);
  }catch(e){ alert(e.message); }
};

window.rejeitar = async function(id){
  const motivo = prompt('Motivo da rejeição:') || '';
  if(!confirm('Rejeitar esta solicitação?')) return;
  try{
    const resp = await fetch(`/api/matricula-online/${encodeURIComponent(id)}/rejeitar`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:'operador', motivo})});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Erro ao rejeitar.');
    alert(json.mensagem || 'Solicitação rejeitada.');
    await carregar();
  }catch(e){ alert(e.message); }
};

window.solicitarCorrecao = async function(id){
  const motivo = prompt('Informe o que o candidato precisa corrigir ou anexar:');
  if(!motivo) return;
  try{
    const resp = await fetch(`/api/matricula-online/${encodeURIComponent(id)}/solicitar-correcao`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:'operador', motivo})});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Erro ao solicitar correção.');
    alert(json.mensagem || 'Correção solicitada.');
    await carregar();
  }catch(e){ alert(e.message); }
};

window.abrirFinanceiro = function(financeiroId){
  const params = new URLSearchParams({financeiroId, receberAgora:'1', origem:'matricula_online'});
  location.href = `/pages/financeiro/index.html?${params.toString()}`;
};

document.getElementById('btnAtualizar').addEventListener('click', carregar);
document.getElementById('btnFiltrar').addEventListener('click', carregar);
document.getElementById('btnFecharDetalhes').addEventListener('click', ()=> modal.classList.add('hidden'));
modal.addEventListener('click', (ev)=>{ if(ev.target === modal) modal.classList.add('hidden'); });
carregar();
