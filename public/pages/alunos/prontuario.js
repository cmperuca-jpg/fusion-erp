const params = new URLSearchParams(location.search);
const alunoId = params.get('id');
if (!alunoId) {
  alert('Selecione um aluno para abrir o prontuário.');
  location.replace('/pages/alunos/index.html');
}
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

  const dadosAlunoEl = $('#dadosAluno');
  if (dadosAlunoEl) dadosAlunoEl.innerHTML = info({Nome:nomeAluno(a), CPF:a.cpf, RG:a.rg, Nascimento:data(a.data_nascimento), Sexo:a.sexo, Telefone:a.telefone, WhatsApp:a.whatsapp, Email:a.email, Endereço:[a.endereco,a.numero,a.bairro,a.cidade,a.estado].filter(Boolean).join(', '), Objetivo:a.objetivo});
  const dadosMedicosEl = $('#dadosMedicos');
  if (dadosMedicosEl) dadosMedicosEl.innerHTML = info({'Tipo sanguíneo':a.tipo_sanguineo, Peso:a.peso, Altura:a.altura, Alergias:a.alergias, Restrições:a.restricoes_medicas, Medicamentos:a.medicamentos, Lesões:a.lesoes, Observações:a.observacoes});
  renderMensalidades(); renderFinanceiro(); renderMatriculas(); renderContratoComercial(); renderServicosContratados(); renderAvaliacoes(); renderTreinos(); renderCheckins(); renderTimeline();
}
function chip(t,c=''){ return `<span class="chip ${c}">${esc(t)}</span>`; }
function info(obj){ return Object.entries(obj).map(([k,v]) => `<div class="info-item"><span>${esc(k)}</span><strong>${esc(v || '-')}</strong></div>`).join(''); }

function renderMensalidades(){
  const lista = prontuario.mensalidades || [];
  $('#listaMensalidades').innerHTML = lista.length ? lista.map(m=>`<tr><td>${esc(m.competencia||'-')}</td><td>${data(m.vencimento)}</td><td>${moeda(m.total ?? m.valor)}</td><td><span class="badge ${statusClass(m.status)}">${esc(m.status||'-')}</span></td></tr>`).join('') : `<tr><td colspan="4">Nenhuma mensalidade.</td></tr>`;
}
function valorLancamentoFinanceiro(item = {}){
  const status = String(item.status || '').toLowerCase();
  if (['pago','paga','recebido','quitado','baixado'].includes(status)) {
    return item.valorBrutoRecebido ?? item.valorRecebido ?? item.valorPago ?? item.total ?? item.valorOriginal ?? item.valor ?? 0;
  }
  return item.valorOriginal ?? item.valorDevido ?? item.valorBruto ?? item.total ?? item.valor ?? item.valorPlano ?? item.valorMensal ?? item.valorRestante ?? 0;
}

function renderFinanceiro(){
  const lista = prontuario.financeiro || [];
  $('#listaFinanceiro').innerHTML = lista.length ? lista.map(f=>`<tr><td>${esc(f.descricao||'-')}</td><td>${data(f.vencimento || f.data_vencimento)}</td><td>${moeda(valorLancamentoFinanceiro(f))}</td><td><span class="badge ${statusClass(f.status)}">${esc(f.status||'-')}</span></td></tr>`).join('') : `<tr><td colspan="4">Nenhum lançamento.</td></tr>`;
}
function card(t, linhas){ return `<div class="mini-card"><h4>${esc(t)}</h4>${linhas.map(l=>`<p>${l}</p>`).join('')}</div>`; }
function renderMatriculas(){
  const lista = prontuario.matriculas || [];
  $('#listaMatriculas').innerHTML = lista.length ? lista.map(m=>card(m.numero || 'Matrícula', [`Plano: ${esc(m.plano||'-')}`, `Status: ${esc(m.status||'-')}`, `Valor mensal: ${moeda(m.valorMensal)}`, `Vencimento inicial: ${data(m.vencimentoInicial)}`])).join('') : empty('Nenhuma matrícula.');
}

function statusAtivoItem(item = {}){
  const st = String(item.status || item.situacao || item.statusMatricula || '').toLowerCase();
  return !['cancelado','cancelada','inativo','inativa','encerrado','encerrada','suspenso','suspensa'].includes(st);
}

function primeiraMatriculaAtiva(){
  const lista = Array.isArray(prontuario?.matriculas) ? prontuario.matriculas : [];
  return lista.find(statusAtivoItem) || lista[0] || {};
}

function mensalidadeAbertaPrincipal(){
  const lista = Array.isArray(prontuario?.mensalidades) ? prontuario.mensalidades : [];
  const abertas = lista.filter(m => ['aberto','aberta','pendente','parcial','atrasado'].includes(String(m.status||'').toLowerCase()));
  return abertas.sort((a,b)=>String(a.vencimento||'').localeCompare(String(b.vencimento||'')))[0] || {};
}

