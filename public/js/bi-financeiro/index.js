const API_BI_FINANCEIRO = '/api/financeiro/relatorios/bi-financeiro';
let ultimoBI = null;
const graficos = {};

function moeda(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function numero(valor) { const n = Number(String(valor ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setTexto(id, valor) { const el = document.getElementById(id); if (el) el.textContent = valor; }
function valor(id) { return document.getElementById(id)?.value || ''; }
function setValor(id, v) { const el = document.getElementById(id); if (el) el.value = v || ''; }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function statusAnalitico(linha) {
  if (linha.realizado) return 'realizado';
  if (linha.vencimento && linha.vencimento < hojeISO()) return 'vencido';
  return 'aberto';
}
function paramsFiltro() {
  const p = new URLSearchParams();
  if (valor('filtroInicio')) p.set('inicio', valor('filtroInicio'));
  if (valor('filtroFim')) p.set('fim', valor('filtroFim'));
  return p.toString();
}
function linhasFiltradasLocal() {
  const tipo = valor('filtroTipo');
  const status = valor('filtroStatus');
  return (ultimoBI?.linhas || []).filter((l) => {
    if (tipo && l.tipo !== tipo) return false;
    if (status && statusAnalitico(l) !== status) return false;
    return true;
  });
}
function aplicarResumo(resumo = {}, linhas = []) {
  const receitas = linhas.filter(l => l.tipo === 'receita');
  const despesas = linhas.filter(l => l.tipo === 'despesa');
  const recebidas = receitas.filter(l => l.realizado);
  const hoje = hojeISO();
  const recebido = receitas.filter(l => l.realizado).reduce((s, l) => s + numero(l.valorRealizado || l.valor), 0);
  const receber = receitas.filter(l => !l.realizado).reduce((s, l) => s + numero(l.valor), 0);
  const pago = despesas.filter(l => l.realizado).reduce((s, l) => s + numero(l.valorRealizado || l.valor), 0);
  const pagar = despesas.filter(l => !l.realizado).reduce((s, l) => s + numero(l.valor), 0);
  const vencidoReceber = receitas.filter(l => !l.realizado && l.vencimento && l.vencimento < hoje).reduce((s, l) => s + numero(l.valor), 0);
  const vencidoPagar = despesas.filter(l => !l.realizado && l.vencimento && l.vencimento < hoje).reduce((s, l) => s + numero(l.valor), 0);
  const taxas = linhas.reduce((s, l) => s + numero(l.taxa || l.taxaOperadoraValor || 0), 0);
  setTexto('kpiRecebido', moeda(recebido || resumo.recebido));
  setTexto('kpiReceber', moeda(receber || resumo.receber));
  setTexto('kpiPago', moeda(pago || resumo.pago));
  setTexto('kpiPagar', moeda(pagar || resumo.pagar));
  setTexto('kpiVencidoReceber', moeda(vencidoReceber || resumo.vencidoReceber));
  setTexto('kpiVencidoPagar', moeda(vencidoPagar || resumo.vencidoPagar));
  setTexto('kpiSaldoRealizado', moeda((recebido - pago) || resumo.saldoRealizado));
  setTexto('kpiSaldoPrevisto', moeda(((recebido + receber) - (pago + pagar)) || resumo.saldoPrevisto));
  setTexto('kpiTicketMedio', moeda(recebidas.length ? recebido / recebidas.length : 0));
  setTexto('kpiTaxas', moeda(taxas || resumo.taxasFinanceiras || 0));
  setTexto('kpiQtdReceitas', String(receitas.length));
  setTexto('kpiQtdDespesas', String(despesas.length));
}
function destruirGrafico(id) { if (graficos[id]) { graficos[id].destroy(); delete graficos[id]; } }
function semDadosGrafico(id) { destruirGrafico(id); const canvas = document.getElementById(id); if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
function graficoBarras(id, labels, valores, label) {
  const canvas = document.getElementById(id); if (!canvas || !window.Chart) return;
  if (!labels.length) return semDadosGrafico(id);
  destruirGrafico(id);
  graficos[id] = new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ label, data: valores }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
}
function graficoPizza(id, labels, valores) {
  const canvas = document.getElementById(id); if (!canvas || !window.Chart) return;
  if (!labels.length) return semDadosGrafico(id);
  destruirGrafico(id);
  graficos[id] = new Chart(canvas, { type: 'doughnut', data: { labels, datasets: [{ data: valores }] }, options: { responsive: true, maintainAspectRatio: false } });
}
function graficoFluxo(id, dados) {
  const canvas = document.getElementById(id); if (!canvas || !window.Chart) return;
  if (!dados.length) return semDadosGrafico(id);
  destruirGrafico(id);
  graficos[id] = new Chart(canvas, { type: 'line', data: { labels: dados.map(x => x.mes), datasets: [{ label: 'Receitas', data: dados.map(x => x.receitas) }, { label: 'Despesas', data: dados.map(x => x.despesas) }, { label: 'Saldo', data: dados.map(x => x.saldo) }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
}
function agrupar(linhas, chaveFn, valorFn) {
  const mapa = new Map();
  for (const l of linhas) {
    const chave = chaveFn(l) || 'Sem informação';
    mapa.set(chave, Number((numero(mapa.get(chave)) + numero(valorFn(l))).toFixed(2)));
  }
  return [...mapa.entries()].map(([chave, valor]) => ({ chave, valor })).sort((a, b) => a.chave.localeCompare(b.chave));
}
function aplicarGraficos(linhas) {
  const receitas = linhas.filter(l => l.tipo === 'receita');
  const despesas = linhas.filter(l => l.tipo === 'despesa');
  const receitasMes = agrupar(receitas, l => String(l.data || l.vencimento || '').slice(0, 7), l => l.realizado ? (l.valorRealizado || l.valor) : l.valor);
  const despesasMes = agrupar(despesas, l => String(l.data || l.vencimento || '').slice(0, 7), l => l.realizado ? (l.valorRealizado || l.valor) : l.valor);
  const meses = [...new Set([...receitasMes.map(x => x.chave), ...despesasMes.map(x => x.chave)])].sort();
  const fluxo = meses.map(mes => {
    const r = receitasMes.find(x => x.chave === mes)?.valor || 0;
    const d = despesasMes.find(x => x.chave === mes)?.valor || 0;
    return { mes, receitas: r, despesas: d, saldo: Number((r - d).toFixed(2)) };
  });
  const status = agrupar(linhas, l => l.realizado ? (l.tipo === 'receita' ? 'Recebido' : 'Pago') : (statusAnalitico(l) === 'vencido' ? 'Vencido' : 'Aberto'), l => l.realizado ? (l.valorRealizado || l.valor) : l.valor);
  const receitaCat = agrupar(receitas, l => l.categoria, l => l.realizado ? (l.valorRealizado || l.valor) : l.valor).sort((a, b) => b.valor - a.valor).slice(0, 10);
  const despesaCat = agrupar(despesas, l => l.categoria, l => l.realizado ? (l.valorRealizado || l.valor) : l.valor).sort((a, b) => b.valor - a.valor).slice(0, 10);
  graficoBarras('graficoReceitas', receitasMes.map(x => x.chave), receitasMes.map(x => x.valor), 'Receitas');
  graficoBarras('graficoDespesas', despesasMes.map(x => x.chave), despesasMes.map(x => x.valor), 'Despesas');
  graficoFluxo('graficoFluxo', fluxo);
  graficoPizza('graficoStatus', status.map(x => x.chave), status.map(x => x.valor));
  graficoPizza('graficoReceitaCategoria', receitaCat.map(x => x.chave), receitaCat.map(x => x.valor));
  graficoPizza('graficoDespesaCategoria', despesaCat.map(x => x.chave), despesaCat.map(x => x.valor));
}
function tabelaLinhas(id, linhas, limite = 20) {
  const el = document.getElementById(id); if (!el) return;
  const dados = linhas.slice(0, limite);
  if (!dados.length) { el.innerHTML = '<p class="bi-empty">Nenhum registro encontrado.</p>'; return; }
  el.innerHTML = `<div class="bi-table-wrap"><table class="bi-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Pessoa</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${dados.map(l => `<tr><td>${esc(l.vencimento || l.data || '-')}</td><td><span class="bi-badge ${esc(l.tipo)}">${l.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></td><td>${esc(l.descricao || '-')}</td><td>${esc(l.pessoa || '-')}</td><td>${esc(l.categoria || '-')}</td><td><strong>${moeda(l.realizado ? (l.valorRealizado || l.valor) : l.valor)}</strong></td></tr>`).join('')}</tbody></table></div>`;
}
function aplicarTabelas(linhas) {
  const hoje = hojeISO();
  const vencidos = linhas.filter(l => !l.realizado && l.vencimento && l.vencimento < hoje).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  const topReceitas = linhas.filter(l => l.tipo === 'receita').sort((a, b) => numero(b.valorRealizado || b.valor) - numero(a.valorRealizado || a.valor));
  const movimentos = [...linhas].sort((a, b) => String(b.data || b.vencimento || '').localeCompare(String(a.data || a.vencimento || '')));
  tabelaLinhas('tabelaVencidos', vencidos, 20);
  tabelaLinhas('tabelaTopReceitas', topReceitas, 20);
  tabelaLinhas('tabelaMovimentos', movimentos, 50);
}
function aplicarTela() {
  const linhas = linhasFiltradasLocal();
  aplicarResumo(ultimoBI?.resumo || {}, linhas);
  aplicarGraficos(linhas);
  aplicarTabelas(linhas);
}
async function carregarDashboard() {
  try {
    const qs = paramsFiltro();
    const resp = await fetch(`${API_BI_FINANCEIRO}${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
    const json = resp.ok ? await resp.json().catch(() => ({})) : {};
    if (!resp.ok || json.ok === false) throw new Error(json.mensagem || `Erro HTTP ${resp.status}`);
    ultimoBI = json;
    aplicarTela();
  } catch (erro) {
    console.error(erro);
    alert(erro.message || 'Erro ao carregar BI Financeiro.');
  }
}
function limparFiltros() {
  setValor('filtroInicio', ''); setValor('filtroFim', ''); setValor('filtroTipo', ''); setValor('filtroStatus', ''); carregarDashboard();
}
function exportarCSV() {
  const linhas = linhasFiltradasLocal();
  if (!linhas.length) return alert('Não há dados para exportar.');
  const cab = ['origem', 'tipo', 'status', 'data', 'vencimento', 'descricao', 'pessoa', 'categoria', 'valor', 'valorRealizado'];
  const csv = [cab.join(';'), ...linhas.map(l => cab.map(c => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'bi-financeiro.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
window.carregarDashboard = carregarDashboard; window.limparFiltros = limparFiltros; window.exportarCSV = exportarCSV;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAtualizarBI')?.addEventListener('click', carregarDashboard);
  document.getElementById('btnLimparBI')?.addEventListener('click', limparFiltros);
  document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV);
  document.getElementById('filtroTipo')?.addEventListener('change', aplicarTela);
  document.getElementById('filtroStatus')?.addEventListener('change', aplicarTela);
  carregarDashboard();
});
