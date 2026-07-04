import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

async function main() {
  await fs.mkdir(LOGS, { recursive: true });
  const fin = await fs.readFile(path.join(ROOT, "modules/financeiro/financeiro.service.mjs"), "utf8");

  const relatorio = {
    ok: fin.includes("statusFinanceiroInicial = \\"Pago\\"") &&
        fin.includes("matricula.status = \\"Ativa\\"") &&
        fin.includes("aluno.status = \\"ativo\\""),
    versao: "2.6.1-L",
    data: new Date().toISOString(),
    correcao: "ativacao-sincronizada-pos-pagamento"
  };

  await fs.writeFile(path.join(LOGS, "homologacao-ativacao-sincronizada-261l.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-L — Homologação Ativação Sincronizada");
  console.log(`Status: ${relatorio.ok ? "OK" : "Falhou"}`);
  console.log("Relatório: logs/homologacao-ativacao-sincronizada-261l.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
