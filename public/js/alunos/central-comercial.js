(function(){
  const params = new URLSearchParams(location.search);
  const alunoId = params.get('id') || params.get('alunoId');
  let central = null;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  function moeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function data(v){ if(!v) return '-'; const s=String(v).slice(0,10); const p=s.split('-'); return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : s; }
  function normalizar(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function alerta(msg,tipo='sucesso'){
    const el = $('#alerta') || $('#alertaAlunos');
    if(!el){ if(msg) alert(msg); return; }
    el.textContent = msg;
    el.className = `alunos-alert ${tipo}`;
    el.classList.remove('hidden');
    setTimeout(()=>el.classList.add('hidden'), 6000);
  }
  function garantirEstrutura(){
    const tabs = document.querySelector('.prontuario-tabs');
    if(tabs && !tabs.querySelector('[data-tab="contrato-comercial"]')){
      const b1 = document.createElement('button'); b1.className='tab'; b1.dataset.tab='contrato-comercial'; b1.textContent='Contrato Comercial';
      const b2 = document.createElement('button'); b2.className='tab'; b2.dataset.tab='servicos-contratados'; b2.textContent='Serviços Contratados';
      tabs.appendChild(b1); tabs.appendChild(b2);
    }
    const content = document.querySelector('.prontuario-page') || document.querySelector('.fusion-content') || document.querySelector('main');
    if(content && !$('#tab-contrato-comercial')){
      const sec = document.createElement('div'); sec.className='tab-panel'; sec.id='tab-contrato-comercial';
      sec.innerHTML = `<div class="fusion-card comercial-card"><h3>Contrato Comercial</h3><div id="contratoComercialResumo" class="info-grid"></div></div>`;
      content.appendChild(sec);
    }
    if(content && !$('#tab-servicos-contratados')){
      const sec = document.createElement('div'); sec.className='tab-panel'; sec.id='tab-servicos-contratados';
      sec.innerHTML = `<div class="fusion-card comercial-card"><div class="comercial-head"><h3>Serviços Contratados</h3><button class="fusion-button" id="btnSalvarChecklistComercial" type="button">Salvar contrato</button></div><div id="servicosChecklist" class="servicos-checklist">Carregando...</div><div id="contratoTotalBox" class="contrato-total-box"></div></div>`;
      content.appendChild(sec);
    }
    $$('.prontuario-tabs .tab').forEach(btn => {
      if(btn.dataset._centralBound) return;
      btn.dataset._centralBound='1';
      btn.addEventListener('click',()=>{
        $$('.prontuario-tabs .tab').forEach(b=>b.classList.toggle('active', b===btn));
        $$('.tab-panel').forEach(p=>p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
      });
    });
  }
  async function api(url, opt={}){
    const resp = await fetch(url, {cache:'no-store', ...opt, headers:{'Content-Type':'application/json', ...(opt.headers||{})}});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.erro || json.mensagem || `Erro HTTP ${resp.status}`);
    return json;
  }
  async function carregarCentral(){
    if(!alunoId) return;
    garantirEstrutura();
    try{
      central = await api(`/api/comercial/alunos/${encodeURIComponent(alunoId)}/central`);
      renderContrato(); renderChecklist();
    }catch(e){ alerta(e.message || 'Erro ao carregar central comercial.', 'erro'); }
  }
  function renderContrato(){
    const box = $('#contratoComercialResumo'); if(!box) return;
    const c = central?.contrato;
    if(!c){ box.innerHTML = '<div class="empty">Aluno sem contrato comercial ativo.</div>'; return; }
    const t = central.totais || {};
    box.innerHTML = [
      item('Status', c.status || '-'), item('Tipo', c.tipoPlano || c.tipoCobranca || '-'), item('Renovação', c.renovacaoAutomatica ? 'Automática' : 'Manual'),
      item('Início', data(c.dataInicio)), item('Fim / vencimento', data(c.dataFim || c.proximoVencimento)),
      `<div class="info-item"><span>Valor da matrícula/base</span><div class="input-inline"><input id="valorMatriculaCentral" value="${Number(t.valorMatricula||0).toFixed(2)}"><button id="btnSalvarValorMatriculaCentral" type="button">Salvar</button></div></div>`,
      item('Serviços', moeda(t.valorServicos)), item('Total comercial', moeda(t.total))
    ].join('');
    $('#btnSalvarValorMatriculaCentral')?.addEventListener('click', salvarValorMatricula);
  }
  function item(k,v){ return `<div class="info-item"><span>${esc(k)}</span><strong>${esc(v || '-')}</strong></div>`; }
  function turmasServico(servico){ return Array.isArray(servico.turmas) ? servico.turmas : []; }
  function renderChecklist(){
    const box = $('#servicosChecklist'); if(!box) return;
    const contrato = central?.contrato;
    if(!contrato){ box.innerHTML = '<div class="empty">Nenhum contrato ativo para editar.</div>'; return; }
    const checklist = central.checklist || [];
    if(!checklist.length){ box.innerHTML = '<div class="empty">Nenhum serviço comercial cadastrado.</div>'; return; }
    box.innerHTML = checklist.map(s => {
      const turmas = turmasServico(s);
      const checked = s.contratado ? 'checked' : '';
      const turmasHtml = turmas.length ? `<select data-role="turma" data-servico-id="${esc(s.id)}"><option value="">Turma opcional</option>${turmas.map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(s.turmaId)?'selected':''}>${esc(t.nome || t.turma || '-')} · ${esc(t.professor || '-')} · ${esc(t.horario || '-')}</option>`).join('')}</select>` : '<small>Sem turmas vinculadas.</small>';
      return `<div class="servico-check-row" data-servico-id="${esc(s.id)}" data-sc-id="${esc(s.servicoContratadoId||'')}">
        <label class="servico-check-title"><input type="checkbox" data-role="ativo" ${checked}> <strong>${esc(s.nome || s.servico)}</strong></label>
        <div class="servico-check-meta">Modalidade: ${esc(s.modalidade || '-')}</div>
        <div class="grid-3-mini"><div>${turmasHtml}</div><div><label>Valor</label><input data-role="valor" value="${Number(s.valorAtual ?? s.valorPadrao ?? 0).toFixed(2)}"></div><div><span>Total padrão</span><strong>${moeda(s.valorPadrao)}</strong></div></div>
      </div>`;
    }).join('');
    $('#btnSalvarChecklistComercial')?.addEventListener('click', salvarChecklist);
    atualizarTotalLocal();
    box.querySelectorAll('input,select').forEach(el=>el.addEventListener('input', atualizarTotalLocal));
  }
  function atualizarTotalLocal(){
    const tbox = $('#contratoTotalBox'); if(!tbox) return;
    const base = Number(String($('#valorMatriculaCentral')?.value || central?.totais?.valorMatricula || 0).replace(',','.')) || 0;
    const servicos = $$('#servicosChecklist .servico-check-row').reduce((s,row)=>{
      if(!row.querySelector('[data-role="ativo"]')?.checked) return s;
      return s + (Number(String(row.querySelector('[data-role="valor"]')?.value || 0).replace(',','.')) || 0);
    },0);
    tbox.innerHTML = `<div><span>Matrícula/base</span><strong>${moeda(base)}</strong></div><div><span>Serviços</span><strong>${moeda(servicos)}</strong></div><div class="total-final"><span>Total</span><strong>${moeda(base+servicos)}</strong></div>`;
  }
  async function salvarValorMatricula(){
    const contrato = central?.contrato; if(!contrato) return;
    const valor = Number(String($('#valorMatriculaCentral')?.value || 0).replace(',','.')) || 0;
    try{ await api(`/api/comercial/contratos/${encodeURIComponent(contrato.id)}/valor-matricula`, {method:'PATCH', body:JSON.stringify({valorMatricula:valor, usuario:'Administrador'})}); alerta('Valor da matrícula atualizado.'); await carregarCentral(); }
    catch(e){ alerta(e.message, 'erro'); }
  }
  async function salvarChecklist(){
    const contrato = central?.contrato; if(!contrato) return;
    const servicos = $$('#servicosChecklist .servico-check-row').filter(row=>row.querySelector('[data-role="ativo"]')?.checked).map(row=>({
      servicoContratadoId: row.dataset.scId || '', servicoId: row.dataset.servicoId || '', turmaId: row.querySelector('[data-role="turma"]')?.value || '', valor: row.querySelector('[data-role="valor"]')?.value || 0
    }));
    try{ await api(`/api/comercial/contratos/${encodeURIComponent(contrato.id)}/checklist`, {method:'PUT', body:JSON.stringify({servicos, usuario:'Administrador'})}); alerta('Contrato comercial salvo.'); await carregarCentral(); }
    catch(e){ alerta(e.message, 'erro'); }
  }
  document.addEventListener('DOMContentLoaded', carregarCentral);
  if(document.readyState !== 'loading') carregarCentral();
})();
