const dadosFallback = { alunos: [], mensalidades: [], avaliacoes: [], lancamentos: [] };

async function buscar(url, chave) {
  try {
    const resp = await (window.FusionAuth?.fetchAuth ? FusionAuth.fetchAuth(url, { cache: 'no-store' }) : fetch(url, { cache: 'no-store' }));
    if (!resp.ok) return dadosFallback[chave] || [];
    const json = await resp.json();
    if (Array.isArray(json)) return json;
    return json[chave] || json.dados || json.data || [];
  } catch {
    return dadosFallback[chave] || [];
  }
}

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

(async function carregarDashboard() {
  const [alunos, mensalidades, avaliacoes, financeiro] = await Promise.all([
    buscar('/api/alunos', 'alunos'),
    buscar('/api/mensalidades', 'mensalidades'),
    buscar('/api/avaliacoes', 'avaliacoes'),
    buscar('/api/financeiro', 'lancamentos')
  ]);

  const ativos = alunos.filter(a => String(a.status || 'ativo').toLowerCase() === 'ativo').length;
  const abertas = mensalidades.filter(m => String(m.status || '').toLowerCase().includes('aberto')).length;
  const receita = financeiro
    .filter(f => String(f.status || '').toLowerCase() === 'pago')
    .reduce((s, f) => s + Number(f.valorLiquido || f.valorPago || f.valor || 0), 0);

  setText('kpiAlunos', ativos);
  setText('kpiAbertas', abertas);
  setText('kpiAvaliacoes', avaliacoes.length);
  setText('kpiReceita', moeda(receita));
})();
