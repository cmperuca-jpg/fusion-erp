import * as repo from "./natacao.repository.mjs";

const DISTANCIAS_PADRAO = ["25m", "50m", "100m", "200m", "400m", "800m", "1500m", "Livre"];
const ESTILOS_PADRAO = ["Livre", "Crawl", "Costas", "Peito", "Borboleta", "Medley"];

function texto(v) { return String(v || "").trim(); }
function numero(v, padrao = 0) { const n = Number(v); return Number.isFinite(n) ? n : padrao; }
function chave(r = {}) { return [r.alunoId, r.distancia || "Livre", r.estilo || "Livre", r.piscina || ""].join("::"); }
function chaveProva(r = {}) { return [r.distancia || "Livre", r.estilo || "Livre", r.piscina || ""].join("::"); }
function melhor(a, b) { return Number(a || 0) > 0 && (Number(b || 0) === 0 || Number(a) < Number(b)); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  const min = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  const mil = total % 1000;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(mil).padStart(3, "0")}`;
}
function pct(melhorAtual, primeiro) {
  const a = numero(melhorAtual, 0), b = numero(primeiro, 0);
  if (!a || !b || a >= b) return 0;
  return Number((((b - a) / b) * 100).toFixed(2));
}
function resultadoNormalizado(sessao = {}, res = {}) {
  return {
    alunoId: res.alunoId,
    aluno: res.aluno,
    distancia: sessao.distancia || "Livre",
    estilo: sessao.estilo || "Livre",
    piscina: sessao.piscina || "",
    tempoMs: numero(res.tempoMs, 0),
    tempo: res.tempo || fmt(res.tempoMs),
    parciais: Array.isArray(res.parciais) ? res.parciais : [],
    melhorParcialMs: numero(res.melhorParcialMs, 0),
    mediaParcialMs: numero(res.mediaParcialMs, 0),
    sessaoId: sessao.id,
    professorId: sessao.professorId || "",
    professor: sessao.professor || "",
    criadoEm: sessao.criadoEm || new Date().toISOString()
  };
}

export async function listarSessoes(limit) { return await repo.listarSessoes(limit); }
export async function listarRecordes() { return await repo.listarRecordes(); }

export async function criarSessao(dados = {}) {
  const sessao = await repo.salvarSessao({
    ...dados,
    distancia: dados.distancia || "Livre",
    estilo: dados.estilo || "Livre",
    piscina: dados.piscina || "",
    resultados: Array.isArray(dados.resultados) ? dados.resultados : []
  });

  await recalcularRecordes();
  return sessao;
}

export async function recalcularRecordes() {
  const sessoes = await repo.listarTodasSessoes();
  const mapa = new Map();

  for (const sessao of sessoes) {
    for (const res of sessao.resultados || []) {
      if (!res.alunoId || !res.tempoMs) continue;
      const item = resultadoNormalizado(sessao, res);
      const k = chave(item);
      const atual = mapa.get(k);
      if (!atual || melhor(item.tempoMs, atual.tempoMs)) {
        mapa.set(k, {
          id: `rec_${item.alunoId}_${String(item.distancia).replace(/\W/g, "")}_${String(item.estilo).replace(/\W/g, "")}_${String(item.piscina).replace(/\W/g, "")}`,
          alunoId: item.alunoId,
          aluno: item.aluno,
          distancia: item.distancia,
          estilo: item.estilo,
          piscina: item.piscina,
          tempoMs: item.tempoMs,
          tempo: item.tempo,
          melhorParcialMs: item.melhorParcialMs || 0,
          melhorParcial: item.melhorParcialMs ? fmt(item.melhorParcialMs) : "",
          mediaParcialMs: item.mediaParcialMs || 0,
          mediaParcial: item.mediaParcialMs ? fmt(item.mediaParcialMs) : "",
          voltas: item.parciais.length,
          sessaoId: item.sessaoId,
          professorId: item.professorId,
          professor: item.professor,
          atualizadoEm: item.criadoEm
        });
      }
    }
  }

  const recordes = [...mapa.values()].sort((a, b) =>
    String(a.aluno).localeCompare(String(b.aluno), "pt-BR") ||
    String(a.distancia).localeCompare(String(b.distancia), "pt-BR") ||
    String(a.estilo).localeCompare(String(b.estilo), "pt-BR")
  );
  await repo.salvarRecordes(recordes);
  await repo.salvarEstatisticas(await montarEstatisticas(recordes, sessoes));
  return recordes;
}

async function montarEstatisticas(recordes = [], sessoes = []) {
  const resultados = [];
  for (const sessao of sessoes) {
    for (const res of sessao.resultados || []) {
      if (res.alunoId && res.tempoMs) resultados.push(resultadoNormalizado(sessao, res));
    }
  }

  const provas = new Map();
  for (const r of recordes) {
    const k = chaveProva(r);
    if (!provas.has(k)) provas.set(k, []);
    provas.get(k).push(r);
  }

  const rankings = [...provas.entries()].map(([key, lista]) => {
    const [distancia, estilo, piscina] = key.split("::");
    const ordenada = lista.slice().sort((a, b) => numero(a.tempoMs) - numero(b.tempoMs));
    return {
      distancia,
      estilo,
      piscina,
      total: ordenada.length,
      recordeAcademia: ordenada[0] || null,
      ranking: ordenada.slice(0, 50).map((r, i) => ({ posicao: i + 1, ...r }))
    };
  }).sort((a,b)=>String(a.distancia).localeCompare(String(b.distancia),'pt-BR') || String(a.estilo).localeCompare(String(b.estilo),'pt-BR'));

  const porAlunoProva = new Map();
  for (const r of resultados) {
    const k = chave(r);
    if (!porAlunoProva.has(k)) porAlunoProva.set(k, []);
    porAlunoProva.get(k).push(r);
  }

  const evolucao = [...porAlunoProva.values()].map(lista => {
    const ord = lista.slice().sort((a,b)=>String(a.criadoEm).localeCompare(String(b.criadoEm)));
    const primeiro = ord[0];
    const melhor = ord.reduce((acc, item) => !acc || item.tempoMs < acc.tempoMs ? item : acc, null);
    const ultimo = ord[ord.length - 1];
    return {
      alunoId: primeiro.alunoId,
      aluno: primeiro.aluno,
      distancia: primeiro.distancia,
      estilo: primeiro.estilo,
      piscina: primeiro.piscina,
      tentativas: ord.length,
      primeiroTempoMs: primeiro.tempoMs,
      primeiroTempo: fmt(primeiro.tempoMs),
      melhorTempoMs: melhor.tempoMs,
      melhorTempo: fmt(melhor.tempoMs),
      ultimoTempoMs: ultimo.tempoMs,
      ultimoTempo: fmt(ultimo.tempoMs),
      evolucaoPercentual: pct(melhor.tempoMs, primeiro.tempoMs),
      historico: ord.slice(-20).map(x => ({ data: x.criadoEm, tempoMs: x.tempoMs, tempo: fmt(x.tempoMs), sessaoId: x.sessaoId }))
    };
  }).sort((a,b)=>String(a.aluno).localeCompare(String(b.aluno),'pt-BR'));

  return {
    atualizadoEm: new Date().toISOString(),
    distancias: DISTANCIAS_PADRAO,
    estilos: ESTILOS_PADRAO,
    rankings,
    evolucao,
    resumo: {
      sessoes: sessoes.length,
      recordes: recordes.length,
      provasComRanking: rankings.length,
      alunosComEvolucao: new Set(evolucao.map(e => e.alunoId)).size
    }
  };
}

export async function estatisticas() {
  const stats = await repo.listarEstatisticas();
  if (!stats?.atualizadoEm) {
    const recordes = await recalcularRecordes();
    return await repo.listarEstatisticas();
  }
  return stats;
}

export async function ranking(filtros = {}) {
  const stats = await estatisticas();
  let lista = Array.isArray(stats.rankings) ? stats.rankings : [];
  if (filtros.distancia) lista = lista.filter(r => String(r.distancia) === String(filtros.distancia));
  if (filtros.estilo) lista = lista.filter(r => String(r.estilo) === String(filtros.estilo));
  if (filtros.piscina) lista = lista.filter(r => String(r.piscina) === String(filtros.piscina));
  return lista;
}

export async function historicoAluno(alunoId) {
  const [sessoes, recordes, stats] = await Promise.all([repo.listarSessoes(5000), repo.listarRecordes(), estatisticas()]);
  const historico = [];
  for (const s of sessoes) {
    for (const r of s.resultados || []) {
      if (String(r.alunoId) === String(alunoId)) historico.push({ ...r, sessaoId: s.id, distancia: s.distancia, estilo: s.estilo, piscina: s.piscina, professor: s.professor, criadoEm: s.criadoEm });
    }
  }
  return {
    recordes: recordes.filter(r => String(r.alunoId) === String(alunoId)),
    evolucao: (stats.evolucao || []).filter(e => String(e.alunoId) === String(alunoId)),
    historico: historico.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 200)
  };
}


export async function painelTecnico() {
  const stats = await estatisticas();
  const sessoes = await repo.listarTodasSessoes();
  const resultados = [];
  for (const s of sessoes) {
    for (const r of s.resultados || []) {
      if (r.alunoId && r.tempoMs) resultados.push(resultadoNormalizado(s, r));
    }
  }
  const atletas = new Set(resultados.map(r => r.alunoId)).size;
  const evolucaoLista = Array.isArray(stats.evolucao) ? stats.evolucao : [];
  const evolucaoMedia = evolucaoLista.length
    ? Number((evolucaoLista.reduce((acc, e) => acc + Number(e.evolucaoPercentual || 0), 0) / evolucaoLista.length).toFixed(2))
    : 0;
  const metros = resultados.reduce((acc, r) => {
    const n = Number(String(r.distancia || '').replace(/[^0-9]/g, '')) || 0;
    return acc + n;
  }, 0);
  const hoje = new Date().toISOString().slice(0, 10);
  const provasHoje = resultados.filter(r => String(r.criadoEm || '').slice(0, 10) === hoje).length;
  return {
    atualizadoEm: new Date().toISOString(),
    resumo: {
      sessoes: sessoes.length,
      provas: resultados.length,
      recordes: Array.isArray(stats.rankings) ? stats.rankings.reduce((acc, g) => acc + Number(g.total || 0), 0) : 0,
      atletas,
      evolucaoMedia,
      metros,
      provasHoje,
      provasComRanking: Array.isArray(stats.rankings) ? stats.rankings.length : 0
    },
    rankings: stats.rankings || [],
    evolucao: evolucaoLista,
    ultimasSessoes: sessoes.slice(0, 20)
  };
}

export async function compararAlunos(filtros = {}) {
  const ids = String(filtros.alunoIds || filtros.ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
  if (!ids.length) return [];
  const stats = await estatisticas();
  let lista = Array.isArray(stats.evolucao) ? stats.evolucao : [];
  lista = lista.filter(e => ids.includes(String(e.alunoId)));
  if (filtros.distancia) lista = lista.filter(e => String(e.distancia) === String(filtros.distancia));
  if (filtros.estilo) lista = lista.filter(e => String(e.estilo) === String(filtros.estilo));
  if (filtros.piscina) lista = lista.filter(e => String(e.piscina) === String(filtros.piscina));
  const porAluno = new Map();
  for (const e of lista) {
    const atual = porAluno.get(String(e.alunoId));
    if (!atual || Number(e.melhorTempoMs || 0) < Number(atual.melhorTempoMs || Infinity)) porAluno.set(String(e.alunoId), e);
  }
  return [...porAluno.values()].sort((a, b) => Number(a.melhorTempoMs || Infinity) - Number(b.melhorTempoMs || Infinity));
}

export async function relatorioTecnicoAluno(alunoId) {
  const dados = await historicoAluno(alunoId);
  const provas = Array.isArray(dados.historico) ? dados.historico.length : 0;
  const melhorEvolucao = Math.max(0, ...((dados.evolucao || []).map(e => Number(e.evolucaoPercentual || 0))));
  const recordes = dados.recordes || [];
  const metros = (dados.historico || []).reduce((acc, h) => acc + (Number(String(h.distancia || '').replace(/[^0-9]/g, '')) || 0), 0);
  const melhorParcial = Math.min(...recordes.map(r => Number(r.melhorParcialMs || 0)).filter(Boolean));
  return {
    alunoId,
    resumo: {
      provas,
      recordes: recordes.length,
      melhorEvolucao: Number(melhorEvolucao.toFixed(2)),
      metros,
      melhorParcialMs: Number.isFinite(melhorParcial) ? melhorParcial : 0,
      melhorParcial: Number.isFinite(melhorParcial) ? fmt(melhorParcial) : ''
    },
    ...dados
  };
}
