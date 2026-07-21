import { garantirEstruturaFinanceira, migrarFinanceiroLegado, verificarIntegridadeFinanceira } from "../modules/financeiro/financeiro-ledger.service.mjs";

const aplicar = process.argv.includes("--apply");

try {
  await garantirEstruturaFinanceira();
  const migracao = await migrarFinanceiroLegado({ aplicar, usuario: "script-migracao" });
  const integridade = aplicar ? await verificarIntegridadeFinanceira() : null;
  console.log(JSON.stringify({ migracao, integridade }, null, 2));
  if (!aplicar) console.log("Simulação concluída. Execute novamente com --apply para consolidar os arquivos.");
  if (integridade && !integridade.ok) process.exitCode = 2;
} catch (erro) {
  console.error(erro?.stack || erro?.message || String(erro));
  process.exitCode = 1;
}
