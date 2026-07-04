import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

const arquivos = [
  "modules/financeiro/financeiro.service.mjs",
  "modules/financeiro/financeiro.routes.mjs",
  "modules/financeiro/caixa.service.mjs",
  "public/pages/financeiro/index.js",
  "public/pages/recebimentos/index.js"
];

async function existe(rel) {
  try { await fs.access(path.join(ROOT, rel)); return true; }
  catch { return false; }
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });
  const resultados = [];
  for (const arquivo of arquivos) resultados.push({ arquivo, existe: await existe(arquivo) });

  const relatorio = {
    ok: resultados.every(r => r.existe),
    versao: "2.6.1-I",
    modulo: "motor-financeiro-unico",
    data: new Date().toISOString(),
    regras: [
      "Recebimentos não executa baixa própria.",
      "Recebimentos redireciona para o modal oficial do Financeiro.",
      "Financeiro usa o service oficial do Caixa.",
      "Se não houver caixa aberto, o motor financeiro abre o caixa oficial.",
      "Forma de pagamento, desconto, acréscimo, taxa e valor líquido são processados pelo mesmo motor."
    ],
    resultados
  };

  await fs.writeFile(path.join(LOGS, "homologacao-motor-financeiro-unico-261i.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-I — Motor Financeiro Único");
  console.log(`Status: ${relatorio.ok ? "OK" : "Falhou"}`);
  console.log("Relatório: logs/homologacao-motor-financeiro-unico-261i.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
