import { sincronizarTodosContratosFinanceiro } from '../modules/comercial/comercial.financeiro.service.mjs';

try {
  const resultado = await sincronizarTodosContratosFinanceiro({});
  console.log('Financeiro comercial sincronizado.');
  console.log(`Contratos processados: ${resultado.total}`);
  for (const item of resultado.resultados || []) {
    if (item.ok) {
      console.log(`OK  ${item.contrato?.id || '-'} | ${item.contrato?.aluno || '-'} | R$ ${Number(item.calculo?.total || 0).toFixed(2)}`);
    } else {
      console.log(`ERRO ${item.contratoId || '-'} | ${item.erro}`);
    }
  }
} catch (err) {
  console.error('Erro ao sincronizar financeiro comercial:', err.message);
  process.exitCode = 1;
}
