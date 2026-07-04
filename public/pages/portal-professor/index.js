const API = '/api/portal-professor/acessar';
const SESSION_KEY = 'fusion_portal_professor';
const $ = s => document.querySelector(s);

function mostrar(msg){ const el = $('#alerta'); el.textContent = msg; el.classList.remove('hidden'); }
function esconder(){ $('#alerta').classList.add('hidden'); }

async function acessar(ev){
  ev.preventDefault();
  esconder();
  const payload = {
    cpf: $('#cpf').value,
    dataNascimento: $('#dataNascimento').value,
    telefone: $('#telefone').value,
    cref: $('#cref').value
  };
  try{
    const resp = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || `Erro HTTP ${resp.status}`);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(json));
    localStorage.setItem(SESSION_KEY, JSON.stringify(json));
    location.href = '/pages/professor-painel/index.html';
  }catch(e){
    mostrar(e.message || 'Erro ao acessar o portal do professor.');
  }
}

$('#formAcesso').addEventListener('submit', acessar);
try{
  const salvo = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
  if(salvo?.ok && salvo?.professor?.id) location.href = '/pages/professor-painel/index.html';
}catch{}
