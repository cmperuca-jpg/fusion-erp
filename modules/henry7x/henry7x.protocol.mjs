import net from 'node:net';

export function normalizeHex(hex) {
  return String(hex || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

export function hexToBuffer(hex) {
  const clean = normalizeHex(hex);
  if (!clean || clean.length % 2 !== 0) throw new Error('HEX inválido');
  return Buffer.from(clean, 'hex');
}

export function bufferToHex(buffer, spaced = true) {
  const hex = Buffer.from(buffer || []).toString('hex').toUpperCase();
  if (!spaced) return hex;
  return hex.match(/.{1,2}/g)?.join(' ') || '';
}

export function asciiPreview(buffer) {
  return Buffer.from(buffer || []).toString('latin1').replace(/[\x00-\x1F\x7F-\xFF]/g, '.');
}

export function splitHexBytes(hex) {
  return normalizeHex(hex).match(/.{1,2}/g) || [];
}

export function compararHex(a, b) {
  const aa = splitHexBytes(a);
  const bb = splitHexBytes(b);
  const max = Math.max(aa.length, bb.length);
  const diferencas = [];
  for (let i = 0; i < max; i++) {
    if ((aa[i] || null) !== (bb[i] || null)) {
      diferencas.push({ posicao: i, a: aa[i] || null, b: bb[i] || null });
    }
  }
  return { aBytes: aa.length, bBytes: bb.length, iguais: diferencas.length === 0, diferencas };
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, Number(ms) || 0));
}

export function tcpRequest({ host, port, payload, timeoutMs = 5000, closeAfterMs = 300 }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const chunks = [];
    const startedAt = Date.now();
    let finished = false;
    let connectedAt = null;

    const finish = (err, result = {}) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (err) return reject(err);
      resolve(result);
    };

    socket.setTimeout(Number(timeoutMs));
    socket.once('timeout', () => finish(new Error(`Timeout após ${timeoutMs}ms`)));
    socket.once('error', (err) => finish(err));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.once('close', () => {
      if (finished) return;
      const response = Buffer.concat(chunks);
      finish(null, {
        connected: Boolean(connectedAt),
        connectedAt,
        closedAt: new Date().toISOString(),
        ms: Date.now() - startedAt,
        sentBytes: payload?.length || 0,
        receivedBytes: response.length,
        response,
        responseHex: bufferToHex(response),
        responseHexRaw: bufferToHex(response, false),
        responseAscii: asciiPreview(response)
      });
    });

    socket.connect(Number(port), host, () => {
      connectedAt = new Date().toISOString();
      if (payload?.length) socket.write(payload);
      setTimeout(() => socket.end(), Number(closeAfterMs));
    });
  });
}

/**
 * Mantém uma única conexão TCP e envia vários pacotes em sequência.
 * Cada etapa espera um período de silêncio após a última resposta antes de seguir.
 */
export function tcpSequence({
  host,
  port,
  steps = [],
  timeoutMs = 5000,
  responseQuietMs = 120,
  finalWaitMs = 250
}) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const startedAt = Date.now();
    const respostas = [];
    let finished = false;
    let currentChunks = [];
    let connectedAt = null;
    let quietTimer = null;

    const finish = (err, result = {}) => {
      if (finished) return;
      finished = true;
      if (quietTimer) clearTimeout(quietTimer);
      socket.destroy();
      if (err) return reject(err);
      resolve(result);
    };

    const collectCurrent = () => {
      const response = Buffer.concat(currentChunks);
      currentChunks = [];
      return {
        receivedBytes: response.length,
        responseHex: bufferToHex(response),
        responseHexRaw: bufferToHex(response, false),
        responseAscii: asciiPreview(response)
      };
    };

    const aguardarResposta = (quietMs) => new Promise((resolveStep, rejectStep) => {
      let settled = false;
      const onData = (chunk) => {
        currentChunks.push(chunk);
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.off('data', onData);
          resolveStep(collectCurrent());
        }, quietMs);
      };

      socket.on('data', onData);
      quietTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.off('data', onData);
        resolveStep(collectCurrent());
      }, quietMs);

      socket.once('error', rejectStep);
    });

    socket.setTimeout(Number(timeoutMs));
    socket.once('timeout', () => finish(new Error(`Timeout após ${timeoutMs}ms`)));
    socket.once('error', (err) => finish(err));

    socket.connect(Number(port), host, async () => {
      connectedAt = new Date().toISOString();
      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i] || {};
          const payload = hexToBuffer(step.hex);
          socket.write(payload);
          const resposta = await aguardarResposta(Number(step.responseQuietMs || responseQuietMs));
          respostas.push({
            indice: i + 1,
            nome: step.nome || `etapa-${i + 1}`,
            sentHex: normalizeHex(step.hex),
            sentBytes: payload.length,
            ...resposta
          });
          if (step.delayAfterMs) await esperar(step.delayAfterMs);
        }

        await esperar(finalWaitMs);
        socket.end();
        finish(null, {
          ok: true,
          connected: true,
          connectedAt,
          closedAt: new Date().toISOString(),
          host,
          port: Number(port),
          ms: Date.now() - startedAt,
          etapas: respostas
        });
      } catch (error) {
        finish(error);
      }
    });
  });
}
