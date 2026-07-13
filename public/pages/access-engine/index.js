const API = '/api/access-engine';
const $ = (id) => document.getElementById(id);

const BIOMETRIA_API = "/api/biometria";
let biometriaPolling = null;
let ultimaSequenciaBiometria = 0;

async function jsonAuth(url, opts = {}) {
  const r = window.FusionAuth?.fetchAuth
    ? await FusionAuth.fetchAuth(url, opts)
    : await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(data.mensagem || data.erro || "Falha na requisição");
  return data;
}

function atualizarStatusBiometria(status, mensagem) {
  const box = $("biometriaStatus");
  const resultado = $("biometriaResultado");
  if (box) {
    box.dataset.status = status;
    const texto = box.querySelector("strong");
    if (texto) texto.textContent =
      status === "ativa" ? "Biometria ativa" :
      status === "processando" ? "Lendo digital..." :
      status === "erro" ? "Biometria indisponível" :
      "Biometria desativada";
  }
  if (resultado && mensagem) resultado.textContent = mensagem;

  const ativa = status === "ativa" || status === "processando";
  if ($("btnAtivarBiometria")) $("btnAtivarBiometria").disabled = ativa;
  if ($("btnDesativarBiometria")) $("btnDesativarBiometria").disabled = !ativa;
}

