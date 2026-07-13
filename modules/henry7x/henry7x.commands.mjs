// Comandos confirmados/observados por PCAP.
// Não marque como definitivo sem comparar mais de uma captura.
export const comandosConfirmados = {
  liberarEntrada: null,
  liberarSaida: null,
  piscarLed: null,
  receber: null,
  enviar: null,

  // Capturado no PCAP de liberar catraca em 09/07/2026.
  // Requisição TCP payload: FE 8A 71 00 01 01 00 05 00 00
  // Resposta observada:       01 8A 71 00 01 00 00 FB
  // Status: diagnóstico. Ainda precisa confirmar se é comando final ou etapa de sessão.
  liberarCatracaDiagnostico: {
    hex: 'FE8A7100010100050000',
    respostaEsperada: '018A7100010000FB',
    bytesEnvio: 10,
    bytesResposta: 8,
    origem: 'pcap liberar catraca',
    confirmadoFisicamente: false
  }
};
