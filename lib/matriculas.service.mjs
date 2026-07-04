import { readJson, writeJson, makeId, money, isoDate } from './fusion-json-store.mjs';

const ARQ_ALUNOS = 'alunos.json';
const ARQ_PLANOS = 'planos.json';
const ARQ_MENSALIDADES = 'mensalidades.json';
const ARQ_FINANCEIRO = 'financeiro.json';
const ARQ_HISTORICO = 'alunos_historico.json';
const ARQ_CHECKINS = 'checkins.json';

function hojeISOData() {
  return new Date().toISOString().slice(0, 10);
}

function vencimentoPadrao(dataBase = hojeISOData()) {
  const d = new Date(`${dataBase}T12:00:00.000Z`);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function normalizarTexto(v) {
  return String(v ?? '').trim();
}

function normalizarLista(v) {
  if (Array.isArray(v)) return v.map(normalizarTexto).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(normalizarTexto).filter(Boolean);
  return [];
}

function localizarPlano(planos, entrada) {
  const planoId = normalizarTexto(entrada?.planoId || entrada?.plano_id || entrada?.idPlano);
  const planoNome = normalizarTexto(entrada?.plano || entrada?.nomePlano);
  return planos.find(p => String(p.id) === planoId)
    || planos.find(p => normalizarTexto(p.nome).toLowerCase() === planoNome.toLowerCase())
    || null;
}

function montarDadosPlano(plano) {
  return {
    planoId: plano?.id || '',
    plano: plano?.nome || '',
    valorMensal: money(plano?.valorMensal),
    taxaMatricula: money(plano?.taxaMatricula),
    modalidades: normalizarLista(plano?.modalidadesIncluidas || plano?.modalidades)
  };
}

async function registrarHistorico(alunoId, tipo, dados = {}) {
  const historico = await readJson(ARQ_HISTORICO, []);
  const item = {
    id: makeId('hist_aluno'),
    alunoId,
    tipo,
    dados,
    criadoEm: isoDate()
  };
  historico.push(item);
  await writeJson(ARQ_HISTORICO, historico);
  return item;
}

export async function gerarMensalidadeInicial(aluno, opcoes = {}) {
  const mensalidades = await readJson(ARQ_MENSALIDADES, []);
  const jaExiste = mensalidades.find(m =>
    String(m.alunoId) === String(aluno.id) &&
    String(m.origem) === 'matricula' &&
    String(m.planoId || '') === String(aluno.planoId || '') &&
    ['aberta', 'pendente', 'parcial'].includes(String(m.status || '').toLowerCase())
  );

  if (jaExiste && !opcoes.forcarNova) return jaExiste;

  const dataMatricula = aluno.dataMatricula || hojeISOData();
  const mensalidade = {
    id: makeId('men'),
    alunoId: aluno.id,
    aluno: aluno.nome || aluno.nomeCompleto || '',
    planoId: aluno.planoId || '',
    plano: aluno.plano || '',
    modalidades: normalizarLista(aluno.modalidades),
    competencia: dataMatricula.slice(0, 7),
    vencimento: opcoes.vencimento || vencimentoPadrao(dataMatricula),
    valorMensal: money(aluno.valorMensal),
    taxaMatricula: money(aluno.taxaMatricula),
    valor: money(Number(aluno.valorMensal || 0) + Number(aluno.taxaMatricula || 0)),
    valorPago: 0,
    status: 'aberta',
    origem: 'matricula',
    criadoEm: isoDate(),
    atualizadoEm: isoDate()
  };

  mensalidades.push(mensalidade);
  await writeJson(ARQ_MENSALIDADES, mensalidades);
  await registrarLancamentoFinanceiroInicial(aluno, mensalidade);
  await registrarHistorico(aluno.id, 'mensalidade_inicial_gerada', { mensalidadeId: mensalidade.id, valor: mensalidade.valor });
  return mensalidade;
}

async function registrarLancamentoFinanceiroInicial(aluno, mensalidade) {
  const financeiro = await readJson(ARQ_FINANCEIRO, []);
  const existente = financeiro.find(f => f.origem === 'matricula' && f.mensalidadeId === mensalidade.id);
  if (existente) return existente;

  const lancamento = {
    id: makeId('fin'),
    tipo: 'receber',
    descricao: `Matrícula / mensalidade inicial - ${aluno.nome || aluno.nomeCompleto || aluno.id}`,
    alunoId: aluno.id,
    aluno: aluno.nome || aluno.nomeCompleto || '',
    planoId: aluno.planoId || '',
    plano: aluno.plano || '',
    mensalidadeId: mensalidade.id,
    categoria: 'Mensalidades',
    valor: money(mensalidade.valor),
    valorPago: 0,
    vencimento: mensalidade.vencimento,
    status: 'aberto',
    origem: 'matricula',
    criadoEm: isoDate(),
    atualizadoEm: isoDate()
  };

  financeiro.push(lancamento);
  await writeJson(ARQ_FINANCEIRO, financeiro);
  return lancamento;
}

export async function integrarAlunoMatricula(alunoEntrada, opcoes = {}) {
  const alunos = await readJson(ARQ_ALUNOS, []);
  const planos = await readJson(ARQ_PLANOS, []);
  const plano = localizarPlano(planos, alunoEntrada);
  if (!plano) throw new Error('Plano não localizado. Informe um planoId válido ou um nome de plano cadastrado.');

  const dadosPlano = montarDadosPlano(plano);
  const agora = isoDate();
  const dataMatricula = alunoEntrada.dataMatricula || hojeISOData();
  const alunoId = alunoEntrada.id || makeId('aluno');
  const idx = alunos.findIndex(a => String(a.id) === String(alunoId));

  const alunoAtualizado = {
    ...(idx >= 0 ? alunos[idx] : {}),
    ...alunoEntrada,
    id: alunoId,
    ...dadosPlano,
    dataMatricula,
    status: alunoEntrada.status || (idx >= 0 ? alunos[idx].status : 'Ativo'),
    atualizadoEm: agora,
    criadoEm: idx >= 0 ? (alunos[idx].criadoEm || agora) : (alunoEntrada.criadoEm || agora),
    matricula: {
      ...(idx >= 0 ? alunos[idx].matricula : {}),
      planoId: dadosPlano.planoId,
      plano: dadosPlano.plano,
      valorMensal: dadosPlano.valorMensal,
      taxaMatricula: dadosPlano.taxaMatricula,
      modalidades: dadosPlano.modalidades,
      dataMatricula,
      ativo: true,
      atualizadoEm: agora
    }
  };

  if (idx >= 0) alunos[idx] = alunoAtualizado;
  else alunos.push(alunoAtualizado);

  await writeJson(ARQ_ALUNOS, alunos);
  await registrarHistorico(alunoAtualizado.id, idx >= 0 ? 'matricula_atualizada' : 'matricula_criada', {
    planoId: dadosPlano.planoId,
    plano: dadosPlano.plano,
    valorMensal: dadosPlano.valorMensal,
    taxaMatricula: dadosPlano.taxaMatricula,
    modalidades: dadosPlano.modalidades
  });

  const mensalidade = opcoes.gerarMensalidade === false ? null : await gerarMensalidadeInicial(alunoAtualizado, opcoes);
  await prepararCheckinAluno(alunoAtualizado);

  return { aluno: alunoAtualizado, mensalidade };
}

export async function trocarPlanoAluno(alunoId, novoPlanoId, motivo = '') {
  const alunos = await readJson(ARQ_ALUNOS, []);
  const planos = await readJson(ARQ_PLANOS, []);
  const idx = alunos.findIndex(a => String(a.id) === String(alunoId));
  if (idx < 0) throw new Error('Aluno não localizado.');

  const plano = planos.find(p => String(p.id) === String(novoPlanoId));
  if (!plano) throw new Error('Novo plano não localizado.');

  const anterior = {
    planoId: alunos[idx].planoId || '',
    plano: alunos[idx].plano || '',
    valorMensal: money(alunos[idx].valorMensal),
    taxaMatricula: money(alunos[idx].taxaMatricula),
    modalidades: normalizarLista(alunos[idx].modalidades)
  };

  const novo = montarDadosPlano(plano);
  const historicoPlanos = Array.isArray(alunos[idx].historicoPlanos) ? alunos[idx].historicoPlanos : [];
  historicoPlanos.push({ id: makeId('plano_hist'), anterior, novo, motivo, criadoEm: isoDate() });

  alunos[idx] = {
    ...alunos[idx],
    ...novo,
    historicoPlanos,
    matricula: { ...(alunos[idx].matricula || {}), ...novo, atualizadoEm: isoDate(), ativo: true },
    atualizadoEm: isoDate()
  };

  await writeJson(ARQ_ALUNOS, alunos);
  await registrarHistorico(alunoId, 'troca_plano', { anterior, novo, motivo });
  await prepararCheckinAluno(alunos[idx]);
  return alunos[idx];
}

export async function prepararCheckinAluno(aluno) {
  const checkins = await readJson(ARQ_CHECKINS, []);
  const idx = checkins.findIndex(c => String(c.alunoId) === String(aluno.id) && c.tipo === 'permissao');
  const permissao = {
    id: idx >= 0 ? checkins[idx].id : makeId('chk_perm'),
    tipo: 'permissao',
    alunoId: aluno.id,
    aluno: aluno.nome || aluno.nomeCompleto || '',
    planoId: aluno.planoId || '',
    plano: aluno.plano || '',
    modalidades: normalizarLista(aluno.modalidades),
    statusAluno: aluno.status || 'Ativo',
    permitido: String(aluno.status || 'Ativo').toLowerCase() === 'ativo',
    atualizadoEm: isoDate(),
    criadoEm: idx >= 0 ? checkins[idx].criadoEm : isoDate()
  };

  if (idx >= 0) checkins[idx] = permissao;
  else checkins.push(permissao);
  await writeJson(ARQ_CHECKINS, checkins);
  return permissao;
}
