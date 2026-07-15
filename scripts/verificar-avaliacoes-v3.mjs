import fs from "node:fs/promises";
import path from "node:path";
const raiz = process.cwd();
const ler = (arquivo) => fs.readFile(path.join(raiz, arquivo), "utf8");
const existe = async (arquivo) => fs.access(path.join(raiz, arquivo)).then(() => true).catch(() => false);
const obrigatorios = [
  "modules/avaliacoes/avaliacoes.routes.mjs",
  "modules/avaliacoes/avaliacoes.service.mjs",
  "modules/avaliacoes/avaliacoes.repository.mjs",
  "modules/avaliacoes/avaliacoes.schema.mjs",
  "modules/avaliacoes/engine/evaluation.engine.mjs",
  "modules/avaliacoes/importacao/importador-avaliacoes.service.mjs",
  "public/pages/avaliacoes/index.html",
  "public/pages/aluno-avaliacao/index.html",
  "public/pages/importador-avaliacoes/index.html"
];
const missing = [];
for (const arquivo of obrigatorios) if (!(await existe(arquivo))) missing.push(arquivo);
const rotaImportador = await ler("modules/importador-access/importador-access.routes.mjs");
const repositorio = await ler("modules/avaliacoes/avaliacoes.repository.mjs");
const packageJson = JSON.parse(await ler("package.json"));
const checks = {
  requiredFiles: missing.length === 0,
  canonicalImporter: rotaImportador.includes('../avaliacoes/importacao/importador-avaliacoes.service.mjs'),
  oldImporterRemoved: !(await existe("modules/importador-access/importador-avaliacoes.service.mjs")),
  repositoryProtectsId: repositorio.includes('id: atual.id') && repositorio.includes('_idIgnorado'),
  repositoryProtectsCreatedAt: repositorio.includes('_criadoEmIgnorado') && repositorio.includes('criado_em: atual.criado_em'),
  repositoryAtomicWrite: repositorio.includes('.tmp-${process.pid}-${Date.now()}') && repositorio.includes('fs.rename'),
  scriptRegistered: Boolean(packageJson.scripts?.["v3:avaliacoes:check"])
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([nome]) => nome);
const resultado = { ok: missing.length === 0 && failed.length === 0, version: packageJson.version, canonicalModule: "modules/avaliacoes", importer: "modules/avaliacoes/importacao/importador-avaliacoes.service.mjs", checks, missing, failed };
console.log(JSON.stringify(resultado, null, 2));
if (!resultado.ok) process.exit(1);
