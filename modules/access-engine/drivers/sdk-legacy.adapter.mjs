/*
  Adaptador documental para SDKs legados de catraca.

  Este arquivo NÃO carrega DLL/EXE de terceiros.
  Ele apenas registra o desenho técnico observado em kits antigos para que o
  Fusion Access Engine tenha uma interface limpa e futura para drivers reais.

  Integrações reais devem usar SDK oficial/licenciado de cada fabricante ou API pública.
*/

export const SDK_LEGADO_REFERENCIAS = [
  { fabricante: 'Control iD', referencias: ['scaControliD.exe', 'libcidbio.dll'], tipo: 'sdk_api' },
  { fabricante: 'Henry', referencias: ['scaHenry.exe', 'HenryOn.dll'], tipo: 'sdk_dll' },
  { fabricante: 'TopData', referencias: ['scaTopdata.exe', 'EasyInner.dll', 'InnerTCP.dll'], tipo: 'sdk_tcp' },
  { fabricante: 'Dimep', referencias: ['scaDimep.exe'], tipo: 'sdk' },
  { fabricante: 'Tecnibra', referencias: ['scaTecnibra.exe'], tipo: 'sdk' },
  { fabricante: 'Proveu', referencias: ['scaProveu.exe', 'FMKProveu.dll'], tipo: 'sdk' },
  { fabricante: 'Face/Biometria', referencias: ['scaFace.exe', 'scaBiometria.exe', 'facesdk.dll'], tipo: 'biometria' },
  { fabricante: 'USB/Serial', referencias: ['SiUSBXp.dll', 'MSCOMM32.OCX', 'MSWINSCK.OCX'], tipo: 'usb_serial_tcp' }
];

export function mapaLegado() {
  return SDK_LEGADO_REFERENCIAS.map(item => ({ ...item }));
}

export function criarRespostaNaoImplementado({ fabricante, dispositivo, acao }) {
  return {
    ok: false,
    implementado: false,
    fabricante,
    dispositivoId: dispositivo?.id || null,
    acao,
    mensagem: 'Driver real ainda não implementado. Use simulador ou genérico até obter SDK/API oficial do fabricante.'
  };
}
