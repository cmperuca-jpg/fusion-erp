import fs from 'node:fs/promises';
import path from 'node:path';

const data = path.join(process.cwd(), 'data');
const ler = async (nome) => JSON.parse(await fs.readFile(path.join(data, nome), 'utf8'));
const salvar = async (nome, valor) => fs.writeFile(path.join(data, nome), JSON.stringify(valor, null, 2), 'utf8');
const hoje = new Date().toISOString().slice(0, 10);
const agora = new Date().toISOString();
const futuros = new Set();
const mensalidades = await ler('mensalidades.json');

for (const mensalidade of mensalidades) {
  const vencimento = String(mensalidade.vencimento || mensalidade.dataVencimento || '').slice(0, 10);
  const origem = String(mensalidade.origem || '').toLowerCase();
  const aberta = ['aberta', 'aberto', 'parcial'].includes(String(mensalidade.status || '').toLowerCase());
  if (vencimento > hoje && aberta && (origem.includes('recorrencia') || origem.includes('mensalidade_automatica'))) {
    mensalidade.status = 'Cancelada';
    mensalidade.canceladaEm = agora;
    mensalidade.motivoCancelamento = 'Correção: previsão futura não é dívida; será emitida somente no vencimento.';
    mensalidade.atualizadoEm = agora;
    futuros.add(String(mensalidade.id));
  }
}

const financeiro = await ler('financeiro.json');
for (const titulo of financeiro) {
  const vencimento = String(titulo.vencimento || titulo.dataVencimento || '').slice(0, 10);
  const origem = String(titulo.origem || '').toLowerCase();
  const aberta = ['aberta', 'aberto', 'parcial'].includes(String(titulo.status || '').toLowerCase());
  if (aberta && (futuros.has(String(titulo.mensalidadeId)) || (vencimento > hoje && (origem.includes('recorrencia') || origem.includes('mensalidade_automatica'))))) {
    titulo.status = 'Cancelado';
    titulo.canceladoEm = agora;
    titulo.motivoCancelamento = 'Correção: título futuro aguardará o vencimento programado.';
    titulo.atualizadoEm = agora;
  }
}

await salvar('mensalidades.json', mensalidades);
await salvar('financeiro.json', financeiro);
console.log(`Correção concluída: ${futuros.size} mensalidade(s) futura(s) cancelada(s), preservando auditoria.`);
