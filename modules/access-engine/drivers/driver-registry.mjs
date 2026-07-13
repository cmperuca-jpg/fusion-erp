const DRIVERS = [
  { id: 'simulador', nome: 'Simulador Fusion', fabricante: 'Fusion', tipo: 'simulador', status: 'operacional', protocolo: 'interno', observacao: 'Usado para testes sem equipamento físico.' },
  { id: 'generic', nome: 'Genérico HTTP/TCP', fabricante: 'Genérico', tipo: 'generic', status: 'operacional', protocolo: 'http_tcp', observacao: 'Base para integrações por API, webhook, TCP/IP ou middleware local.' },
  { id: 'controlid', nome: 'Control iD', fabricante: 'Control iD', tipo: 'sdk_api', status: 'planejado', protocolo: 'api_sdk', observacao: 'Preparado para driver dedicado quando houver SDK/API oficial do equipamento.' },
  { id: 'henry7x', nome: 'Henry 7x - Ponte HTTP', fabricante: 'Henry', tipo: 'ponte_http', status: 'operacional', protocolo: 'http_bridge_tcp_sdk', observacao: 'Modo teste para Henry 7x. Recebe eventos por HTTP e devolve comando liberar/bloquear para uma ponte local.' },
  { id: 'henry', nome: 'Henry', fabricante: 'Henry', tipo: 'sdk_tcp', status: 'planejado', protocolo: 'dll_tcp_serial', observacao: 'Material legado indica uso de HenryOn.dll/scaHenry; integração real deve usar SDK oficial/licenciado.' },
  { id: 'topdata', nome: 'TopData', fabricante: 'TopData', tipo: 'sdk_tcp', status: 'planejado', protocolo: 'dll_tcp', observacao: 'Material legado indica uso de EasyInner/InnerTCP/scaTopdata; integração real deve usar SDK oficial/licenciado.' },
  { id: 'dimep', nome: 'Dimep', fabricante: 'Dimep', tipo: 'sdk', status: 'planejado', protocolo: 'sdk', observacao: 'Previsto para driver dedicado.' },
  { id: 'tecnibra', nome: 'Tecnibra', fabricante: 'Tecnibra', tipo: 'sdk', status: 'planejado', protocolo: 'sdk', observacao: 'Previsto para driver dedicado.' },
  { id: 'proveu', nome: 'Proveu', fabricante: 'Proveu', tipo: 'sdk', status: 'planejado', protocolo: 'sdk', observacao: 'Previsto para driver dedicado.' },
  { id: 'face', nome: 'Reconhecimento Facial', fabricante: 'Genérico Face', tipo: 'biometria_face', status: 'planejado', protocolo: 'api_sdk', observacao: 'Camada futura para facial, QR Code, biometria e credenciais móveis.' }
];

export function listarDrivers() {
  return DRIVERS.map(d => ({ ...d }));
}

export function obterDriver(id = 'simulador') {
  return DRIVERS.find(d => d.id === String(id || '').toLowerCase()) || DRIVERS[0];
}

export function driverAtivo(id = 'simulador') {
  const driver = obterDriver(id);
  return ['operacional', 'ativo'].includes(driver.status);
}
