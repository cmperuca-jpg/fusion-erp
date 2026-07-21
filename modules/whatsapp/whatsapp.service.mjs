import { executarTransacaoJson, lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';

const ARQ_LOG = 'whatsapp_envios.json';
const ARQ_CFG = 'whatsapp_config.json';
const hoje = () => new Date().toISOString().slice(0, 10);
const normalizar = (v = '') => String(v).replace(/\D/g, '');
const telefone = (aluno = {}) => normalizar(aluno.whatsapp || aluno.celular || aluno.telefone || aluno.fone || '');
const ativo = (a = {}) => ['ativo', 'ativa'].includes(String(a.status || a.situacao || '').trim().toLowerCase());
const cancelado = (a = {}) => ['cancelado', 'cancelada', 'inativo', 'inativa'].includes(String(a.status || a.situacao || '').trim().toLowerCase());
const dataSomada = (data, dias) => { const d = new Date(`${String(data).slice(0, 10)}T12:00:00`); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };

function configSegura(c = {}) { return { ativo: Boolean(c.ativo), phoneNumberId: c.phoneNumberId || '', apiVersion: c.apiVersion || 'v22.0', templates: c.templates || {}, tokenConfigurado: Boolean(process.env.WHATSAPP_META_TOKEN) }; }
async function config() { return { ...(await lerJsonDuravel(ARQ_CFG, {})), phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID || (await lerJsonDuravel(ARQ_CFG, {})).phoneNumberId || '' }; }
function podeEnviar(a) { return telefone(a).length >= 10 && a.whatsappOptOut !== true && a.autorizaWhatsApp !== false; }

async function enviarTemplate({ destinatario, template, parametros = [], tipo = 'utility', referencia = '', usuario = 'sistema' }) {
  const cfg = await config(); const token = process.env.WHATSAPP_META_TOKEN;
  if (!cfg.ativo || !cfg.phoneNumberId || !token) throw new Error('WhatsApp Meta não configurado. Defina WHATSAPP_META_TOKEN, WHATSAPP_META_PHONE_NUMBER_ID e ative a integração.');
  if (!template) throw new Error('Informe um modelo aprovado pela Meta.');
  const body = { messaging_product: 'whatsapp', to: destinatario, type: 'template', template: { name: template, language: { code: 'pt_BR' }, components: parametros.length ? [{ type: 'body', parameters: parametros.map(text => ({ type: 'text', text: String(text) })) }] : [] } };
  const resp = await fetch(`https://graph.facebook.com/${cfg.apiVersion || 'v22.0'}/${cfg.phoneNumberId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(json?.error?.message || `Meta respondeu HTTP ${resp.status}`);
  const logs = await lerJsonDuravel(ARQ_LOG, []); logs.unshift({ id: `wpp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`, tipo, referencia, destinatario, template, usuario, status: 'enviado', metaMessageId: json?.messages?.[0]?.id || '', criadoEm: new Date().toISOString() }); await salvarJsonDuravel(ARQ_LOG, logs.slice(0, 10000)); return json;
}

export async function obterConfiguracao() { return configSegura(await config()); }
export async function salvarConfiguracao(dados = {}) { const atual = await lerJsonDuravel(ARQ_CFG, {}); const novo = { ...atual, ativo: Boolean(dados.ativo), phoneNumberId: String(dados.phoneNumberId || atual.phoneNumberId || ''), apiVersion: String(dados.apiVersion || atual.apiVersion || 'v22.0'), templates: { ...(atual.templates || {}), ...(dados.templates || {}) }, atualizadoEm: new Date().toISOString() }; await salvarJsonDuravel(ARQ_CFG, novo); return configSegura(novo); }
export async function listarInativos() { const alunos = await lerJsonDuravel('alunos.json', []); return alunos.filter(a => cancelado(a) && podeEnviar(a)).map(a => ({ id: a.id, nome: a.nome || a.aluno, telefone: telefone(a), status: a.status, bloqueado: a.whatsappOptOut === true })); }
export async function campanhaInativos({ alunoIds = [], template, parametros = [], usuario = 'sistema' } = {}) { const alunos = await lerJsonDuravel('alunos.json', []); const escolhidos = alunos.filter(a => alunoIds.map(String).includes(String(a.id)) && cancelado(a) && podeEnviar(a)); const resultados = []; for (const a of escolhidos) { try { await enviarTemplate({ destinatario: telefone(a), template, parametros: [a.nome || a.aluno || '', ...parametros], tipo: 'marketing_inativo', referencia: String(a.id), usuario }); resultados.push({ alunoId: a.id, ok: true }); } catch (e) { resultados.push({ alunoId: a.id, ok: false, erro: e.message }); } } return { ok: resultados.every(x => x.ok), total: resultados.length, resultados }; }
export async function executarLembretesVencimento({ dataReferencia = hoje() } = {}) { return executarTransacaoJson(async () => { const [alunos, matriculas, logs, cfg] = await Promise.all([lerJsonDuravel('alunos.json', []), lerJsonDuravel('matriculas.json', []), lerJsonDuravel(ARQ_LOG, []), config()]); if (!cfg.ativo) return { ok: true, enviados: 0, motivo: 'Integração desativada.' }; const resultados = []; for (const m of matriculas) { const a = alunos.find(x => String(x.id) === String(m.alunoId)); if (!a || !ativo(a) || !podeEnviar(a)) continue; const vencimento = String(m.proximoVencimento || m.vencimentoInicial || '').slice(0, 10); if (!vencimento) continue; const dias = dataSomada(dataReferencia, 5) === vencimento ? 5 : dataReferencia === vencimento ? 0 : null; if (dias === null) continue; const tipo = dias === 5 ? 'lembrete_5_dias' : 'lembrete_vencimento'; const chave = `${tipo}:${a.id}:${vencimento}`; if (logs.some(l => l.referencia === chave && l.status === 'enviado')) continue; const template = dias === 5 ? cfg.templates?.lembrete5Dias : cfg.templates?.lembreteVencimento; try { await enviarTemplate({ destinatario: telefone(a), template, parametros: [a.nome || a.aluno || '', vencimento.split('-').reverse().join('/')], tipo, referencia: chave }); resultados.push({ alunoId: a.id, tipo, ok: true }); } catch (e) { resultados.push({ alunoId: a.id, tipo, ok: false, erro: e.message }); } } return { ok: true, enviados: resultados.filter(x => x.ok).length, resultados }; }); }
export async function listarEnvios() { return (await lerJsonDuravel(ARQ_LOG, [])).slice(0, 200); }
