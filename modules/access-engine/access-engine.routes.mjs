import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as service from './access-engine.service.mjs';
import * as repo from './access-engine.repository.mjs';
import { normalizarTenantId, tenantAtual } from '../core/persistence/tenant-context.mjs';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.resolve(__dirname, '../..');
const instaladorAccessPath = path.join(raizProjeto, 'public', 'downloads', 'FusionAccessSetup.exe');

function tratar(res, e, status = 500) {
  return res.status(e.status || status).json({ ok: false, erro: e.message, mensagem: e.message });
}

function erroHttp(mensagem, status = 400) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function texto(valor) {
  return String(valor ?? '').trim();
}

function contextoFisico() {
  const tenantId = normalizarTenantId(tenantAtual());
  const tenantConfigurado = normalizarTenantId(
    process.env.ACCESS_AGENT_TENANT_ID || process.env.FUSION_TENANT_ID || 'academia-piloto'
  );
  const equipmentIds = new Set(
    String(process.env.ACCESS_EQUIPMENT_IDS || process.env.ACCESS_EQUIPMENT_ID || 'catraca-piloto-01')
      .split(',')
      .map(texto)
      .filter(Boolean)
  );
  return {
    tenantId,
    tenantConfigurado,
    equipmentIds,
    configurado: Boolean(tenantId && tenantConfigurado && tenantId === tenantConfigurado)
  };
}

function idDispositivo(dispositivo = {}) {
  return texto(dispositivo.id || dispositivo.equipmentId || dispositivo.equipment_id || dispositivo.codigo);
}

function dispositivoFisico(dispositivo = {}) {
  const driver = repo.normalizar(dispositivo.driver || '');
  const fabricante = repo.normalizar(dispositivo.fabricante || '');
  const modelo = repo.normalizar(dispositivo.modelo || '');
  const simulador = driver === 'simulador' || fabricante === 'simulador';
  if (simulador) return false;
  return driver === 'henry7x' || fabricante === 'henry' || modelo.includes('7x') || Boolean(driver);
}

function dispositivoReservado(dispositivo = {}) {
  const contexto = contextoFisico();
  const id = idDispositivo(dispositivo);
  return Boolean((id && contexto.equipmentIds.has(id)) || dispositivoFisico(dispositivo));
}

function escolherBaseFisica(dispositivos = [], usados = new Set()) {
  const candidatos = dispositivos.filter(dispositivo => dispositivoFisico(dispositivo));
  const livre = candidatos.find(dispositivo => !usados.has(idDispositivo(dispositivo)));
  return livre || candidatos[0] || null;
}

function normalizarDispositivoVinculado(dispositivo = {}, equipmentId, agenteOnline = null) {
  const id = texto(equipmentId || idDispositivo(dispositivo));
  const host = texto(dispositivo.ip || dispositivo.host || process.env.HENRY7X_HOST || '10.0.0.236');
  const porta = texto(dispositivo.porta || dispositivo.port || process.env.HENRY7X_PORT || '3000');
  const base = {
    ...dispositivo,
    id,
    equipmentId: id,
    codigo: dispositivo.codigo || id,
    nome: dispositivo.nome || 'Catraca Henry 7X',
    fabricante: dispositivo.fabricante || 'Henry',
    modelo: dispositivo.modelo || '7X',
    driver: dispositivo.driver || 'henry7x',
    ip: host,
    porta
  };
  if (agenteOnline === true) base.status = 'online';
  else if (agenteOnline === false) base.status = 'offline';
  return base;
}

function dispositivosVinculadosAoAgente(lista = [], agenteOnline = null) {
  const contexto = contextoFisico();
  const dispositivos = Array.isArray(lista) ? lista : [];

  if (!contexto.configurado) {
    return dispositivos.filter(dispositivo => !dispositivoReservado(dispositivo));
  }

  const idsVinculados = [...contexto.equipmentIds];
  if (!idsVinculados.length) {
    const fisicos = dispositivos.filter(dispositivoFisico);
    return fisicos.map(dispositivo => normalizarDispositivoVinculado(dispositivo, idDispositivo(dispositivo), agenteOnline));
  }

  const usados = new Set();
  return idsVinculados.map(equipmentId => {
    let base = dispositivos.find(dispositivo => idDispositivo(dispositivo) === equipmentId) || null;
    if (!base) base = escolherBaseFisica(dispositivos, usados);
    if (base) usados.add(idDispositivo(base));
    return normalizarDispositivoVinculado(base || {}, equipmentId, agenteOnline);
  });
}

