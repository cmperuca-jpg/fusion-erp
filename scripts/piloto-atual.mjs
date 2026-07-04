import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const LOGS = path.join(ROOT, "logs");

const obrigatorios = [
  "server.mjs",
  "package.json",
  "modules/alunos/alunos.routes.mjs",
  "modules/matriculas/matricula.integracao.routes.mjs",
  "modules/financeiro/financeiro.routes.mjs",
  "modules/financeiro/caixa.routes.mjs",
  "public/pages/alunos/index.html",
  "public/pages/financeiro/index.html",
  "public/pages/caixa/index.html"
];

const dados = [
  "alunos.json",
  "matriculas.json",
  "financeiro.json",
  "mensalidades.json",
  "recebimentos.json",
  "pagamentos.json",
  "caixa.json",
  "professores.json",
  "planos.json",
  "turmas.json"
];

async function lerJson(file, fallback) {
  try {
    const txt = await fs.readFile(file, "utf8");
    return txt.trim() ? JSON.parse(txt) : fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  await fs.mkdir(LOGS, { recursive: true });

  const arquivos = obrigatorios.map((rel) => ({
    arquivo: rel,
    existe: fssync.existsSync(path.join(ROOT, rel))
  }));

  const bases = [];
  for (const nome of dados) {
    const file = path.join(DATA, nome);
    const existe = fssync.existsSync(file);
    let valido = true;
    let registros = 0;
    if (existe) {
      const json = await lerJson(file, []);
      registros = Array.isArray(json) ? json.length : Object.keys(json || {}).length;
    } else {
      valido = false;
    }
    bases.push({ arquivo: `data/${nome}`, existe, jsonValido: valido, registros });
  }

  const relatorio = {
    ok: arquivos.every(a => a.existe) && bases.every(b => b.existe && b.jsonValido),
    versao: "2.6.1-piloto",
    data: new Date().toISOString(),
    modulo: "piloto_atual",
    arquivos,
    bases,
    recomendacao: "Executar piloto sem novas alterações estruturais. Registrar pendências para Fusion ERP 2.7."
  };

  await fs.writeFile(path.join(LOGS, "piloto-atual.json"), JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP — Validação do Projeto Piloto");
  console.log(`Status: ${relatorio.ok ? "OK" : "Verificar pendências"}`);
  console.log("Relatório: logs/piloto-atual.json");
  if (!relatorio.ok) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("Falha na validação do piloto:", erro.message);
  process.exit(1);
});
