const API = '/api/access-engine';
const $ = (id) => document.getElementById(id);
let agentePolling = null;

async function json(url, opts = {}) {
  const request = window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth(url, opts) : fetch(url, opts);
  const response = await request;
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.mensagem || data.erro || 'Falha na requisição');
  return data;
}

function hora(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}
function badge(ok) { return `<span class="badge ${ok ? 'badge-ok' : 'badge-no'}">${ok ? 'Liberado' : 'Bloqueado'}</span>`; }

async function consultarAgente() {
  try {
    const data = await json(`${API}/agente/status`, { cache: 'no-store' });
    const box = $('agenteStatus');
    box.dataset.status = data.online ? 'online' : 'offline';
    box.querySelector('strong').textContent = data.online ? 'Online' : 'Offline';
    $('agenteMensagem').textContent = data.online
      ? `Agente ${data.agentId} conectado. Último contato: ${hora(data.ultimoContato)}.`
      : `Agente ${data.agentId} desconectado. Inicie INICIAR-FUSION-ACCESS-AGENT.bat no computador da academia.`;
  } catch (e) {
    $('agenteStatus').dataset.status = 'offline';
    $('agenteStatus').querySelector('strong').textContent = 'Indisponível';
    $('agenteMensagem').textContent = e.message;
  }
}

async function carregarDrivers() {
  const data = await json(`${API}/drivers`);
  const el = $('listaDrivers');
  el.innerHTML = (data.drivers || []).map(d => `
    <div class="access-driver-card"><strong>${d.nome}</strong><small>${d.fabricante} · ${d.protocolo}</small>
    <span class="badge ${d.status === 'operacional' ? 'badge-ok' : 'badge-warn'}">${d.status}</span><p>${d.observacao || ''}</p></div>`).join('');
}

async function carregar() {
  await Promise.all([carregarDrivers(), consultarAgente()]);
  const data = await json(`${API}/dashboard`, { cache: 'no-store' });
  const r = data.resumo || {};
  $('kpiDispositivos').textContent = r.dispositivos || 0;
  $('kpiOnline').textContent = r.online || 0;
  $('kpiDentro').textContent = r.pessoasDentro || 0;
  $('kpiHoje').textContent = r.acessosHoje || 0;
  $('kpiLiberados').textContent = r.liberadosHoje || 0;
  $('kpiBloqueados').textContent = r.bloqueadosHoje || 0;
  const dispositivos = data.dispositivos || [];
  $('dispositivoId').innerHTML = dispositivos.map(d => `<option value="${d.id}">${d.nome} · ${d.fabricante}</option>`).join('');
  $('tabelaDispositivos').innerHTML = dispositivos.map(d => `<tr><td>${d.nome || '-'}</td><td>${d.fabricante || '-'}</td><td>${d.driver || '-'}</td><td>${d.status || '-'}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum equipamento cadastrado.</td></tr>';
  $('listaPresentes').innerHTML = (data.presentes || []).map(p => `<div class="access-person"><strong>${p.nome || '-'}</strong><small>${p.numeroMatricula || ''} · entrada ${hora(p.entradaEm)}</small></div>`).join('') || '<div class="access-muted access-result">Nenhuma pessoa registrada dentro da academia.</div>';
  $('tabelaLogs').innerHTML = (data.ultimosLogs || []).map(l => `<tr><td>${hora(l.criadoEm)}</td><td>${l.alunoNome || l.identificador || '-'}</td><td>${l.direcao || '-'}</td><td>${badge(!!l.autorizado)}</td><td>${l.motivo || '-'}</td><td>${l.dispositivoNome || '-'}<br><small>${l.fabricante || ''} ${l.driver ? '· '+l.driver : ''}</small></td></tr>`).join('') || '<tr><td colspan="6">Nenhum acesso registrado.</td></tr>';
}

async function aguardarComando(id, box) {
  for (let i = 0; i < 20; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 750));
    const data = await json(`${API}/comandos/${encodeURIComponent(id)}`, { cache: 'no-store' });
    const status = data.command?.status;
    if (status === 'completed') { box.className = 'access-result access-ok'; box.textContent = 'CATRACA LIBERADA PELO AGENTE LOCAL.'; return; }
    if (status === 'failed' || status === 'expired') { throw new Error(data.command?.error || `Comando ${status}`); }
  }
  box.className = 'access-result access-muted';
  box.textContent = 'Comando enviado. A confirmação ainda está pendente.';
}

async function simular() {
  const box = $('resultado');
  box.className = 'access-result access-muted'; box.textContent = 'Validando acesso e enviando para o agente...';
  try {
    const r = await json(`${API}/simular-acesso`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ identificador:$('identificador').value, dispositivoId:$('dispositivoId').value, direcao:$('direcao').value, origem:'painel-online' }) });
    if (!r.autorizado) { box.className = 'access-result access-no'; box.textContent = `BLOQUEADO — ${r.motivo}`; await carregar(); return; }
    box.className = 'access-result access-ok'; box.textContent = 'ACESSO APROVADO. Comando enviado ao agente local.';
    const id = r.catraca?.commandId || r.catraca?.command?.id;
    if (id) await aguardarComando(id, box);
    await carregar();
  } catch(e) { box.className = 'access-result access-no'; box.textContent = e.message; }
}

async function liberarManual() {
  const motivo = prompt('Motivo da liberação manual:', 'Visitante') || 'Liberação manual';
  const box = $('resultado'); box.className='access-result access-muted'; box.textContent='Enviando comando ao agente...';
  try {
    const r = await json(`${API}/liberar-remoto`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ dispositivoId:$('dispositivoId').value, direcao:$('direcao').value, origem:'painel-manual', motivo }) });
    const id = r.catraca?.commandId || r.catraca?.command?.id;
    box.textContent = 'Comando enviado ao agente local.';
    if (id) await aguardarComando(id, box);
    await carregar();
  } catch(e) { box.className='access-result access-no'; box.textContent=e.message; }
}

async function salvarEquipamento() {
  await json(`${API}/dispositivos`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nome:$('eqNome').value, fabricante:$('eqFabricante').value, modelo:'Genérico', driver:$('eqDriver').value, ip:$('eqIp').value, porta:$('eqPorta').value, status:'ativo' }) });
  await carregar();
}

document.addEventListener('DOMContentLoaded', () => {
  try { FusionAuth?.proteger(['admin','gerente','recepcao','comercial']); } catch {}
  try { window.carregarLayout?.('Fusion Access Engine'); } catch {}
  $('btnAtualizar').addEventListener('click', carregar);
  $('btnSimular').addEventListener('click', simular);
  $('btnLiberarManual').addEventListener('click', liberarManual);
  $('btnSalvarEquipamento').addEventListener('click', salvarEquipamento);
  $('btnLimpar').addEventListener('click', () => { $('identificador').value=''; $('resultado').className='access-result access-muted'; $('resultado').textContent='Aguardando operação.'; });
  carregar().catch(e => { $('resultado').className='access-result access-no'; $('resultado').textContent=e.message; });
  agentePolling = setInterval(consultarAgente, 5000);
});
