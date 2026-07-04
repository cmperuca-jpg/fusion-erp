const $ = (s) => document.querySelector(s);
function hojeISO(){ return new Date().toISOString().slice(0,10); }
function moeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function html(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function linhaVazia(colspan, texto='Nenhum registro encontrado.'){
  return `<tr><td class="vazio" colspan="${colspan}">${texto}</td></tr>`;
}

function renderResumo(resumo){
  const itens = [
    ['Saldo inicial', resumo.saldoInicial],
    ['Recebido bruto', resumo.totalBrutoRecebido],
    ['Taxas', resumo.totalTaxas],
    ['Receita líquida', resumo.totalLiquidoRecebido],
    ['Saídas', resumo.totalPagamentos],
    ['Saldo final', resumo.saldoFinal]
  ];
  $('#resumoCards').innerHTML = itens.map(([t,v]) => `<div class="kpi"><small>${t}</small><strong>${moeda(v)}</strong></div>`).join('');
}

function renderPorForma(lista){
  $('#porForma').innerHTML = lista.length ? lista.map(i => `<tr><td>${html(i.forma)}</td><td>${i.quantidade}</td><td>${moeda(i.bruto)}</td><td>${moeda(i.taxa)}</td><td><strong>${moeda(i.liquido)}</strong></td></tr>`).join('') : linhaVazia(5);
}

function renderPorCategoria(lista){
  $('#porCategoria').innerHTML = lista.length ? lista.map(i => `<tr><td>${html(i.categoria)}</td><td>${i.quantidade}</td><td>${moeda(i.bruto)}</td><td>${moeda(i.taxa)}</td><td><strong>${moeda(i.liquido)}</strong></td></tr>`).join('') : linhaVazia(5);
}

function renderRecebimentos(lista){
  $('#recebimentos').innerHTML = lista.length ? lista.map(r => `<tr><td>${html(r.hora || '-')}</td><td>${html(r.cliente || '-')}</td><td>${html(r.descricao)}</td><td>${html(r.categoria)}</td><td>${html(r.formaPagamento)}</td><td>${moeda(r.bruto)}</td><td>${moeda(r.taxa)}</td><td><strong>${moeda(r.liquido)}</strong></td></tr>`).join('') : linhaVazia(8);
}

function renderPagamentos(lista){
  $('#pagamentos').innerHTML = lista.length ? lista.map(p => `<tr><td>${html(p.hora || '-')}</td><td>${html(p.pessoa || '-')}</td><td>${html(p.descricao)}</td><td>${html(p.categoria)}</td><td>${html(p.formaPagamento)}</td><td><strong>${moeda(p.valor)}</strong></td></tr>`).join('') : linhaVazia(6);
}

async function gerar(){
  const params = new URLSearchParams();
  params.set('dataInicio', $('#dataInicio').value || hojeISO());
  params.set('dataFim', $('#dataFim').value || $('#dataInicio').value || hojeISO());
  if ($('#formaPagamento').value) params.set('formaPagamento', $('#formaPagamento').value);
  if ($('#categoria').value.trim()) params.set('categoria', $('#categoria').value.trim());
  const resp = await fetch(`/api/financeiro/relatorios/movimento-diario?${params.toString()}`, { cache:'no-store' });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.ok === false) return alert(json.mensagem || `Erro HTTP ${resp.status}`);
  renderResumo(json.resumo || {});
  renderPorForma(json.porForma || []);
  renderRecebimentos(json.recebimentos || []);
  renderPagamentos(json.pagamentos || []);
  renderPorCategoria(json.porCategoria || []);
}

$('#dataInicio').value = hojeISO();
$('#dataFim').value = hojeISO();
$('#btnGerar').addEventListener('click', gerar);
$('#btnImprimir').addEventListener('click', () => window.print());
gerar();
