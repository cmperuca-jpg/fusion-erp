(function(){
  const API_PROF = '/api/professores';
  const cache = { professores: null };
  const norm = v => String(v||'').trim().toLowerCase();
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function json(resp){ try { return await resp.json(); } catch { return {}; } }
  async function professores(){
    if (cache.professores) return cache.professores;
    const resp = await fetch(API_PROF,{cache:'no-store'});
    const data = await json(resp);
    const lista = Array.isArray(data) ? data : (data.professores || data.dados || data.data || []);
    cache.professores = lista.filter(p => !['inativo','cancelado','excluido','excluído'].includes(norm(p.status||'ativo')));
    return cache.professores;
  }
  function nome(p){ return p.nome || p.name || p.professor || 'Professor'; }
  function id(p){ return p.id || p._id || p.codigo || nome(p); }
  function findProfessorByText(lista, texto){
    const t = norm(texto);
    return lista.find(p => norm(id(p))===t || norm(nome(p))===t || norm(p.professorId)===t || norm(p.cref)===t) || null;
  }
  function buildOptions(lista, atual){
    const selected = norm(atual);
    return '<option value="">Selecione um professor cadastrado</option>' + lista.map(p => {
      const pid = String(id(p));
      const sel = norm(pid)===selected || norm(nome(p))===selected ? ' selected' : '';
      const cref = p.cref ? ` - ${p.cref}` : '';
      return `<option value="${esc(pid)}" data-nome="${esc(nome(p))}"${sel}>${esc(nome(p)+cref)}</option>`;
    }).join('');
  }
  function ensureHidden(form, name, value){
    if (!form) return;
    let el = form.querySelector(`[name="${name}"],#${name}`);
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.id = name;
      el.name = name;
      form.appendChild(el);
    }
    el.value = value || '';
  }
  async function transformarCampoProfessorAluno(){
    const campo = document.getElementById('professor_responsavel');
    if (!campo || campo.dataset.professorSelectAplicado) return;
    const form = document.getElementById('formAluno') || campo.closest('form');
    const lista = await professores();
    const atual = document.getElementById('professorId')?.value || document.getElementById('professor_id')?.value || campo.value || campo.getAttribute('value') || '';
    const select = document.createElement('select');
    select.id = campo.id;
    select.name = campo.name || 'professor_responsavel';
    select.className = campo.className;
    select.required = true;
    select.dataset.professorSelectAplicado = '1';
    select.innerHTML = buildOptions(lista, atual);
    campo.replaceWith(select);
    const sync = () => {
      const opt = select.selectedOptions[0];
      const nomeLimpo = (opt?.dataset?.nome || opt?.textContent || '').replace(/\s+-\s+CREF.*$/i, '').trim();
      ensureHidden(form, 'professorId', select.value);
      ensureHidden(form, 'professorNome', nomeLimpo);
      ensureHidden(form, 'professor_id', select.value);
      ensureHidden(form, 'professor_nome', nomeLimpo);
    };
    select.addEventListener('change', sync);
    sync();
  }
  function bloquearSubmitSemProfessor(){
    document.addEventListener('submit', function(ev){
      const form = ev.target;
      if (!form) return;
      const path = location.pathname;
      const exige = path.includes('/pages/alunos') || path.includes('/pages/avaliacoes') || path.includes('/pages/treinos');
      if (!exige) return;
      const prof = form.querySelector('#professor_responsavel, #professorId, #professor_id, [name="professorId"], [name="professor_id"], [name="professor_responsavel"]');
      if (prof && !String(prof.value||'').trim()) {
        ev.preventDefault();
        ev.stopPropagation();
        alert('Selecione um professor cadastrado antes de salvar. Avaliações e treinos só podem ser prescritos por profissional cadastrado.');
      }
    }, true);
  }
  async function popularSelectsProfissionais(){
    const lista = await professores();
    const ids = ['professorId','professor_id','avaliadorId','professor_responsavel'];
    ids.forEach(selId => {
      const el = document.getElementById(selId);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        const atual = el.value;
        el.innerHTML = buildOptions(lista, atual);
      }
    });
  }
  async function adicionarCampoProfessorEmFormularios(){
    const path = location.pathname;
    if (!path.includes('/pages/avaliacoes') && !path.includes('/pages/treinos')) return;
    const form = document.querySelector('form');
    if (!form || form.querySelector('#professorId,#professor_id,#professor_responsavel')) return;
    const lista = await professores();
    const box = document.createElement('div');
    box.className = 'field campo-professor-obrigatorio';
    box.innerHTML = `<label for="professorId">Professor responsável *</label><select id="professorId" name="professorId" required>${buildOptions(lista,'')}</select><small>Obrigatório: avaliação ou treino deve ser assinado por professor cadastrado.</small>`;
    form.insertBefore(box, form.firstElementChild);
  }
  async function boot(){
    try {
      bloquearSubmitSemProfessor();
      await transformarCampoProfessorAluno();
      await adicionarCampoProfessorEmFormularios();
      await popularSelectsProfissionais();
    } catch(e){ console.warn('Professor obrigatório:', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
