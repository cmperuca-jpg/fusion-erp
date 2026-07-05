import fs from "fs";
import path from "path";

const raiz = process.cwd();
const obrigatorios = ["server.mjs", "package.json", "render.yaml", "public"];
const faltantes = obrigatorios.filter((item) => !fs.existsSync(path.join(raiz, item)));

const avisos = [];
const renderYaml = fs.existsSync(path.join(raiz, "render.yaml"))
  ? fs.readFileSync(path.join(raiz, "render.yaml"), "utf8")
  : "";

if (!renderYaml.includes("healthCheckPath: /api/health")) avisos.push("render.yaml sem healthCheckPath /api/health.");
if (!renderYaml.includes("mountPath: /var/data")) avisos.push("render.yaml sem disco persistente em /var/data.");

for (const pasta of ["data", "uploads"]) {
  const alvo = path.join(raiz, pasta);
  if (!fs.existsSync(alvo)) fs.mkdirSync(alvo, { recursive: true });
}

if (faltantes.length) {
  console.error(JSON.stringify({ ok: false, faltantes, avisos }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  modulo: "render-smoke-test",
  mensagem: "Arquivos mínimos para Render encontrados.",
  avisos
}, null, 2));
