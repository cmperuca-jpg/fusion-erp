const API = '/api/biblioteca-inteligente';
const $ = s => document.querySelector(s);
let lista = [];
let editando = null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg,tipo='sucesso'){const el=$('#alerta');el.textContent=msg;el.className=`alert ${tipo}`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),6000)}
async function j(url,opt){const r=await fetch(url,opt);const data=await r.json().catch(()=>({}));if(!r.ok||data.ok===false)throw new Error(data.mensagem||`HTTP ${r.status}`);return data;}
function media(ex){const src=ex.midia||ex.imagemUrl||ex.videoUrl||''; if(!src)return '<div class="thumb empty">sem mídia</div>'; if((ex.tipoMidia||'').includes('video')||/\.(mp4|webm|mov)$/i.test(src))return `<video class="thumb" src="${esc(src)}" muted loop playsinline></video>`; return `<img class="thumb" src="${esc(src)}" loading="lazy">`;}

async function carregar(){
  const dash=await j(`${API}/dashboard`);
  const e=dash.estatisticas||{};
  $('#kpiTotal').textContent=e.total||0; $('#kpiGifs').textContent=e.gifs||0; $('#kpiVideos').textContent=e.videos||0; $('#kpiGrupos').textContent=e.grupos||0; $('#kpiSemMidia').textContent=e.semMidia||0; $('#kpiDuplicados').textContent=e.duplicados||0;
  $('#logs').innerHTML=(dash.logs||[]).length?(dash.logs||[]).map(l=>`<div class="log"><strong>${esc(l.acao)}</strong><small>${new Date(l.criadoEm).toLocaleString('pt-BR')}</small></div>`).join(''):'<p class="muted">Sem logs.</p>';
  await buscar();
}

async function buscar(){
  const q = new URLSearchParams();
  if($('#busca').value) q.set('q',$('#busca').value);
  if($('#filtroGrupo').value) q.set('grupo',$('#filtroGrupo').value);
  if($('#filtroStatus').value) q.set('status',$('#filtroStatus').value);
  const data=await j(`${API}/exercicios?${q.toString()}`);
  lista=data.dados||[];
  renderTabela();
  renderGrupos();
}

function renderGrupos(){
  const sel=$('#filtroGrupo'); const atual=sel.value;
  const grupos=[...new Set(lista.map(x=>x.grupo||x.grupoMuscular).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  sel.innerHTML='<option value="">Todos os grupos</option>'+grupos.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
  sel.value=atual;
}

function renderTabela(){
  $('#contador').textContent=`${lista.length} registro(s)`;
  $('#tabela').innerHTML=lista.length?lista.map(ex=>`<tr>
    <td><code>${esc(ex.id)}</code></td>
    <td>${media(ex)}</td>
    <td><strong>${esc(ex.nome)}</strong><small>${esc(ex.equipamento||'')}</small></td>
    <td>${esc(ex.grupo||ex.grupoMuscular||'-')}</td>
    <td>${esc(ex.tipoMidia||'-')}</td>
    <td><span class="badge">${esc(ex.status||'Ativo')}</span></td>
    <td><button onclick="abrirEditor('${esc(ex.id)}')">Editar</button></td>
  </tr>`).join(''):'<tr><td colspan="7">Nenhum exercício encontrado.</td></tr>';
}

window.abrirEditor=function(id){
  editando=lista.find(x=>String(x.id)===String(id)); if(!editando)return;
  $('#editId').value=editando.id||''; $('#editNome').value=editando.nome||''; $('#editGrupo').value=editando.grupo||editando.grupoMuscular||''; $('#editEquipamento').value=editando.equipamento||''; $('#editNivel').value=editando.nivel||''; $('#editStatus').value=editando.status||'Ativo'; $('#editMidia').value=editando.midia||editando.imagemUrl||editando.videoUrl||''; $('#editTipo').value=editando.tipoMidia||''; $('#editSinonimos').value=(editando.sinonimos||[]).join(', ');
  $('#previewMidia').innerHTML=media(editando);
  $('#modalEditor').classList.remove('hidden');
}

async function salvarEdicao(){
  if(!editando)return;
  const payload={nome:$('#editNome').value,grupo:$('#editGrupo').value,grupoMuscular:$('#editGrupo').value,equipamento:$('#editEquipamento').value,nivel:$('#editNivel').value,status:$('#editStatus').value,midia:$('#editMidia').value,tipoMidia:$('#editTipo').value,sinonimos:$('#editSinonimos').value.split(',').map(s=>s.trim()).filter(Boolean)};
  await j(`${API}/exercicios/${encodeURIComponent(editando.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  $('#modalEditor').classList.add('hidden'); toast('Exercício atualizado.'); await carregar();
}

async function organizar(){
  if(!confirm('Organizar biblioteca agora? Isso atualiza nomes, grupos e caminhos de mídia preservando IDs.')) return;
  const r=await j(`${API}/organizar`,{method:'POST'});
  toast(`Organização concluída. Novos: ${r.resumo?.novos||0}, atualizados: ${r.resumo?.atualizados||0}.`); await carregar();
}
async function validar(){
  const r=await j(`${API}/validar`,{method:'POST'});
  $('#validacao').innerHTML=(r.problemas||[]).length?`<p><b>${r.problemas.length}</b> problema(s) encontrado(s).</p>`+(r.problemas||[]).slice(0,8).map(p=>`<div class="log"><strong>${esc(p.tipo)}</strong><small>${esc(p.id)}</small></div>`).join(''):'<p class="ok">Nenhum problema crítico encontrado.</p>';
  toast('Validação concluída.');
}

$('#btnBuscar').onclick=buscar; $('#busca').addEventListener('keydown',e=>{if(e.key==='Enter')buscar()}); $('#filtroGrupo').onchange=buscar; $('#filtroStatus').onchange=buscar;
$('#btnAtualizar').onclick=organizar; $('#btnOrganizar').onclick=organizar; $('#btnValidar').onclick=validar; $('#btnFechar').onclick=()=>$('#modalEditor').classList.add('hidden'); $('#btnSalvarEdicao').onclick=salvarEdicao;
carregar().catch(e=>toast(e.message,'erro'));
