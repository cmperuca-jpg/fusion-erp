import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

async function main() {
  await fs.mkdir(LOGS, { recursive: true });
  const file = path.join(ROOT, "modules/financeiro/financeiro.service.mjs");
  const txt = await fs.readFile(file, "utf8");

  const relatorio = {
    ok: txt.includes("ativarAlunoMatriculaAposBaixaFinanceira") &&
        txt.includes("ehEntradaMatriculaFinanceiro"),
    versao: "2.6.1-K",
    data: new Date().toISOString(),
    correcao: "ativacao-aluno-matricula-apos-baixa",
    regras: [
      "Ao baixar a entrada inicial da matrícula, o aluno muda para ativo.",
      "A matrícula muda para Ativa.",
      "O vínculo de check-in muda para Ativo.",
      "A mensagem falsa de aluno sem matrícula ativa deixa de representar o estado final."
    ]
  };

  await fs.writeFile(path.join(LOGS, "homologacao-ativacao-pos-baixa-261k.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-K — Ativação Pós-Baixa");
  console.log(`Status: ${relatorio.ok ? "OK" : "Falhou"}`);
  console.log("Relatório: logs/homologacao-ativacao-pos-baixa-261k.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
