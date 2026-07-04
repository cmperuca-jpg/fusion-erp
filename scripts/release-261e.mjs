import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");
const HOMOLOGACAO_FINAL = path.join(LOG_DIR, "homologacao-final-261e.json");
const FREEZE_FILE = path.join(LOG_DIR, "versao-261-freeze.json");

async function lerJson(arquivo) {
  const bruto = await fs.readFile(arquivo, "utf8");
  return JSON.parse(bruto);
}

async function hashArquivosPrincipais() {
  const arquivos = [
    "package.json",
    "server.mjs",
    "scripts/auditoria-261a.mjs",
    "scripts/performance-261b.mjs",
    "scripts/seguranca-261c.mjs",
    "scripts/interface-261d.mjs",
    "scripts/piloto-261e.mjs",
    "scripts/release-261e.mjs"
  ];

  const hash = crypto.createHash("sha256");
  const encontrados = [];
  const ausentes = [];

  for (const relativo of arquivos) {
    const absoluto = path.join(ROOT, relativo);

    if (!fssync.existsSync(absoluto)) {
      ausentes.push(relativo);
      continue;
    }

    const conteudo = await fs.readFile(absoluto);
    hash.update(relativo);
    hash.update(conteudo);
    encontrados.push(relativo);
  }

  return {
    algoritmo: "sha256",
    valor: hash.digest("hex"),
    arquivosVerificados: encontrados,
    arquivosAusentes: ausentes
  };
}

async function main() {
  await fs.mkdir(LOG_DIR, { recursive: true });

  if (!fssync.existsSync(HOMOLOGACAO_FINAL)) {
    console.error("Homologação final não encontrada. Execute npm run piloto antes de npm run release.");
    process.exit(1);
  }

  const homologacao = await lerJson(HOMOLOGACAO_FINAL);

  if (!homologacao?.ok) {
    console.error("Homologação final não aprovada. Release bloqueada.");
    process.exit(1);
  }

  const hash = await hashArquivosPrincipais();

  const freeze = {
    ok: true,
    versao: "2.6.1",
    release: "2.6.1-E",
    status: "Frozen",
    homologacao: "Aprovada",
    piloto: true,
    desenvolvimento: false,
    proximaVersao: "2.7.0",
    dataFreeze: new Date().toISOString(),
    origem: {
      homologacaoFinal: "logs/homologacao-final-261e.json"
    },
    resumoHomologacao: homologacao.resumo || {},
    hash,
    politica: [
      "A linha 2.6.1 está congelada para operação piloto.",
      "Não incluir novas funcionalidades na linha 2.6.1.",
      "Correções críticas devem ser registradas antes de qualquer nova release de manutenção.",
      "Toda evolução funcional deve seguir na linha 2.7."
    ]
  };

  await fs.writeFile(FREEZE_FILE, JSON.stringify(freeze, null, 2), "utf8");

  console.log("Fusion ERP 2.6.1-E — Release");
  console.log("Status: Frozen");
  console.log("Homologação: Aprovada");
  console.log(`Freeze: ${FREEZE_FILE}`);
}

main().catch((erro) => {
  console.error("Falha na release 2.6.1-E:", erro.message);
  process.exit(1);
});