function ultimoPagamento(){
  const lista = Array.isArray(prontuario?.mensalidades) ? prontuario.mensalidades : [];
  return lista.filter(m => ['pago','paga','recebido','quitado','baixado'].includes(String(m.status||'').toLowerCase()))
    .sort((a,b)=>String(b.dataPagamento || b.pagamento || b.atualizadoEm || '').localeCompare(String(a.dataPagamento || a.pagamento || a.atualizadoEm || '')))[0] || {};
}

function modalidadeLista(aluno = {}, matricula = {}){
  const valores = [];
  const add = (v) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(add);
    else String(v).split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>valores.push(x));
  };
  add(aluno.modalidade); add(aluno.modalidades); add(aluno.modalidadesIncluidas);
  add(matricula.modalidade); add(matricula.modalidades); add(matricula.modalidadesIncluidas);
  add(aluno.plano); add(matricula.plano);
  return [...new Set(valores.filter(Boolean))];
}

function servicosExtrasLista(){
  const fontes = [prontuario?.aluno, primeiraMatriculaAtiva(), ...(prontuario?.mensalidades||[]), ...(prontuario?.financeiro||[])];
  const out = [];
  for (const fonte of fontes) {
    if (!fonte) continue;
    const servicos = fonte.servicos || fonte.servicosContratados || fonte.extras || [];
    if (Array.isArray(servicos)) {
      servicos.forEach(s => out.push(typeof s === 'string' ? s : (s.nome || s.descricao || s.servico || 'Serviço')));
    }
  }
  return [...new Set(out.filter(Boolean))];
}

function contratoInfoBase(){
  const aluno = prontuario?.aluno || {};
  const matricula = primeiraMatriculaAtiva();
  const aberta = mensalidadeAbertaPrincipal();
  const pago = ultimoPagamento();
  const treino = (prontuario?.treinos || [])[0] || {};
  const avaliacao = (prontuario?.avaliacoes || [])[0] || {};
  const valorMensal = matricula.valorMensal ?? matricula.valorPlano ?? aberta.valor ?? aberta.total ?? aluno.valorMensal ?? 0;
  return { aluno, matricula, aberta, pago, treino, avaliacao, valorMensal };
}

function renderContratoComercial(){
  const el = $('#contratoComercialResumo');
  if (!el) return;
  const { aluno, matricula, aberta, pago, valorMensal } = contratoInfoBase();
  el.innerHTML = info({
    'Plano contratado': matricula.plano || aluno.plano || '-',
    'Valor mensal': moeda(valorMensal),
    'Matrícula': matricula.status || aluno.statusMatricula || '-',
    'Próximo vencimento': data(aberta.vencimento || prontuario?.resumoFinanceiro?.proximoVencimento),
    'Renovação': (matricula.renovacaoAutomatica === false || aluno.renovacaoAutomatica === false) ? 'Manual' : 'Automática',
    'Último pagamento': data(pago.dataPagamento || pago.pagamento || pago.baixadoEm),
    'Situação financeira': aberta.status || 'Sem aberto'
  });
}

function listaHtml(titulo, itens){
  const lista = itens.filter(Boolean);
  return `<div class="mini-card"><h4>${esc(titulo)}</h4>${lista.length ? lista.map(i=>`<p>${i}</p>`).join('') : '<p>-</p>'}</div>`;
}

function renderServicosContratados(){
  const box = $('#servicosChecklist');
  const totalBox = $('#contratoTotalBox');
  if (!box) return;
  const { aluno, matricula, aberta, pago, treino, avaliacao, valorMensal } = contratoInfoBase();
  const modalidades = modalidadeLista(aluno, matricula);
  const extras = servicosExtrasLista();
  const exercicios = exerciciosDoTreino(treino);
  box.innerHTML = [
    listaHtml('Plano contratado', [
      `Plano: ${esc(matricula.plano || aluno.plano || '-')}`,
      `Valor: ${moeda(valorMensal)}/mês`,
      `Matrícula: ${esc(matricula.status || aluno.statusMatricula || '-')}`,
      `Vencimento: ${data(aberta.vencimento || prontuario?.resumoFinanceiro?.proximoVencimento)}`,
      `Renovação: ${(matricula.renovacaoAutomatica === false || aluno.renovacaoAutomatica === false) ? 'Manual' : 'Automática'}`
    ]),
    listaHtml('Modalidades', modalidades.map(m => `• ${esc(m)}`)),
    listaHtml('Serviços extras', extras.length ? extras.map(s => `• ${esc(s)}`) : ['Nenhum serviço extra contratado.']),
    listaHtml('Professor responsável', [
      `Nome: ${esc(aluno.professorNome || aluno.professor_responsavel || matricula.professorNome || '-')}`,
      `CREF: ${esc(aluno.cref || matricula.cref || '-')}`,
      `Horário: ${esc(aluno.horarioProfessor || matricula.horario || '-')}`
    ]),
    listaHtml('Turma', [
      `Turma: ${esc(aluno.turma || matricula.turma || '-')}`,
      `Dias: ${esc(aluno.diasSemana || matricula.diasSemana || '-')}`,
      `Horário: ${esc(aluno.horario || matricula.horario || '-')}`
    ]),
    listaHtml('Avaliação física e treino', [
      `Última avaliação: ${data(avaliacao.data || avaliacao.criadoEm || prontuario?.indicadores?.ultimaAvaliacao)}`,
      `Treino: ${treino.id ? 'Ativo' : 'Não localizado'}`,
      `Objetivo: ${esc(treino.objetivo || aluno.objetivo || '-')}`,
      `Exercícios: ${exercicios.length}`
    ]),
    listaHtml('Benefícios', ['Portal do Aluno', 'Portal Professor', 'Check-in ativo'].map(x => `✓ ${x}`)),
    listaHtml('Resumo financeiro', [
      `Valor mensal: ${moeda(valorMensal)}`,
      `Próximo vencimento: ${data(aberta.vencimento || prontuario?.resumoFinanceiro?.proximoVencimento)}`,
      `Situação: ${esc(aberta.status || '-')}`,
      `Último pagamento: ${data(pago.dataPagamento || pago.pagamento || pago.baixadoEm)}`
    ])
  ].join('');
  if (totalBox) totalBox.innerHTML = `<strong>Total mensal:</strong> ${moeda(valorMensal)} <span>Base: matrícula, mensalidades e financeiro do aluno.</span>`;
}

