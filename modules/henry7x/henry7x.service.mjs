import { Henry7xDriver } from './henry7x.driver.mjs';
import { comandosConfirmados } from './henry7x.commands.mjs';
import { salvarEquipamento, readDb, addLog, readLogs } from './henry7x.repository.mjs';
import { compararHex, normalizeHex } from './henry7x.protocol.mjs';

let filaLiberacao = Promise.resolve();

function executarEmFila(tarefa) {
  const proxima = filaLiberacao.then(tarefa, tarefa);
  filaLiberacao = proxima.catch(() => undefined);
  return proxima;
}

export function listarEquipamentos() { return readDb().equipamentos; }
export function cadastrarEquipamento(payload) { return salvarEquipamento(payload); }
export function listarLogs() { return { ok: true, logs: readLogs() }; }

export function listarComandos() {
  return {
    ok: true,
    comandos: Object.entries(comandosConfirmados).map(([nome, valor]) => ({
      nome,
      configurado: Boolean(valor),
      hex: typeof valor === 'string' ? valor : valor?.hex || null,
      respostaEsperada: valor?.respostaEsperada || null,
      confirmadoFisicamente: Boolean(valor?.confirmadoFisicamente)
    }))
  };
}

export async function testarTCP(payload) {
  const driver = new Henry7xDriver(payload);
  const result = await driver.tcpTest();
  addLog({ acao: 'tcp-test', host: payload.host, port: payload.port || 3000, result });
  return result;
}

export async function enviarHex(payload) {
  const driver = new Henry7xDriver(payload);
  const result = await driver.sendHex(payload.hex);
  addLog({ acao: 'send-hex', host: payload.host, port: payload.port || 3000, hex: normalizeHex(payload.hex), result });
  return result;
}

export async function raw(payload) {
  const result = await enviarHex(payload);
  return {
    ok: result.ok,
    tipo: 'raw',
    host: result.host,
    port: result.port,
    sentHex: result.sentHex,
    sentBytes: result.sentBytes,
    receivedHex: result.responseHexRaw,
    receivedHexSpaced: result.responseHex,
    receivedAscii: result.responseAscii,
    receivedLength: result.receivedBytes,
    tempoMs: result.ms
  };
}

export async function liberarCatraca(payload) {
  return executarEmFila(async () => {
    const driver = new Henry7xDriver(payload);
    const result = await driver.liberarCatracaSca({ tempoSegundos: payload.tempoSegundos ?? 5 });
    const registro = {
      acao: 'liberar-catraca',
      host: payload.host,
      port: payload.port || 3000,
      direcao: 'ambos',
      tempoSegundos: 5,
      alunoId: payload.alunoId ?? null,
      alunoNome: payload.alunoNome ?? null,
      operadorId: payload.operadorId ?? null,
      origem: payload.origem ?? 'fusion-erp',
      motivo: payload.motivo ?? null,
      confirmadoFisicamente: true,
      respostasValidas: result.respostasValidas,
      result
    };
    addLog(registro);
    return {
      ...result,
      registro: {
        alunoId: registro.alunoId,
        alunoNome: registro.alunoNome,
        operadorId: registro.operadorId,
        origem: registro.origem,
        motivo: registro.motivo
      }
    };
  });
}

// Compatibilidade com o endpoint de teste anterior.
export const liberarCatracaSca = liberarCatraca;

export async function liberarCatracaDiagnostico(payload) {
  const driver = new Henry7xDriver(payload);
  const result = await driver.liberarCatracaDiagnostico();
  addLog({ acao: 'liberar-catraca-diagnostico', host: payload.host, port: payload.port || 3000, result });
  return result;
}

export function compararPacotes(payload) {
  const result = compararHex(payload.a, payload.b);
  addLog({ acao: 'comparar-hex', result });
  return { ok: true, ...result };
}
