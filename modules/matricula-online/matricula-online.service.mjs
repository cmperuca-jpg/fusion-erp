import path from 'node:path';
import crypto from 'node:crypto';
import { integrarMatriculaAluno } from '../matriculas/matricula.integracao.service.mjs';
import { lerJsonDuravel, salvarJsonDuravel, executarTransacaoJson } from '../core/persistence/durable-json.mjs';
import { criarNotificacao } from '../notificacoes/notificacoes.service.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SOLICITACOES_FILE = path.join(DATA_DIR, 'matriculas_online.json');
const ALUNOS_FILE = path.join(DATA_DIR, 'alunos.json');
const PLANOS_FILE = path.join(DATA_DIR, 'planos.json');

async function lerJson(arquivo, padrao = []) {
  try { return await lerJsonDuravel(arquivo, padrao); } catch { return padrao; }
}
async function salvarJson(arquivo, dados) { return salvarJsonDuravel(arquivo, dados); }
function agoraISO() { return new Date().toISOString(); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v ?? '').trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function numeros(v) { return String(v ?? '').replace(/\D/g, ''); }
function numero(v, padrao = 0) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao; }
function mesmoId(a, b) { return String(a || '') === String(b || ''); }
function nomePlano(plano = {}) { return texto(plano.nome || plano.descricao || plano.titulo || plano.plano || ''); }
function valorPlano(plano = {}) { return numero(plano.valorMensal ?? plano.valor ?? plano.mensalidade ?? plano.preco ?? 0); }
function planoAtivo(plano = {}) { return !['inativo','cancelado','excluido','excluído'].includes(normalizar(plano.status || 'ativo')); }
function erro(mensagem, status = 400) { const e = new Error(mensagem); e.status = status; throw e; }
function cpfValido(valor) {
  const cpf = numeros(valor);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  let dig = 11 - (soma % 11); if (dig >= 10) dig = 0;
  if (dig !== Number(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  dig = 11 - (soma % 11); if (dig >= 10) dig = 0;
  return dig === Number(cpf[10]);
}
function dataISO(valor) { const v = texto(valor); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; const n = numeros(v); if (n.length !== 8) return ''; return `${n.slice(4,8)}-${n.slice(2,4)}-${n.slice(0,2)}`; }
function base64ArquivoValido(valor = '') { return /^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(String(valor || '')) && String(valor || '').length > 250; }
function fotoValida(foto = '') { return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(String(foto || '')) && String(foto || '').length > 300; }
function assinaturaValida(assinatura = '') { return /^data:image\/png;base64,/i.test(String(assinatura || '')) && String(assinatura || '').length > 400; }
function statusAluno(a = {}) { return normalizar(a.status || a.situacao || a.statusMatricula || a.matriculaStatus || ''); }
function cpfJaCadastrado(alunos = [], cpf = '') { const alvo = numeros(cpf); return alunos.find(a => alvo && numeros(a.cpf || a.documento || a.cpfAluno) === alvo) || null; }
function solicitacaoCpfAberta(solicitacoes = [], cpf = '') { const alvo = numeros(cpf); return solicitacoes.find(s => alvo && numeros(s.cpf || s.documento) === alvo && !['rejeitada','cancelada','cancelado'].includes(normalizar(s.status))) || null; }
function normalizarDocumento(doc = {}, nomePadrao = '') {
  const nome = texto(doc.nome || nomePadrao);
  const tipo = texto(doc.tipo || '');
  const base64 = texto(doc.base64 || doc.arquivo || doc.dataUrl);
  if (!base64) return null;
  if (!base64ArquivoValido(base64)) erro(`Arquivo inválido: ${nomePadrao || nome}. Envie imagem ou PDF válido.`);
  return { nome: nome || nomePadrao, tipo, tamanho: numero(doc.tamanho, 0), base64 };
}
function normalizarDocumentos(dados = {}) {
  const docs = dados.documentos || {};
  return {
    rgFrente: normalizarDocumento(docs.rgFrente || dados.rgFrente || {}, 'RG frente'),
    rgVerso: normalizarDocumento(docs.rgVerso || dados.rgVerso || {}, 'RG verso'),
    comprovanteResidencia: normalizarDocumento(docs.comprovanteResidencia || dados.comprovanteResidencia || {}, 'Comprovante de residência'),
    atestadoMedico: normalizarDocumento(docs.atestadoMedico || dados.atestadoMedico || {}, 'Atestado médico')
  };
}

function formatarCpf(valor = '') {
  const n = numeros(valor).slice(0, 11);
  if (n.length !== 11) return n;
  return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9,11)}`;
}
function statusDescricaoAluno(aluno = {}) {
  const st = statusAluno(aluno) || 'cadastrado';
  if (['ativo','ativa','regular'].includes(st)) return 'Ativo';
  if (['pre-matriculado','pre matriculado','pendente'].includes(st)) return 'Pré-matriculado/Pendente';
  if (['inativo','inativa','cancelado','cancelada','desligado','desligada','encerrado','encerrada'].includes(st)) return 'Inativo/Cancelado';
  return st;
}
function exporResumoAlunoCpf(aluno = {}) {
  if (!aluno) return null;
  return {
    id: aluno.id || aluno._id || '',
    nome: aluno.nome || aluno.nomeCompleto || aluno.aluno || 'Aluno cadastrado',
    cpf: formatarCpf(aluno.cpf || aluno.documento || aluno.cpfAluno || ''),
    status: statusDescricaoAluno(aluno),
    matriculaId: aluno.matriculaId || '',
    numeroMatricula: aluno.numeroMatricula || ''
  };
}
function exporResumoSolicitacaoCpf(s = {}) {
  if (!s) return null;
  return {
    id: s.id || '',
    protocolo: s.protocolo || '',
    nome: s.nome || 'Solicitação existente',
    cpf: formatarCpf(s.cpf || s.documento || ''),
    status: s.status || 'aguardando',
    criadoEm: s.criadoEm || ''
  };
}
export async function validarCpfMatriculaOnline(cpf = '') {
  const cpfLimpo = numeros(cpf);
  if (!cpfLimpo) erro('Informe o CPF.', 400);
  if (!cpfValido(cpfLimpo)) erro('CPF inválido. Confira os números digitados.', 400);

  const [alunos, solicitacoes] = await Promise.all([
    lerJson(ALUNOS_FILE, []),
    lerJson(SOLICITACOES_FILE, [])
  ]);

  const aluno = cpfJaCadastrado(alunos, cpfLimpo);
  if (aluno) {
    const resumo = exporResumoAlunoCpf(aluno);
    return {
      ok: true,
      valido: true,
      disponivel: false,
      bloqueado: true,
      motivo: 'aluno_existente',
      aluno: resumo,
      mensagem: `CPF já cadastrado para ${resumo.nome}. Situação: ${resumo.status}. Procure a recepção para regularizar ou reativar o cadastro.`
    };
  }

  const solicitacao = solicitacaoCpfAberta(solicitacoes, cpfLimpo);
  if (solicitacao) {
    const resumo = exporResumoSolicitacaoCpf(solicitacao);
    return {
      ok: true,
      valido: true,
      disponivel: false,
      bloqueado: true,
      motivo: 'solicitacao_existente',
      solicitacao: resumo,
      mensagem: `Já existe solicitação de matrícula para este CPF. Protocolo: ${resumo.protocolo || resumo.id}.`
    };
  }

  return {
    ok: true,
    valido: true,
    disponivel: true,
    bloqueado: false,
    motivo: '',
    cpf: formatarCpf(cpfLimpo),
    mensagem: 'CPF disponível para matrícula.'
  };
}

function validarSolicitacao(dados = {}) {
  const documentos = normalizarDocumentos(dados);
  const base = {
    nome: texto(dados.nome || dados.nomeCompleto), cpf: numeros(dados.cpf || dados.documento), telefone: numeros(dados.telefone || dados.whatsapp || dados.celular), email: texto(dados.email).toLowerCase(), dataNascimento: dataISO(dados.dataNascimento || dados.data_nascimento), sexo: texto(dados.sexo), rg: texto(dados.rg),
    cep: numeros(dados.cep), endereco: texto(dados.endereco || dados.rua || dados.logradouro), numero: texto(dados.numero), complemento: texto(dados.complemento), bairro: texto(dados.bairro), cidade: texto(dados.cidade), estado: texto(dados.estado).toUpperCase().slice(0, 2),
    planoId: texto(dados.planoId || dados.plano_id || dados.plano), horarioPreferido: texto(dados.horarioPreferido || dados.horario), modalidade: texto(dados.modalidade || dados.servico || dados.servicoDesejado), objetivo: texto(dados.objetivo), restricoes: texto(dados.restricoes || dados.restricoesMedicas), observacao: texto(dados.observacao || dados.observacoes),
    fotoBase64: texto(dados.fotoBase64 || dados.foto_base64 || dados.foto), documentos, assinaturaBase64: texto(dados.assinaturaBase64 || dados.assinatura || ''), aceiteTermos: Boolean(dados.aceiteTermos), aceiteImagem: Boolean(dados.aceiteImagem), aceiteLgpd: Boolean(dados.aceiteLgpd), aceiteContrato: Boolean(dados.aceiteContrato)
  };
  if (base.nome.length < 3) erro('Informe o nome completo.');
  if (!base.cpf) erro('Informe o CPF.');
  if (!cpfValido(base.cpf)) erro('CPF inválido. Confira os números digitados.');
  if (!base.telefone) erro('Informe um telefone ou WhatsApp.');
  if (!base.dataNascimento) erro('Informe a data de nascimento.');
  if (!base.cep || base.cep.length !== 8) erro('Informe o CEP completo.');
  if (!base.endereco) erro('Informe o endereço.');
  if (!base.numero) erro('Informe o número do endereço.');
  if (!base.bairro) erro('Informe o bairro.');
  if (!base.cidade) erro('Informe a cidade.');
  if (!base.estado || base.estado.length !== 2) erro('Informe o estado com 2 letras.');
  if (!base.planoId) erro('Selecione um plano.');
  if (!fotoValida(base.fotoBase64)) erro('A foto é obrigatória. Tire uma foto pelo celular ou selecione uma imagem.');
  if (!base.documentos.rgFrente) erro('Anexe o RG frente.');
  if (!base.documentos.comprovanteResidencia) erro('Anexe o comprovante de residência.');
  if (!assinaturaValida(base.assinaturaBase64)) erro('Assinatura digital obrigatória.');
  if (!base.aceiteTermos || !base.aceiteImagem || !base.aceiteLgpd || !base.aceiteContrato) erro('Aceite todos os termos obrigatórios para enviar a matrícula.');
  return base;
}
function exporSolicitacao(s = {}) {
  return {
    id: s.id, protocolo: s.protocolo, nome: s.nome, cpf: s.cpf, telefone: s.telefone, whatsapp: s.whatsapp, email: s.email,
    dataNascimento: s.dataNascimento || '', sexo: s.sexo || '', rg: s.rg || '', fotoBase64: s.fotoBase64 || '', documentos: s.documentos || {}, assinaturaBase64: s.assinaturaBase64 || '',
    cep: s.cep || '', endereco: s.endereco || '', numero: s.numero || '', complemento: s.complemento || '', bairro: s.bairro || '', cidade: s.cidade || '', estado: s.estado || '',
    planoId: s.planoId, plano: s.plano, valorPlano: s.valorPlano, horarioPreferido: s.horarioPreferido || '', modalidade: s.modalidade || '', objetivo: s.objetivo, restricoes: s.restricoes || '', observacao: s.observacao,
    status: s.status, motivoCorrecao: s.motivoCorrecao || '', motivoRejeicao: s.motivoRejeicao || '', alunoId: s.alunoId || '', matriculaId: s.matriculaId || '', financeiroId: s.financeiroId || '', mensalidadeId: s.mensalidadeId || '', criadoEm: s.criadoEm, aprovadoEm: s.aprovadoEm || '', rejeitadoEm: s.rejeitadoEm || '', correcaoSolicitadaEm: s.correcaoSolicitadaEm || ''
  };
}
export async function listarSolicitacoes(filtros = {}) {
  const lista = await lerJson(SOLICITACOES_FILE, []);
  const status = normalizar(filtros.status || '');
  const q = normalizar(filtros.q || filtros.busca || '');
  return lista.filter(s => {
    if (status && status !== 'todos' && normalizar(s.status) !== status) return false;
    if (q) {
      const alvo = normalizar(`${s.nome} ${s.cpf} ${s.telefone} ${s.email} ${s.plano} ${s.protocolo} ${s.cidade} ${s.bairro} ${s.status}`);
      if (!alvo.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).map(exporSolicitacao);
}
export async function criarSolicitacao(dados = {}) {
  const base = validarSolicitacao(dados);
  const [solicitacoes, planos, alunos] = await Promise.all([lerJson(SOLICITACOES_FILE, []), lerJson(PLANOS_FILE, []), lerJson(ALUNOS_FILE, [])]);
  const alunoExistente = cpfJaCadastrado(alunos, base.cpf);
  if (alunoExistente) {
    const st = statusAluno(alunoExistente) || 'cadastrado';
    erro(`CPF já cadastrado para ${alunoExistente.nome || alunoExistente.aluno || 'um aluno existente'}. Situação: ${st}. Procure a recepção para regularizar ou reativar o cadastro.`, 409);
  }
  const solicitacaoAberta = solicitacaoCpfAberta(solicitacoes, base.cpf);
  if (solicitacaoAberta) erro(`Já existe solicitação de matrícula para este CPF. Protocolo: ${solicitacaoAberta.protocolo || solicitacaoAberta.id}.`, 409);
  const plano = planos.find(p => mesmoId(p.id, base.planoId) || mesmoId(p.codigo, base.planoId) || nomePlano(p) === base.planoId);
  if (!plano || !planoAtivo(plano)) erro('Plano não encontrado ou inativo.', 404);
  const protocolo = `MO-${hojeISO().replace(/-/g, '')}-${String(solicitacoes.length + 1).padStart(5, '0')}`;
  const solicitacao = { id: crypto.randomUUID(), protocolo, ...base, whatsapp: base.telefone, planoId: plano.id || base.planoId, plano: nomePlano(plano), valorPlano: valorPlano(plano), status: 'aguardando', origem: 'matricula_online', criadoEm: agoraISO(), atualizadoEm: agoraISO(), historico: [{ acao: 'solicitacao_recebida', criadoEm: agoraISO() }] };
  solicitacoes.push(solicitacao);
  await salvarJson(SOLICITACOES_FILE, solicitacoes);
  await criarNotificacao({
    eventoId: `matricula-online:${solicitacao.id}`,
    tipo: 'matricula_online',
    prioridade: 'alta',
    titulo: `Nova matrícula online: ${solicitacao.nome}`,
    mensagem: `${solicitacao.plano} · Protocolo ${solicitacao.protocolo}`,
    contato: solicitacao.whatsapp || solicitacao.telefone,
    referenciaId: solicitacao.id,
    link: '/pages/matriculas-pendentes/index.html',
    destinatarios: ['admin', 'recepcao', 'comercial', 'matriculas']
  }).catch(erroNotificacao => console.error(`[Notificações] Matrícula salva, mas o aviso falhou: ${erroNotificacao.message}`));
  return { ok: true, solicitacao: exporSolicitacao(solicitacao), mensagem: 'Solicitação de matrícula enviada para aprovação.' };
}
async function aprovarSolicitacaoInterna(id, opcoes = {}) {
  const solicitacoes = await lerJson(SOLICITACOES_FILE, []);
  const idx = solicitacoes.findIndex(s => mesmoId(s.id, id) || mesmoId(s.protocolo, id));
  if (idx < 0) erro('Solicitação não encontrada.', 404);
  const solicitacao = solicitacoes[idx];
  if (normalizar(solicitacao.status) === 'aprovada') return { ok: true, solicitacao: exporSolicitacao(solicitacao), mensagem: 'Solicitação já aprovada.' };
  if (normalizar(solicitacao.status) === 'rejeitada') erro('Solicitação rejeitada não pode ser aprovada.');
  const alunos = await lerJson(ALUNOS_FILE, []);
  const cpf = numeros(solicitacao.cpf);
  let aluno = alunos.find(a => cpf && numeros(a.cpf || a.documento) === cpf) || null;
  if (!aluno) {
    aluno = { id: crypto.randomUUID(), nome: solicitacao.nome, cpf: solicitacao.cpf, rg: solicitacao.rg || '', sexo: solicitacao.sexo || '', telefone: solicitacao.telefone, whatsapp: solicitacao.whatsapp || solicitacao.telefone, email: solicitacao.email || '', data_nascimento: solicitacao.dataNascimento || '', foto_base64: solicitacao.fotoBase64 || '', documentos_matricula: solicitacao.documentos || {}, assinatura_matricula: solicitacao.assinaturaBase64 || '', cep: solicitacao.cep || '', endereco: solicitacao.endereco || '', numero: solicitacao.numero || '', complemento: solicitacao.complemento || '', bairro: solicitacao.bairro || '', cidade: solicitacao.cidade || '', estado: solicitacao.estado || '', objetivo: solicitacao.objetivo || '', restricoes_medicas: solicitacao.restricoes || '', observacoes: solicitacao.observacao || '', planoId: solicitacao.planoId, plano: solicitacao.plano, valorMensal: numero(solicitacao.valorPlano, 0), status: 'pre-matriculado', statusMatricula: 'Pendente', origem: 'matricula_online', data_matricula: hojeISO(), criadoEm: agoraISO(), atualizadoEm: agoraISO() };
    alunos.push(aluno);
  } else {
    aluno = Object.assign(aluno, { planoId: solicitacao.planoId || aluno.planoId || '', plano: solicitacao.plano || aluno.plano || '', foto_base64: aluno.foto_base64 || solicitacao.fotoBase64 || '', documentos_matricula: aluno.documentos_matricula || solicitacao.documentos || {}, assinatura_matricula: aluno.assinatura_matricula || solicitacao.assinaturaBase64 || '', status: ['ativo','ativa'].includes(normalizar(aluno.status)) ? aluno.status : 'pre-matriculado', statusMatricula: ['Ativa','ativa'].includes(String(aluno.statusMatricula || '')) ? aluno.statusMatricula : 'Pendente', atualizadoEm: agoraISO() });
  }
  await salvarJson(ALUNOS_FILE, alunos);
  const integracao = await integrarMatriculaAluno(aluno.id, solicitacao.planoId, { dataMatricula: hojeISO(), gerarMensalidade: true, usuario: opcoes.usuario || 'operador', observacao: `Matrícula online aprovada. Protocolo ${solicitacao.protocolo}.`, permitirTroca: false });
  const matricula = integracao?.matricula || integracao?.dados || {};
  const financeiroId = integracao?.financeiroInicial?.id || matricula.financeiroInicialId || '';
  const mensalidadeId = integracao?.mensalidadeGerada?.id || matricula.mensalidadeInicialId || '';
  solicitacao.status = 'aprovada'; solicitacao.alunoId = aluno.id; solicitacao.matriculaId = matricula.id || ''; solicitacao.financeiroId = financeiroId; solicitacao.mensalidadeId = mensalidadeId; solicitacao.aprovadoPor = opcoes.usuario || 'operador'; solicitacao.aprovadoEm = agoraISO(); solicitacao.atualizadoEm = agoraISO();
  solicitacao.historico = Array.isArray(solicitacao.historico) ? solicitacao.historico : [];
  solicitacao.historico.push({ acao: 'aprovada', usuario: opcoes.usuario || 'operador', alunoId: aluno.id, matriculaId: matricula.id || '', financeiroId, criadoEm: agoraISO() });
  solicitacoes[idx] = solicitacao;
  await salvarJson(SOLICITACOES_FILE, solicitacoes);
  return { ok: true, solicitacao: exporSolicitacao(solicitacao), aluno, integracao, financeiroId, mensalidadeId, mensagem: 'Matrícula online aprovada. Aluno, matrícula pendente e cobrança inicial foram criados.' };
}
export async function aprovarSolicitacao(id, opcoes = {}) {
  return executarTransacaoJson(() => aprovarSolicitacaoInterna(id, opcoes), {
    operacaoId: `matricula-online-${id}-${opcoes.idempotencyKey || opcoes.operacaoId || Date.now()}`
  });
}
export async function rejeitarSolicitacao(id, opcoes = {}) {
  const solicitacoes = await lerJson(SOLICITACOES_FILE, []);
  const idx = solicitacoes.findIndex(s => mesmoId(s.id, id) || mesmoId(s.protocolo, id));
  if (idx < 0) erro('Solicitação não encontrada.', 404);
  const solicitacao = solicitacoes[idx];
  if (normalizar(solicitacao.status) === 'aprovada') erro('Solicitação aprovada não pode ser rejeitada.');
  solicitacao.status = 'rejeitada'; solicitacao.motivoRejeicao = texto(opcoes.motivo || ''); solicitacao.rejeitadoPor = opcoes.usuario || 'operador'; solicitacao.rejeitadoEm = agoraISO(); solicitacao.atualizadoEm = agoraISO();
  solicitacao.historico = Array.isArray(solicitacao.historico) ? solicitacao.historico : [];
  solicitacao.historico.push({ acao: 'rejeitada', motivo: solicitacao.motivoRejeicao, usuario: solicitacao.rejeitadoPor, criadoEm: agoraISO() });
  solicitacoes[idx] = solicitacao;
  await salvarJson(SOLICITACOES_FILE, solicitacoes);
  return { ok: true, solicitacao: exporSolicitacao(solicitacao), mensagem: 'Solicitação rejeitada.' };
}
export async function solicitarCorrecao(id, opcoes = {}) {
  const solicitacoes = await lerJson(SOLICITACOES_FILE, []);
  const idx = solicitacoes.findIndex(s => mesmoId(s.id, id) || mesmoId(s.protocolo, id));
  if (idx < 0) erro('Solicitação não encontrada.', 404);
  const solicitacao = solicitacoes[idx];
  if (normalizar(solicitacao.status) === 'aprovada') erro('Solicitação aprovada não pode receber pedido de correção.');
  const motivo = texto(opcoes.motivo || opcoes.observacao || 'Correção de dados/documentos solicitada.');
  solicitacao.status = 'correcao_solicitada'; solicitacao.motivoCorrecao = motivo; solicitacao.correcaoSolicitadaPor = opcoes.usuario || 'operador'; solicitacao.correcaoSolicitadaEm = agoraISO(); solicitacao.atualizadoEm = agoraISO();
  solicitacao.historico = Array.isArray(solicitacao.historico) ? solicitacao.historico : [];
  solicitacao.historico.push({ acao: 'correcao_solicitada', motivo, usuario: solicitacao.correcaoSolicitadaPor, criadoEm: agoraISO() });
  solicitacoes[idx] = solicitacao;
  await salvarJson(SOLICITACOES_FILE, solicitacoes);
  return { ok: true, solicitacao: exporSolicitacao(solicitacao), mensagem: 'Correção solicitada ao candidato.' };
}
