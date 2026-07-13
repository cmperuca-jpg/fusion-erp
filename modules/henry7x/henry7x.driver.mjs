import { hexToBuffer, normalizeHex, tcpRequest, tcpSequence } from './henry7x.protocol.mjs';
import { comandosConfirmados } from './henry7x.commands.mjs';

const COMANDO_8A_AMBOS = 'FE8A7100010100050000';
const COMANDO_86_5S_AMBOS = 'FE8671000201000A030506';
const RESPOSTA_8A = '018A7100010000FB';
const RESPOSTA_86 = '01867100020000F4';

export class Henry7xDriver {
  constructor({ host, port = 3000, timeoutMs = 5000, closeAfterMs = 300 }) {
    if (!host) throw new Error('host é obrigatório');
    this.host = host;
    this.port = Number(port);
    this.timeoutMs = Number(timeoutMs);
    this.closeAfterMs = Number(closeAfterMs);
  }

  async tcpTest() {
    const startedAt = Date.now();
    try {
      const result = await tcpRequest({ host: this.host, port: this.port, timeoutMs: this.timeoutMs, closeAfterMs: this.closeAfterMs });
      return { ok: true, tipo: 'tcp-test', host: this.host, port: this.port, ms: Date.now() - startedAt, ...result, response: undefined };
    } catch (error) {
      return { ok: false, tipo: 'tcp-test', host: this.host, port: this.port, ms: Date.now() - startedAt, error: error.message };
    }
  }

  async sendHex(hex) {
    const payload = hexToBuffer(hex);
    const result = await tcpRequest({ host: this.host, port: this.port, payload, timeoutMs: this.timeoutMs, closeAfterMs: this.closeAfterMs });
    return {
      ok: true,
      tipo: 'send-hex',
      host: this.host,
      port: this.port,
      sentHex: normalizeHex(hex),
      sentBytes: payload.length,
      receivedBytes: result.receivedBytes,
      responseHex: result.responseHex,
      responseHexRaw: result.responseHexRaw,
      responseAscii: result.responseAscii,
      ms: result.ms
    };
  }

  async sendSequence(steps) {
    return tcpSequence({
      host: this.host,
      port: this.port,
      timeoutMs: this.timeoutMs,
      steps
    });
  }

  /**
   * Reproduz exatamente a sequência curta observada no SCA:
   * 8A -> resposta -> 86 -> resposta, sem fechar a conexão entre os pacotes.
   */
  async liberarCatracaSca({ tempoSegundos = 5 } = {}) {
    const tempo = Number(tempoSegundos);
    if (tempo !== 5) {
      throw new Error('Neste pacote de teste o protocolo confirmado é somente 5 segundos. Não use outro valor ainda.');
    }

    const result = await this.sendSequence([
      {
        nome: 'habilitar-operacao-8A',
        hex: COMANDO_8A_AMBOS,
        responseQuietMs: 130,
        delayAfterMs: 350
      },
      {
        nome: 'liberar-ambos-5s-86',
        hex: COMANDO_86_5S_AMBOS,
        responseQuietMs: 180,
        delayAfterMs: 50
      }
    ]);

    return {
      ...result,
      tipo: 'liberar-catraca-sca',
      direcao: 'ambos',
      tempoSegundos: 5,
      confirmadoFisicamente: true,
      respostasValidas:
        normalizeHex(result.etapas?.[0]?.responseHexRaw) === RESPOSTA_8A &&
        normalizeHex(result.etapas?.[1]?.responseHexRaw) === RESPOSTA_86,
      aviso: 'Sequência confirmada fisicamente em três liberações consecutivas na Henry 7X.'
    };
  }

  async liberarCatracaDiagnostico() {
    const comando = comandosConfirmados.liberarCatracaDiagnostico;
    const result = await this.sendHex(comando.hex);
    const respostaNormalizada = normalizeHex(result.responseHexRaw || result.responseHex);
    const esperado = normalizeHex(comando.respostaEsperada);
    return {
      ...result,
      tipo: 'liberar-catraca-diagnostico',
      comando: comando.hex,
      respostaEsperada: esperado,
      respostaConfere: respostaNormalizada === esperado,
      aviso: 'Comando em modo diagnóstico. Validar fisicamente antes de marcar como definitivo.'
    };
  }
}
