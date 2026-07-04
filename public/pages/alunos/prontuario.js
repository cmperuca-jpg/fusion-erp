const params = new URLSearchParams(location.search);
const alunoId = params.get('id');
let prontuario = null;

const $ = (s) => document.querySelector(s);

function moeda(v){ return Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function data(v){ if(!v) return '-'; const s=String(v).slice(0,10); const [a,m,d]=s.split('-'); return a&&m&&d ? `${d}/${m}/${a}` : s; }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function statusClass(st){ const s=String(st||'').toLowerCase(); if(['pago','recebido','ativo','ativa'].includes(s)) return 'ok'; if(['aberto','aberta','pendente','parcial'].includes(s)) return 'warn'; if(['cancelado','inativo','bloqueado'].includes(s)) return 'bad'; return ''; }
function nomeAluno(a){ return a?.nome || a?.aluno || a?.name || 'Aluno'; }

function alerta(msg,tipo='erro'){
  const el=$('#alerta'); el.textContent=msg; el.className=`alunos-alert ${tipo}`; el.classList.remove('hidden');
}

async function carregar(){
  if(!alunoId){ alerta('ID do aluno não informado.'); return; }
  try{
    const resp = await fetch(`/api/alunos/${encodeURIComponent(alunoId)}/prontuario`, {cache:'no-store'});
    const json = await resp.json().catch(()=>({}));
    if(!resp.ok || json.ok === false) throw new Error(json.mensagem || json.erro || `Erro HTTP ${resp.status}`);
    prontuario = json;
    render();
  }catch(e){ alerta(e.message || 'Erro ao carregar prontuário.'); }
}

function render(){
  const a = prontuario.aluno || {};
  $('#nomeAluno').textContent = nomeAluno(a);
  $('#subtituloAluno').textContent = `${a.cpf ? 'CPF '+a.cpf+' · ' : ''}${a.telefone || a.whatsapp || ''}`;
  $('#fotoAluno').innerHTML = (a.foto_base64 || a.foto) ? `<img src="${esc(a.foto_base64 || a.foto)}" alt="Foto do aluno">` : 'Foto';
  $('#chipsAluno').innerHTML = [
    chip(`Status: ${a.status || '-'}`, statusClass(a.status)),
    chip(`Matrícula: ${a.statusMatricula || '-'}`, statusClass(a.statusMatricula)),
    chip(`Plano: ${a.plano || '-'}`),
    chip(`Professor: ${a.professor_responsavel || '-'}`)
  ].join('');

  const rf = prontuario.resumoFinanceiro || {};
  $('#kpiProximo').textContent = data(rf.proximoVencimento);
  $('#kpiAberto').textContent = moeda(rf.valorAberto);
  $('#kpiPago').textContent = moeda(rf.valorPago);
  $('#kpiAvaliacao').textContent = data(prontuario.indicadores?.ultimaAvaliacao);

  $('#dadosAluno').innerHTML = info({Nome:nomeAluno(a), CPF:a.cpf, RG:a.rg, Nascimento:data(a.data_nascimento), Sexo:a.sexo, Telefone:a.telefone, WhatsApp:a.whatsapp, Email:a.email, Endereço:[a.endereco,a.numero,a.bairro,a.cidade,a.estado].filter(Boolean).join(', '), Objetivo:a.objetivo});
  $('#dadosMedicos').innerHTML = info({'Tipo sanguíneo':a.tipo_sanguineo, Peso:a.peso, Altura:a.altura, Alergias:a.alergias, Restrições:a.restricoes_medicas, Medicamentos:a.medicamentos, Lesões:a.lesoes, Observações:a.observacoes});
  renderMensalidades(); renderFinanceiro(); renderMatriculas(); renderAvaliacoes(); renderTreinos(); renderCheckins(); renderTimeline();
}
function chip(t,c=''){ return `<span class="chip ${c}">${esc(t)}</span>`; }
function info(obj){ return Object.entries(obj).map(([k,v]) => `<div class="info-item"><span>${esc(k)}</span><strong>${esc(v || '-')}</strong></div>`).join(''); }

function renderMensalidades(){
  const lista = prontuario.mensalidades || [];
  $('#listaMensalidades').innerHTML = lista.length ? lista.map(m=>`<tr><td>${esc(m.competencia||'-')}</td><td>${data(m.vencimento)}</td><td>${moeda(m.total ?? m.valor)}</td><td><span class="badge ${statusClass(m.status)}">${esc(m.status||'-')}</span></td></tr>`).join('') : `<tr><td colspan="4">Nenhuma mensalidade.</td></tr>`;
}
function renderFinanceiro(){
  const lista = prontuario.financeiro || [];
  $('#listaFinanceiro').innerHTML = lista.length ? lista.map(f=>`<tr><td>${esc(f.descricao||'-')}</td><td>${data(f.vencimento)}</td><td>${moeda(f.valorBrutoRecebido ?? f.valorPago ?? f.valor)}</td><td><span class="badge ${statusClass(f.status)}">${esc(f.status||'-')}</span></td></tr>`).join('') : `<tr><td colspan="4">Nenhum lançamento.</td></tr>`;
}
function card(t, linhas){ return `<div class="mini-card"><h4>${esc(t)}</h4>${linhas.map(l=>`<p>${l}</p>`).join('')}</div>`; }
function renderMatriculas(){
  const lista = prontuario.matriculas || [];
  $('#listaMatriculas').innerHTML = lista.length ? lista.map(m=>card(m.numero || 'Matrícula', [`Plano: ${esc(m.plano||'-')}`, `Status: ${esc(m.status||'-')}`, `Valor mensal: ${moeda(m.valorMensal)}`, `Vencimento inicial: ${data(m.vencimentoInicial)}`])).join('') : empty('Nenhuma matrícula.');
}
function renderAvaliacoes(){
  const lista = prontuario.avaliacoes || [];
  $('#listaAvaliacoes').innerHTML = lista.length ? lista.map(a=>card(`Avaliação ${data(a.data || a.criado_em)}`, [`Peso: ${esc(a.peso||'-')}`, `Altura: ${esc(a.altura||'-')}`, `IMC: ${esc(a.imc||'-')}`, `Objetivo: ${esc(a.objetivo||'-')}`])).join('') : empty('Nenhuma avaliação física.');
}
function renderTreinos(){
  const lista = prontuario.treinos || [];
  $('#listaTreinos').innerHTML = lista.length ? lista.map(t=>card(t.nome || 'Treino', [`Objetivo: ${esc(t.objetivo||'-')}`, `Status: ${esc(t.status||'-')}`, `Exercícios: ${Array.isArray(t.exercicios)?t.exercicios.length:0}`])).join('') : empty('Nenhum treino vinculado.');
}
function renderCheckins(){
  const lista = prontuario.checkins || [];
  $('#listaCheckins').innerHTML = lista.length ? lista.map(c=>card(`Check-in ${data(c.data || c.criadoEm)}`, [`Status: ${esc(c.status||'-')}`, `Plano: ${esc(c.plano||'-')}`, `Modalidade: ${esc(c.modalidade||'-')}`])).join('') : empty('Nenhum check-in.');
}
function renderTimeline(){
  const lista = prontuario.linhaDoTempo || [];
  $('#linhaTempo').innerHTML = lista.length ? lista.map(i=>`<div class="timeline-row"><time>${data(i.data)}</time><div><strong>${esc(i.titulo||'-')}</strong><p>${esc(i.descricao||'')}</p></div></div>`).join('') : empty('Nenhum evento na linha do tempo.');
}
function empty(t){ return `<div class="empty">${esc(t)}</div>`; }

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b===btn));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
  }));
  $('#btnEditar').addEventListener('click',()=> location.href='/pages/alunos/index.html');
  $('#btnImprimir').addEventListener('click',()=> window.print());
  carregar();
});
