const API = '/api/portal-professor/acessar';
const SESSION_KEY = 'fusion_portal_professor';
const $ = s => document.querySelector(s);

function mostrar(msg){
  const el = $('#alerta');
  if(!el) return alert(msg);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function esconder(){
  const el = $('#alerta');
  if(el) el.classList.add('hidden');
}

function limparDigitos(v){
  return String(v || '').replace(/\D/g, '');
}

function sessaoSalva(){
  try{
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
  }catch{
    return null;
  }
}

function salvarSessao(json, lembrar){
  const dados = JSON.stringify(json);
  sessionStorage.setItem(SESSION_KEY, dados);
  if(lembrar) localStorage.setItem(SESSION_KEY, dados);
  else localStorage.removeItem(SESSION_KEY);
}

async function acessar(ev){
  ev.preventDefault();
  esconder();

  const cpf = limparDigitos($('#cpf')?.value);
  const telefone = limparDigitos($('#telefone')?.value);
  const lembrar = Boolean($('#lembrarDispositivo')?.checked);

  if(!cpf){ mostrar('Informe o CPF do professor.'); return; }
  if(!telefone){ mostrar('Informe o telefone ou WhatsApp cadastrado.'); return; }

  const payload = { cpf, telefone };

  try{
    const resp = await fetch(API, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || `Erro HTTP ${resp.status}`);
    salvarSessao(json, lembrar);
    location.href = '/pages/professor-painel/index.html';
  }catch(e){
    mostrar(e.message || 'Erro ao acessar o portal do professor.');
  }
}

$('#formAcesso')?.addEventListener('submit', acessar);

const salvo = sessaoSalva();
if(salvo?.ok && salvo?.professor?.id){
  location.href = '/pages/professor-painel/index.html';
}
