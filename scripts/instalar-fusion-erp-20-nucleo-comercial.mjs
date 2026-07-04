import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "server.mjs");

function inserirDepois(texto, marcador, insercao) {
  if (texto.includes(insercao.trim())) return texto;
  const idx = texto.indexOf(marcador);
  if (idx < 0) return texto;
  const pos = idx + marcador.length;
  return texto.slice(0, pos) + "\n" + insercao + texto.slice(pos);
}

async function main() {
  let server = await fs.readFile(SERVER, "utf8");
  const importLinha = 'import comercialRoutes from "./modules/comercial/comercial.routes.mjs";';
  if (!server.includes(importLinha)) {
    const marcadorImport = 'import presencasRoutes from "./modules/presencas/presencas.routes.mjs";';
    server = inserirDepois(server, marcadorImport, importLinha);
  }
  const useLinha = 'app.use("/api/comercial", comercialRoutes);';
  if (!server.includes(useLinha)) {
    const marcadorUse = 'app.use("/api/presencas", presencasRoutes);';
    server = inserirDepois(server, marcadorUse, useLinha);
  }
  await fs.writeFile(SERVER, server, "utf8");
  console.log("Fusion ERP 2.0 Núcleo Comercial instalado no server.mjs.");
  console.log("Rota nova: /api/comercial/status");
}

main().catch((erro) => {
  console.error("Erro ao instalar núcleo comercial:", erro.message);
  process.exit(1);
});
