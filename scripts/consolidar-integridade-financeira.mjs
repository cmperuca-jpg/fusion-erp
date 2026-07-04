import { spawnSync } from "child_process";
import path from "path";

const scripts = [
  "corrigir-alunos-excluidos-orfaos.mjs",
  "corrigir-nomes-mensalidades-financeiro.mjs",
  "auditoria-integridade-financeira.mjs"
];

for (const script of scripts) {
  console.log(`\n=== Executando ${script} ===`);
  const r = spawnSync(process.execPath, [path.join("scripts", script)], { stdio: "inherit", shell: false });
  if (r.status !== 0) {
    console.error(`Falha ao executar ${script}.`);
    process.exit(r.status || 1);
  }
}

console.log("\nConsolidação de integridade concluída.");
