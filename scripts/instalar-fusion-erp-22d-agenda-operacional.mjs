import fs from "node:fs/promises";
import path from "node:path";

const SERVER = path.resolve(process.cwd(), "server.mjs");

async function main() {
  let txt = await fs.readFile(SERVER, "utf8");

  const importLine = 'import agendaOperacionalRoutes from "./modules/agenda-operacional/agenda-operacional.routes.mjs";';
  if (!txt.includes(importLine)) {
    const marker = 'import agendaRoutes from "./modules/agenda/agenda.routes.mjs";';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${importLine}`);
    else txt = `${importLine}\n${txt}`;
  }

  const useLine = 'app.use("/api/agenda-operacional", agendaOperacionalRoutes);';
  if (!txt.includes(useLine)) {
    const marker = 'app.use("/api/agenda", agendaRoutes);';
    if (txt.includes(marker)) txt = txt.replace(marker, `${marker}\n${useLine}`);
    else {
      const portMarker = "const PORT = process.env.PORT || 3000;";
      txt = txt.replace(portMarker, `${useLine}\n\n${portMarker}`);
    }
  }

  await fs.writeFile(SERVER, txt, "utf8");
  console.log("Fusion ERP 2.2-D instalado. Rota ativa: /api/agenda-operacional");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
