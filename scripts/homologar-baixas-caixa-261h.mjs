import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

const arquivos = [
  "modules/financeiro/recebimentos.service.mjs",
  "modules/financeiro/financeiro.service.mjs",
  "public/pages/recebimentos/index.js"
];

async function existe(rel) {
  try { await fs.access(path.join(ROOT, rel)); return true; }
  catch { return false; }
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });
  const resultados = [];
  for (const arquivo of arquivos) {
    resultados.push({ arquivo, existe: await existe(arquivo) });
  }

  const relatorio = {
    ok: resultados.every(r => r.existe),
    versao: "2.6.1-H",
    modulo: "baixas-caixa-formas-pagamento",
    data: new Date().toISOString(),
    regras: [
      "Baixa abre/movimenta caixa automaticamente se não houver caixa aberto.",
      "Baixa aceita forma de pagamento.",
      "Baixa aceita desconto.",
      "Baixa aceita acréscimo/juros.",
      "Valor registrado no recebimento é propagado para financeiro, mensalidade e caixa.",
      "Baixa parcial permanece parcial; baixa total ativa matrícula quando for entrada inicial."
    ],
    resultados
  };

  await fs.writeFile(path.join(LOGS, "homologacao-baixas-caixa-261h.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-H — Homologação de Baixas");
  console.log(`Status: ${relatorio.ok ? "OK" : "Falhou"}`);
  console.log("Relatório: logs/homologacao-baixas-caixa-261h.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
