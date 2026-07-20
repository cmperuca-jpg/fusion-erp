const API = '/api/professores';
const API_ALUNOS = '/api/alunos';
let professores = [];
let alunos = [];
let documentos = [];
const $ = s => document.querySelector(s);

function norm(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function enc(v){return encodeURIComponent(String(v||''));}
function lista(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean);}
function joinLista(v){return Array.isArray(v)?v.join(', '):String(v||'');}
function mostrar(msg,tipo='info'){const el=$('#alerta'); if(!el) return alert(msg); el.textContent=msg;el.className=`alert ${tipo}`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),7000);}
async function safeJson(resp){try{return await resp.json();}catch{return {};}}
function extrairLista(payload){if(Array.isArray(payload))return payload;return payload.professores||payload.alunos||payload.dados||payload.data||payload.itens||payload.registros||[];}
function nome(p){return p?.nome||p?.name||'';}
function status(p){return norm(p?.status||'ativo');}
function idProfessor(p){return String(p?.id||p?._id||p?.codigo||'');}
function idAluno(a){return String(a?.id||a?._id||a?.codigo||'');}
function nomeAluno(a){return a?.nome||a?.alunoNome||a?.name||'Aluno sem nome';}
function planoAluno(a){return a?.plano||a?.planoNome||a?.nomePlano||'-';}
function telefoneAluno(a){return a?.telefone||a?.whatsapp||a?.celular||'-';}
function statusAluno(a){return a?.status||a?.situacao||'ativo';}

async function carregar(){
  $('#tabela').innerHTML='<tr><td colspan="6">Carregando...</td></tr>';
  try{
    const [respProf, respAlunos] = await Promise.all([
      fetch(API,{cache:'no-store'}),
      fetch(API_ALUNOS,{cache:'no-store'}).catch(()=>null)
    ]);
    const payload = await safeJson(respProf);
    if(!respProf.ok)throw new Error(payload.mensagem||payload.erro||`HTTP ${respProf.status}`);
    professores = extrairLista(payload);

    if(respAlunos){
      const payloadAlunos = await safeJson(respAlunos);
      alunos = respAlunos.ok ? extrairLista(payloadAlunos) : [];
    } else alunos = [];

    render();
  } catch(e){
    $('#tabela').innerHTML=`<tr><td colspan="6">${esc(e.message)}</td></tr>`;
    mostrar(e.message,'erro');
  }
}

function filtrados(){
  const q=norm($('#busca').value);
  const st=norm($('#filtroStatus').value);
  return professores.filter(p=>{
    const alvo=norm([p.nome,p.cpf,p.cref,p.email,p.telefone,p.especialidade,joinLista(p.especialidades),joinLista(p.modalidades)].join(' '));
    return (!q||alvo.includes(q))&&(!st||status(p)===st);
  });
}

function alunosDoProfessor(professor){
  const pid = idProfessor(professor);
  const pn = norm(nome(professor));
  const cref = norm(professor?.cref);
  return alunos.filter(a=>{
    // Regra principal: vínculo por ID do professor.
    const camposId = [
      a.professorId,
      a.professor_id,
      a.professorResponsavelId,
      a.professor_responsavel_id,
      a.professor_id_responsavel,
      // Compatibilidade com registros antigos onde professor_responsavel recebeu o ID do select.
      a.professor_responsavel,
      a.professorResponsavel
    ];
    if(pid && camposId.some(v=>String(v||'')===pid)) return true;

    // Compatibilidade: registros antigos que guardaram apenas o nome.
    const camposNome = [
      a.professorNome,
      a.professor_nome,
      a.professor_responsavel_nome,
      a.professor_responsavel,
      a.professorResponsavel,
      a.professor,
      a.nomeProfessor,
      a.avaliador,
      a.treinador
    ].map(norm);
    if(pn && camposNome.some(v=>v===pn)) return true;
    if(cref && camposNome.some(v=>v.includes(cref))) return true;
    return false;
  });
}

