import path from 'node:path';
import crypto from 'node:crypto';
import { lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';
import { criarNotificacao } from '../notificacoes/notificacoes.service.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const MATRICULAS_ONLINE_FILE = path.join(DATA_DIR, 'matriculas_online.json');
const PLANOS_FILE = path.join(DATA_DIR, 'planos.json');

const ETAPAS = [
  'novo',
  'contatado',
  'agendado',
  'aula_experimental',
  'matricula_online',
  'convertido',
  'perdido'
];

async function lerJson(arquivo, padrao = []) {
  return lerJsonDuravel(arquivo, padrao);
}

async function salvarJson(arquivo, dados) {
  return salvarJsonDuravel(arquivo, dados);
}

function agoraISO() { return new Date().toISOString(); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function texto(v) { return String(v ?? '').trim(); }
function normalizar(v) { return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function numeros(v) { return String(v ?? '').replace(/\D/g, ''); }
function numero(v, padrao = 0) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Number(n.toFixed(2)) : padrao; }
function erro(msg, status = 400) { const e = new Error(msg); e.status = status; throw e; }
function mesmoId(a, b) { return String(a || '') === String(b || ''); }

function etapaValida(etapa = '') {
  const e = normalizar(etapa || 'novo').replace(/\s+/g, '_');
  return ETAPAS.includes(e) ? e : 'novo';
}

function nomePlano(plano = {}) { return texto(plano.nome || plano.descricao || plano.titulo || plano.plano || ''); }
function valorPlano(plano = {}) { return numero(plano.valorMensal ?? plano.valor ?? plano.mensalidade ?? plano.preco ?? 0); }

function leadIdMatriculaOnline(s = {}) {
  const origem = texto(s.id || s.protocolo || `${s.cpf || ''}-${s.criadoEm || ''}`) || crypto.randomUUID();
  return `lead_mo_${origem.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function etapaMatriculaOnline(s = {}) {
  const status = normalizar(s.status || 'aguardando');
  if (status === 'aprovada') return 'convertido';
  if (['rejeitada', 'cancelada', 'cancelado'].includes(status)) return 'perdido';
  return 'matricula_online';
}

function statusLeadMatriculaOnline(s = {}) {
  return etapaMatriculaOnline(s) === 'perdido' ? 'perdido' : 'ativo';
}

function historicoMatriculaOnline(s = {}, existente = {}) {
  const historico = Array.isArray(existente.historico) ? existente.historico : [];
  if (historico.length) return historico;
  const itens = [{
    id: crypto.randomUUID(),
    acao: 'matricula_online_recebida',
    etapa: 'matricula_online',
    protocolo: s.protocolo || '',
    criadoEm: s.criadoEm || agoraISO()
  }];
  if (normalizar(s.status) === 'aprovada') {
    itens.unshift({
      id: crypto.randomUUID(),
      acao: 'matricula_online_aprovada',
      etapa: 'convertido',
      alunoId: s.alunoId || '',
      matriculaId: s.matriculaId || '',
      financeiroId: s.financeiroId || '',
      criadoEm: s.aprovadoEm || s.atualizadoEm || agoraISO()
    });
  }
  if (['rejeitada', 'cancelada', 'cancelado'].includes(normalizar(s.status))) {
    itens.unshift({
      id: crypto.randomUUID(),
      acao: 'matricula_online_perdida',
      etapa: 'perdido',
      motivo: s.motivoRejeicao || '',
      criadoEm: s.rejeitadoEm || s.atualizadoEm || agoraISO()
    });
  }
  return itens;
}

function montarLeadMatriculaOnline(s = {}, existente = {}) {
  const etapa = etapaMatriculaOnline(s);
  const atualizadoEm = s.atualizadoEm || s.aprovadoEm || s.rejeitadoEm || s.correcaoSolicitadaEm || s.criadoEm || agoraISO();
  return {
    ...existente,
    id: existente.id || leadIdMatriculaOnline(s),
    nome: texto(s.nome || existente.nome || 'Matrícula online'),
    telefone: numeros(s.telefone || s.whatsapp || existente.telefone || ''),
    whatsapp: numeros(s.whatsapp || s.telefone || existente.whatsapp || ''),
    email: texto(s.email || existente.email || '').toLowerCase(),
    cpf: numeros(s.cpf || existente.cpf || ''),
    origem: 'matricula_online',
    etapa,
    status: statusLeadMatriculaOnline(s),
    planoId: texto(s.planoId || existente.planoId || ''),
    plano: texto(s.plano || existente.plano || ''),
    valorPrevisto: numero(s.valorPrevisto ?? s.valorPlano ?? existente.valorPrevisto, 0),
    modalidade: texto(s.modalidade || existente.modalidade || ''),
    objetivo: texto(s.objetivo || existente.objetivo || ''),
    observacao: texto(s.observacao || existente.observacao || ''),
    dataAgendada: existente.dataAgendada || '',
    horarioAgendado: texto(s.horarioPreferido || existente.horarioAgendado || ''),
    professor: existente.professor || '',
    matriculaOnlineId: s.id || existente.matriculaOnlineId || '',
    protocolo: s.protocolo || existente.protocolo || '',
    alunoId: s.alunoId || existente.alunoId || '',
    matriculaId: s.matriculaId || existente.matriculaId || '',
    financeiroId: s.financeiroId || existente.financeiroId || '',
    mensalidadeId: s.mensalidadeId || existente.mensalidadeId || '',
    convertidoEm: etapa === 'convertido' ? (s.aprovadoEm || existente.convertidoEm || atualizadoEm) : (existente.convertidoEm || ''),
    perdidoEm: etapa === 'perdido' ? (s.rejeitadoEm || existente.perdidoEm || atualizadoEm) : (existente.perdidoEm || ''),
    criadoEm: s.criadoEm || existente.criadoEm || agoraISO(),
    atualizadoEm,
    historico: historicoMatriculaOnline(s, existente)
  };
}

async function sincronizarMatriculasOnlineComLeads() {
  const [leads, matriculasOnline] = await Promise.all([
    lerJson(LEADS_FILE, []),
    lerJson(MATRICULAS_ONLINE_FILE, [])
  ]);
  if (!Array.isArray(matriculasOnline) || !matriculasOnline.length) return leads;

  let alterou = false;
  for (const solicitacao of matriculasOnline) {
    if (!solicitacao?.id && !solicitacao?.protocolo) continue;
    const idEsperado = leadIdMatriculaOnline(solicitacao);
    const idx = leads.findIndex(l =>
      mesmoId(l.matriculaOnlineId, solicitacao.id) ||
      mesmoId(l.id, idEsperado)
    );
    const lead = montarLeadMatriculaOnline(solicitacao, idx >= 0 ? leads[idx] : {});
    if (idx >= 0) {
      if (JSON.stringify(leads[idx]) !== JSON.stringify(lead)) {
        leads[idx] = lead;
        alterou = true;
      }
    } else {
      leads.unshift(lead);
      alterou = true;
    }
  }

  if (alterou) await salvarJson(LEADS_FILE, leads);
  return leads;
}

function matriculaOnlinePendente(m = {}) {
  return !['aprovada', 'rejeitada', 'cancelada', 'cancelado'].includes(normalizar(m.status));
}

function exporLead(l = {}) {
  return {
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    whatsapp: l.whatsapp || l.telefone,
    email: l.email || '',
    cpf: l.cpf || '',
    origem: l.origem || 'site',
    etapa: l.etapa || 'novo',
    status: l.status || 'ativo',
    planoId: l.planoId || '',
    plano: l.plano || '',
    valorPrevisto: numero(l.valorPrevisto, 0),
    modalidade: l.modalidade || '',
    objetivo: l.objetivo || '',
    observacao: l.observacao || '',
    dataAgendada: l.dataAgendada || '',
    horarioAgendado: l.horarioAgendado || '',
    professor: l.professor || '',
    matriculaOnlineId: l.matriculaOnlineId || '',
    protocolo: l.protocolo || '',
    alunoId: l.alunoId || '',
    matriculaId: l.matriculaId || '',
    financeiroId: l.financeiroId || '',
    mensalidadeId: l.mensalidadeId || '',
    convertidoEm: l.convertidoEm || '',
    perdidoEm: l.perdidoEm || '',
    criadoEm: l.criadoEm || '',
    atualizadoEm: l.atualizadoEm || '',
    historico: Array.isArray(l.historico) ? l.historico : []
  };
}

function validarLead(dados = {}, parcial = false) {
  const lead = {
    nome: texto(dados.nome || dados.nomeCompleto),
    telefone: numeros(dados.telefone || dados.whatsapp || dados.celular),
    whatsapp: numeros(dados.whatsapp || dados.telefone || dados.celular),
    email: texto(dados.email).toLowerCase(),
    cpf: numeros(dados.cpf || dados.documento),
    origem: texto(dados.origem || 'site'),
    etapa: etapaValida(dados.etapa || dados.statusComercial || 'novo'),
    status: texto(dados.status || 'ativo'),
    planoId: texto(dados.planoId || dados.plano_id || ''),
    plano: texto(dados.plano || dados.planoNome || ''),
    valorPrevisto: numero(dados.valorPrevisto ?? dados.valorPlano ?? dados.valor, 0),
    modalidade: texto(dados.modalidade || dados.servico || ''),
    objetivo: texto(dados.objetivo || ''),
    observacao: texto(dados.observacao || dados.observacoes || ''),
    dataAgendada: texto(dados.dataAgendada || dados.dataAula || dados.data || ''),
    horarioAgendado: texto(dados.horarioAgendado || dados.horario || ''),
    professor: texto(dados.professor || '')
  };

  if (!parcial) {
    if (lead.nome.length < 3) erro('Informe o nome do interessado.');
    if (!lead.telefone) erro('Informe telefone ou WhatsApp.');
  }
  return lead;
}

export async function listarLeads(filtros = {}) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const q = normalizar(filtros.q || filtros.busca || '');
  const etapa = normalizar(filtros.etapa || filtros.statusComercial || '');
  const origem = normalizar(filtros.origem || '');

  return leads
    .filter(l => {
      if (etapa && etapa !== 'todos' && normalizar(l.etapa) !== etapa) return false;
      if (origem && origem !== 'todos' && normalizar(l.origem) !== origem) return false;
      if (q) {
        const alvo = normalizar(`${l.nome} ${l.telefone} ${l.whatsapp} ${l.email} ${l.cpf} ${l.plano} ${l.modalidade} ${l.origem}`);
        if (!alvo.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => String(b.atualizadoEm || b.criadoEm || '').localeCompare(String(a.atualizadoEm || a.criadoEm || '')))
    .map(exporLead);
}

export async function obterLead(id) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const lead = leads.find(l => mesmoId(l.id, id));
  if (!lead) erro('Lead não encontrado.', 404);
  return exporLead(lead);
}

export async function criarLead(dados = {}) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const planos = await lerJson(PLANOS_FILE, []);
  const base = validarLead(dados);

  if (base.planoId) {
    const plano = planos.find(p => mesmoId(p.id, base.planoId) || mesmoId(p.codigo, base.planoId));
    if (plano) {
      base.plano = base.plano || nomePlano(plano);
      base.valorPrevisto = base.valorPrevisto || valorPlano(plano);
    }
  }

  const cpf = numeros(base.cpf);
  const telefone = numeros(base.telefone || base.whatsapp);
  const existenteAberto = leads.find(l =>
    normalizar(l.status || 'ativo') !== 'excluido' &&
    !['convertido', 'perdido'].includes(normalizar(l.etapa)) &&
    ((cpf && numeros(l.cpf) === cpf) || (telefone && numeros(l.telefone || l.whatsapp) === telefone))
  );

  if (existenteAberto) erro('Já existe um lead aberto para este CPF ou telefone.', 409);

  const lead = {
    id: crypto.randomUUID(),
    ...base,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    historico: [{ id: crypto.randomUUID(), acao: 'lead_criado', etapa: base.etapa, usuario: dados.usuario || 'site', criadoEm: agoraISO() }]
  };
  leads.unshift(lead);
  await salvarJson(LEADS_FILE, leads);
  const agendamento = ['agendado', 'aula_experimental'].includes(base.etapa);
  await criarNotificacao({
    eventoId: `lead:${lead.id}`,
    tipo: agendamento ? 'aula_experimental' : 'lead',
    prioridade: agendamento ? 'alta' : 'normal',
    titulo: agendamento ? `Nova aula experimental: ${lead.nome}` : `Novo interesse: ${lead.nome}`,
    mensagem: [lead.plano || lead.modalidade, lead.dataAgendada, lead.horarioAgendado].filter(Boolean).join(' · ') || lead.objetivo || 'Novo contato recebido pelo site da academia.',
    contato: lead.whatsapp || lead.telefone,
    referenciaId: lead.id,
    link: `/pages/comercial-painel/index.html?leadId=${encodeURIComponent(lead.id)}`,
    destinatarios: ['admin', 'recepcao', 'comercial', 'comercial_painel']
  }).catch(erroNotificacao => console.error(`[Notificações] Lead salvo, mas o aviso falhou: ${erroNotificacao.message}`));
  return exporLead(lead);
}

export async function atualizarLead(id, dados = {}) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const idx = leads.findIndex(l => mesmoId(l.id, id));
  if (idx < 0) erro('Lead não encontrado.', 404);
  const base = validarLead(dados, true);
  leads[idx] = { ...leads[idx], ...Object.fromEntries(Object.entries(base).filter(([,v]) => v !== '' && v !== 0)), atualizadoEm: agoraISO() };
  leads[idx].historico = Array.isArray(leads[idx].historico) ? leads[idx].historico : [];
  leads[idx].historico.unshift({ id: crypto.randomUUID(), acao: 'lead_atualizado', usuario: dados.usuario || 'operador', criadoEm: agoraISO() });
  await salvarJson(LEADS_FILE, leads);
  return exporLead(leads[idx]);
}

export async function moverLead(id, dados = {}) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const idx = leads.findIndex(l => mesmoId(l.id, id));
  if (idx < 0) erro('Lead não encontrado.', 404);
  const etapaAnterior = leads[idx].etapa || 'novo';
  const novaEtapa = etapaValida(dados.etapa || dados.novaEtapa);
  leads[idx].etapa = novaEtapa;
  leads[idx].status = novaEtapa === 'perdido' ? 'perdido' : leads[idx].status || 'ativo';
  if (novaEtapa === 'convertido') leads[idx].convertidoEm = agoraISO();
  if (novaEtapa === 'perdido') leads[idx].perdidoEm = agoraISO();
  if (dados.dataAgendada) leads[idx].dataAgendada = texto(dados.dataAgendada);
  if (dados.horarioAgendado || dados.horario) leads[idx].horarioAgendado = texto(dados.horarioAgendado || dados.horario);
  leads[idx].atualizadoEm = agoraISO();
  leads[idx].historico = Array.isArray(leads[idx].historico) ? leads[idx].historico : [];
  leads[idx].historico.unshift({ id: crypto.randomUUID(), acao: 'movido_pipeline', de: etapaAnterior, para: novaEtapa, observacao: texto(dados.observacao), usuario: dados.usuario || 'operador', criadoEm: agoraISO() });
  await salvarJson(LEADS_FILE, leads);
  return exporLead(leads[idx]);
}

export async function registrarContato(id, dados = {}) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const idx = leads.findIndex(l => mesmoId(l.id, id));
  if (idx < 0) erro('Lead não encontrado.', 404);
  const contato = {
    id: crypto.randomUUID(),
    acao: 'contato',
    tipo: texto(dados.tipo || 'whatsapp'),
    resultado: texto(dados.resultado || dados.observacao || ''),
    proximoContato: texto(dados.proximoContato || ''),
    usuario: dados.usuario || 'operador',
    criadoEm: agoraISO()
  };
  leads[idx].etapa = leads[idx].etapa === 'novo' ? 'contatado' : leads[idx].etapa;
  leads[idx].atualizadoEm = agoraISO();
  leads[idx].historico = Array.isArray(leads[idx].historico) ? leads[idx].historico : [];
  leads[idx].historico.unshift(contato);
  await salvarJson(LEADS_FILE, leads);
  return exporLead(leads[idx]);
}

export async function excluirLead(id) {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const idx = leads.findIndex(l => mesmoId(l.id, id));
  if (idx < 0) erro('Lead não encontrado.', 404);
  leads[idx].status = 'excluido';
  leads[idx].etapa = leads[idx].etapa || 'perdido';
  leads[idx].excluidoEm = agoraISO();
  leads[idx].atualizadoEm = agoraISO();
  await salvarJson(LEADS_FILE, leads);
  return { ok: true, removido: true };
}

export async function resumoComercial() {
  const leads = await sincronizarMatriculasOnlineComLeads();
  const matriculas = await lerJson(MATRICULAS_ONLINE_FILE, []);
  const ativos = leads.filter(l => normalizar(l.status || 'ativo') !== 'excluido');
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const porEtapa = Object.fromEntries(ETAPAS.map(e => [e, 0]));
  let receitaPrevista = 0;
  let receitaConvertida = 0;
  for (const l of ativos) {
    const etapa = etapaValida(l.etapa);
    porEtapa[etapa] += 1;
    if (etapa === 'convertido') receitaConvertida += numero(l.valorPrevisto, 0);
    if (!['convertido', 'perdido'].includes(etapa)) receitaPrevista += numero(l.valorPrevisto, 0);
  }
  const leadsMes = ativos.filter(l => String(l.criadoEm || '').slice(0,7) === mes).length;
  const leadsHoje = ativos.filter(l => String(l.criadoEm || '').slice(0,10) === hoje).length;
  const convertidos = ativos.filter(l => etapaValida(l.etapa) === 'convertido').length;
  const pendentesMatricula = matriculas.filter(matriculaOnlinePendente).length;
  const matriculasRealizadas = matriculas.filter(m => normalizar(m.status) === 'aprovada').length;
  const taxaConversao = ativos.length ? Number(((convertidos / ativos.length) * 100).toFixed(1)) : 0;
  return { total: ativos.length, leadsHoje, leadsMes, convertidos, taxaConversao, receitaPrevista: Number(receitaPrevista.toFixed(2)), receitaConvertida: Number(receitaConvertida.toFixed(2)), pendentesMatricula, matriculasRealizadas, porEtapa };
}
