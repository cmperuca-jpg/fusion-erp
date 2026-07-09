const listaPlanos = document.getElementById('listaPlanos');
const formLead = document.getElementById('formLead');
const alertaLead = document.getElementById('alertaLead');
const leadPlano = document.getElementById('leadPlano');
let planos = [];

function lista(payload){ return Array.isArray(payload) ? payload : (payload.dados || payload.data || payload.planos || []); }
function moeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function esc(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function ativo(p){ return !['inativo','cancelado','excluido','excluído'].includes(String(p.status||'ativo').toLowerCase()); }
function nomePlano(p){ return p.nome || p.descricao || 'Plano'; }
function valorPlano(p){ return p.valorMensal ?? p.valor ?? p.mensalidade ?? p.preco ?? 0; }
function msg(t, tipo='info'){ alertaLead.textContent=t; alertaLead.className=`alerta ${tipo}`; alertaLead.classList.remove('hidden'); }

async function carregarPlanos(){
  try{
    const resp = await fetch('/api/planos', {cache:'no-store'});
    const json = await resp.json().catch(()=>({}));
    planos = lista(json).filter(ativo);
    if(!planos.length){ listaPlanos.innerHTML='<div class="loading">Nenhum plano ativo encontrado.</div>'; return; }
    listaPlanos.innerHTML = planos.map(p=>`<article class="plano"><h3>${esc(nomePlano(p))}</h3><p>${esc(p.descricao || 'Plano da academia')}</p><strong>${moeda(valorPlano(p))}</strong><small>${esc(p.horariosPermitidos || 'Horário livre')}</small><a href="/pages/matricula-online/index.html?planoId=${encodeURIComponent(p.id || p.codigo || nomePlano(p))}">Matricular nesse plano</a></article>`).join('');
    leadPlano.innerHTML = '<option value="">Plano de interesse</option>' + planos.map(p=>`<option value="${esc(p.id || p.codigo || nomePlano(p))}">${esc(nomePlano(p))} - ${moeda(valorPlano(p))}</option>`).join('');
  }catch(e){ listaPlanos.innerHTML='<div class="loading">Erro ao carregar planos.</div>'; }
}

formLead.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const plano = planos.find(p => String(p.id || p.codigo || nomePlano(p)) === String(leadPlano.value));
  const payload = {
    nome: document.getElementById('leadNome').value.trim(),
    telefone: document.getElementById('leadTelefone').value.trim(),
    email: document.getElementById('leadEmail').value.trim(),
    planoId: leadPlano.value,
    plano: plano ? nomePlano(plano) : '',
    valorPrevisto: plano ? valorPlano(plano) : 0,
    horarioAgendado: document.getElementById('leadHorario').value.trim(),
    objetivo: document.getElementById('leadObjetivo').value.trim(),
    origem: 'site_comercial',
    etapa: document.getElementById('leadHorario').value.trim() ? 'agendado' : 'novo'
  };
  try{
    const resp = await fetch('/api/leads', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || 'Erro ao enviar interesse.');
    formLead.reset(); msg('Interesse enviado. A recepção entrará em contato.', 'sucesso');
  }catch(e){ msg(e.message, 'erro'); }
});

carregarPlanos();
