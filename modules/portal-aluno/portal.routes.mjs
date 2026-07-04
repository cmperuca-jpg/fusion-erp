import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const router = Router();
const DATA_DIR = path.resolve(process.cwd(), 'data');

const FILES = {
  alunos: 'alunos.json',
  avaliacoes: 'avaliacoes.json',
  treinos: 'treinos.json',
  treinosIntegrados: 'treinos_integrados.json',
  execucoes: 'treinos_execucoes.json',
  checkins: 'checkins.json',
  frequencia: 'frequencia.json',
  financeiro: 'financeiro.json',
  mensalidades: 'mensalidades.json',
  matriculas: 'matriculas.json',
  avisos: 'avisos_professor.json',
  comunicados: 'comunicados.json',
  agenda: 'agenda.json'
};

async function lerJson(nome, padrao = []) {
  try {
    const arquivo = path.join(DATA_DIR, nome);
    const txt = await fs.readFile(arquivo, 'utf8');
    if (!txt.trim()) return padrao;
    const dados = JSON.parse(txt);
    return Array.isArray(dados) ? dados : padrao;
  } catch {
    return padrao;
  }
}

function soNumeros(v) { return String(v || '').replace(/\D/g, ''); }
function texto(v) { return String(v ?? '').trim(); }
function mesmoId(a, b) { return String(a || '') === String(b || ''); }
function normalizar(v) { return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function dataISO(v) { return texto(v).slice(0, 10); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function alunoId(a = {}) { return texto(a.id || a._id || a.alunoId || a.aluno_id); }
function alunoNome(a = {}) { return texto(a.nome || a.alunoNome || a.aluno || a.name || 'Aluno'); }
function numero(v) { const n = Number(String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0] || 0); return Number.isFinite(n) ? n : 0; }
function seriesNumero(v) { const n = numero(v); return n > 0 ? n : 1; }
function volumeExercicio(ex = {}) { return numero(ex.cargaRealizada || ex.cargaPrevista || ex.carga) * numero(ex.repeticoesRealizadas || ex.repeticoes) * seriesNumero(ex.series); }
function volumeExecucao(exec = {}) { return (exec.exercicios || []).reduce((t, ex) => t + volumeExercicio(ex), 0); }
function inicioSemanaISO() { const d = new Date(`${hojeISO()}T12:00:00`); const dia = d.getDay() || 7; d.setDate(d.getDate() - dia + 1); return d.toISOString().slice(0, 10); }
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function addDias(data, n) { const d = new Date(`${data}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function localizarAluno(alunos, credenciais = {}) {
  const cpf = soNumeros(credenciais.cpf);
  const telefone = soNumeros(credenciais.telefone || credenciais.whatsapp);
  if (!cpf) return null;
  return alunos.find(a => {
    const cpfOk = soNumeros(a.cpf || a.documento) === cpf;
    const telAluno = soNumeros(a.telefone || a.whatsapp || a.celular);
    if (!cpfOk) return false;
    if (telefone && telAluno) return telAluno.endsWith(telefone.slice(-8));
    return true;
  }) || null;
}

function pertenceAoAluno(item = {}, aluno = {}) {
  const id = alunoId(aluno);
  if (!id) return false;
  if (mesmoId(item.alunoId, id) || mesmoId(item.aluno_id, id)) return true;
  const nome = normalizar(alunoNome(aluno));
  const campos = [item.alunoNome, item.nomeAluno, item.aluno, item.pessoa, item.alunoFornecedor, item.pessoaFornecedor, item.descricao].map(normalizar);
  return nome && campos.some(c => c.includes(nome));
}

function ordenarPorData(lista, campos = ['data', 'vencimento', 'criadoEm', 'criado_em']) {
  return [...lista].sort((a, b) => {
    const da = campos.map(c => texto(a[c])).find(Boolean) || '';
    const db = campos.map(c => texto(b[c])).find(Boolean) || '';
    return db.localeCompare(da);
  });
}

function resumoExecucao(exec = {}) {
  const lista = Array.isArray(exec.exercicios) ? exec.exercicios : [];
  const total = lista.length;
  const concluidos = lista.filter(e => e.concluido).length;
  return { total, concluidos, percentual: total ? Math.round((concluidos / total) * 100) : 0 };
}

function exercicioAtual(exec = {}) {
  const lista = Array.isArray(exec.exercicios) ? exec.exercicios : [];
  return lista.find(e => !e.concluido) || lista[lista.length - 1] || null;
}

function checkinAberto(c = {}) {
  const st = normalizar(c.status || c.situacao || 'presente');
  return !['saida', 'finalizado', 'encerrado', 'cancelado', 'bloqueado'].includes(st);
}

function melhorExercicio(execucoes = [], nomeExercicio = '') {
  const alvo = normalizar(nomeExercicio);
  const historico = [];
  for (const exec of execucoes) {
    for (const ex of exec.exercicios || []) {
      if (normalizar(ex.nome) !== alvo) continue;
      historico.push({
        data: exec.data || dataISO(exec.criadoEm),
        carga: numero(ex.cargaRealizada || ex.cargaPrevista || ex.carga),
        repeticoes: numero(ex.repeticoesRealizadas || ex.repeticoes),
        volume: Math.round(volumeExercicio(ex)),
        concluido: Boolean(ex.concluido)
      });
    }
  }
  historico.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return { melhorCarga: Math.max(0, ...historico.map(h => h.carga)), melhorVolume: Math.max(0, ...historico.map(h => h.volume)), ultima: historico[0] || null, historico: historico.slice(0, 8) };
}

function frequenciaMensal(frequencia = [], aluno = {}) {
  const mes = hojeISO().slice(0, 7);
  const registros = frequencia.filter(f => pertenceAoAluno(f, aluno) && dataISO(f.data || f.criadoEm).startsWith(mes));
  const presentes = registros.filter(f => ['presente', 'entrada', 'checkin', 'check-in'].includes(normalizar(f.status || f.tipo))).length;
  return { mes, registros: registros.length, presentes };
}

function streakFrequencia(frequencia = [], checkins = [], aluno = {}) {
  const datas = new Set([...frequencia, ...checkins]
    .filter(i => pertenceAoAluno(i, aluno))
    .map(i => dataISO(i.data || i.dataEntrada || i.criadoEm))
    .filter(Boolean));
  let streak = 0;
  for (let i = 0; i < 120; i += 1) {
    const dia = diasAtras(i);
    if (datas.has(dia)) streak += 1;
    else if (i === 0) continue;
    else break;
  }
  return { atual: streak, totalDiasComPresenca: datas.size };
}

function metasSemanais(execucoes = [], frequencia = [], checkins = [], aluno = {}) {
  const inicio = inicioSemanaISO();
  const execSemana = execucoes.filter(e => dataISO(e.data || e.criadoEm) >= inicio).length;
  const presencasSemana = new Set([...frequencia, ...checkins].filter(i => pertenceAoAluno(i, aluno) && dataISO(i.data || i.dataEntrada || i.criadoEm) >= inicio).map(i => dataISO(i.data || i.dataEntrada || i.criadoEm))).size;
  const volumeSemana = Math.round(execucoes.filter(e => dataISO(e.data || e.criadoEm) >= inicio).reduce((t, e) => t + volumeExecucao(e), 0));
  const metas = [
    { nome: 'Frequência semanal', atual: presencasSemana, meta: 3, unidade: 'presenças' },
    { nome: 'Treinos concluídos', atual: execSemana, meta: 3, unidade: 'treinos' },
    { nome: 'Volume semanal', atual: volumeSemana, meta: Math.max(10000, volumeSemana), unidade: 'kg' }
  ];
  return metas.map(m => ({ ...m, percentual: m.meta ? Math.min(100, Math.round((m.atual / m.meta) * 100)) : 0 }));
}

function agrupamentoVolume(execucoes = []) {
  return execucoes.slice(0, 14).map(e => ({ data: e.data || dataISO(e.criadoEm), volume: Math.round(volumeExecucao(e)), status: e.status || '' })).reverse();
}

function evolucaoCarga(execucoes = []) {
  const mapa = new Map();
  for (const exec of execucoes) {
    for (const ex of exec.exercicios || []) {
      const nome = texto(ex.nome || 'Exercício');
      if (!mapa.has(nome)) mapa.set(nome, []);
      mapa.get(nome).push({ data: exec.data || dataISO(exec.criadoEm), carga: numero(ex.cargaRealizada || ex.cargaPrevista || ex.carga), volume: Math.round(volumeExercicio(ex)) });
    }
  }
  return [...mapa.entries()].map(([exercicio, pontos]) => {
    pontos.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    return { exercicio, pontos: pontos.slice(-8), melhorCarga: Math.max(0, ...pontos.map(p => p.carga)) };
  }).sort((a, b) => b.melhorCarga - a.melhorCarga).slice(0, 6);
}

function montarAgenda(treinos = [], agenda = [], aluno = {}) {
  const base = [];
  for (const t of treinos.slice(0, 5)) {
    base.push({ data: dataISO(t.dataInicio || t.data || hojeISO()) || hojeISO(), titulo: t.nome || t.objetivo || 'Treino', tipo: 'treino', status: t.status || 'ativo' });
  }
  for (const item of agenda.filter(a => pertenceAoAluno(a, aluno)).slice(0, 10)) {
    base.push({ data: dataISO(item.data || item.inicio || item.start), titulo: item.titulo || item.nome || item.descricao || 'Agenda', tipo: item.tipo || 'agenda', status: item.status || '' });
  }
  const hoje = hojeISO();
  if (!base.length && treinos[0]) {
    base.push({ data: hoje, titulo: treinos[0].nome || treinos[0].objetivo || 'Treino de hoje', tipo: 'treino', status: treinos[0].status || 'ativo' });
    base.push({ data: addDias(hoje, 2), titulo: treinos[0].nome || 'Próximo treino', tipo: 'treino', status: 'previsto' });
  }
  return base.filter(a => !a.data || a.data >= hoje).sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(0, 8);
}

function montarAvisos(avisos = [], comunicados = [], aluno = {}) {
  const professor = normalizar(aluno.professorNome || aluno.professor || '');
  return [...avisos, ...comunicados]
    .filter(a => !a.alunoId || pertenceAoAluno(a, aluno) || (professor && normalizar(a.professor || a.professorNome).includes(professor)))
    .map(a => ({ titulo: a.titulo || a.assunto || 'Aviso', mensagem: a.mensagem || a.descricao || a.texto || '', data: dataISO(a.data || a.criadoEm), professor: a.professor || a.professorNome || aluno.professorNome || '' }))
    .sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 8);
}

function conquistas(execucoes = [], prs = [], freq = {}, streak = {}) {
  const lista = [];
  if (execucoes.length >= 1) lista.push({ nome: 'Primeiro treino', descricao: 'Primeira execução registrada.' });
  if (execucoes.length >= 10) lista.push({ nome: '10 treinos', descricao: 'Aluno completou 10 execuções.' });
  if (execucoes.length >= 30) lista.push({ nome: '30 treinos', descricao: 'Consistência de longo prazo.' });
  if ((freq.presentes || 0) >= 8) lista.push({ nome: 'Frequente no mês', descricao: 'Boa regularidade mensal.' });
  if ((streak.atual || 0) >= 3) lista.push({ nome: 'Sequência ativa', descricao: `${streak.atual} dias com presença.` });
  if (prs.length >= 1) lista.push({ nome: 'Primeiro PR', descricao: 'Primeiro recorde pessoal registrado.' });
  if (prs.length >= 5) lista.push({ nome: '5 recordes', descricao: 'Evolução consistente de carga.' });
  return lista;
}


function analisarIAProgressao(execs = []) {
  const mapa = new Map();
  for (const exec of [...execs].sort((a,b)=>String(a.data||a.criadoEm||'').localeCompare(String(b.data||b.criadoEm||'')))) {
    for (const ex of exec.exercicios || []) {
      const nome = texto(ex.nome || 'Exercício');
      const chave = normalizar(nome);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push({
        data: dataISO(exec.data || exec.criadoEm),
        nome,
        carga: numero(ex.cargaRealizada || ex.cargaPrevista || ex.carga),
        repeticoes: numero(ex.repeticoesRealizadas || ex.repeticoes),
        series: seriesNumero(ex.series),
        volume: volumeExercicio(ex),
        concluido: Boolean(ex.concluido)
      });
    }
  }
  const exercicios = [...mapa.values()].map(hist => {
    const atual = hist[hist.length - 1] || {};
    const ant = hist[hist.length - 2] || {};
    const deltaVolume = Math.round((atual.volume || 0) - (ant.volume || 0));
    const deltaCarga = Number(((atual.carga || 0) - (ant.carga || 0)).toFixed(1));
    const perc = ant.volume ? Math.round((deltaVolume / Math.max(1, ant.volume)) * 100) : ((atual.volume || 0) > 0 ? 100 : 0);
    const tendencia = !ant.data ? 'Primeiro registro' : perc >= 5 ? 'Evolução' : perc <= -5 ? 'Regressão' : 'Estável';
    const ajuste = tendencia === 'Evolução' ? (atual.carga >= 40 ? 2.5 : 1) : tendencia === 'Regressão' ? (atual.carga >= 40 ? -2.5 : -1) : 0;
    const risco = ajuste > 0 && perc > 25 ? 'Moderado' : tendencia === 'Regressão' ? 'Moderado' : 'Baixo';
    let score = 50 + Math.max(-25, Math.min(25, perc));
    if (tendencia === 'Evolução') score += 15;
    if (tendencia === 'Regressão') score -= 15;
    score = Math.max(0, Math.min(100, Math.round(score)));
    return {
      exercicio: atual.nome || hist[0]?.nome || 'Exercício',
      tendencia,
      indice: score,
      ultimaCarga: atual.carga || 0,
      cargaAnterior: ant.carga || 0,
      deltaCarga,
      ultimoVolume: Math.round(atual.volume || 0),
      deltaVolume,
      percentualVolume: perc,
      risco,
      estagnado: hist.length >= 3 && hist.slice(-3).every(h => Number(h.carga || 0) === Number(atual.carga || 0)),
      recomendacao: {
        acao: tendencia === 'Evolução' ? 'Subir carga' : tendencia === 'Regressão' ? 'Reduzir ou manter' : 'Manter',
        cargaSugerida: Math.max(0, Number(((atual.carga || 0) + ajuste).toFixed(1))),
        ajusteKg: ajuste,
        repeticoesSugeridas: tendencia === 'Estável' ? (atual.repeticoes || 0) + 1 : atual.repeticoes || 0
      },
      historico: hist.slice(-6).reverse()
    };
  }).sort((a,b)=>b.indice-a.indice);
  const score = exercicios.length ? Math.round(exercicios.reduce((t,e)=>t+e.indice,0)/exercicios.length) : 0;
  const resumo = {
    score,
    classificacao: !exercicios.length ? 'Sem dados' : score >= 75 ? 'Evolução forte' : score >= 60 ? 'Evolução controlada' : score >= 45 ? 'Estável' : 'Atenção necessária',
    avaliados: exercicios.length,
    evoluindo: exercicios.filter(e=>e.tendencia==='Evolução').length,
    estaveis: exercicios.filter(e=>e.tendencia==='Estável').length,
    regressao: exercicios.filter(e=>e.tendencia==='Regressão').length,
    riscoAlto: exercicios.filter(e=>e.risco==='Alto').length,
    riscoModerado: exercicios.filter(e=>e.risco==='Moderado').length
  };
  return {
    resumo,
    aluno: exercicios.length ? [score >= 60 ? 'Sua evolução geral está positiva. Mantenha regularidade e registre todos os treinos.' : 'Evolução irregular. Priorize técnica, descanso e constância antes de subir carga.'] : ['Execute mais treinos para liberar análise inteligente.'],
    professor: exercicios.filter(e=>e.tendencia==='Regressão'||e.estagnado).slice(0,5).map(e=>`Revisar ${e.exercicio}: ${e.tendencia}${e.estagnado ? ' com estagnação' : ''}.`),
    exercicios
  };
}

async function carregarBase() {
  const [avaliacoes, treinosBase, treinosIntegrados, execucoes, checkins, frequencia, financeiro, mensalidades, matriculas, avisos, comunicados, agenda] = await Promise.all([
    lerJson(FILES.avaliacoes), lerJson(FILES.treinos), lerJson(FILES.treinosIntegrados), lerJson(FILES.execucoes), lerJson(FILES.checkins), lerJson(FILES.frequencia), lerJson(FILES.financeiro), lerJson(FILES.mensalidades), lerJson(FILES.matriculas), lerJson(FILES.avisos), lerJson(FILES.comunicados), lerJson(FILES.agenda)
  ]);
  const mapa = new Map();
  for (const t of [...treinosIntegrados, ...treinosBase]) if (t?.id) mapa.set(String(t.id), t);
  return { avaliacoes, treinos: [...mapa.values()], execucoes, checkins, frequencia, financeiro, mensalidades, matriculas, avisos, comunicados, agenda };
}

async function montarResumo(aluno) {
  const base = await carregarBase();
  const avs = ordenarPorData(base.avaliacoes.filter(a => pertenceAoAluno(a, aluno)), ['data', 'dataAvaliacao', 'criado_em', 'criadoEm']);
  const trs = ordenarPorData(base.treinos.filter(t => pertenceAoAluno(t, aluno)), ['dataInicio', 'data', 'criado_em', 'criadoEm']);
  const execs = ordenarPorData(base.execucoes.filter(e => pertenceAoAluno(e, aluno)), ['data', 'criadoEm', 'atualizadoEm']);
  const fins = ordenarPorData(base.financeiro.filter(f => pertenceAoAluno(f, aluno)), ['vencimento', 'data', 'criadoEm']);
  const mens = ordenarPorData(base.mensalidades.filter(m => pertenceAoAluno(m, aluno)), ['vencimento', 'competencia', 'criadoEm']);
  const mats = ordenarPorData(base.matriculas.filter(m => pertenceAoAluno(m, aluno)), ['dataMatricula', 'data_matricula', 'criadoEm']);

  const abertos = fins.filter(f => ['aberto', 'pendente', 'a receber'].includes(normalizar(f.status)));
  const pagos = fins.filter(f => ['pago', 'recebido', 'quitado'].includes(normalizar(f.status)));
  const hoje = hojeISO();
  const checkinHoje = base.checkins.filter(c => pertenceAoAluno(c, aluno) && dataISO(c.data || c.dataEntrada || c.criadoEm) === hoje).sort((a,b)=>String(b.criadoEm||b.entrada||'').localeCompare(String(a.criadoEm||a.entrada||'')))[0] || null;
  const execucaoAtiva = execs.find(e => dataISO(e.data || e.criadoEm) === hoje && !['concluido','concluído','cancelado'].includes(normalizar(e.status))) || null;
  const ultimaExecucao = execs[0] || null;
  const atual = execucaoAtiva ? exercicioAtual(execucaoAtiva) : null;
  const progressaoAtual = atual ? melhorExercicio(execs, atual.nome) : null;
  const historicoVolumes = agrupamentoVolume(execs);
  const evolucaoCargas = evolucaoCarga(execs);
  const prs = [];
  for (const serie of evolucaoCargas) {
    if (serie.melhorCarga > 0) prs.push({ exercicio: serie.exercicio, carga: serie.melhorCarga, volume: Math.max(0, ...serie.pontos.map(p => p.volume)) });
  }
  const freqMes = frequenciaMensal(base.frequencia, aluno);
  const streak = streakFrequencia(base.frequencia, base.checkins, aluno);
  const metas = metasSemanais(execs, base.frequencia, base.checkins, aluno);

  const ultimos30 = execs.filter(e => dataISO(e.data || e.criadoEm) >= diasAtras(30));
  const ultimos90 = execs.filter(e => dataISO(e.data || e.criadoEm) >= diasAtras(90));
  const volume30 = Math.round(ultimos30.reduce((t, e) => t + volumeExecucao(e), 0));
  const volume90 = Math.round(ultimos90.reduce((t, e) => t + volumeExecucao(e), 0));

  return {
    aluno: { id: alunoId(aluno), nome: alunoNome(aluno), cpf: soNumeros(aluno.cpf), plano: aluno.plano || aluno.nomePlano || aluno.planoNome || '', status: aluno.status || aluno.situacao || 'ativo', professorId: aluno.professorId || aluno.professor_id || '', professorNome: aluno.professorNome || aluno.professor_responsavel || aluno.professor || '' },
    resumo: { avaliacoes: avs.length, treinos: trs.length, execucoes: execs.length, mensalidades: mens.length, financeiroAberto: abertos.length, financeiroPago: pagos.length, proximoVencimento: abertos[0]?.vencimento || mens.find(m => !['pago','recebido','cancelado'].includes(normalizar(m.status)))?.vencimento || '', volumeTotal: Math.round(execs.reduce((t, e) => t + volumeExecucao(e), 0)), frequenciaMes: freqMes, streak, volume30, volume90 },
    operacional: {
      checkinHoje: checkinHoje ? { id: checkinHoje.id, status: checkinHoje.status || 'Presente', aberto: checkinAberto(checkinHoje), entrada: checkinHoje.horaEntrada || checkinHoje.entrada || checkinHoje.criadoEm || '' } : null,
      treinoAtivo: execucaoAtiva ? { execucaoId: execucaoAtiva.id, treinoId: execucaoAtiva.treinoId, status: execucaoAtiva.status, resumo: resumoExecucao(execucaoAtiva), exercicioAtual: atual, proximoExercicio: (execucaoAtiva.exercicios || []).find(e => !e.concluido && e.exercicioTreinoId !== atual?.exercicioTreinoId) || null, volume: Math.round(volumeExecucao(execucaoAtiva)), progressaoAtual } : null,
      ultimaExecucao: ultimaExecucao ? { id: ultimaExecucao.id, data: ultimaExecucao.data || dataISO(ultimaExecucao.criadoEm), status: ultimaExecucao.status, resumo: resumoExecucao(ultimaExecucao), volume: Math.round(volumeExecucao(ultimaExecucao)) } : null,
      historicoVolumes,
      evolucaoCargas,
      prs: prs.slice(0, 12),
      metas,
      agenda: montarAgenda(trs, base.agenda, aluno),
      avisos: montarAvisos(base.avisos, base.comunicados, aluno),
      conquistas: conquistas(execs, prs, freqMes, streak),
      evolucaoResumo: { execucoes30: ultimos30.length, execucoes90: ultimos90.length, volume30, volume90, variacaoVolume: volume90 ? Math.round((volume30 / Math.max(1, volume90 / 3) - 1) * 100) : 0 },
      iaProgressao: analisarIAProgressao(execs)
    },
    avaliacoes: avs.slice(0, 20), treinos: trs.slice(0, 20), execucoes: execs.slice(0, 20), financeiro: fins.slice(0, 40), mensalidades: mens.slice(0, 40), matriculas: mats.slice(0, 10)
  };
}

router.post('/acessar', async (req, res) => {
  try {
    const alunos = await lerJson(FILES.alunos, []);
    const aluno = localizarAluno(alunos, req.body || {});
    if (!aluno) return res.status(401).json({ ok: false, mensagem: 'Aluno não encontrado. Confira CPF e telefone/WhatsApp.' });
    const status = normalizar(aluno.status || 'ativo');
    if (['inativo', 'cancelado', 'excluido', 'excluído'].includes(status)) return res.status(403).json({ ok: false, mensagem: 'Acesso indisponível para aluno inativo ou cancelado.' });
    const dados = await montarResumo(aluno);
    res.json({ ok: true, ...dados });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: erro.message || 'Erro ao acessar portal do aluno.' });
  }
});

router.get('/alunos/:alunoId/dashboard', async (req, res) => {
  try {
    const alunos = await lerJson(FILES.alunos, []);
    const aluno = alunos.find(a => alunoId(a) === String(req.params.alunoId));
    if (!aluno) return res.status(404).json({ ok: false, mensagem: 'Aluno não encontrado.' });
    const dados = await montarResumo(aluno);
    res.json({ ok: true, ...dados });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: erro.message || 'Erro ao carregar dashboard do aluno.' });
  }
});

router.get('/alunos/:alunoId/ia', async (req, res) => {
  try {
    const alunos = await lerJson(FILES.alunos, []);
    const aluno = alunos.find(a => alunoId(a) === String(req.params.alunoId));
    if (!aluno) return res.status(404).json({ ok: false, mensagem: 'Aluno não encontrado.' });
    const base = await carregarBase();
    const execs = ordenarPorData(base.execucoes.filter(e => pertenceAoAluno(e, aluno)), ['data', 'criadoEm', 'atualizadoEm']);
    res.json({ ok: true, aluno: { id: alunoId(aluno), nome: alunoNome(aluno) }, iaProgressao: analisarIAProgressao(execs) });
  } catch (erro) {
    res.status(500).json({ ok: false, mensagem: erro.message || 'Erro ao carregar IA de progressão.' });
  }
});

export default router;
