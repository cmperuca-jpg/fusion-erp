import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

async function main() {
  await fs.mkdir(LOGS, { recursive: true });
  const file = path.join(ROOT, "public/pages/alunos/index.js");
  const txt = await fs.readFile(file, "utf8");

  const relatorio = {
    ok: txt.includes("statusMatricula") &&
        txt.includes("abrirFluxoMatriculaAluno") &&
        txt.includes("pre-matriculado"),
    versao: "2.6.1-M",
    data: new Date().toISOString(),
    correcao: "status-visual-alunos-e-bloqueio-matricula-duplicada-na-interface"
  };

  await fs.writeFile(path.join(LOGS, "homologacao-alunos-status-visual-261m.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-M — Status Visual de Alunos");
  console.log(`Status: ${relatorio.ok ? "OK" : "Falhou"}`);
  console.log("Relatório: logs/homologacao-alunos-status-visual-261m.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
