/* Fusion ERP - Ciclo Professor -> Aluno -> Avaliação -> Treino v1 */
(function(){
  const API_PROF = '/api/professores';
  const API_ALUNOS = '/api/alunos';
  const API_AVAL = '/api/avaliacoes';
  const API_TREINOS = '/api/treinos';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const norm = v => String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idAluno = a => String(a?.id || a?._id || a?.alunoId || a?.aluno_id || a?.codigo || '');
  const idProf = p => String(p?.id || p?._id || p?.professorId || p?.professor_id || p?.codigo || '');
  const nomeAluno = a => a?.nome || a?.alunoNome || a?.name || 'Aluno sem nome';
  const nomeProf = p => p?.nome || p?.professorNome || p?.name || 'Professor';
  const planoAluno = a => a?.plano || a?.planoNome || a?.nomePlano || '-';
  const statusAluno = a => a?.status || a?.situacao || 'ativo';

  async function safeJson(resp){ try { return await resp.json(); } catch { return {}; } }
  function lista(payload){
    if(Array.isArray(payload)) return payload;
    return payload?.dados || payload?.data || payload?.itens || payload?.registros || payload?.alunos || payload?.professores || payload?.avaliacoes || payload?.treinos || [];
  }
  async function get(url){
    const r = await fetch(url,{cache:'no-store'});
    const j = await safeJson(r);
    if(!r.ok) throw new Error(j.mensagem || j.erro || `HTTP ${r.status}`);
    return lista(j);
  }

  function professorDoAluno(a, profs){
    const pid = String(a.professorId || a.professor_id || a.professorResponsavelId || a.professor_responsavel_id || '');
    if(pid) {
      const p = profs.find(x => idProf(x) === pid);
      return { id: pid, nome: a.professorNome || a.professor_nome || nomeProf(p||{}) };
    }
    const pn = a.professorNome || a.professor_nome || a.professor_responsavel_nome || a.professor_responsavel || a.professorResponsavel || a.professor || '';
    if(pn) {
      const p = profs.find(x => norm(nomeProf(x)) === norm(pn));
      return { id: p ? idProf(p) : '', nome: p ? nomeProf(p) : pn };
    }
    return { id:'', nome:'' };
  }

  function alunoPertenceAoProfessor(a, p){
    const pid = idProf(p), pn = norm(nomeProf(p)), cref = norm(p.cref);
    const ids = [a.professorId,a.professor_id,a.professorResponsavelId,a.professor_responsavel_id,a.professor_id_responsavel,a.professor_responsavel,a.professorResponsavel].map(v=>String(v||''));
    if(pid && ids.includes(pid)) return true;
    const nomes = [a.professorNome,a.professor_nome,a.professor_responsavel_nome,a.professor_responsavel,a.professorResponsavel,a.professor,a.nomeProfessor,a.avaliador,a.treinador].map(norm);
    return (pn && nomes.includes(pn)) || (cref && nomes.some(n=>n.includes(cref)));
  }

  function garantirPopup(){
    let pop = $('#fusionCicloPopup');
    if(pop) return pop;
    pop = document.createElement('div');
    pop.id = 'fusionCicloPopup';
    pop.className = 'fusion-ciclo-popup hidden';
    pop.innerHTML = `
      <div class="fusion-ciclo-card">
        <div class="fusion-ciclo-head">
          <strong id="fusionCicloTitulo">Operação</strong>
          <button type="button" id="fusionCicloFechar">×</button>
        </div>
        <iframe id="fusionCicloFrame" title="Operação"></iframe>
      </div>`;
    document.body.appendChild(pop);
    $('#fusionCicloFechar', pop).addEventListener('click', () => {
      pop.classList.add('hidden');
      $('#fusionCicloFrame', pop).src = 'about:blank';
      setTimeout(()=>location.reload(), 100);
    });
    return pop;
  }

  function abrirPopup(titulo, url){
    const pop = garantirPopup();
    $('#fusionCicloTitulo', pop).textContent = titulo;
    $('#fusionCicloFrame', pop).src = url + (url.includes('?')?'&':'?') + 'embed=1';
    pop.classList.remove('hidden');
  }

  function urlAval(aluno, prof, modo){
    const q = new URLSearchParams({ alunoId:idAluno(aluno), professorId:idProf(prof) });
    if(modo === 'nova') q.set('nova','1');
    if(modo === 'editar') q.set('editar','1');
    return `/pages/avaliacoes/index.html?${q.toString()}`;
  }
  function urlTreino(aluno, prof, modo){
    const q = new URLSearchParams({ alunoId:idAluno(aluno), professorId:idProf(prof) });
    if(modo === 'novo') q.set('novo','1');
    if(modo === 'editar') q.set('editar','1');
    return `/pages/treinos/index.html?${q.toString()}`;
  }

  async function aplicarSelectProfessorAluno(){
    if(!location.pathname.includes('/pages/alunos/')) return;
    const campo = $('#professor_responsavel');
    if(!campo || campo.tagName === 'SELECT' || campo.dataset.fusionSelectOk === '1') return;
    let professores = [];
    try { professores = await get(API_PROF); } catch { return; }
    const atual = campo.value || $('#professorId')?.value || '';
    const select = document.createElement('select');
    select.id = campo.id;
    select.name = campo.name || 'professor_responsavel';
    select.required = true;
    select.dataset.fusionSelectOk = '1';
    select.innerHTML = '<option value="">Selecione um professor cadastrado</option>' + professores
      .filter(p => !['inativo','cancelado','excluido','excluído'].includes(norm(p.status||'ativo')))
      .map(p => `<option value="${esc(idProf(p))}" data-nome="${esc(nomeProf(p))}">${esc(nomeProf(p))}${p.cref?' - '+esc(p.cref):''}</option>`).join('');
    campo.replaceWith(select);
    const form = $('#formAluno') || select.closest('form');
    function hidden(name, val){
      let el = form?.querySelector(`#${name},[name="${name}"]`);
      if(!el && form){ el = document.createElement('input'); el.type='hidden'; el.id=name; el.name=name; form.appendChild(el); }
      if(el) el.value = val || '';
    }
    function sync(){
      const opt = select.selectedOptions[0];
      hidden('professorId', select.value || '');
      hidden('professor_id', select.value || '');
      hidden('professorNome', opt?.dataset?.nome || '');
      hidden('professor_nome', opt?.dataset?.nome || '');
    }
    select.addEventListener('change', sync);
    if(atual) {
      const p = professores.find(x => idProf(x) === atual || norm(nomeProf(x)) === norm(atual));
      if(p) select.value = idProf(p);
    }
    sync();
  }

  async function renderAlunosProfessor(profId){
    const profs = await get(API_PROF);
    const alunos = await get(API_ALUNOS);
    const prof = profs.find(p => idProf(p) === String(profId)) || profs.find(p => String(p.id||'') === String($('#id')?.value||'')) || null;
    if(!prof) return '<p>Professor não localizado.</p>';
    const vinculados = alunos.filter(a => alunoPertenceAoProfessor(a, prof));
    if(!vinculados.length) return `
      <div class="prof-alunos-box">
        <h4>Alunos sob responsabilidade</h4>
        <p>Nenhum aluno vinculado a este professor.</p>
        <small>Edite o cadastro do aluno e selecione este professor no campo Professor responsável.</small>
      </div>`;
    return `
      <div class="prof-alunos-box">
        <h4>Alunos sob responsabilidade (${vinculados.length})</h4>
        <div class="prof-alunos-list">
        ${vinculados.map(a=>`
          <details class="prof-aluno-card" open>
            <summary>
              <strong>${esc(nomeAluno(a))}</strong>
              <span>${esc(planoAluno(a))}</span>
              <em>${esc(statusAluno(a))}</em>
            </summary>
            <div class="prof-aluno-actions">
              <button type="button" data-acao="nova-avaliacao" data-aluno="${esc(idAluno(a))}" data-prof="${esc(idProf(prof))}">Nova avaliação</button>
              <button type="button" data-acao="editar-avaliacao" data-aluno="${esc(idAluno(a))}" data-prof="${esc(idProf(prof))}">Editar avaliação</button>
              <button type="button" data-acao="novo-treino" data-aluno="${esc(idAluno(a))}" data-prof="${esc(idProf(prof))}">Novo treino</button>
              <button type="button" data-acao="editar-treino" data-aluno="${esc(idAluno(a))}" data-prof="${esc(idProf(prof))}">Editar treino</button>
              <a href="/pages/alunos/index.html?alunoId=${encodeURIComponent(idAluno(a))}">Ficha</a>
            </div>
          </details>`).join('')}
        </div>
      </div>`;
  }

  async function aplicarProntuarioProfessor(){
    if(!location.pathname.includes('/pages/professores/')) return;
    const antigo = window.abrirProntuario;
    window.abrirProntuario = async function(id){
      if(typeof antigo === 'function') {
        try { await antigo(id); } catch {}
      }
      const box = $('#prontuario');
      if(!box) return;
      box.innerHTML = '<p>Carregando alunos vinculados...</p>';
      box.innerHTML = await renderAlunosProfessor(id);
      box.onclick = async (ev) => {
        const btn = ev.target.closest('[data-acao]');
        if(!btn) return;
        const profs = await get(API_PROF);
        const als = await get(API_ALUNOS);
        const prof = profs.find(p => idProf(p) === btn.dataset.prof);
        const aluno = als.find(a => idAluno(a) === btn.dataset.aluno);
        if(!prof || !aluno) return alert('Vínculo professor/aluno não localizado.');
        const acao = btn.dataset.acao;
        if(acao === 'nova-avaliacao') abrirPopup(`Nova avaliação - ${nomeAluno(aluno)}`, urlAval(aluno, prof, 'nova'));
        if(acao === 'editar-avaliacao') abrirPopup(`Editar avaliação - ${nomeAluno(aluno)}`, urlAval(aluno, prof, 'editar'));
        if(acao === 'novo-treino') abrirPopup(`Novo treino - ${nomeAluno(aluno)}`, urlTreino(aluno, prof, 'novo'));
        if(acao === 'editar-treino') abrirPopup(`Editar treino - ${nomeAluno(aluno)}`, urlTreino(aluno, prof, 'editar'));
      };
    };
  }

  function aplicarCss(){
    if($('#fusionCicloStyle')) return;
    const st = document.createElement('style');
    st.id = 'fusionCicloStyle';
    st.textContent = `
      .fusion-ciclo-popup{position:fixed;inset:0;background:rgba(2,6,23,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}
      .fusion-ciclo-popup.hidden{display:none!important}
      .fusion-ciclo-card{background:#fff;width:min(1180px,98vw);height:min(92vh,860px);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
      .fusion-ciclo-head{height:48px;background:#101826;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14px}
      .fusion-ciclo-head button{border:0;background:#ef4444;color:#fff;border-radius:7px;width:34px;height:32px;font-size:20px;cursor:pointer}
      .fusion-ciclo-card iframe{border:0;width:100%;height:100%;background:#fff}
      .prof-alunos-box{border:1px solid #dbe3ef;border-radius:12px;background:#f8fafc;padding:14px;margin-top:12px}
      .prof-alunos-box h4{margin:0 0 10px}
      .prof-aluno-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin:8px 0;padding:10px}
      .prof-aluno-card summary{cursor:pointer;display:grid;grid-template-columns:1fr 160px 100px;gap:10px;align-items:center}
      .prof-aluno-card summary span,.prof-aluno-card summary em{color:#64748b;font-style:normal}
      .prof-aluno-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .prof-aluno-actions button,.prof-aluno-actions a{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 10px;color:#0f172a;text-decoration:none;cursor:pointer}
      .prof-aluno-actions button:first-child{background:#ff6600;border-color:#ff6600;color:#fff}
      @media(max-width:780px){.prof-aluno-card summary{grid-template-columns:1fr}.fusion-ciclo-card{height:96vh}}
    `;
    document.head.appendChild(st);
  }

  function aplicarEmbed(){
    const qs = new URLSearchParams(location.search);
    if(qs.get('embed') !== '1') return;
    const shell = $('.fusion-shell');
    const main = $('.fusion-main');
    const sidebar = $('.fusion-sidebar');
    const topbar = $('.fusion-topbar');
    if(sidebar) sidebar.style.display = 'none';
    if(topbar) topbar.style.display = 'none';
    if(shell) shell.style.minHeight = 'auto';
    if(main) main.style.width = '100%';
    document.body.style.background = '#fff';
  }

  document.addEventListener('DOMContentLoaded', () => {
    aplicarCss();
    aplicarEmbed();
    aplicarSelectProfessorAluno();
    aplicarProntuarioProfessor();
  });
})();