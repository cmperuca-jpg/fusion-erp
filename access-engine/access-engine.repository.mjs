import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { lerJsonDuravel, salvarJsonDuravel } from '../core/persistence/durable-json.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ARQUIVOS = {
  alunos: 'alunos.json',
  matriculas: 'matriculas.json',
  mensalidades: 'mensalidades.json',
  financeiro: 'financeiro.json',
  dispositivos: 'access_dispositivos.json',
  logs: 'access_logs.json',
  regras: 'access_regras.json',
  presentes: 'access_pessoas_presentes.json',
  eventos: 'access_eventos.json'
};

async function garantirArquivo(nome, padrao = []) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const arquivo = path.join(DATA_DIR, nome);
  try { await fs.access(arquivo); }
  catch { await fs.writeFile(arquivo, JSON.stringify(padrao, null, 2), 'utf-8'); }
  return arquivo;
}

async function lerJson(nome, padrao = []) {
  const arquivo = await garantirArquivo(nome, padrao);
  const raw = await fs.readFile(arquivo, 'utf-8').catch(() => '[]');
  try {
    const dados = raw.trim() ? JSON.parse(raw) : padrao;
    return Array.isArray(dados) ? dados : padrao;
  } catch {
    return padrao;
  }
}

async function salvarJson(nome, dados) {
  const arquivo = await garantirArquivo(nome, []);
  await fs.writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf-8');
}

export function normalizar(valor) {
  return String(valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function apenasNumeros(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

export function novoId(prefixo = 'acc') {
  return `${prefixo}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

export async function listarAlunos() { return lerJsonDuravel(ARQUIVOS.alunos, []); }
export async function listarMatriculas() { return lerJsonDuravel(ARQUIVOS.matriculas, []); }
export async function listarMensalidades() { return lerJsonDuravel(ARQUIVOS.mensalidades, []); }
export async function listarFinanceiro() { return lerJsonDuravel(ARQUIVOS.financeiro, []); }
export async function listarDispositivos() { return lerJson(ARQUIVOS.dispositivos); }
export async function listarLogs() { return lerJson(ARQUIVOS.logs); }
export async function listarRegras() { return lerJson(ARQUIVOS.regras); }
export async function listarPresentes() { return lerJson(ARQUIVOS.presentes); }

export async function salvarDispositivos(lista) { return salvarJson(ARQUIVOS.dispositivos, lista); }
export async function salvarAlunos(lista) { return salvarJsonDuravel(ARQUIVOS.alunos, lista); }
export async function salvarLogs(lista) { return salvarJson(ARQUIVOS.logs, lista); }
export async function salvarRegras(lista) { return salvarJson(ARQUIVOS.regras, lista); }
export async function salvarPresentes(lista) { return salvarJson(ARQUIVOS.presentes, lista); }

export async function buscarAlunoPorIdentificador(identificador) {
  const alvoTexto = normalizar(identificador);
  const alvoNum = apenasNumeros(identificador);
  if (!alvoTexto && !alvoNum) return null;
  const alunos = await listarAlunos();
  return alunos.find((a = {}) => {
    const camposTexto = [a.id, a.nome, a.email, a.numeroMatricula, a.matriculaId, a.tag, a.rfid, a.cartao, a.qrcode].map(normalizar);
    const camposNum = [a.cpf, a.telefone, a.whatsapp, a.numeroMatricula, a.matriculaId, a.tag, a.rfid, a.cartao].map(apenasNumeros);
    return camposTexto.includes(alvoTexto) || (alvoNum && camposNum.includes(alvoNum));
  }) || null;
}

// Corrige somente a contradição deixada por uma reativação já autorizada. Esta
// função deve ser chamada depois de validar matrícula e pendências financeiras;
// nunca remove um bloqueio manual antes dessa validação.
export async function sincronizarAlunoLiberado(aluno = {}, matricula = {}) {
  const alunoId = String(aluno.id || aluno._id || aluno.alunoId || '');
  if (!alunoId) return aluno;

  const alunos = await listarAlunos();
  const indice = alunos.findIndex((item) => String(item.id || item._id || item.alunoId || '') === alunoId);
  if (indice < 0) return aluno;

  const agora = new Date().toISOString();
  const atualizado = {
    ...alunos[indice],
    status: 'ativo',
    situacao: 'ativo',
    ativo: true,
    statusMatricula: 'Ativa',
    matriculaStatus: 'Ativa',
    matriculaId: matricula.id || alunos[indice].matriculaId || '',
    numeroMatricula: matricula.numero || matricula.numeroMatricula || alunos[indice].numeroMatricula || '',
    bloqueado: false,
    bloqueioCheckin: false,
    inadimplente: false,
    emAtraso: false,
    motivoBloqueio: '',
    motivoBloqueioCheckin: '',
    reativacaoPendenteEm: '',
    recebimentoReativacaoId: '',
    acessoSincronizadoEm: agora,
    atualizadoEm: agora
  };

  alunos[indice] = atualizado;
  await salvarAlunos(alunos);
  return atualizado;
}

export async function obterDispositivo(id) {
  const lista = await listarDispositivos();
  return lista.find(d => String(d.id) === String(id)) || null;
}

export async function salvarDispositivo(dados) {
  const lista = await listarDispositivos();
  const agora = new Date().toISOString();
  const id = dados.id || novoId('disp');
  const existente = lista.findIndex(d => String(d.id) === String(id));
  const dispositivo = {
    id,
    nome: String(dados.nome || 'Catraca Simulador').trim(),
    fabricante: String(dados.fabricante || 'Simulador').trim(),
    modelo: String(dados.modelo || 'Genérico').trim(),
    driver: String(dados.driver || 'simulador').trim(),
    ip: String(dados.ip || '').trim(),
    porta: String(dados.porta || '').trim(),
    sentido: String(dados.sentido || 'entrada_saida').trim(),
    status: String(dados.status || 'ativo').trim(),
    criadoEm: dados.criadoEm || agora,
    atualizadoEm: agora
  };
  if (existente >= 0) lista[existente] = { ...lista[existente], ...dispositivo };
  else lista.push(dispositivo);
  await salvarDispositivos(lista);
  return dispositivo;
}

export async function registrarLog(log) {
  const lista = await listarLogs();
  const registro = { id: log.id || novoId('log'), criadoEm: new Date().toISOString(), ...log };
  lista.unshift(registro);
  await salvarLogs(lista.slice(0, 5000));
  return registro;
}

export async function marcarPresenca({ aluno, direcao, logId }) {
  const lista = await listarPresentes();
  const alunoId = String(aluno?.id || aluno?.matriculaId || aluno?.numeroMatricula || '');
  if (!alunoId) return lista;
  const agora = new Date().toISOString();
  const idx = lista.findIndex(p => String(p.alunoId) === alunoId);
  if (String(direcao || 'entrada') === 'saida') {
    if (idx >= 0) lista.splice(idx, 1);
  } else if (idx >= 0) {
    lista[idx] = { ...lista[idx], atualizadoEm: agora, ultimoLogId: logId };
  } else {
    lista.push({ alunoId, nome: aluno.nome, numeroMatricula: aluno.numeroMatricula, entradaEm: agora, atualizadoEm: agora, ultimoLogId: logId });
  }
  await salvarPresentes(lista);
  return lista;
}
