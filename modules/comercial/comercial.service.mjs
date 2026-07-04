import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const COMERCIAL_DIR = path.join(DATA_DIR, 'comercial');
const CONTRATOS_FILE = path.join(COMERCIAL_DIR, 'contratos.json');
const SERVICOS_FILE = path.join(COMERCIAL_DIR, 'servicos.json');
const SERVICOS_CONTRATADOS_FILE = path.join(COMERCIAL_DIR, 'servicos_contratados.json');
const TURMAS_FILE = path.join(DATA_DIR, 'turmas.json');
const ALUNOS_FILE = path.join(DATA_DIR, 'alunos.json');

async function garantirArquivo(arquivo, padrao = []) {
  try { await fs.access(arquivo); }
  catch {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), 'utf8');
  }
}
async function lerJson(arquivo, padrao = []) {
  await garantirArquivo(arquivo, padrao);
  const raw = await fs.readFile(arquivo, 'utf8');
  if (!raw.trim()) return padrao;
  try { return JSON.parse(raw); } catch { return padrao; }
}
async function salvarJson(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}
function id(prefixo) { return `${prefixo}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`; }
function dinheiro(v) { const n = Number(String(v ?? 0).replace(',', '.')); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; }
function texto(v) { return String(v ?? '').trim(); }
function agora() { return new Date().toISOString(); }
function normalizar(v) { return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function ativo(item) { return !['removido','removida','cancelado','cancelada','inativo','inativa','encerrado','encerrada'].includes(normalizar(item?.status)); }
function valorServico(servico, tipoCobranca = 'Mensal') {
  const tipo = normalizar(tipoCobranca);
  if (tipo.includes('diar')) return dinheiro(servico.valorDiarista ?? servico.valorAvulso ?? servico.valorMensal ?? servico.valor);
  if (tipo.includes('pre')) return dinheiro(servico.valorPrePago ?? servico.valorMensal ?? servico.valor);
  return dinheiro(servico.valorMensal ?? servico.valor);
}
async function bases() {
  return {
    alunos: await lerJson(ALUNOS_FILE, []),
    contratos: await lerJson(CONTRATOS_FILE, []),
    servicos: await lerJson(SERVICOS_FILE, []),
    servicosContratados: await lerJson(SERVICOS_CONTRATADOS_FILE, []),
    turmas: await lerJson(TURMAS_FILE, [])
  };
}
async function salvarServicosContratados(lista) { await salvarJson(SERVICOS_CONTRATADOS_FILE, lista); }
async function salvarContratos(lista) { await salvarJson(CONTRATOS_FILE, lista); }
function localizarContrato(contratos, contratoId) {
  return contratos.find(c => String(c.id) === String(contratoId) || String(c.matriculaId || '') === String(contratoId));
}
function contratoAtivoAluno(contratos, alunoId) {
  const lista = contratos.filter(c => String(c.alunoId) === String(alunoId));
  return lista.find(c => ativo(c)) || lista[0] || null;
}
function localizarAluno(alunos, alunoId) {
  return alunos.find(a => String(a.id) === String(alunoId) || String(a._id || '') === String(alunoId)) || null;
}
function localizarServico(servicos, turmas, entrada = {}) {
  const servicoId = entrada.servicoId || entrada.servico_id || '';
  const turmaId = entrada.turmaId || entrada.turma_id || '';
  let servico = servicos.find(s => String(s.id) === String(servicoId));
  const turma = turmas.find(t => String(t.id) === String(turmaId));
  if (!servico && turma) {
    const mod = normalizar(turma.modalidade || turma.nome);
    servico = servicos.find(s => normalizar(s.modalidade || s.nome) === mod) || null;
  }
  if (!servico && servicoId) throw Object.assign(new Error('Serviço não encontrado.'), { status: 404 });
  if (turmaId && !turma) throw Object.assign(new Error('Turma não encontrada.'), { status: 404 });
  return { servico, turma };
}
function montarItem(contrato, servico, turma, dados = {}) {
  const tipoCobranca = dados.tipoCobranca || contrato.tipoCobranca || contrato.tipoPlano || 'Mensal';
  const base = turma || servico || {};
  const valorPadrao = servico ? valorServico(servico, tipoCobranca) : valorServico(base, tipoCobranca);
  const valor = dados.valor !== undefined && dados.valor !== '' ? dinheiro(dados.valor) : valorPadrao;
  return {
    id: id('sc'),
    contratoId: contrato.id,
    alunoId: contrato.alunoId || '',
    aluno: contrato.aluno || '',
    matriculaId: contrato.matriculaId || '',
    servicoId: servico?.id || dados.servicoId || '',
    servico: servico?.nome || base.modalidade || base.nome || dados.servico || '',
    modalidade: servico?.modalidade || base.modalidade || dados.modalidade || '',
    turmaId: turma?.id || dados.turmaId || '',
    turma: turma?.nome || dados.turma || '',
    professor: turma?.professor || dados.professor || '',
    diasSemana: turma?.diasSemana || dados.diasSemana || '',
    horario: turma?.horario || dados.horario || '',
    sala: turma?.sala || dados.sala || '',
    tipoCobranca,
    valor,
    valorOriginal: valor,
    status: dados.status || 'Ativo',
    observacao: dados.observacao || '',
    criadoEm: agora(),
    atualizadoEm: agora()
  };
}
function servicosAtivosContrato(servicosContratados, contratoId) {
  return servicosContratados.filter(s => String(s.contratoId) === String(contratoId) && ativo(s));
}
function totalContrato(contrato, servicosContratados) {
  const valorMatricula = dinheiro(contrato.valorMatricula ?? contrato.valorBaseMatricula ?? 0);
  const servicos = servicosAtivosContrato(servicosContratados, contrato.id);
  const valorServicos = dinheiro(servicos.reduce((t, s) => t + dinheiro(s.valor), 0));
  return { valorMatricula, valorServicos, total: dinheiro(valorMatricula + valorServicos), servicos };
}
async function atualizarTotaisContrato(contratoId) {
  const { contratos, servicosContratados } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const totais = totalContrato(contrato, servicosContratados);
  contrato.valorServicos = totais.valorServicos;
  contrato.valorTotal = totais.total;
  contrato.totalMensal = totais.total;
  contrato.quantidadeServicos = totais.servicos.length;
  contrato.atualizadoEm = agora();
  await salvarContratos(contratos);
  return { contrato, ...totais };
}
function turmasPorServico(turmas, servico) {
  const modalidade = normalizar(servico?.modalidade || servico?.nome || '');
  return turmas.filter(t => ativo(t) && (!modalidade || normalizar(t.modalidade || t.nome).includes(modalidade) || modalidade.includes(normalizar(t.modalidade || t.nome))));
}
function montarServicosChecklist(servicos, turmas, servicosAtivos, tipoCobranca) {
  return servicos.filter(ativo).map(servico => {
    const contratado = servicosAtivos.find(s => String(s.servicoId) === String(servico.id) || normalizar(s.servico) === normalizar(servico.nome));
    return {
      ...servico,
      valorPadrao: valorServico(servico, tipoCobranca),
      contratado: Boolean(contratado),
      servicoContratadoId: contratado?.id || '',
      valorAtual: contratado ? dinheiro(contratado.valor) : valorServico(servico, tipoCobranca),
      turmaId: contratado?.turmaId || '',
      turmas: turmasPorServico(turmas, servico)
    };
  });
}

export async function statusComercial() {
  return { ok: true, modulo: 'comercial', versao: 'Fusion ERP 2.0-C', status: 'Online', conceito: 'Central do aluno com contrato e checklist de serviços' };
}
export async function listarServicos() { const { servicos } = await bases(); return { ok: true, dados: servicos }; }
export async function listarContratos(filtros = {}) {
  const { contratos } = await bases();
  let lista = contratos;
  if (filtros.alunoId) lista = lista.filter(c => String(c.alunoId) === String(filtros.alunoId));
  if (filtros.status) lista = lista.filter(c => String(c.status) === String(filtros.status));
  return { ok: true, dados: lista };
}
export async function listarServicosContratados(filtros = {}) {
  const { servicosContratados } = await bases();
  let lista = servicosContratados;
  if (filtros.contratoId) lista = lista.filter(s => String(s.contratoId) === String(filtros.contratoId));
  if (filtros.alunoId) lista = lista.filter(s => String(s.alunoId) === String(filtros.alunoId));
  if (filtros.status) lista = lista.filter(s => String(s.status) === String(filtros.status));
  return { ok: true, dados: lista };
}
export async function obterResumoContrato(contratoId) {
  const { contratos, servicos, servicosContratados, turmas } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const totais = totalContrato(contrato, servicosContratados);
  const checklist = montarServicosChecklist(servicos, turmas, totais.servicos, contrato.tipoCobranca || contrato.tipoPlano);
  return { ok: true, contrato, servicosContratados: totais.servicos, servicosDisponiveis: servicos, turmasDisponiveis: turmas.filter(ativo), checklist, totais: { valorMatricula: totais.valorMatricula, valorServicos: totais.valorServicos, total: totais.total } };
}
export async function obterCentralAluno(alunoId) {
  const { alunos, contratos, servicos, servicosContratados, turmas } = await bases();
  const aluno = localizarAluno(alunos, alunoId);
  const contratosAluno = contratos.filter(c => String(c.alunoId) === String(alunoId));
  const contrato = contratoAtivoAluno(contratos, alunoId);
  if (!contrato) return { ok: true, aluno: aluno || { id: alunoId }, contrato: null, contratos: contratosAluno, servicosContratados: [], servicosDisponiveis: servicos, turmasDisponiveis: turmas.filter(ativo), checklist: [], totais: { valorMatricula: 0, valorServicos: 0, total: 0 }, mensagem: 'Aluno sem contrato comercial.' };
  const totais = totalContrato(contrato, servicosContratados);
  const checklist = montarServicosChecklist(servicos, turmas, totais.servicos, contrato.tipoCobranca || contrato.tipoPlano);
  return { ok: true, aluno: aluno || { id: alunoId, nome: contrato.aluno }, contrato, contratos: contratosAluno, servicosContratados: totais.servicos, servicosDisponiveis: servicos, turmasDisponiveis: turmas.filter(ativo), checklist, totais: { valorMatricula: totais.valorMatricula, valorServicos: totais.valorServicos, total: totais.total } };
}
export async function atualizarValorMatricula(contratoId, dados = {}) {
  const { contratos, servicosContratados } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const anterior = dinheiro(contrato.valorMatricula ?? 0);
  contrato.valorMatricula = dinheiro(dados.valorMatricula ?? dados.valor ?? dados.valorBaseMatricula ?? 0);
  contrato.observacaoValorMatricula = dados.observacao || contrato.observacaoValorMatricula || '';
  contrato.historico = Array.isArray(contrato.historico) ? contrato.historico : [];
  contrato.historico.push({ id: id('hist_ctr'), acao: 'alterar_valor_matricula', anterior, atual: contrato.valorMatricula, usuario: dados.usuario || 'sistema', criadoEm: agora() });
  const totais = totalContrato(contrato, servicosContratados);
  contrato.valorServicos = totais.valorServicos;
  contrato.valorTotal = totais.total;
  contrato.totalMensal = totais.total;
  contrato.atualizadoEm = agora();
  await salvarContratos(contratos);
  return { ok: true, contrato, totais: { valorMatricula: totais.valorMatricula, valorServicos: totais.valorServicos, total: totais.total } };
}
export async function incluirServicoContrato(contratoId, dados = {}) {
  const { contratos, servicos, servicosContratados, turmas } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const { servico, turma } = localizarServico(servicos, turmas, dados);
  if (!servico && !turma) throw Object.assign(new Error('Informe servicoId ou turmaId.'), { status: 400 });
  const duplicado = servicosContratados.find(s => String(s.contratoId) === String(contrato.id) && ativo(s) && ((dados.turmaId && String(s.turmaId) === String(dados.turmaId)) || (dados.servicoId && String(s.servicoId) === String(dados.servicoId) && !dados.turmaId)));
  if (duplicado) throw Object.assign(new Error('Este serviço/turma já está ativo no contrato.'), { status: 409 });
  const item = montarItem(contrato, servico, turma, dados);
  servicosContratados.push(item);
  await salvarServicosContratados(servicosContratados);
  const resumo = await atualizarTotaisContrato(contrato.id);
  return { ok: true, dados: item, contrato: resumo.contrato, totais: { valorMatricula: resumo.valorMatricula, valorServicos: resumo.valorServicos, total: resumo.total } };
}
export async function atualizarServicoContrato(contratoId, servicoContratadoId, dados = {}) {
  const { contratos, servicosContratados } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const idx = servicosContratados.findIndex(s => String(s.id) === String(servicoContratadoId) && String(s.contratoId) === String(contrato.id));
  if (idx < 0) throw Object.assign(new Error('Serviço contratado não encontrado.'), { status: 404 });
  const atual = servicosContratados[idx];
  servicosContratados[idx] = { ...atual, valor: dados.valor !== undefined ? dinheiro(dados.valor) : atual.valor, turmaId: dados.turmaId ?? atual.turmaId, status: dados.status || atual.status, observacao: dados.observacao ?? atual.observacao, atualizadoEm: agora() };
  await salvarServicosContratados(servicosContratados);
  const resumo = await atualizarTotaisContrato(contrato.id);
  return { ok: true, dados: servicosContratados[idx], contrato: resumo.contrato, totais: { valorMatricula: resumo.valorMatricula, valorServicos: resumo.valorServicos, total: resumo.total } };
}
export async function removerServicoContrato(contratoId, servicoContratadoId, dados = {}) {
  const { contratos, servicosContratados } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const idx = servicosContratados.findIndex(s => String(s.id) === String(servicoContratadoId) && String(s.contratoId) === String(contrato.id));
  if (idx < 0) throw Object.assign(new Error('Serviço contratado não encontrado.'), { status: 404 });
  servicosContratados[idx] = { ...servicosContratados[idx], status: 'Removido', removidoEm: agora(), motivoRemocao: dados.motivo || '', atualizadoEm: agora() };
  await salvarServicosContratados(servicosContratados);
  const resumo = await atualizarTotaisContrato(contrato.id);
  return { ok: true, removido: true, dados: servicosContratados[idx], contrato: resumo.contrato, totais: { valorMatricula: resumo.valorMatricula, valorServicos: resumo.valorServicos, total: resumo.total } };
}
export async function salvarChecklistContrato(contratoId, dados = {}) {
  const { contratos, servicos, servicosContratados, turmas } = await bases();
  const contrato = localizarContrato(contratos, contratoId);
  if (!contrato) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const selecionados = Array.isArray(dados.servicos) ? dados.servicos : [];
  const ativosAtuais = servicosAtivosContrato(servicosContratados, contrato.id);
  const idsSelecionados = new Set(selecionados.map(s => String(s.servicoContratadoId || s.servicoId || s.turmaId || '')).filter(Boolean));

  for (const atual of ativosAtuais) {
    const continua = selecionados.some(s => String(s.servicoContratadoId || '') === String(atual.id) || (s.servicoId && String(s.servicoId) === String(atual.servicoId) && (!s.turmaId || String(s.turmaId) === String(atual.turmaId))));
    if (!continua) {
      const idx = servicosContratados.findIndex(s => String(s.id) === String(atual.id));
      if (idx >= 0) servicosContratados[idx] = { ...servicosContratados[idx], status: 'Removido', removidoEm: agora(), motivoRemocao: 'Removido pelo checklist', atualizadoEm: agora() };
    }
  }

  for (const item of selecionados) {
    if (item.servicoContratadoId) {
      const idx = servicosContratados.findIndex(s => String(s.id) === String(item.servicoContratadoId) && String(s.contratoId) === String(contrato.id));
      if (idx >= 0) servicosContratados[idx] = { ...servicosContratados[idx], valor: item.valor !== undefined ? dinheiro(item.valor) : servicosContratados[idx].valor, turmaId: item.turmaId || servicosContratados[idx].turmaId, status: 'Ativo', atualizadoEm: agora() };
      continue;
    }
    const { servico, turma } = localizarServico(servicos, turmas, item);
    if (!servico && !turma) continue;
    const jaExiste = servicosContratados.find(s => String(s.contratoId) === String(contrato.id) && ativo(s) && ((item.turmaId && String(s.turmaId) === String(item.turmaId)) || (item.servicoId && String(s.servicoId) === String(item.servicoId) && !item.turmaId)));
    if (!jaExiste) servicosContratados.push(montarItem(contrato, servico, turma, item));
  }

  await salvarServicosContratados(servicosContratados);
  const resumo = await atualizarTotaisContrato(contrato.id);
  return { ok: true, contrato: resumo.contrato, totais: { valorMatricula: resumo.valorMatricula, valorServicos: resumo.valorServicos, total: resumo.total } };
}