function render(){
  const lista=filtrados();
  $('#contador').textContent=`${lista.length} registro(s)`;
  $('#kpiTotal').textContent=professores.length;
  $('#kpiAtivos').textContent=professores.filter(p=>status(p)==='ativo').length;
  $('#kpiCref').textContent=professores.filter(p=>p.cref).length;
  const mods=new Set();professores.forEach(p=>(p.modalidades||[]).forEach(m=>mods.add(m)));
  $('#kpiModalidades').textContent=mods.size;
  if(!lista.length){$('#tabela').innerHTML='<tr><td colspan="6">Nenhum professor encontrado.</td></tr>';return;}
  $('#tabela').innerHTML=lista.map(p=>{
    const vinculados = alunosDoProfessor(p).length;
    return `<tr><td><strong>${esc(nome(p))}</strong><small>${esc(p.email||'')}</small></td><td>${esc(p.cref||'-')}</td><td>${esc(p.telefone||p.whatsapp||'-')}</td><td>${esc(joinLista(p.especialidades)||p.especialidade||joinLista(p.modalidades)||'-')}</td><td><span class="badge status-${esc(status(p))}">${esc(p.status||'Ativo')}</span><small>${vinculados} aluno(s)</small></td><td class="text-right"><button class="btn-row" onclick="editar('${esc(idProfessor(p))}')">Editar</button><button class="btn-row" onclick="abrirProntuario('${esc(idProfessor(p))}')">Prontuário</button><button class="btn-row danger" onclick="excluir('${esc(idProfessor(p))}')">Excluir</button></td></tr>`;
  }).join('');
}

function abrirModal(t='Novo professor'){ $('#modalTitulo').textContent=t; $('#modal').classList.remove('hidden'); setTimeout(()=>$('#nome').focus(),50); }
function fechar(){ $('#modal').classList.add('hidden'); $('#form').reset(); $('#id').value=''; if($('#senha'))$('#senha').value=''; if($('#confirmarSenha'))$('#confirmarSenha').value=''; documentos=[]; renderDocs(); $('#prontuario').textContent='Selecione um professor para carregar o prontuário.'; trocarTab('cadastro'); }
function trocarTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`));}
function coletar(){const dados={nome:$('#nome').value.trim(),status:$('#status').value,cpf:$('#cpf').value,rg:$('#rg').value,cref:$('#cref').value,email:$('#email').value,telefone:$('#telefone').value,whatsapp:$('#whatsapp').value,dataNascimento:$('#dataNascimento').value,endereco:$('#endereco').value,especialidade:$('#especialidade').value,especialidades:lista($('#especialidades').value),modalidades:lista($('#modalidades').value),diasTrabalho:lista($('#diasTrabalho').value),horarioInicio:$('#horarioInicio').value,horarioFim:$('#horarioFim').value,tipoContrato:$('#tipoContrato').value,valorHora:$('#valorHora').value,banco:$('#banco').value,agencia:$('#agencia').value,conta:$('#conta').value,chavePix:$('#chavePix').value,observacoes:$('#observacoes').value,documentos};const senha=$('#senha')?.value||'';if(senha)dados.senha=senha;return dados;}
function preencher(p){$('#id').value=idProfessor(p);['nome','status','cpf','rg','cref','email','telefone','whatsapp','dataNascimento','endereco','especialidade','horarioInicio','horarioFim','tipoContrato','valorHora','banco','agencia','conta','chavePix','observacoes'].forEach(k=>{const el=$(`#${k}`);if(el)el.value=p[k]||'';});if($('#senha'))$('#senha').value='';if($('#confirmarSenha'))$('#confirmarSenha').value='';$('#especialidades').value=joinLista(p.especialidades);$('#modalidades').value=joinLista(p.modalidades);$('#diasTrabalho').value=joinLista(p.diasTrabalho);documentos=Array.isArray(p.documentos)?p.documentos:[];renderDocs();}
window.editar=function(id){const p=professores.find(x=>String(idProfessor(x))===String(id));if(!p)return mostrar('Professor não encontrado.','erro');preencher(p);abrirModal('Editar professor');};
window.abrirProntuario=async function(id){const p=professores.find(x=>String(idProfessor(x))===String(id));if(p)preencher(p);abrirModal('Prontuário do professor');trocarTab('prontuario');await carregarProntuario(id);};

