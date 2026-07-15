import path from 'node:path';
import { gerarProximaMensalidadeAposPagamento } from '../cobranca/cobranca.service.mjs';
import { aplicarPremioNaMensalidade, vincularMensalidadePremio } from '../fidelidade/fidelidade.service.mjs';
import { lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const MENSALIDADES_FILE = path.join(DATA_DIR, 'mensalidades.json');
const FINANCEIRO_FILE = path.join(DATA_DIR, 'financeiro.json');
const ALUNOS_FILE = path.join(DATA_DIR, 'alunos.json');
const PLANOS_FILE = path.join(DATA_DIR, 'planos.json');
const CAIXA_FILE = path.join(DATA_DIR, 'caixa.json');

async function lerJson(arquivo, padrao = []) {
  return lerJsonDuravel(arquivo, padrao);
}

async function salvarJson(arquivo, dados) {
  return salvarJsonDuravel(arquivo, dados);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function gerarId(prefixo = 'men') {
  return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase();
}

function numero(valor, padrao = 0) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : padrao;
}

function competenciaPorVencimento(dataISO) {
  return String(dataISO || hojeISO()).slice(0, 7);
}

function adicionarMeses(dataISO, qtd) {
  const d = new Date(`${dataISO}T12:00:00`);
  d.setMonth(d.getMonth() + qtd);
  return d.toISOString().slice(0, 10);
}

function statusInterno(status) {
  const s = normalizarTexto(status);
  if (s === 'pago') return 'pago';
  if (s === 'parcial') return 'parcial';
  if (s === 'cancelado') return 'cancelado';
  if (s === 'atrasado') return 'atrasado';
  return 'aberto';
}

function statusFinanceiro(status) {
  const s = statusInterno(status);
  if (s === 'pago') return 'Pago';
  if (s === 'cancelado') return 'Cancelado';
  return 'Aberto';
}

function calcularStatus(m) {
  const s = statusInterno(m.status);
  if (s === 'pago' || s === 'cancelado' || s === 'parcial') return s;
  const venc = new Date(`${m.vencimento}T23:59:59`);
  return venc < new Date() ? 'atrasado' : 'aberto';
}

function calcularValorAtualizado(m, config = {}) {
  const multaPercentual = numero(config.multaPercentual, 2);
  const jurosDiaPercentual = numero(config.jurosDiaPercentual, 0.033);
  const valorBase = numero(m.valor, 0);
  const status = calcularStatus(m);

  if (status !== 'atrasado') {
    return { valorBase, multa: 0, juros: 0, valorAtualizado: valorBase, diasAtraso: 0 };
  }

  const venc = new Date(`${m.vencimento}T00:00:00`);
  const hoje = new Date(`${hojeISO()}T00:00:00`);
  const diasAtraso = Math.max(0, Math.floor((hoje - venc) / 86400000));
  const multa = valorBase * (multaPercentual / 100);
  const juros = valorBase * (jurosDiaPercentual / 100) * diasAtraso;

  return {
    valorBase,
    multa: Number(multa.toFixed(2)),
    juros: Number(juros.toFixed(2)),
    valorAtualizado: Number((valorBase + multa + juros).toFixed(2)),
    diasAtraso
  };
}

async function buscarAluno(id) {
  const alunos = await lerJson(ALUNOS_FILE, []);
  return alunos.find(a => String(a.id) === String(id) || String(a._id) === String(id)) || null;
}

async function buscarPlano(id) {
  const planos = await lerJson(PLANOS_FILE, []);
  return planos.find(p => String(p.id) === String(id) || String(p._id) === String(id)) || null;
}

function existeDuplicada(mensalidades, alunoId, competencia, ignorarId = '') {
  return mensalidades.some(m =>
    String(m.id) !== String(ignorarId) &&
    String(m.alunoId) === String(alunoId) &&
    String(m.competencia) === String(competencia) &&
    statusInterno(m.status) !== 'cancelado'
  );
}

function ehMatriculaInicial(mensalidade = {}) {
  const txt = normalizarTexto([
    mensalidade.origem,
    mensalidade.descricao,
    mensalidade.categoria,
    mensalidade.tipoCobranca,
    mensalidade.observacao
  ].join(' '));

  return txt.includes('matricula_inicial_unificada') ||
    txt.includes('entrada_unica') ||
    txt.includes('entrada matricula') ||
    txt.includes('entrada matrícula') ||
    txt.includes('matricula + mensalidade') ||
    txt.includes('matrícula + mensalidade') ||
    txt.includes('matricula_inicial') ||
    txt.includes('matrícula inicial') ||
    txt.includes('matricula inicial') ||
    txt.includes('taxa de matrícula') ||
    txt.includes('taxa de matricula') ||
    txt.includes('adesão') ||
    txt.includes('adesao');
}

function valorPrincipalMensalidade(mensalidade = {}) {
  // Matrícula inicial é cobrança única: o valor financeiro precisa ser o total
  // inicial, não apenas a mensalidade pura. Mensalidade recorrente premiada
  // usa o valor final depois do desconto de fidelidade.
  if (ehMatriculaInicial(mensalidade)) {
    return numero(mensalidade.total ?? mensalidade.valorTotalInicial ?? mensalidade.valorOriginal ?? mensalidade.valor, 0);
  }
  if (mensalidade.premioFidelidadeId || numero(mensalidade.descontoFidelidadePercentual, 0) > 0) {
    return numero(mensalidade.valor, 0);
  }
  return numero(mensalidade.valorOriginal ?? mensalidade.valor, 0);
}

function descricaoFinanceiraMensalidade(mensalidade = {}, nomePessoa = '') {
  if (ehMatriculaInicial(mensalidade)) {
    return mensalidade.descricao || `Matrícula inicial - ${nomePessoa}`;
  }
  return `Mensalidade ${nomePessoa} - ${mensalidade.competencia}`;
}

async function upsertLancamentoFinanceiro(mensalidade) {
  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  const nomePessoa = mensalidade.alunoNome || mensalidade.aluno || mensalidade.pessoa || mensalidade.pessoaFornecedor || mensalidade.alunoFornecedor || '';
  const pagamento = mensalidade.dataPagamento || mensalidade.pagamento || '';

  // Usa o lançamento original quando a mensalidade já veio da matrícula.
  // Fallback por mensalidadeId impede criar um segundo lançamento financeiro.
  let lancamentoId = mensalidade.lancamentoFinanceiroId || mensalidade.financeiroInicialId || '';
  let existente = lancamentoId ? financeiro.findIndex(l => String(l.id) === String(lancamentoId)) : -1;

  if (existente < 0 && mensalidade.id) {
    existente = financeiro.findIndex(l => String(l.mensalidadeId || '') === String(mensalidade.id));
    if (existente >= 0) lancamentoId = financeiro[existente].id;
  }

  if (!lancamentoId) lancamentoId = `fin_${mensalidade.id}`;

  const valorPrincipal = valorPrincipalMensalidade(mensalidade);
  const valorBrutoRecebido = numero(mensalidade.valorBrutoRecebido || mensalidade.valorPago || 0, 0);
  const valorPago = numero(mensalidade.valorPago || 0, 0);
  const valorLiquido = numero(mensalidade.valorLiquido || valorPago, 0);
  const statusFin = statusFinanceiro(mensalidade.status);

  const lancamento = {
    id: lancamentoId,
    tipo: 'receber',
    descricao: descricaoFinanceiraMensalidade(mensalidade, nomePessoa),
    categoria: ehMatriculaInicial(mensalidade) ? 'Matrículas' : 'Mensalidades',
    centroCusto: 'Academia',
    alunoFornecedor: nomePessoa,
    pessoa: nomePessoa,
    pessoaFornecedor: nomePessoa,
    alunoId: mensalidade.alunoId || '',
    matriculaId: mensalidade.matriculaId || '',
    planoId: mensalidade.planoId || '',
    plano: mensalidade.plano || mensalidade.planoNome || '',
    valor: valorPrincipal,
    valorBruto: valorPrincipal,
    valorMensal: numero(mensalidade.valor, 0),
    taxaMatricula: numero(mensalidade.taxaMatricula, 0),
    taxaPlanoMatricula: numero(mensalidade.taxaPlanoMatricula, 0),
    descontoMatricula: numero(mensalidade.descontoMatricula, 0),
    total: valorPrincipal,
    valorPago,
    valorRecebido: valorPago,
    valorRestante: statusFin === 'Pago' ? 0 : Math.max(0, Number((valorPrincipal - valorPago).toFixed(2))),
    valorBrutoRecebido,
    valorLiquido,
    taxaOperadoraPercentual: numero(mensalidade.taxaOperadoraPercentual, 0),
    taxaOperadoraValor: numero(mensalidade.taxaOperadoraValor, 0),
    taxaOperadoraFixa: numero(mensalidade.taxaOperadoraFixa, 0),
    bandeiraCartao: mensalidade.bandeiraCartao || '',
    modalidadeCartao: mensalidade.modalidadeCartao || '',
    parcelasCartao: mensalidade.parcelasCartao || '',
    vencimento: mensalidade.vencimento,
    pagamento,
    dataPagamento: pagamento,
    formaPagamento: mensalidade.formaPagamento || '',
    status: statusFin,
    origem: mensalidade.origem || (ehMatriculaInicial(mensalidade) ? 'matricula_inicial' : 'mensalidades'),
    mensalidadeId: mensalidade.id,
    caixaId: mensalidade.caixaId || '',
    movimentoCaixaId: mensalidade.movimentoCaixaId || '',
    observacoes: mensalidade.observacao || mensalidade.observacoes || '',
    observacao: mensalidade.observacao || mensalidade.observacoes || '',
    atualizadoEm: agoraISO()
  };

  if (existente >= 0) financeiro[existente] = { ...financeiro[existente], ...lancamento };
  else financeiro.push({ ...lancamento, criadoEm: agoraISO() });

  await salvarJson(FINANCEIRO_FILE, financeiro);
  return lancamentoId;
}

async function removerLancamentoFinanceiro(mensalidadeId) {
  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  await salvarJson(FINANCEIRO_FILE, financeiro.filter(l => String(l.mensalidadeId) !== String(mensalidadeId)));
}

async function estornarMovimentoCaixa(movimentoId) {
  if (!movimentoId) return null;

  const dados = await lerJson(CAIXA_FILE, { caixas: [], movimentos: [] });
  dados.caixas = Array.isArray(dados.caixas) ? dados.caixas : [];
  dados.movimentos = Array.isArray(dados.movimentos) ? dados.movimentos : [];

  const idx = dados.movimentos.findIndex(m => String(m.id) === String(movimentoId));
  if (idx < 0) return null;

  const movimento = dados.movimentos[idx];

  if (movimento.status === 'estornado') {
    return movimento;
  }

  dados.movimentos[idx] = {
    ...movimento,
    status: 'estornado',
    estornadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  await salvarJson(CAIXA_FILE, dados);
  return dados.movimentos[idx];
}

async function atualizarLancamentoFinanceiroEstorno(mensalidade, motivo = '') {
  const financeiro = await lerJson(FINANCEIRO_FILE, []);
  const lancamentoId = mensalidade.lancamentoFinanceiroId || `fin_${mensalidade.id}`;
  const idx = financeiro.findIndex(l => String(l.id) === String(lancamentoId));

  const nomePessoa = mensalidade.alunoNome || mensalidade.pessoa || mensalidade.pessoaFornecedor || mensalidade.alunoFornecedor || '';

  const lancamento = {
    id: lancamentoId,
    tipo: 'receber',
    descricao: `Mensalidade ${nomePessoa} - ${mensalidade.competencia}`,
    categoria: 'Mensalidades',
    centroCusto: 'Academia',
    alunoFornecedor: nomePessoa,
    pessoa: nomePessoa,
    pessoaFornecedor: nomePessoa,
    alunoId: mensalidade.alunoId || '',
    valor: numero(mensalidade.valorOriginal || mensalidade.valor, 0),
    vencimento: mensalidade.vencimento,
    pagamento: '',
    dataPagamento: '',
    formaPagamento: '',
    status: 'Aberto',
    origem: 'mensalidades',
    mensalidadeId: mensalidade.id,
    caixaId: '',
    movimentoCaixaId: '',
    observacoes: motivo ? `Estorno: ${motivo}` : 'Pagamento estornado.',
    observacao: motivo ? `Estorno: ${motivo}` : 'Pagamento estornado.',
    atualizadoEm: agoraISO()
  };

  if (idx >= 0) financeiro[idx] = { ...financeiro[idx], ...lancamento };
  else financeiro.push({ ...lancamento, criadoEm: agoraISO() });

  await salvarJson(FINANCEIRO_FILE, financeiro);
  return lancamentoId;
}

async function criarMovimentoCaixaParaMensalidade(mensalidade, pagamento) {
  const dados = await lerJson(CAIXA_FILE, { caixas: [], movimentos: [] });
  dados.caixas = Array.isArray(dados.caixas) ? dados.caixas : [];
  dados.movimentos = Array.isArray(dados.movimentos) ? dados.movimentos : [];

  const caixa = dados.caixas.find(c => c.status === 'aberto');

  if (!caixa) {
    const erro = new Error('Abra o caixa antes de baixar mensalidade.');
    erro.status = 400;
    throw erro;
  }

  const movimentoId = mensalidade.movimentoCaixaId || gerarId('mov');
  const existente = dados.movimentos.findIndex(m => String(m.id) === String(movimentoId));
  const valorPago = numero(pagamento.valorPago, 0);

  const movimento = {
    id: movimentoId,
    caixaId: caixa.id,
    tipo: 'entrada',
    descricao: ehMatriculaInicial(mensalidade)
      ? `Recebimento matrícula inicial ${mensalidade.alunoNome || mensalidade.aluno || ''}`
      : `Recebimento mensalidade ${mensalidade.alunoNome || mensalidade.aluno || ''} - ${mensalidade.competencia}`,
    categoria: ehMatriculaInicial(mensalidade) ? 'Matrículas' : 'Mensalidades',
    pessoa: mensalidade.alunoNome || mensalidade.aluno || '',
    formaPagamento: pagamento.formaPagamento || 'Dinheiro',
    valor: valorPago,
    data: pagamento.dataPagamento || hojeISO(),
    status: 'ativo',
    origem: 'mensalidades',
    mensalidadeId: mensalidade.id,
    observacao: pagamento.observacao || '',
    lancamentoFinanceiroId: mensalidade.lancamentoFinanceiroId || `fin_${mensalidade.id}`,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  if (existente >= 0) dados.movimentos[existente] = { ...dados.movimentos[existente], ...movimento };
  else dados.movimentos.push(movimento);

  await salvarJson(CAIXA_FILE, dados);

  return {
    caixaId: caixa.id,
    movimentoCaixaId: movimento.id
  };
}

function nomeAlunoDeRegistro(m = {}, aluno = null, matricula = null, financeiro = null) {
  return m.alunoNome || m.aluno || m.pessoa || m.alunoFornecedor || m.pessoaFornecedor ||
    aluno?.nome || aluno?.name || aluno?.nomeCompleto ||
    matricula?.aluno || matricula?.alunoNome ||
    financeiro?.alunoFornecedor || financeiro?.pessoa || financeiro?.pessoaFornecedor || '';
}

function nomePlanoDeRegistro(m = {}, plano = null, matricula = null, financeiro = null) {
  return m.planoNome || m.plano ||
    plano?.nome || plano?.name ||
    matricula?.plano || matricula?.planoNome ||
    financeiro?.plano || financeiro?.planoNome || '';
}

export async function listarMensalidades(filtros = {}) {
  const [mensalidades, alunos, planos, financeiro, matriculas] = await Promise.all([
    lerJson(MENSALIDADES_FILE, []),
    lerJson(ALUNOS_FILE, []),
    lerJson(PLANOS_FILE, []),
    lerJson(FINANCEIRO_FILE, []),
    lerJson(path.join(DATA_DIR, 'matriculas.json'), [])
  ]);

  const q = normalizarTexto(filtros.q);
  const status = normalizarTexto(filtros.status);
  const competencia = String(filtros.competencia || '').trim();
  const alunoId = String(filtros.alunoId || '').trim();

  return mensalidades
    .map(m => {
      const vencimento = String(m.vencimento || hojeISO()).slice(0, 10);
      const aluno = alunos.find(a => String(a.id || a._id || '') === String(m.alunoId || '')) || null;
      const matricula = matriculas.find(mat =>
        String(mat.id || '') === String(m.matriculaId || '') ||
        (m.alunoId && String(mat.alunoId || '') === String(m.alunoId))
      ) || null;
      const plano = planos.find(p => String(p.id || p._id || '') === String(m.planoId || matricula?.planoId || '')) || null;
      const fin = financeiro.find(f =>
        String(f.mensalidadeId || '') === String(m.id || '') ||
        String(f.id || '') === String(m.lancamentoFinanceiroId || '')
      ) || null;

      const alunoNome = nomeAlunoDeRegistro(m, aluno, matricula, fin);
      const planoNome = nomePlanoDeRegistro(m, plano, matricula, fin);

      const base = {
        ...m,
        alunoNome,
        aluno: m.aluno || alunoNome,
        planoNome,
        plano: m.plano || planoNome,
        vencimento,
        competencia: competenciaPorVencimento(vencimento),
        valor: numero(m.valor, 0),
        status: calcularStatus({ ...m, vencimento })
      };
      return { ...base, ...calcularValorAtualizado(base) };
    })
    .filter(m => {
      if (q) {
        const alvo = normalizarTexto(`${m.alunoNome} ${m.aluno} ${m.descricao} ${m.planoNome} ${m.plano} ${m.competencia}`);
        if (!alvo.includes(q)) return false;
      }
      if (status && status !== 'todos' && m.status !== status) return false;
      if (competencia && m.competencia !== competencia) return false;
      if (alunoId && String(m.alunoId) !== alunoId) return false;
      return true;
    })
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
}

export async function resumoMensalidades(filtros = {}) {
  const lista = await listarMensalidades(filtros);

  const resumo = {
    total: lista.length,
    abertas: 0,
    pagas: 0,
    parciais: 0,
    atrasadas: 0,
    canceladas: 0,
    valorAberto: 0,
    valorPago: 0,
    valorAtrasado: 0,
    valorPrevisto: 0
  };

  for (const m of lista) {
    if (m.status === 'aberto') {
      resumo.abertas++;
      resumo.valorAberto += numero(m.valorAtualizado ?? m.valor, 0);
    } else if (m.status === 'pago') {
      resumo.pagas++;
      resumo.valorPago += numero(m.valorPago ?? m.valor, 0);
    } else if (m.status === 'parcial') {
      resumo.parciais++;
      resumo.valorAberto += numero(m.saldoRestante ?? 0, 0);
      resumo.valorPago += numero(m.valorPago ?? 0, 0);
    } else if (m.status === 'atrasado') {
      resumo.atrasadas++;
      resumo.valorAtrasado += numero(m.valorAtualizado ?? m.valor, 0);
    } else if (m.status === 'cancelado') {
      resumo.canceladas++;
    }

    if (m.status !== 'cancelado') resumo.valorPrevisto += numero(m.valorAtualizado ?? m.valor, 0);
  }

  for (const k of Object.keys(resumo)) {
    if (k.startsWith('valor')) resumo[k] = Number(resumo[k].toFixed(2));
  }

  return resumo;
}

export async function criarMensalidade(dados = {}) {
  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const aluno = dados.alunoId ? await buscarAluno(dados.alunoId) : null;
  const plano = dados.planoId ? await buscarPlano(dados.planoId) : null;

  const vencimento = String(dados.vencimento || hojeISO()).slice(0, 10);
  const competencia = competenciaPorVencimento(vencimento);
  const valor = numero(dados.valor ?? plano?.valor ?? plano?.preco ?? plano?.valorMensal ?? 0);

  if (!dados.alunoId) {
    const erro = new Error('Aluno obrigatório.');
    erro.status = 400;
    throw erro;
  }

  if (existeDuplicada(mensalidades, dados.alunoId, competencia)) {
    const erro = new Error(`Já existe mensalidade ativa para este aluno na competência ${competencia}.`);
    erro.status = 409;
    throw erro;
  }

  const mensalidadeId = gerarId('men');
  const beneficio = await aplicarPremioNaMensalidade({ alunoId: dados.alunoId, valor, mensalidadeId });
  const mensalidade = {
    id: mensalidadeId,
    alunoId: dados.alunoId || '',
    alunoNome: dados.alunoNome || aluno?.nome || aluno?.name || '',
    planoId: dados.planoId || '',
    planoNome: dados.planoNome || plano?.nome || plano?.name || '',
    competencia,
    vencimento,
    valor: beneficio.valor,
    valorOriginal: beneficio.valorOriginal,
    desconto: beneficio.desconto,
    descontoFidelidadePercentual: beneficio.premio?.percentual || 0,
    premioFidelidadeId: beneficio.premio?.id || '',
    status: statusInterno(dados.status || 'aberto'),
    descricao: dados.descricao || 'Mensalidade',
    observacao: dados.observacao || '',
    lancamentoFinanceiroId: '',
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  mensalidade.lancamentoFinanceiroId = await upsertLancamentoFinanceiro(mensalidade);
  mensalidades.push(mensalidade);
  await salvarJson(MENSALIDADES_FILE, mensalidades);
  if (beneficio.premio?.id) await vincularMensalidadePremio(beneficio.premio.id, mensalidade.id);

  return mensalidade;
}

export async function gerarMensalidades(dados = {}) {
  const aluno = await buscarAluno(dados.alunoId);
  const plano = dados.planoId ? await buscarPlano(dados.planoId) : null;
  const quantidade = Math.max(1, numero(dados.quantidade, 1));
  const primeiroVencimento = String(dados.primeiroVencimento || dados.vencimento || hojeISO()).slice(0, 10);
  const valor = numero(dados.valor ?? plano?.valor ?? plano?.preco ?? plano?.valorMensal ?? 0);
  const criadas = [];
  const ignoradas = [];

  for (let i = 0; i < quantidade; i++) {
    const vencimento = adicionarMeses(primeiroVencimento, i);

    try {
      criadas.push(await criarMensalidade({
        alunoId: dados.alunoId || '',
        alunoNome: dados.alunoNome || aluno?.nome || aluno?.name || '',
        planoId: dados.planoId || '',
        planoNome: dados.planoNome || plano?.nome || plano?.name || '',
        vencimento,
        valor,
        descricao: dados.descricao || 'Mensalidade',
        observacao: dados.observacao || ''
      }));
    } catch (erro) {
      if (erro.status === 409) {
        ignoradas.push({ competencia: competenciaPorVencimento(vencimento), motivo: erro.message });
      } else {
        throw erro;
      }
    }
  }

  return { criadas, ignoradas };
}

export async function atualizarMensalidade(id, dados = {}) {
  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const idx = mensalidades.findIndex(m => String(m.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Mensalidade não encontrada.');
    erro.status = 404;
    throw erro;
  }

  const vencimento = String(dados.vencimento || mensalidades[idx].vencimento || hojeISO()).slice(0, 10);
  const competencia = competenciaPorVencimento(vencimento);
  const alunoId = dados.alunoId || mensalidades[idx].alunoId;

  if (existeDuplicada(mensalidades, alunoId, competencia, id)) {
    const erro = new Error(`Já existe mensalidade ativa para este aluno na competência ${competencia}.`);
    erro.status = 409;
    throw erro;
  }

  const atualizada = {
    ...mensalidades[idx],
    ...dados,
    alunoId,
    vencimento,
    competencia,
    valor: dados.valor !== undefined ? numero(dados.valor) : numero(mensalidades[idx].valor, 0),
    status: statusInterno(dados.status || mensalidades[idx].status || 'aberto'),
    atualizadoEm: agoraISO()
  };

  atualizada.lancamentoFinanceiroId = await upsertLancamentoFinanceiro(atualizada);
  mensalidades[idx] = atualizada;
  await salvarJson(MENSALIDADES_FILE, mensalidades);

  return atualizada;
}

export async function baixarMensalidade(id, dados = {}) {
  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const idx = mensalidades.findIndex(m => String(m.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Mensalidade não encontrada.');
    erro.status = 404;
    throw erro;
  }

  const atual = mensalidades[idx];

  if (statusInterno(atual.status) === 'pago') {
    const erro = new Error('Esta mensalidade já está paga.');
    erro.status = 409;
    throw erro;
  }

  const calculo = calcularValorAtualizado(atual);
  const desconto = numero(dados.desconto, 0);
  const multa = dados.multa !== undefined ? numero(dados.multa, 0) : numero(calculo.multa, 0);
  const juros = dados.juros !== undefined ? numero(dados.juros, 0) : numero(calculo.juros, 0);
  const valorBaseCobranca = valorPrincipalMensalidade(atual);
  const valorDevido = Math.max(0, valorBaseCobranca + multa + juros - desconto);
  const valorPago = numero(dados.valorPago, valorDevido);

  if (valorPago <= 0) {
    const erro = new Error('Valor pago deve ser maior que zero.');
    erro.status = 400;
    throw erro;
  }

  const saldoRestante = Number(Math.max(0, valorDevido - valorPago).toFixed(2));
  const status = saldoRestante > 0 ? 'parcial' : 'pago';

  const baseBaixa = {
    ...atual,
    status,
    dataPagamento: dados.dataPagamento || hojeISO(),
    pagamento: dados.dataPagamento || hojeISO(),
    formaPagamento: dados.formaPagamento || 'Dinheiro',
    valorOriginal: valorBaseCobranca,
    valorDevido: Number(valorDevido.toFixed(2)),
    valorPago,
    valorBrutoRecebido: numero(dados.valorBrutoRecebido ?? dados.valorPago, valorPago),
    valorLiquido: numero(dados.valorLiquido ?? dados.valorPago, valorPago),
    taxaOperadoraPercentual: numero(dados.taxaOperadoraPercentual, 0),
    taxaOperadoraValor: numero(dados.taxaOperadoraValor, 0),
    taxaOperadoraFixa: numero(dados.taxaOperadoraFixa, 0),
    bandeiraCartao: dados.bandeiraCartao || '',
    modalidadeCartao: dados.modalidadeCartao || '',
    parcelasCartao: dados.parcelasCartao || '',
    desconto,
    multa,
    juros,
    saldoRestante,
    observacao: dados.observacao ?? atual.observacao ?? '',
    baixadoPor: dados.usuario || 'Administrador',
    baixadoEm: agoraISO(),
    atualizadoEm: agoraISO()
  };

  const vinculosCaixa = await criarMovimentoCaixaParaMensalidade(baseBaixa, {
    valorPago: baseBaixa.valorLiquido || valorPago,
    formaPagamento: baseBaixa.formaPagamento,
    dataPagamento: baseBaixa.dataPagamento,
    observacao: baseBaixa.observacao
  });

  const paga = {
    ...baseBaixa,
    caixaId: vinculosCaixa.caixaId,
    movimentoCaixaId: vinculosCaixa.movimentoCaixaId
  };

  paga.lancamentoFinanceiroId = await upsertLancamentoFinanceiro(paga);
  mensalidades[idx] = paga;
  await salvarJson(MENSALIDADES_FILE, mensalidades);

  // Após a baixa efetiva, gera a próxima mensalidade uma única vez.
  // Isto também vale para matrícula inicial paga: ela é cobrança única,
  // mas o pagamento dela libera a primeira recorrência do mês seguinte.
  let cobrancaAutomatica = null;
  if (statusInterno(paga.status) === 'pago') {
    try {
      cobrancaAutomatica = await gerarProximaMensalidadeAposPagamento({
        mensalidadeId: paga.id,
        financeiroId: paga.lancamentoFinanceiroId || '',
        alunoId: paga.alunoId || '',
        usuario: dados.usuario || 'mensalidades'
      });
    } catch (erroMotor) {
      cobrancaAutomatica = {
        ok: false,
        gerada: false,
        motivo: erroMotor?.message || 'Motor de cobrança não executado.'
      };
    }
  }

  return { ...paga, cobrancaAutomatica };
}

export async function estornarBaixaMensalidade(id, dados = {}) {
  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const idx = mensalidades.findIndex(m => String(m.id) === String(id));

  if (idx < 0) {
    const erro = new Error('Mensalidade não encontrada.');
    erro.status = 404;
    throw erro;
  }

  const atual = mensalidades[idx];
  const status = statusInterno(atual.status);

  if (status !== 'pago' && status !== 'parcial') {
    const erro = new Error('Apenas mensalidades pagas ou parciais podem ser estornadas.');
    erro.status = 400;
    throw erro;
  }

  await estornarMovimentoCaixa(atual.movimentoCaixaId);

  const estornada = {
    ...atual,
    status: 'aberto',
    dataPagamento: '',
    pagamento: '',
    formaPagamento: '',
    valorPago: 0,
    desconto: 0,
    multa: 0,
    juros: 0,
    saldoRestante: 0,
    valorDevido: numero(atual.valorOriginal || atual.valor, 0),
    caixaId: '',
    movimentoCaixaId: '',
    estornadoEm: agoraISO(),
    estornadoPor: dados.usuario || 'Administrador',
    motivoEstorno: dados.motivo || 'Estorno de baixa.',
    observacao: dados.motivo || atual.observacao || '',
    atualizadoEm: agoraISO()
  };

  estornada.lancamentoFinanceiroId = await atualizarLancamentoFinanceiroEstorno(estornada, dados.motivo || '');

  mensalidades[idx] = estornada;
  await salvarJson(MENSALIDADES_FILE, mensalidades);

  return estornada;
}

export async function cancelarMensalidade(id, dados = {}) {
  return atualizarMensalidade(id, {
    status: 'cancelado',
    observacao: dados.observacao || 'Mensalidade cancelada.'
  });
}

export async function excluirMensalidade(id) {
  const mensalidades = await lerJson(MENSALIDADES_FILE, []);
  const existe = mensalidades.some(m => String(m.id) === String(id));

  if (!existe) {
    const erro = new Error('Mensalidade não encontrada.');
    erro.status = 404;
    throw erro;
  }

  await salvarJson(MENSALIDADES_FILE, mensalidades.filter(m => String(m.id) !== String(id)));
  await removerLancamentoFinanceiro(id);

  return { ok: true };
}

export async function historicoAluno(alunoId) {
  return listarMensalidades({ alunoId });
}
