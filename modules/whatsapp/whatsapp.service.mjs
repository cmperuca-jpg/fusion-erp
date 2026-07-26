import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';

const ARQ_LOG = 'whatsapp_envios.json';
const ARQ_CFG = 'whatsapp_config.json';
const hoje = () => new Date().toISOString().slice(0, 10);

function normalizar(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function telefone(aluno = {}) {
  return normalizar(aluno.whatsapp || aluno.celular || aluno.telefone || aluno.fone || '');
}

function ativo(aluno = {}) {
  return ['ativo', 'ativa'].includes(String(aluno.status || aluno.situacao || '').trim().toLowerCase());
}

function cancelado(aluno = {}) {
  return ['cancelado', 'cancelada', 'inativo', 'inativa'].includes(String(aluno.status || aluno.situacao || '').trim().toLowerCase());
}

function dataSomada(data, dias) {
  const d = new Date(`${String(data).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function configSegura(configuracao = {}) {
  return {
    ativo: Boolean(configuracao.ativo),
    phoneNumberId: configuracao.phoneNumberId || '',
    apiVersion: configuracao.apiVersion || 'v22.0',
    templates: configuracao.templates || {},
    tokenConfigurado: Boolean(process.env.WHATSAPP_META_TOKEN),
    atualizadoEm: configuracao.atualizadoEm || null,
    atualizadoPor: configuracao.atualizadoPor || null
  };
}

async function config() {
  const atual = await lerJsonDuravel(ARQ_CFG, {});
  return {
    ...atual,
    phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID || atual.phoneNumberId || ''
  };
}

function podeEnviar(aluno = {}) {
  return telefone(aluno).length >= 10 && aluno.whatsappOptOut !== true && aluno.autorizaWhatsApp !== false;
}

function textoCurto(valor, limite = 160) {
  return String(valor || '').trim().slice(0, limite);
}

function templateSeguro(valor) {
  return textoCurto(valor, 128).replace(/[^\w.-]/g, '');
}

function parametrosSeguros(parametros = []) {
  return (Array.isArray(parametros) ? parametros : [])
    .map((item) => textoCurto(item, 160))
    .filter(Boolean)
    .slice(0, 8);
}

function versaoApiSegura(valor) {
  return textoCurto(valor, 20).replace(/[^\w.-]/g, '') || 'v22.0';
}

async function enviarTemplate({ destinatario, template, parametros = [], tipo = 'utility', referencia = '', usuario = 'sistema' }) {
  const cfg = await config();
  const token = process.env.WHATSAPP_META_TOKEN;
  const numeroDestino = normalizar(destinatario);
  const nomeTemplate = templateSeguro(template);
  const parametrosNormalizados = parametrosSeguros(parametros);

  if (!cfg.ativo || !cfg.phoneNumberId || !token) {
    throw new Error('WhatsApp Meta nao configurado. Defina WHATSAPP_META_TOKEN, WHATSAPP_META_PHONE_NUMBER_ID e ative a integracao.');
  }
  if (numeroDestino.length < 10) throw new Error('Telefone do destinatario invalido.');
  if (!nomeTemplate) throw new Error('Informe um modelo aprovado pela Meta.');

  const body = {
    messaging_product: 'whatsapp',
    to: numeroDestino,
    type: 'template',
    template: {
      name: nomeTemplate,
      language: { code: 'pt_BR' },
      components: parametrosNormalizados.length
        ? [{ type: 'body', parameters: parametrosNormalizados.map((text) => ({ type: 'text', text })) }]
        : []
    }
  };

  const resp = await fetch(`https://graph.facebook.com/${versaoApiSegura(cfg.apiVersion)}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error?.message || `Meta respondeu HTTP ${resp.status}`);

  const logs = await lerJsonDuravel(ARQ_LOG, []);
  logs.unshift({
    id: `wpp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    tipo: textoCurto(tipo, 80),
    referencia: textoCurto(referencia, 120),
    destinatario: numeroDestino,
    template: nomeTemplate,
    usuario: textoCurto(usuario, 120) || 'sistema',
    status: 'enviado',
    metaMessageId: json?.messages?.[0]?.id || '',
    criadoEm: new Date().toISOString()
  });
  await salvarJsonDuravel(ARQ_LOG, logs.slice(0, 10000));
  return json;
}

export async function obterConfiguracao() {
  return configSegura(await config());
}

export async function salvarConfiguracao(dados = {}) {
  const atual = await lerJsonDuravel(ARQ_CFG, {});
  const templatesEntrada = dados.templates || {};
  const templatesAtuais = atual.templates || {};
  const novo = {
    ...atual,
    ativo: Boolean(dados.ativo),
    phoneNumberId: normalizar(dados.phoneNumberId || atual.phoneNumberId || ''),
    apiVersion: versaoApiSegura(dados.apiVersion || atual.apiVersion || 'v22.0'),
    templates: {
      ...templatesAtuais,
      lembrete5Dias: templateSeguro(templatesEntrada.lembrete5Dias ?? templatesAtuais.lembrete5Dias),
      lembreteVencimento: templateSeguro(templatesEntrada.lembreteVencimento ?? templatesAtuais.lembreteVencimento)
    },
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: textoCurto(dados.usuario, 120) || atual.atualizadoPor || 'sistema'
  };
  await salvarJsonDuravel(ARQ_CFG, novo);
  return configSegura(novo);
}

export async function listarInativos() {
  const alunos = await lerJsonDuravel('alunos.json', []);
  return alunos
    .filter((aluno) => cancelado(aluno) && podeEnviar(aluno))
    .map((aluno) => ({
      id: aluno.id,
      nome: aluno.nome || aluno.aluno,
      telefone: telefone(aluno),
      status: aluno.status,
      bloqueado: aluno.whatsappOptOut === true
    }));
}

export async function campanhaInativos({ alunoIds = [], template, parametros = [], usuario = 'sistema' } = {}) {
  const ids = new Set((Array.isArray(alunoIds) ? alunoIds : []).map(String).filter(Boolean).slice(0, 500));
  const nomeTemplate = templateSeguro(template);
  const parametrosBase = parametrosSeguros(parametros);
  if (!nomeTemplate) throw new Error('Informe um modelo aprovado pela Meta.');

  const alunos = await lerJsonDuravel('alunos.json', []);
  const escolhidos = alunos.filter((aluno) => ids.has(String(aluno.id)) && cancelado(aluno) && podeEnviar(aluno));
  const resultados = [];

  for (const aluno of escolhidos) {
    try {
      await enviarTemplate({
        destinatario: telefone(aluno),
        template: nomeTemplate,
        parametros: [aluno.nome || aluno.aluno || '', ...parametrosBase],
        tipo: 'marketing_inativo',
        referencia: String(aluno.id),
        usuario
      });
      resultados.push({ alunoId: aluno.id, ok: true });
    } catch (e) {
      resultados.push({ alunoId: aluno.id, ok: false, erro: e.message });
    }
  }

  return { ok: resultados.every((item) => item.ok), total: resultados.length, resultados };
}

export async function executarLembretesVencimento({ dataReferencia = hoje(), usuario = 'sistema' } = {}) {
  return executarTransacaoJson(async () => {
    const [alunos, matriculas, logs, cfg] = await Promise.all([
      lerJsonDuravel('alunos.json', []),
      lerJsonDuravel('matriculas.json', []),
      lerJsonDuravel(ARQ_LOG, []),
      config()
    ]);
    if (!cfg.ativo) return { ok: true, enviados: 0, motivo: 'Integracao desativada.' };

    const referenciaData = String(dataReferencia || hoje()).slice(0, 10);
    const resultados = [];
    for (const matricula of matriculas) {
      const aluno = alunos.find((item) => String(item.id) === String(matricula.alunoId));
      if (!aluno || !ativo(aluno) || !podeEnviar(aluno)) continue;

      const vencimento = String(matricula.proximoVencimento || matricula.vencimentoInicial || '').slice(0, 10);
      if (!vencimento) continue;

      const dias = dataSomada(referenciaData, 5) === vencimento ? 5 : referenciaData === vencimento ? 0 : null;
      if (dias === null) continue;

      const tipo = dias === 5 ? 'lembrete_5_dias' : 'lembrete_vencimento';
      const chave = `${tipo}:${aluno.id}:${vencimento}`;
      if (logs.some((log) => log.referencia === chave && log.status === 'enviado')) continue;

      const template = dias === 5 ? cfg.templates?.lembrete5Dias : cfg.templates?.lembreteVencimento;
      try {
        await enviarTemplate({
          destinatario: telefone(aluno),
          template,
          parametros: [aluno.nome || aluno.aluno || '', vencimento.split('-').reverse().join('/')],
          tipo,
          referencia: chave,
          usuario
        });
        resultados.push({ alunoId: aluno.id, tipo, ok: true });
      } catch (e) {
        resultados.push({ alunoId: aluno.id, tipo, ok: false, erro: e.message });
      }
    }

    return { ok: true, enviados: resultados.filter((item) => item.ok).length, resultados };
  });
}

export async function listarEnvios() {
  return (await lerJsonDuravel(ARQ_LOG, [])).slice(0, 200);
}