function urlAvaliacao(professor, aluno, modo='nova'){
  const params = new URLSearchParams({ alunoId: idAluno(aluno), professorId: idProfessor(professor) });
  if (modo === 'nova') params.set('nova', '1');
  if (modo === 'editar') params.set('editar', '1');
  return `/pages/avaliacoes/index.html?${params.toString()}`;
}
function urlTreino(professor, aluno, modo='novo'){
  const params = new URLSearchParams({ alunoId: idAluno(aluno), professorId: idProfessor(professor) });
  if (modo === 'novo') params.set('novo', '1');
  if (modo === 'editar') params.set('editar', '1');
  return `/pages/treinos/index.html?${params.toString()}`;
}
function linkFichaAluno(aluno){ return `/pages/alunos/index.html?alunoId=${enc(idAluno(aluno))}`; }

function garantirPopupOperacional(){
  let pop = document.getElementById('popupOperacionalProfessor');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'popupOperacionalProfessor';
  pop.className = 'popup-operacional hidden';
  pop.innerHTML = `
    <div class="popup-operacional-card">
      <div class="popup-operacional-head">
        <h3 id="popupOperacionalTitulo">Operação</h3>
        <div>
          <button type="button" class="btn-light" id="popupOperacionalAtualizar">Atualizar</button>
          <button type="button" class="btn-light" id="popupOperacionalFechar">Fechar</button>
        </div>
      </div>
      <iframe id="popupOperacionalFrame" title="Operação do professor"></iframe>
    </div>`;
  document.body.appendChild(pop);
  pop.querySelector('#popupOperacionalFechar').addEventListener('click', fecharPopupOperacional);
  pop.querySelector('#popupOperacionalAtualizar').addEventListener('click', () => {
    const frame = pop.querySelector('#popupOperacionalFrame');
    if (frame?.contentWindow) frame.contentWindow.location.reload();
  });
  return pop;
}

function abrirPopupOperacional(url, titulo){
  const pop = garantirPopupOperacional();
  pop.querySelector('#popupOperacionalTitulo').textContent = titulo || 'Operação';
  pop.querySelector('#popupOperacionalFrame').src = url;
  pop.classList.remove('hidden');
}

function fecharPopupOperacional(){
  const pop = document.getElementById('popupOperacionalProfessor');
  if (!pop) return;
  pop.classList.add('hidden');
  const frame = pop.querySelector('#popupOperacionalFrame');
  if (frame) frame.src = 'about:blank';
  carregar().catch(()=>{});
}

window.abrirNovaAvaliacaoAluno = function(professorId, alunoId){
  const professor = professores.find(p => String(idProfessor(p)) === String(professorId));
  const aluno = alunos.find(a => String(idAluno(a)) === String(alunoId));
  if (!professor || !aluno) return mostrar('Professor ou aluno não encontrado.', 'erro');
  abrirPopupOperacional(urlAvaliacao(professor, aluno, 'nova'), `Nova avaliação - ${nomeAluno(aluno)}`);
};
window.abrirEditarAvaliacaoAluno = function(professorId, alunoId){
  const professor = professores.find(p => String(idProfessor(p)) === String(professorId));
  const aluno = alunos.find(a => String(idAluno(a)) === String(alunoId));
  if (!professor || !aluno) return mostrar('Professor ou aluno não encontrado.', 'erro');
  abrirPopupOperacional(urlAvaliacao(professor, aluno, 'editar'), `Editar avaliações - ${nomeAluno(aluno)}`);
};
window.abrirNovoTreinoAluno = function(professorId, alunoId){
  const professor = professores.find(p => String(idProfessor(p)) === String(professorId));
  const aluno = alunos.find(a => String(idAluno(a)) === String(alunoId));
  if (!professor || !aluno) return mostrar('Professor ou aluno não encontrado.', 'erro');
  abrirPopupOperacional(urlTreino(professor, aluno, 'novo'), `Novo treino - ${nomeAluno(aluno)}`);
};
window.abrirEditarTreinoAluno = function(professorId, alunoId){
  const professor = professores.find(p => String(idProfessor(p)) === String(professorId));
  const aluno = alunos.find(a => String(idAluno(a)) === String(alunoId));
  if (!professor || !aluno) return mostrar('Professor ou aluno não encontrado.', 'erro');
  abrirPopupOperacional(urlTreino(professor, aluno, 'editar'), `Editar treinos - ${nomeAluno(aluno)}`);
};

