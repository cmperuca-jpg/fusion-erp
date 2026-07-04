import fs from "node:fs/promises";
import path from "node:path";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import treinosMontadorRoutes from "./modules/treinos-montador/treinos-montador.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import treinosIntegradoRoutes from "./modules/treinos-integrado/treinos-integrado.routes.mjs";';
    txt = txt.includes(marker) ? txt.replace(marker, `${marker}\n${importLine}`) : `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/treinos-montador", treinosMontadorRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/treinos-integrado", treinosIntegradoRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else txt = txt.replace("const PORT = process.env.PORT || 3000;", `${useLine}\n\nconst PORT = process.env.PORT || 3000;`);
  }

  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.5-C instalado. Rota ativa: /api/treinos-montador");
}

main().catch((err) => { console.error(err); process.exit(1); });