function renderAvaliacoes(){
  const lista = prontuario.avaliacoes || [];
  $('#listaAvaliacoes').innerHTML = lista.length ? lista.map(a=>card(`Avaliação ${data(a.data || a.criado_em)}`, [`Peso: ${esc(a.peso||'-')}`, `Altura: ${esc(a.altura||'-')}`, `IMC: ${esc(a.imc||'-')}`, `Objetivo: ${esc(a.objetivo||'-')}`])).join('') : empty('Nenhuma avaliação física.');
}
function exerciciosDoTreino(t = {}){
  if (Array.isArray(t.exercicios) && t.exercicios.length) return t.exercicios;

  if (Array.isArray(t.divisoes)) {
    return t.divisoes.flatMap(divisao => {
      if (Array.isArray(divisao.itens)) return divisao.itens;
      if (Array.isArray(divisao.exercicios)) return divisao.exercicios;
      return [];
    });
  }

  if (Array.isArray(t.grupos)) {
    return t.grupos.flatMap(grupo => {
      if (Array.isArray(grupo.exercicios)) return grupo.exercicios;
      if (Array.isArray(grupo.itens)) return grupo.itens;
      return [];
    });
  }

  return [];
}

function divisoesDoTreino(t = {}){
  if (Array.isArray(t.divisoes) && t.divisoes.length) return t.divisoes;
  if (Array.isArray(t.grupos) && t.grupos.length) return t.grupos;
  if (Array.isArray(t.exercicios) && t.exercicios.length) return [{ nome: 'Treino', itens: t.exercicios }];
  return [];
}

function resumoDivisoesTreino(t = {}){
  const divisoes = divisoesDoTreino(t);
  if (!divisoes.length) return '';
  return divisoes.map((divisao, index) => {
    const nome = divisao.nome || divisao.name || String.fromCharCode(65 + index);
    const itens = Array.isArray(divisao.itens) ? divisao.itens : (Array.isArray(divisao.exercicios) ? divisao.exercicios : []);
    return `${esc(nome)}: ${itens.length}`;
  }).join(' · ');
}

function renderTreinos(){
  const lista = prontuario.treinos || [];
  $('#listaTreinos').innerHTML = lista.length ? lista.map(t=>{
    const exercicios = exerciciosDoTreino(t);
    const divisoes = resumoDivisoesTreino(t);
    const validade = t.validade || t.dataValidade || t.data_validade || '';
    const professor = t.professorNome || t.professor || '';
    const linhas = [
      `Objetivo: ${esc(t.objetivo||'-')}`,
      `Status: ${esc(t.status || (t.ativo === false ? 'inativo' : 'ativo'))}`,
      `Exercícios: ${exercicios.length}`,
      divisoes ? `Divisões: ${divisoes}` : '',
      professor ? `Professor: ${esc(professor)}` : '',
      validade ? `Validade: ${data(validade)}` : ''
    ].filter(Boolean);
    return card(t.nome || 'Treino', linhas);
  }).join('') : empty('Nenhum treino vinculado.');
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
  const btnContrato = $('#btnSalvarChecklistComercial');
  if (btnContrato) btnContrato.addEventListener('click',()=> alerta('Contrato comercial atualizado com os dados já vinculados ao aluno.', 'sucesso'));

  const abaInicial = document.querySelector('[data-tab="servicos-contratados"]');
  if (abaInicial) abaInicial.click();
  carregar();
});