function renderAlunosVinculados(professor){
  const lista = alunosDoProfessor(professor).sort((a,b)=>nomeAluno(a).localeCompare(nomeAluno(b),'pt-BR'));
  if(!lista.length){
    return `<div class="mini-panel"><strong>Alunos sob responsabilidade</strong><p>Nenhum aluno direcionado a este professor.</p><small>Para vincular: abra o cadastro do aluno e selecione este professor no campo Professor responsável.</small></div>`;
  }
  return `<details class="prof-accordion" open>
    <summary>Alunos sob responsabilidade do professor <strong>${lista.length}</strong></summary>
    <div class="prof-alunos-lista">
      ${lista.map(a=>`<div class="prof-aluno-card">
        <div>
          <strong>${esc(nomeAluno(a))}</strong>
          <small>Plano: ${esc(planoAluno(a))} · Status: ${esc(statusAluno(a))} · Telefone: ${esc(telefoneAluno(a))}</small>
        </div>
        <div class="prof-aluno-acoes">
          <a class="btn-row" href="${linkFichaAluno(a)}">Ficha</a>
          <button class="btn-row primary" type="button" onclick="abrirNovaAvaliacaoAluno('${esc(idProfessor(professor))}','${esc(idAluno(a))}')">Nova avaliação</button>
          <button class="btn-row" type="button" onclick="abrirEditarAvaliacaoAluno('${esc(idProfessor(professor))}','${esc(idAluno(a))}')">Editar avaliação</button>
          <button class="btn-row success" type="button" onclick="abrirNovoTreinoAluno('${esc(idProfessor(professor))}','${esc(idAluno(a))}')">Novo treino</button>
          <button class="btn-row" type="button" onclick="abrirEditarTreinoAluno('${esc(idProfessor(professor))}','${esc(idAluno(a))}')">Editar treino</button>
        </div>
      </div>`).join('')}
    </div>
  </details>`;
}

function contarExerciciosTreino(t = {}){
  if (Array.isArray(t.exercicios)) return t.exercicios.length;
  if (Array.isArray(t.divisoes)) return t.divisoes.reduce((s,d)=>s+(Array.isArray(d.itens)?d.itens.length:(Array.isArray(d.exercicios)?d.exercicios.length:0)),0);
  if (Array.isArray(t.grupos)) return t.grupos.reduce((s,g)=>s+(Array.isArray(g.itens)?g.itens.length:(Array.isArray(g.exercicios)?g.exercicios.length:0)),0);
  return 0;
}
function dataCurta(v){ const s=String(v||'').slice(0,10); if(!s) return '-'; const [a,m,d]=s.split('-'); return a&&m&&d ? `${d}/${m}/${a}` : s; }
function blocoListaProntuario(titulo, itens, vazio, renderItem){
  return `<details class="prof-accordion" open><summary>${esc(titulo)} <strong>${itens.length}</strong></summary><div class="prof-prontuario-lista">${itens.length?itens.map(renderItem).join(''):`<div class="mini-panel">${esc(vazio)}</div>`}</div></details>`;
}
function renderTurmasProntuario(lista=[]){
  return blocoListaProntuario('Turmas vinculadas', lista, 'Nenhuma turma vinculada.', t=>`<div class="prof-vinculo-card"><strong>${esc(t.nome||t.turma||'-')}</strong><small>Modalidade: ${esc(t.modalidade||'-')} · Dias: ${esc(t.diasSemana||'-')} · Horário: ${esc(t.horario||'-')}</small></div>`);
}
function renderAvaliacoesProntuario(lista=[]){
  return blocoListaProntuario('Avaliações realizadas', lista, 'Nenhuma avaliação realizada por este professor.', a=>`<div class="prof-vinculo-card"><strong>${esc(a.alunoNome||a.aluno||'Aluno')}</strong><small>Data: ${dataCurta(a.data||a.criadoEm||a.criado_em)} · Objetivo: ${esc(a.objetivo||'-')} · IMC: ${esc(a.imc||'-')}</small></div>`);
}
function renderTreinosProntuario(lista=[]){
  return blocoListaProntuario('Treinos prescritos', lista, 'Nenhum treino prescrito por este professor.', t=>`<div class="prof-vinculo-card"><strong>${esc(t.alunoNome||t.aluno||'Aluno')}</strong><small>Objetivo: ${esc(t.objetivo||'-')} · Exercícios: ${contarExerciciosTreino(t)} · Validade: ${dataCurta(t.validade||t.dataValidade||t.data_validade)}</small></div>`);
}
function renderDocumentosProntuario(lista=[]){
  return blocoListaProntuario('Documentos', lista, 'Nenhum documento cadastrado.', d=>`<div class="prof-vinculo-card"><strong>${esc(d.nome||'Documento')}</strong><small>Tipo: ${esc(d.tipo||'-')}</small></div>`);
}
function renderAgendaProntuario(lista=[]){
  return blocoListaProntuario('Agenda', lista, 'Nenhuma agenda vinculada.', a=>`<div class="prof-vinculo-card"><strong>${esc(a.titulo||a.nome||a.turma||'Agenda')}</strong><small>Data: ${dataCurta(a.data||a.inicio)} · Horário: ${esc(a.horario||a.hora||'-')}</small></div>`);
}