function filtrarDispositivos(lista = []) {
  return dispositivosVinculadosAoAgente(lista, null);
}

function logFisicoReservado(log = {}) {
  const contexto = contextoFisico();
  const id = texto(log.dispositivoId || log.equipmentId || log.equipment_id);
  const driver = repo.normalizar(log.driver || '');
  const fabricante = repo.normalizar(log.fabricante || '');
  return Boolean((id && contexto.equipmentIds.has(id)) || driver === 'henry7x' || fabricante === 'henry');
}

function filtrarLogs(lista = []) {
  const contexto = contextoFisico();
  const logs = Array.isArray(lista) ? lista : [];
  if (contexto.configurado) return logs;
  return logs.filter(log => !logFisicoReservado(log));
}

function exigirAcessoFisico() {
  const contexto = contextoFisico();
  if (!contexto.configurado) {
    throw erroHttp('Nenhum Fusion Access Agent fisico esta vinculado a esta academia.', 403);
  }
  return contexto;
}

async function validarDispositivoVisivel(payload = {}) {
  const id = texto(payload.dispositivoId || payload.equipmentId || payload.equipment_id);
  const dispositivos = filtrarDispositivos(await repo.listarDispositivos());
  if (!id) {
    if (!dispositivos.length) throw erroHttp('Nenhum equipamento esta configurado para esta academia.', 400);
    return;
  }
  if (!dispositivos.some(dispositivo => idDispositivo(dispositivo) === id)) {
    throw erroHttp('Equipamento nao encontrado para esta academia.', 404);
  }
}

async function statusAgenteSeguro() {
  const contexto = contextoFisico();
  if (!contexto.configurado) {
    return {
      ok: true,
      configurado: false,
      tenantId: contexto.tenantId || null,
      agentId: null,
      online: false,
      ultimoContato: null,
      estado: 'nao-configurado',
      agent: null
    };
  }
  const status = await service.statusAgenteAcesso();
  return { ...status, configurado: true, tenantId: contexto.tenantId };
}

async function dashboardSeguro() {
  const [dispositivosBrutos, logsBrutos, presentes, agente] = await Promise.all([
    repo.listarDispositivos(),
    repo.listarLogs(),
    repo.listarPresentes(),
    statusAgenteSeguro()
  ]);
  const dispositivos = dispositivosVinculadosAoAgente(dispositivosBrutos, agente.online === true);
  const logs = filtrarLogs(logsBrutos);
  const hoje = new Date().toISOString().slice(0, 10);
  const logsHoje = logs.filter(log => String(log.criadoEm || '').startsWith(hoje));
  const contexto = contextoFisico();
  const online = contexto.configurado
    ? (agente.online ? dispositivos.length : 0)
    : dispositivos.filter(dispositivo => repo.normalizar(dispositivo.status) === 'ativo').length;

  return {
    ok: true,
    resumo: {
      dispositivos: dispositivos.length,
      online,
      cadastrosIgnorados: Math.max(0, dispositivosBrutos.length - dispositivos.length),
      pessoasDentro: presentes.length,
      acessosHoje: logsHoje.length,
      liberadosHoje: logsHoje.filter(log => log.autorizado).length,
      bloqueadosHoje: logsHoje.filter(log => !log.autorizado).length
    },
    dispositivos,
    presentes,
    ultimosLogs: logs.slice(0, 20)
  };
}

async function consultarComandoSeguro(id) {
  const resultado = await service.consultarComandoRemoto(id);
  const tenantId = normalizarTenantId(tenantAtual());
  const tenantComando = normalizarTenantId(resultado?.command?.tenantId || resultado?.command?.tenant_id || '');
  if (!tenantId || !tenantComando || tenantId !== tenantComando) {
    throw erroHttp('Comando nao encontrado.', 404);
  }
  return resultado;
}

