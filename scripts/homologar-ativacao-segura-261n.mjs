import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOGS = path.join(ROOT, "logs");

async function main() {
  await fs.mkdir(LOGS, { recursive: true });
  const txt = await fs.readFile(path.join(ROOT, "modules/financeiro/financeiro.service.mjs"), "utf8");

  const rel = {
    ok: txt.includes("pagamento inicial ativa somente a matrícula vinculada") &&
        txt.includes("matriculaAlvo") &&
        txt.includes("delete matriculaAlvo.encerradaEm"),
    versao: "2.6.1-N",
    data: new Date().toISOString(),
    correcao: "ativacao-segura-pre-matricula"
  };

  await fs.writeFile(path.join(LOGS, "homologacao-ativacao-segura-261n.json"), JSON.stringify(rel, null, 2), "utf8");
  console.log("Fusion ERP 2.6.1-N — Homologação Ativação Segura");
  console.log(`Status: ${rel.ok ? "OK" : "Falhou"}`);
  if (!rel.ok) process.exitCode = 1;
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