async function carregarProntuario(id){
  const el=$('#prontuario');
  const professor = professores.find(x=>String(idProfessor(x))===String(id));
  if(!professor){ el.textContent='Professor não encontrado.'; return; }
  el.textContent='Carregando prontuário...';
  let dados = { resumo:{}, turmas:[], agenda:[], alunos:alunosDoProfessor(professor), avaliacoes:[], treinos:[], documentos:professor.documentos||[], linhaTempo:[] };
  try{
    const resp=await fetch(`${API}/${encodeURIComponent(id)}/prontuario`,{cache:'no-store'});
    const j=await safeJson(resp);
    if(resp.ok && j.ok!==false) dados = {...dados, ...j, resumo:{...dados.resumo, ...(j.resumo||{})}};
  } catch{}
  const alunosVinculados = Array.isArray(dados.alunos) && dados.alunos.length ? dados.alunos : alunosDoProfessor(professor);
  const resumo = {
    turmas: (dados.turmas||[]).length,
    agenda: (dados.agenda||[]).length,
    alunos: alunosVinculados.length,
    avaliacoes: (dados.avaliacoes||[]).length,
    treinos: (dados.treinos||[]).length,
    documentos: (dados.documentos||professor.documentos||[]).length,
    ...(dados.resumo||{})
  };
  resumo.alunos = alunosVinculados.length;
  el.innerHTML=`
    <div class="prof-prontuario-head">
      <div><h3>${esc(nome(professor))}</h3><p>${esc(professor.cref||'CREF não informado')} · ${esc(professor.especialidade||joinLista(professor.especialidades)||'Sem especialidade')}</p></div>
      <div class="prof-prontuario-status"><span class="badge status-${esc(status(professor))}">${esc(professor.status||'Ativo')}</span></div>
    </div>
    <div class="prof-info-grid">
      <div><span>Modalidades</span><strong>${esc(joinLista(professor.modalidades)||'-')}</strong></div>
      <div><span>Especialidades</span><strong>${esc(joinLista(professor.especialidades)||professor.especialidade||'-')}</strong></div>
      <div><span>Horário</span><strong>${esc((professor.horarioInicio||'-')+' às '+(professor.horarioFim||'-'))}</strong></div>
      <div><span>Contrato</span><strong>${esc(professor.tipoContrato||'-')}</strong></div>
    </div>
    <div class="pront-kpis"><div><span>Turmas</span><strong>${resumo.turmas||0}</strong></div><div><span>Agenda</span><strong>${resumo.agenda||0}</strong></div><div><span>Alunos</span><strong>${resumo.alunos||0}</strong></div><div><span>Avaliações</span><strong>${resumo.avaliacoes||0}</strong></div><div><span>Treinos</span><strong>${resumo.treinos||0}</strong></div><div><span>Documentos</span><strong>${resumo.documentos||0}</strong></div></div>
    ${renderAlunosVinculados(professor)}
    ${renderTurmasProntuario(dados.turmas||[])}
    ${renderAgendaProntuario(dados.agenda||[])}
    ${renderAvaliacoesProntuario(dados.avaliacoes||[])}
    ${renderTreinosProntuario(dados.treinos||[])}
    ${renderDocumentosProntuario(dados.documentos||professor.documentos||[])}
    <h4>Linha do tempo</h4>
    ${(dados.linhaTempo||[]).length?(dados.linhaTempo||[]).map(i=>`<div class="timeline-item"><strong>${esc(i.tipo)}</strong> — ${esc(i.descricao)}<br><small>${esc(dataCurta(i.data))}</small></div>`).join(''):'<p>Nenhum evento registrado.</p>'}`;
}