async function ativarBiometria() {
  atualizarStatusBiometria("processando", "Carregando digitais cadastradas...");
  try {
    const templatesResp = await jsonAuth(`${BIOMETRIA_API}/sdk/templates-monitor`, { cache: "no-store" });
    const templates = Array.isArray(templatesResp.templates) ? templatesResp.templates : [];
    if (!templates.length) throw new Error("Nenhuma biometria ativa foi cadastrada.");

    const inicio = await jsonAuth(`${BIOMETRIA_API}/motor/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });

    atualizarStatusBiometria("ativa", inicio.ultimoErro || `${templates.length} biometria(s) carregada(s). Encoste o dedo no leitor.`);
    iniciarPollingBiometria();
  } catch (e) {
    atualizarStatusBiometria("erro", e.message || "Falha ao ativar a biometria.");
  }
}

async function desativarBiometria() {
  try {
    await jsonAuth(`${BIOMETRIA_API}/motor/parar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
  } catch {}
  if (biometriaPolling) clearInterval(biometriaPolling);
  biometriaPolling = null;
  atualizarStatusBiometria("desativada", "Monitor biométrico desativado.");
}

async function consultarBiometria() {
  try {
    const estado = await jsonAuth(`${BIOMETRIA_API}/motor/status`, { cache: "no-store" });
    if (!estado.ativo) {
      atualizarStatusBiometria("desativada", "Motor biometrico parado.");
      return;
    }

    const mensagem = estado.processando
      ? "Leitor armado. Encoste o dedo no leitor."
      : estado.ultimoErro || "Leitura continua ativa. Encoste o dedo no leitor.";
    atualizarStatusBiometria(estado.processando ? "processando" : "ativa", mensagem);

    const sequencia = Number(estado.sequencia || 0);
    if (sequencia > ultimaSequenciaBiometria && estado.ultimoResultado) {
      ultimaSequenciaBiometria = sequencia;
      const resultado = estado.ultimoResultado;
      const box = $("biometriaResultado");
      if (box) {
        box.className = `access-result ${resultado.autorizado ? "access-ok" : "access-no"}`;
        const aluno = resultado.aluno?.nome || resultado.acesso?.aluno?.nome || "Digital nao reconhecida";
        box.textContent = `${resultado.autorizado ? "LIBERADO" : "BLOQUEADO"} - ${aluno} - ${resultado.motivo || ""}`;
      }
      await carregar();
    }
  } catch (e) {
    atualizarStatusBiometria("erro", e.message || "Servico biometrico indisponivel.");
  }
  return;
}

function iniciarPollingBiometria() {
  if (biometriaPolling) clearInterval(biometriaPolling);
  consultarBiometria();
  biometriaPolling = setInterval(consultarBiometria, 900);
}

async function verificarBiometriaAoAbrir() {
  try {
    const status = await jsonAuth(`${BIOMETRIA_API}/motor/status`, { cache: "no-store" });
    if (status.ativo) {
      ultimaSequenciaBiometria = Number(status.sequencia || 0);
      atualizarStatusBiometria("ativa", status.ultimoErro || "Leitura continua ativa. Encoste o dedo no leitor.");
      iniciarPollingBiometria();
    } else {
      atualizarStatusBiometria("desativada", "Clique em Ativar biometria para iniciar o leitor.");
    }
  } catch (e) {
    atualizarStatusBiometria("erro", e.message || "Servico biometrico indisponivel.");
  }
  return;
}


function hora(iso){
  if(!iso) return '-';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}
function badge(ok){ return `<span class="badge ${ok ? 'badge-ok' : 'badge-no'}">${ok ? 'Liberado' : 'Bloqueado'}</span>`; }
async function json(url, opts){
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if(!r.ok || data.ok === false) throw new Error(data.mensagem || data.erro || 'Falha na requisição');
  return data;
}

async function carregarDrivers(){
  try {
    const data = await json(`${API}/drivers`);
    const drivers = data.drivers || [];
    const el = $('listaDrivers');
    if (!el) return;
    el.innerHTML = drivers.map(d => `
      <div class="access-driver-card">
        <strong>${d.nome}</strong>
        <small>${d.fabricante} · ${d.protocolo}</small>
        <span class="badge ${d.status === 'operacional' ? 'badge-ok' : 'badge-warn'}">${d.status}</span>
        <p>${d.observacao || ''}</p>
      </div>
    `).join('');
  } catch (e) {
    const el = $('listaDrivers');
    if (el) el.innerHTML = `<div class="access-muted access-result">${e.message}</div>`;
  }
}

async function carregar(){
  await carregarDrivers();
  const data = await json(`${API}/dashboard`);
  const r = data.resumo || {};
  $('kpiDispositivos').textContent = r.dispositivos || 0;
  $('kpiOnline').textContent = r.online || 0;
  $('kpiDentro').textContent = r.pessoasDentro || 0;
  $('kpiHoje').textContent = r.acessosHoje || 0;
  $('kpiLiberados').textContent = r.liberadosHoje || 0;
  $('kpiBloqueados').textContent = r.bloqueadosHoje || 0;

  const dispositivos = data.dispositivos || [];
  $('dispositivoId').innerHTML = dispositivos.map(d => `<option value="${d.id}">${d.nome} · ${d.fabricante}</option>`).join('');
  $('tabelaDispositivos').innerHTML = dispositivos.map(d => `
    <tr><td>${d.nome || '-'}</td><td>${d.fabricante || '-'}</td><td>${d.driver || '-'}</td><td>${d.status || '-'}</td></tr>
  `).join('') || '<tr><td colspan="4">Nenhum equipamento cadastrado.</td></tr>';

  const presentes = data.presentes || [];
  $('listaPresentes').innerHTML = presentes.map(p => `
    <div class="access-person"><strong>${p.nome || '-'}</strong><small>${p.numeroMatricula || ''} · entrada ${hora(p.entradaEm)}</small></div>
  `).join('') || '<div class="access-muted access-result">Nenhuma pessoa registrada dentro da academia.</div>';

  const logs = data.ultimosLogs || [];
  $('tabelaLogs').innerHTML = logs.map(l => `
    <tr>
      <td>${hora(l.criadoEm)}</td>
      <td>${l.alunoNome || l.identificador || '-'}</td>
      <td>${l.direcao || '-'}</td>
      <td>${badge(!!l.autorizado)}</td>
      <td>${l.motivo || '-'}</td>
      <td>${l.dispositivoNome || '-'}<br><small>${l.fabricante || ''} ${l.driver ? '· '+l.driver : ''}</small></td>
    </tr>
  `).join('') || '<tr><td colspan="6">Nenhum acesso registrado.</td></tr>';
}

async function simular(){
  const payload = {
    identificador: $('identificador').value,
    dispositivoId: $('dispositivoId').value,
    direcao: $('direcao').value,
    origem: 'painel'
  };
  const box = $('resultado');
  box.className = 'access-result access-muted';
  box.textContent = 'Validando acesso...';
  try {
    const r = await json(`${API}/simular-acesso`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    box.className = `access-result ${r.autorizado ? 'access-ok' : 'access-no'}`;
    box.textContent = `${r.autorizado ? 'LIBERADO' : 'BLOQUEADO'} — ${r.motivo}`;
    await carregar();
  } catch(e) {
    box.className = 'access-result access-no';
    box.textContent = e.message;
  }
}

async function salvarEquipamento(){
  const payload = {
    nome: $('eqNome').value,
    fabricante: $('eqFabricante').value,
    modelo: 'Genérico',
    driver: $('eqDriver').value,
    ip: $('eqIp').value,
    porta: $('eqPorta').value,
    status: 'ativo'
  };
  await json(`${API}/dispositivos`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  await carregar();
}

document.addEventListener('DOMContentLoaded', () => {
  try { if (window.FusionAuth) FusionAuth.proteger(['admin','gerente','recepcao','comercial']); } catch {}
  try { if (window.carregarLayout) window.carregarLayout('Fusion Access Engine'); } catch {}
  $('btnAtualizar').addEventListener('click', carregar);
  $('btnAtivarBiometria')?.addEventListener('click', ativarBiometria);
  $('btnDesativarBiometria')?.addEventListener('click', desativarBiometria);
  verificarBiometriaAoAbrir();
  $('btnSimular').addEventListener('click', simular);
  $('btnSalvarEquipamento').addEventListener('click', salvarEquipamento);
  $('btnLimpar').addEventListener('click', () => { $('identificador').value=''; $('resultado').className='access-result access-muted'; $('resultado').textContent='Aguardando simulação.'; });
  carregar().catch(e => { $('resultado').className='access-result access-no'; $('resultado').textContent=e.message; });
});
