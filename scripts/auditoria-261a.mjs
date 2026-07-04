import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const obrigatorios = [
  "server.mjs",
  "package.json",
  "modules/alunos/alunos.routes.mjs",
  "modules/professores/professores.routes.mjs",
  "modules/checkin/checkin.routes.mjs",
  "modules/treinos/treinos.routes.mjs",
  "modules/treinos-operacional/treinos-operacional.routes.mjs",
  "modules/professor-painel/professor-painel.routes.mjs",
  "modules/portal-aluno/portal.routes.mjs",
  "public/pages/checkin/index.html",
  "public/pages/treinos/index.html",
  "public/pages/professor-painel/index.html",
  "public/pages/portal-aluno/index.html"
];

const jsons = [
  "data/alunos.json",
  "data/professores.json",
  "data/matriculas.json",
  "data/financeiro.json",
  "data/mensalidades.json",
  "data/frequencia.json",
  "data/checkins.json",
  "data/checkin.json",
  "data/treinos.json",
  "data/treinos_integrados.json",
  "data/treinos_execucoes.json"
];

function rel(p) { return path.join(ROOT, p); }

async function verificarArquivo(p) {
  const abs = rel(p);
  const existe = fssync.existsSync(abs);
  return { arquivo: p, existe };
}

async function verificarJson(p) {
  const abs = rel(p);
  if (!fssync.existsSync(abs)) return { arquivo: p, existe: false, jsonValido: false, registros: 0 };
  try {
    const txt = await fs.readFile(abs, "utf8");
    const dados = txt.trim() ? JSON.parse(txt) : [];
    return { arquivo: p, existe: true, jsonValido: true, registros: Array.isArray(dados) ? dados.length : Object.keys(dados || {}).length };
  } catch (erro) {
    return { arquivo: p, existe: true, jsonValido: false, erro: erro.message, registros: 0 };
  }
}

async function main() {
  const arquivos = await Promise.all(obrigatorios.map(verificarArquivo));
  const dados = await Promise.all(jsons.map(verificarJson));
  const faltantes = arquivos.filter(a => !a.existe);
  const jsonInvalidos = dados.filter(j => j.existe && !j.jsonValido);
  const jsonAusentes = dados.filter(j => !j.existe && !j.arquivo.endsWith("checkin.json"));

  const relatorio = {
    ok: faltantes.length === 0 && jsonInvalidos.length === 0,
    versao: "2.6.1-A",
    data: new Date().toISOString(),
    resumo: {
      arquivosObrigatorios: arquivos.length,
      arquivosFaltantes: faltantes.length,
      jsonsVerificados: dados.length,
      jsonsAusentes: jsonAusentes.length,
      jsonsInvalidos: jsonInvalidos.length
    },
    arquivos,
    jsons: dados,
    recomendacoes: [
      "Manter checkins.json como arquivo oficial de check-in.",
      "Manter checkin.json apenas como legado, quando existir.",
      "Executar npm run homologacao antes do projeto piloto.",
      "Evitar novas funcionalidades na linha 2.6.1; usar apenas correções e estabilização."
    ]
  };

  const outDir = path.join(ROOT, "logs");
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "auditoria-261a.json");
  await fs.writeFile(out, JSON.stringify(relatorio, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-A — Auditoria Geral");
  console.log(`Arquivos faltantes: ${faltantes.length}`);
  console.log(`JSONs ausentes: ${jsonAusentes.length}`);
  console.log(`JSONs inválidos: ${jsonInvalidos.length}`);
  console.log(`Relatório: ${out}`);

  if (!relatorio.ok) process.exitCode = 1;
}

main().catch((erro) => {
  console.error("Falha na auditoria:", erro);
  process.exit(1);
});