window.excluir=async function(id){const p=professores.find(x=>String(idProfessor(x))===String(id));if(!confirm(`Excluir ${nome(p)||'professor'}?`))return;try{const resp=await fetch(`${API}/${encodeURIComponent(id)}`,{method:'DELETE'});const j=await safeJson(resp);if(!resp.ok||j.ok===false)throw new Error(j.mensagem||`HTTP ${resp.status}`);mostrar('Professor excluído.','sucesso');await carregar();}catch(e){mostrar(e.message,'erro');}}
async function salvar(ev){ev.preventDefault();const id=$('#id').value;const senha=$('#senha')?.value||'';const confirmar=$('#confirmarSenha')?.value||'';const dados=coletar();if(!dados.nome||dados.nome.length<3)return mostrar('Informe o nome completo.','erro');if(!id&&!senha)return mostrar('Informe a senha do Portal do Professor.','erro');if(senha&&senha.length<6)return mostrar('A senha deve ter pelo menos 6 caracteres.','erro');if(senha!==confirmar)return mostrar('A confirmação da senha não confere.','erro');try{const resp=await fetch(id?`${API}/${encodeURIComponent(id)}`:API,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});const j=await safeJson(resp);if(!resp.ok||j.ok===false)throw new Error(j.mensagem||`HTTP ${resp.status}`);fechar();mostrar(id?'Professor atualizado.':'Professor cadastrado.','sucesso');await carregar();}catch(e){mostrar(e.message,'erro');}}
function renderDocs(){const el=$('#listaDocs');if(!documentos.length){el.innerHTML='<p>Nenhum documento.</p>';return;}el.innerHTML=documentos.map((d,i)=>`<div><strong>${esc(d.nome||'Documento')}</strong> <button type="button" class="btn-light" onclick="removerDoc(${i})">Remover</button></div>`).join('');}
window.removerDoc=i=>{documentos.splice(i,1);renderDocs();};
async function adicionarDoc(){const nome=$('#nomeDocumento').value.trim();const arq=$('#arquivoDocumento').files[0];if(!nome)return mostrar('Informe o nome do documento.','erro');if(!arq){documentos.push({nome,tipo:'manual',arquivo_base64:''});renderDocs();return;}const reader=new FileReader();reader.onload=()=>{documentos.push({nome,tipo:arq.type,arquivo_base64:reader.result});$('#nomeDocumento').value='';$('#arquivoDocumento').value='';renderDocs();};reader.readAsDataURL(arq);}
$('#btnNovo').addEventListener('click',()=>{fechar();abrirModal();});$('#btnAtualizar').addEventListener('click',carregar);$('#btnFechar').addEventListener('click',fechar);$('#btnCancelar').addEventListener('click',fechar);$('#btnImprimir').addEventListener('click',()=>window.print());$('#form').addEventListener('submit',salvar);$('#busca').addEventListener('input',render);$('#filtroStatus').addEventListener('change',render);$('#btnAdicionarDoc').addEventListener('click',adicionarDoc);document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>trocarTab(b.dataset.tab)));
carregar();
