import fs from "node:fs/promises";
import path from "node:path";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import frequenciaRoutes from "./modules/frequencia/frequencia.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import presencasRoutes from "./modules/presencas/presencas.routes.mjs";';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${importLine}`);
    else txt = `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/frequencia", frequenciaRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/presencas", presencasRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else {
      const portMarker = "const PORT = process.env.PORT || 3000;";
      txt = txt.replace(portMarker, `${useLine}\n\n${portMarker}`);
    }
  }

  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.2-C instalado. Rota ativa: /api/frequencia");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