function baixarInstalador(_req, res) {
  const stat = fs.statSync(instaladorAccessPath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    return res.status(404).json({ ok: false, mensagem: 'Instalador nao encontrado nesta distribuicao.' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.download(instaladorAccessPath, 'FusionAccessSetup.exe', erro => {
    if (erro && !res.headersSent) tratar(res, erro);
  });
}

router.get('/dashboard', async (req, res) => { try { res.json(await dashboardSeguro()); } catch (e) { tratar(res, e); } });
router.get('/drivers', async (req, res) => { try { res.json(await service.listarDriversDisponiveis()); } catch (e) { tratar(res, e); } });
router.get('/instalador', baixarInstalador);
router.get('/dispositivos', async (req, res) => { try { res.json({ ok: true, dados: filtrarDispositivos(await repo.listarDispositivos()) }); } catch (e) { tratar(res, e); } });
router.post('/dispositivos', async (req, res) => {
  try {
    if (!contextoFisico().configurado && dispositivoReservado(req.body || {})) exigirAcessoFisico();
    res.status(201).json({ ok: true, dados: await service.salvarDispositivo(req.body || {}) });
  } catch (e) { tratar(res, e, 400); }
});
router.put('/dispositivos/:id', async (req, res) => {
  try {
    const payload = { ...(req.body || {}), id: req.params.id };
    if (!contextoFisico().configurado && dispositivoReservado(payload)) exigirAcessoFisico();
    res.json({ ok: true, dados: await service.salvarDispositivo(payload) });
  } catch (e) { tratar(res, e, 400); }
});
router.get('/logs', async (req, res) => {
  try {
    const limite = Number(req.query?.limite || req.query?.limit || 100);
    const max = Number.isFinite(limite) && limite > 0 ? Math.min(limite, 5000) : 100;
    res.json({ ok: true, dados: filtrarLogs(await repo.listarLogs()).slice(0, max) });
  } catch (e) { tratar(res, e); }
});
router.post('/simular-acesso', async (req, res) => {
  try {
    await validarDispositivoVisivel(req.body || {});
    res.json(await service.avaliarAcesso(req.body || {}));
  } catch (e) { tratar(res, e, 400); }
});

router.get('/agente/status', async (req, res) => { try { res.json(await statusAgenteSeguro()); } catch (e) { tratar(res, e); } });
router.post('/liberar-remoto', async (req, res) => {
  try {
    exigirAcessoFisico();
    await validarDispositivoVisivel(req.body || {});
    res.status(202).json(await service.liberarRemoto(req.body || {}));
  } catch (e) { tratar(res, e, 400); }
});
router.get('/comandos/:id', async (req, res) => { try { res.json(await consultarComandoSeguro(req.params.id)); } catch (e) { tratar(res, e); } });

router.get('/henry7x/status', async (req, res) => { try { exigirAcessoFisico(); res.json(await service.statusHenry7x(req.query || {})); } catch (e) { tratar(res, e); } });
router.post('/henry7x/evento', async (req, res) => { try { exigirAcessoFisico(); res.json(await service.eventoHenry7x(req.body || {})); } catch (e) { tratar(res, e, 400); } });
router.post('/henry7x/tcp-test', async (req, res) => { try { exigirAcessoFisico(); res.json(await service.testarTcpHenry7x(req.body || {})); } catch (e) { tratar(res, e, 400); } });
router.get('/henry7x/tcp-test', async (req, res) => { try { exigirAcessoFisico(); res.json(await service.testarTcpHenry7x(req.query || {})); } catch (e) { tratar(res, e, 400); } });
router.post('/henry7x/diagnostico-rede', async (req, res) => { try { exigirAcessoFisico(); res.json(await service.diagnosticoRedeHenry7x(req.body || {})); } catch (e) { tratar(res, e, 400); } });
router.get('/henry7x/diagnostico-rede', async (req, res) => { try { exigirAcessoFisico(); res.json(await service.diagnosticoRedeHenry7x(req.query || {})); } catch (e) { tratar(res, e, 400); } });

export default router;
