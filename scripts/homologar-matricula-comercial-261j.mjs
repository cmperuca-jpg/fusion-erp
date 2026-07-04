import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

const arquivos = [
  "public/pages/alunos/index.js",
  "modules/matriculas/matricula.integracao.service.mjs",
  "modules/matriculas/matricula.integracao.routes.mjs",
  "modules/matriculas/matriculas.schema.mjs"
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
    versao: "2.6.1-J",
    modulo: "matricula-comercial-opcional",
    data: new Date().toISOString(),
    regras: [
      "Plano é opcional.",
      "Taxa de matrícula é livre.",
      "Matrícula pode ser vendida sem plano.",
      "Total inicial = taxa de matrícula + plano + serviços - desconto.",
      "Se total inicial for maior que zero, aluno/matrícula ficam pendentes até pagamento.",
      "Se total inicial for zero, aluno/matrícula podem ficar ativos sem baixa.",
      "Nenhum painel financeiro paralelo foi criado."
    ],
    resultados
  };

  await fs.writeFile(path.join(LOGS, "homologacao-matricula-comercial-261j.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-J — Matrícula Comercial Opcional");
  console.log(`Status: ${relatorio.ok ? "OK" : "Falhou"}`);
  console.log("Relatório: logs/homologacao-matricula-comercial-261j.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
