import fs from "node:fs/promises";
import path from "node:path";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import treinosCicloRoutes from "./modules/treinos-ciclo/treinos-ciclo.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import treinosOperacionalRoutes from "./modules/treinos-operacional/treinos-operacional.routes.mjs";';
    txt = txt.includes(marker) ? txt.replace(marker, `${marker}\n${importLine}`) : `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/treinos-ciclo", treinosCicloRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/treinos-operacional", treinosOperacionalRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else txt = txt.replace("const PORT = process.env.PORT || 3000;", `${useLine}\n\nconst PORT = process.env.PORT || 3000;`);
  }

  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.5-F instalado. Rota ativa: /api/treinos-ciclo");
}

main().catch((err) => { console.error(err); process.exit(1); });
