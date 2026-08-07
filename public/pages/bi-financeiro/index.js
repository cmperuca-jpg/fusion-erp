const API_BI_FINANCEIRO = '/api/financeiro/relatorios/bi-financeiro';
let ultimoBI = null;
const graficos = {};
const chartTextColor = '#d9eef2';
const chartMutedColor = 'rgba(217, 238, 242, 0.62)';
const chartGridColor = 'rgba(217, 238, 242, 0.12)';
const chartPalette = ['#38bdf8', '#fb7185', '#f59e0b', '#34d399', '#a78bfa', '#f97316'];

function moeda(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function numero(valor) { const n = Number(String(valor ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setTexto(id, valor) { const el = document.getElementById(id); if (el) el.textContent = valor; }
function valor(id) { return document.getElementById(id)?.value || ''; }
function setValor(id, v) { const el = document.getElementById(id); if (el) el.value = v || ''; }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function statusAnalitico(linha) {
  if (linha.programado) return 'programado';
  if (linha.parcial) return 'parcial';
  if (linha.realizado) return 'realizado';
  if (linha.vencimento && linha.vencimento < hojeISO()) return 'vencido';
  return 'aberto';
}

function valorLinha(linha = {}) {
  return numero(linha.realizado
    ? (linha.valorRealizado ?? linha.valor)
    : (linha.valorPendente ?? linha.valor));
}

function resumoCanonicoDasLinhas(linhas = []) {
  const hoje = hojeISO();
  const base = linhas.filter(l => !l.componenteParcialRealizado);
  const receitas = base.filter(l => l.tipo === 'receita');
  const despesas = base.filter(l => l.tipo === 'despesa');

  const receitasAbertas = receitas.filter(l => !l.realizado && !l.programado);
  const despesasAbertas = despesas.filter(l => !l.realizado && !l.programado);
  const receitasProgramadas = receitas.filter(l => !l.realizado && l.programado);
  const despesasProgramadas = despesas.filter(l => !l.realizado && l.programado);

  const recebido = receitas.filter(l => l.realizado).reduce((s, l) => s + valorLinha(l), 0);
  const receber = receitasAbertas.reduce((s, l) => s + valorLinha(l), 0);
  const pago = despesas.filter(l => l.realizado).reduce((s, l) => s + valorLinha(l), 0);
  const pagar = despesasAbertas.reduce((s, l) => s + valorLinha(l), 0);
  const programadoReceber = receitasProgramadas.reduce((s, l) => s + valorLinha(l), 0);
  const programadoPagar = despesasProgramadas.reduce((s, l) => s + valorLinha(l), 0);
  const vencidoReceber = receitasAbertas.filter(l => l.vencimento && l.vencimento < hoje).reduce((s, l) => s + valorLinha(l), 0);
  const vencidoPagar = despesasAbertas.filter(l => l.vencimento && l.vencimento < hoje).reduce((s, l) => s + valorLinha(l), 0);
  const taxasFinanceiras = linhas.filter(l => l.realizado).reduce((s, l) => s + numero(l.taxa || l.taxaOperadoraValor || 0), 0);

  return {
    recebido, receber, pago, pagar, programadoReceber, programadoPagar,
    vencidoReceber, vencidoPagar, taxasFinanceiras,
    saldoRealizado: recebido - pago,
    saldoPrevisto: (recebido + receber + programadoReceber) - (pago + pagar + programadoPagar)
  };
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
  const filtroLocalAtivo = Boolean(valor('filtroTipo') || valor('filtroStatus'));
  const calculado = resumoCanonicoDasLinhas(linhas);
  const r = filtroLocalAtivo ? calculado : resumo;

  const base = linhas.filter(l => !l.componenteParcialRealizado);
  const receitas = base.filter(l => l.tipo === 'receita');
  const despesas = base.filter(l => l.tipo === 'despesa');
  const recebidas = receitas.filter(l => l.realizado);
  const recebidoTicket = recebidas.reduce((s, l) => s + valorLinha(l), 0);

  setTexto('kpiRecebido', moeda(r.recebido ?? 0));
  setTexto('kpiReceber', moeda(r.receber ?? 0));
  setTexto('kpiPago', moeda(r.pago ?? 0));
  setTexto('kpiPagar', moeda(r.pagar ?? 0));
  setTexto('kpiVencidoReceber', moeda(r.vencidoReceber ?? 0));
  setTexto('kpiVencidoPagar', moeda(r.vencidoPagar ?? 0));
  setTexto('kpiSaldoRealizado', moeda(r.saldoRealizado ?? 0));
  setTexto('kpiSaldoPrevisto', moeda(r.saldoPrevisto ?? 0));
  setTexto('kpiTicketMedio', moeda(recebidas.length ? recebidoTicket / recebidas.length : 0));
  setTexto('kpiTaxas', moeda(r.taxasFinanceiras ?? 0));
  setTexto('kpiQtdReceitas', String(filtroLocalAtivo ? receitas.length : (resumo.qtdReceitas ?? receitas.length)));
  setTexto('kpiQtdDespesas', String(filtroLocalAtivo ? despesas.length : (resumo.qtdDespesas ?? despesas.length)));
}
function destruirGrafico(id) { if (graficos[id]) { graficos[id].destroy(); delete graficos[id]; } }
function semDadosGrafico(id) { destruirGrafico(id); const canvas = document.getElementById(id); if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
function opcoesEscala(beginAtZero = true) {
  return {
    x: { ticks: { color: chartMutedColor }, grid: { color: 'transparent' } },
    y: { beginAtZero, ticks: { color: chartMutedColor }, grid: { color: chartGridColor } }
  };
}
function opcoesLegenda(display = true) {
  return { display, labels: { color: chartTextColor, boxWidth: 13, boxHeight: 13 } };
}
function graficoBarras(id, labels, valores, label) {
  const canvas = document.getElementById(id); if (!canvas || !window.Chart) return;
  if (!labels.length) return semDadosGrafico(id);
  destruirGrafico(id);
  graficos[id] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label, data: valores, backgroundColor: '#2f9ed2', borderColor: '#7dd3fc', borderWidth: 1, borderRadius: 3, maxBarThickness: 48 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: opcoesLegenda(false), tooltip: { titleColor: chartTextColor, bodyColor: chartTextColor } }, scales: opcoesEscala(true) }
  });
}
function graficoPizza(id, labels, valores) {
  const canvas = document.getElementById(id); if (!canvas || !window.Chart) return;
  if (!labels.length) return semDadosGrafico(id);
  destruirGrafico(id);
  graficos[id] = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => chartPalette[i % chartPalette.length]), borderColor: '#0a2731', borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: opcoesLegenda(true), tooltip: { titleColor: chartTextColor, bodyColor: chartTextColor } } }
  });
}
function graficoFluxo(id, dados) {
  const canvas = document.getElementById(id); if (!canvas || !window.Chart) return;
  if (!dados.length) return semDadosGrafico(id);
  destruirGrafico(id);
  graficos[id] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(x => x.mes),
      datasets: [
        { label: 'Receitas', data: dados.map(x => x.receitas), borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.12)', tension: 0.28, pointRadius: 3 },
        { label: 'Despesas', data: dados.map(x => x.despesas), borderColor: '#fb7185', backgroundColor: 'rgba(251, 113, 133, 0.12)', tension: 0.28, pointRadius: 3 },
        { label: 'Saldo', data: dados.map(x => x.saldo), borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', tension: 0.28, pointRadius: 3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: opcoesLegenda(true), tooltip: { titleColor: chartTextColor, bodyColor: chartTextColor } }, scales: opcoesEscala(true) }
  });
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
  const operacionais = linhas.filter(l => !l.programado);
  const receitas = operacionais.filter(l => l.tipo === 'receita');
  const despesas = operacionais.filter(l => l.tipo === 'despesa');
  const receitasMes = agrupar(receitas, l => String(l.data || l.vencimento || '').slice(0, 7), valorLinha);
  const despesasMes = agrupar(despesas, l => String(l.data || l.vencimento || '').slice(0, 7), valorLinha);
  const meses = [...new Set([...receitasMes.map(x => x.chave), ...despesasMes.map(x => x.chave)])].sort();
  const fluxo = meses.map(mes => {
    const r = receitasMes.find(x => x.chave === mes)?.valor || 0;
    const d = despesasMes.find(x => x.chave === mes)?.valor || 0;
    return { mes, receitas: r, despesas: d, saldo: Number((r - d).toFixed(2)) };
  });
  const status = agrupar(
    linhas.filter(l => !l.componenteParcialRealizado),
    l => l.programado ? 'Programado' : (l.parcial ? 'Parcial' : (l.realizado ? (l.tipo === 'receita' ? 'Recebido' : 'Pago') : (statusAnalitico(l) === 'vencido' ? 'Vencido' : 'Aberto'))),
    valorLinha
  );
  const receitaCat = agrupar(receitas, l => l.categoria, valorLinha).sort((a, b) => b.valor - a.valor).slice(0, 10);
  const despesaCat = agrupar(despesas, l => l.categoria, valorLinha).sort((a, b) => b.valor - a.valor).slice(0, 10);
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
  el.innerHTML = `<div class="bi-table-wrap"><table class="bi-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Pessoa</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${dados.map(l => `<tr><td>${esc(l.vencimento || l.data || '-')}</td><td><span class="bi-badge ${esc(l.tipo)}">${l.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></td><td>${esc(l.descricao || '-')}</td><td>${esc(l.pessoa || '-')}</td><td>${esc(l.categoria || '-')}</td><td><strong>${moeda(valorLinha(l))}</strong></td></tr>`).join('')}</tbody></table></div>`;
}
function aplicarTabelas(linhas) {
  const hoje = hojeISO();
  const vencidos = linhas.filter(l => !l.programado && !l.realizado && l.vencimento && l.vencimento < hoje).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  const topReceitas = linhas.filter(l => !l.programado && l.tipo === 'receita').sort((a, b) => valorLinha(b) - valorLinha(a));
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
  const cab = ['origem', 'tipo', 'status', 'data', 'vencimento', 'descricao', 'pessoa', 'categoria', 'valor', 'valorPendente', 'valorRealizado'];
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
